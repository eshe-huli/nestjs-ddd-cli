import assert from 'node:assert/strict';
import { realpathSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Resolve the real installed distribution, including Bun's isolated layout.
const cwd = process.cwd();
const fromRelease = createRequire(
  realpathSync(join(cwd, 'node_modules/semantic-release/package.json')),
);
const analyzerPath = fromRelease.resolve('@semantic-release/commit-analyzer');
const { analyzeCommits } = await import(pathToFileURL(analyzerPath).href);
const fromProject = createRequire(join(cwd, 'package.json'));
const presetPath = fromProject.resolve('conventional-changelog-conventionalcommits');
const read = (file) => JSON.parse(readFileSync(file, 'utf8'));
const release = read(join(cwd, '.releaserc.json'));
const analyzer = release.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === '@semantic-release/commit-analyzer',
)[1];
const notes = release.plugins.find(
  (plugin) => Array.isArray(plugin) && plugin[0] === '@semantic-release/release-notes-generator',
)[1];
const fixture = read(new URL('./release-policy-merge.json', import.meta.url));
const analyze = (messages, policy = analyzer) =>
  analyzeCommits(policy, {
    cwd,
    commits: messages.map((message, index) => ({
      hash: index === 0 ? fixture.hash : String(index),
      message,
    })),
    logger: { log() {} },
  });
let cases = 0;
const check = async (label, messages, expected) => {
  assert.equal(await analyze(messages), expected, label);
  cases++;
};
assert.equal(analyzer.preset, 'conventionalcommits');
assert.equal(notes.preset, analyzer.preset);
assert.equal(
  fromProject('conventional-changelog-conventionalcommits/package.json').version,
  '9.1.0',
);
assert.equal(read(join(cwd, 'package.json')).engines.node, '>=18.0.0');
assert.equal(fixture.published.gitHead, '978a49abe04b4daeebed6a6d7b06bd2a421eb070');
assert.equal(fixture.published.version, '3.2.2');
assert.equal(fixture.published.engines.node, '>=14.0.0');

// The snapshot is the actual verified merge message and parent policy, not a parsed commit mock.
assert.equal(await analyze([fixture.message], fixture.parentAnalyzer), 'minor');
await check('actual Node14→18 merge requires a major', [fixture.message], 'major');
for (const [type, expected] of [
  ['feat', 'minor'],
  ['fix', 'patch'],
  ['perf', 'patch'],
  ['revert', 'patch'],
  ['docs', 'patch'],
  ['refactor', 'patch'],
  ['chore', null],
  ['test', null],
  ['build', null],
  ['ci', null],
  ['style', null],
]) {
  await check(
    `ordinary ${type} keeps its established release`,
    [`${type}(cli): existing ordinary behavior`],
    expected,
  );
  await check(
    `${type} bang has breaking precedence`,
    [`${type}(cli)!: change public runtime contract`],
    'major',
  );
  await check(
    `${type} footer has breaking precedence`,
    [
      `${type}(cli): change public runtime contract\n\nBREAKING CHANGE: Node14/16 users must stay on version3.2.2.`,
    ],
    'major',
  );
}
await check(
  'nonconventional commit keeps no-release behavior',
  ['Update internal formatting'],
  null,
);
await check('empty history keeps no-release behavior', [], null);
await check(
  'nonbreaking ignored commits cannot lower a feature',
  ['chore: internal metadata', 'feat: new supported recipe', 'ci: internal runner'],
  'minor',
);
await check(
  'breaking ignored type dominates a feature',
  ['feat: new supported recipe', 'ci!: change supported public runtimes'],
  'major',
);
await check(
  'breaking fix dominates a feature regardless of order',
  ['fix!: change public behavior', 'feat: ordinary feature'],
  'major',
);
const prospective = fromRelease('semver').inc(
  fixture.published.version,
  await analyze([fixture.message]),
);
assert.equal(prospective, '4.0.0');
const { generateNotes } = await import(
  pathToFileURL(fromRelease.resolve('@semantic-release/release-notes-generator')).href
);
const generatedNotes = await generateNotes(notes, {
  cwd,
  options: { repositoryUrl: 'https://github.com/eshe-huli/nestjs-ddd-cli.git' },
  commits: [{ hash: fixture.hash, message: fixture.message }],
  lastRelease: { ...fixture.published, gitTag: 'v3.2.2' },
  nextRelease: { version: prospective, gitTag: 'v' + prospective, gitHead: fixture.hash },
  logger: { log() {} },
});
assert.ok(generatedNotes.includes('BREAKING CHANGES'));
assert.ok(generatedNotes.includes('Node >=18'));
assert.ok(generatedNotes.includes('Node 14/16 users must retain version 3.2.2'));

console.log(
  JSON.stringify({
    cases,
    semanticRelease: read(realpathSync(join(cwd, 'node_modules/semantic-release/package.json')))
      .version,
    commitAnalyzer: read(join(dirname(analyzerPath), 'package.json')).version,
    preset: fromProject('conventional-changelog-conventionalcommits/package.json').version,
    presetResolved: Boolean(presetPath),
    parentActualMerge: 'minor',
    currentActualMerge: 'major',
    prospectiveNextVersion: prospective,
    generatedNotesDeclareRuntimeMigration: true,
  }),
);
