const assert = require('node:assert/strict');
const path = require('node:path');
const { generateKeyPair, exportJWK, SignJWT } = require('jose');
const { OidcAccessTokenVerifier } = require(
  path.join(process.argv[2], 'oidc-access-token-verifier.js'),
);
const { OidcResourceServerModule } = require(
  path.join(process.argv[2], 'oidc-resource-server.module.js'),
);

async function run() {
  const key = await generateKeyPair('RS256');
  const wrongKey = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(key.publicKey)), kid: 'trusted', alg: 'RS256', use: 'sig' };
  const config = {
    issuer: 'https://issuer.example',
    jwksUri: 'https://issuer.example/keys',
    audiences: ['resource-project'],
    authorizedClients: ['ops-client'],
    algorithms: ['RS256'],
    clockToleranceSeconds: 0,
  };
  let requests = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), config.jwksUri);
    requests++;
    return new Response(JSON.stringify({ keys: [jwk] }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  let cases = 0;
  try {
    const verifier = new OidcAccessTokenVerifier(config);
    const now = Math.floor(Date.now() / 1000);
    const base = {
      sub: 'synthetic-human',
      iss: config.issuer,
      aud: ['resource-project'],
      azp: 'ops-client',
      iat: now,
      exp: now + 300,
      nbf: now - 1,
    };
    const sign = (claims, signingKey = key.privateKey, alg = 'RS256') =>
      new SignJWT(claims).setProtectedHeader({ alg, kid: 'trusted' }).sign(signingKey);
    assert.equal((await verifier.verify(await sign(base))).sub, base.sub);
    cases++;
    const patches = [
      { iss: 'https://wrong.example' },
      { aud: 'browser-client' },
      { azp: 'sibling-client' },
      { sub: '' },
      { sub: '   ' },
      { sub: null },
      { exp: now - 10 },
      { iat: now + 90 },
      { iat: -1 },
      { exp: now - 10, iat: now },
      { nbf: now + 90 },
      { exp: 'tomorrow' },
      { iat: 'yesterday' },
      { nbf: 'later' },
      { azp: ['ops-client'] },
    ];
    for (const patch of patches) {
      await assert.rejects(verifier.verify(await sign({ ...base, ...patch })));
      cases++;
    }
    for (const field of ['sub', 'iat', 'exp', 'azp']) {
      const claims = { ...base };
      delete claims[field];
      await assert.rejects(verifier.verify(await sign(claims)));
      cases++;
    }
    await assert.rejects(verifier.verify(await sign(base, wrongKey.privateKey)));
    cases++;
    await assert.rejects(verifier.verify(await sign(base, new Uint8Array(32), 'HS256')));
    cases++;
    await assert.rejects(verifier.verify('not-a-jwt'));
    cases++;
    const jwt = await sign(base);
    await assert.rejects(verifier.verify(jwt.slice(0, -12) + 'AAAAAAAAAAAA'));
    cases++;
    const none =
      Buffer.from(JSON.stringify({ alg: 'none' })).toString('base64url') +
      '.' +
      Buffer.from(JSON.stringify(base)).toString('base64url') +
      '.';
    await assert.rejects(verifier.verify(none));
    cases++;
    // Typical ID-token audience must fail. Overlapping issuer token profiles require owner validation.
    await assert.rejects(
      verifier.verify(await sign({ ...base, aud: 'ops-client', nonce: 'id-session' })),
    );
    cases++;
    for (const patch of [
      { issuer: 'http://issuer.example' },
      { jwksUri: 'http://issuer.example/keys' },
      { audiences: [] },
      { authorizedClients: [] },
      { algorithms: ['HS256'] },
      { algorithms: ['none'] },
      { clockToleranceSeconds: 61 },
      { clockToleranceSeconds: NaN },
    ]) {
      assert.throws(() => new OidcAccessTokenVerifier({ ...config, ...patch }));
      cases++;
    }
    const mutable = {
      ...config,
      audiences: ['resource-project'],
      authorizedClients: ['ops-client'],
      algorithms: ['RS256'],
    };
    const frozen = new OidcAccessTokenVerifier(mutable);
    mutable.authorizedClients.push('sibling-client');
    await assert.rejects(frozen.verify(await sign({ ...base, azp: 'sibling-client' })));
    cases++;
    const module = OidcResourceServerModule.register(config);
    assert.ok(module.exports.includes(OidcAccessTokenVerifier));
    cases++;
    const offline = new OidcAccessTokenVerifier(config);
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    await assert.rejects(offline.verify(jwt));
    cases++;
    assert.ok(requests > 0);
    console.log('crypto cases passed: ' + cases);
  } finally {
    globalThis.fetch = originalFetch;
  }
}
run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
