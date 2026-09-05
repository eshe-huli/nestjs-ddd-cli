import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'yaml';

interface Workflow {
  jobs: Record<
    string,
    {
      strategy?: { matrix: { 'node-version': string[] } };
      steps: Array<{ uses?: string; with?: { 'node-version'?: string } }>;
    }
  >;
}

describe('CLI release runtime', () => {
  it('publishes on the current LTS runtime covered by the test matrix', () => {
    const workflow = parse(
      fs.readFileSync(path.join(__dirname, '../../.github/workflows/ci.yml'), 'utf8'),
    ) as Workflow;
    const publish = workflow.jobs['build-and-publish'];
    const test = workflow.jobs['test'];
    const runtime = publish?.steps.find((step) => step.uses?.startsWith('actions/setup-node@'))
      ?.with?.['node-version'];
    expect(runtime).toBe('24.x');
    expect(test?.strategy?.matrix['node-version']).toContain(runtime);
  });
});
