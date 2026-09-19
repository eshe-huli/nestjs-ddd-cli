const assert = require('node:assert/strict');
const { constants, generateKeyPairSync, sign: signPayload } = require('node:crypto');
const path = require('node:path');
const { OIDC_RESOURCE_SERVER_OPTIONS, OidcAccessTokenVerifier } = require(
  path.join(process.argv[2], 'oidc-access-token-verifier.js'),
);
const { OidcResourceServerModule } = require(
  path.join(process.argv[2], 'oidc-resource-server.module.js'),
);

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signedToken(claims, privateKey, header = { alg: 'RS256', kid: 'trusted' }) {
  const encodedHeader = encode(header);
  const encodedPayload = encode(claims);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signPayload('RSA-SHA256', Buffer.from(signingInput, 'ascii'), {
    key: privateKey,
    padding: constants.RSA_PKCS1_PADDING,
  });
  return `${signingInput}.${signature.toString('base64url')}`;
}

async function rejectsWithoutLeak(verifier, token) {
  await assert.rejects(verifier.verify(token), (error) => {
    assert.equal(error.message, 'Invalid resource access token');
    assert.equal(error.message.includes(token), false);
    assert.equal(error.message.includes('synthetic-human'), false);
    return true;
  });
}

async function run() {
  const trusted = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const wrong = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const rotated = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const tiny = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const publicJwk = (keyPair, kid) => ({
    ...keyPair.publicKey.export({ format: 'jwk' }),
    kid,
    alg: 'RS256',
    use: 'sig',
    key_ops: ['verify'],
  });
  const config = {
    issuer: 'https://issuer.example',
    jwksUri: 'https://issuer.example/keys',
    audiences: ['resource-project'],
    authorizedClients: ['ops-client'],
    clockToleranceSeconds: 0,
    jwksRefreshCooldownSeconds: 1,
  };
  let publishedKeys = [publicJwk(trusted, 'trusted')];
  let requests = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), config.jwksUri);
    assert.equal(init.redirect, 'error');
    requests++;
    return new Response(JSON.stringify({ keys: publishedKeys }), {
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
    const token = signedToken(base, trusted.privateKey);
    assert.equal((await verifier.verify(token)).sub, base.sub);
    assert.equal((await verifier.verify(token)).sub, base.sub);
    assert.equal(requests, 1, 'known kid should reuse the JWKS cache');
    cases += 2;

    for (const patch of [
      { iss: 'https://wrong.example' },
      { aud: 'browser-client' },
      { aud: ['resource-project', 1] },
      { azp: 'sibling-client' },
      { sub: '' },
      { sub: '   ' },
      { sub: null },
      { exp: now - 10 },
      { iat: now + 90 },
      { iat: -1 },
      { exp: now, iat: now },
      { nbf: now + 90 },
      { exp: 'tomorrow' },
      { iat: 'yesterday' },
      { nbf: 'later' },
      { azp: ['ops-client'] },
      // Typical ID-token substitute: browser-client audience, not API resource audience.
      { aud: 'ops-client', nonce: 'browser-session' },
    ]) {
      await rejectsWithoutLeak(verifier, signedToken({ ...base, ...patch }, trusted.privateKey));
      cases++;
    }
    for (const field of ['sub', 'iss', 'aud', 'iat', 'exp', 'azp']) {
      const claims = { ...base };
      delete claims[field];
      await rejectsWithoutLeak(verifier, signedToken(claims, trusted.privateKey));
      cases++;
    }
    await rejectsWithoutLeak(verifier, signedToken(base, wrong.privateKey));
    cases++;
    await rejectsWithoutLeak(
      verifier,
      signedToken(base, trusted.privateKey, { alg: 'HS256', kid: 'trusted' }),
    );
    cases++;
    await rejectsWithoutLeak(verifier, 'not-a-jwt');
    cases++;
    await rejectsWithoutLeak(verifier, token.slice(0, -12) + 'AAAAAAAAAAAA');
    cases++;
    await rejectsWithoutLeak(
      verifier,
      encode({ alg: 'none', kid: 'trusted' }) + '.' + encode(base) + '.unsigned',
    );
    cases++;
    await rejectsWithoutLeak(verifier, 'a'.repeat(32769));
    cases++;

    publishedKeys = [publicJwk(rotated, 'rotated')];
    const rotatedToken = signedToken(base, rotated.privateKey, {
      alg: 'RS256',
      kid: 'rotated',
    });
    const originalNow = Date.now;
    Date.now = () => originalNow() + 1100;
    try {
      assert.equal((await verifier.verify(rotatedToken)).sub, base.sub);
    } finally {
      Date.now = originalNow;
    }
    assert.equal(requests, 2, 'unknown kid should trigger a bounded JWKS refresh');
    cases++;

    for (const patch of [
      { issuer: 'http://issuer.example' },
      { jwksUri: 'http://issuer.example/keys' },
      { audiences: [] },
      { authorizedClients: [] },
      { clockToleranceSeconds: 61 },
      { clockToleranceSeconds: NaN },
      { jwksCacheTtlSeconds: 1 },
      { jwksRefreshCooldownSeconds: 0 },
      { jwksRefreshCooldownSeconds: 301 },
      { jwksFetchTimeoutMs: 20 },
    ]) {
      assert.throws(() => new OidcAccessTokenVerifier({ ...config, ...patch }));
      cases++;
    }
    const mutable = {
      ...config,
      audiences: ['resource-project'],
      authorizedClients: ['ops-client'],
    };
    const frozen = new OidcAccessTokenVerifier(mutable);
    mutable.authorizedClients.push('sibling-client');
    publishedKeys = [publicJwk(trusted, 'trusted')];
    await rejectsWithoutLeak(
      frozen,
      signedToken({ ...base, azp: 'sibling-client' }, trusted.privateKey),
    );
    cases++;

    const staticModule = OidcResourceServerModule.register(config);
    assert.ok(staticModule.exports.includes(OidcAccessTokenVerifier));
    cases++;
    const configDependency = Symbol('validated-config');
    const asyncModule = OidcResourceServerModule.registerAsync({
      imports: [],
      inject: [configDependency],
      useFactory: (validated) => validated,
    });
    const optionsProvider = asyncModule.providers.find(
      (provider) => provider.provide === OIDC_RESOURCE_SERVER_OPTIONS,
    );
    assert.deepEqual(optionsProvider.inject, [configDependency]);
    assert.equal(await optionsProvider.useFactory(config), config);
    assert.ok(asyncModule.exports.includes(OidcAccessTokenVerifier));
    cases++;

    const undersized = new OidcAccessTokenVerifier(config);
    publishedKeys = [publicJwk(tiny, 'tiny')];
    await rejectsWithoutLeak(
      undersized,
      signedToken(base, tiny.privateKey, { alg: 'RS256', kid: 'tiny' }),
    );
    cases++;

    const offline = new OidcAccessTokenVerifier(config);
    let offlineRequests = 0;
    globalThis.fetch = async () => {
      offlineRequests++;
      throw new Error('offline with secret upstream details');
    };
    await rejectsWithoutLeak(offline, token);
    await rejectsWithoutLeak(offline, token);
    assert.equal(offlineRequests, 1, 'failed JWKS refreshes should respect the cooldown');
    cases++;
    console.log('dependency-free crypto cases passed: ' + cases);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
