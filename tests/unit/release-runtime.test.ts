import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'yaml';

interface Workflow {
  permissions: Record<string, string>;
  jobs: Record<
    string,
    {
      permissions?: Record<string, string>;
      strategy?: { matrix: { 'node-version': string[] } };
      steps: Array<{ uses?: string; with?: { 'node-version'?: string } }>;
    }
  >;
}

describe('CLI release runtime', () => {
  it('restricts write permissions to the main-branch publication job', () => {
    const workflow = parse(
      fs.readFileSync(path.join(__dirname, '../../.github/workflows/ci.yml'), 'utf8'),
    ) as Workflow;
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs['test']?.permissions).toBeUndefined();
    expect(workflow.jobs['build-and-publish']?.permissions).toEqual({
      contents: 'write',
      issues: 'write',
      'pull-requests': 'write',
    });
  });

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
