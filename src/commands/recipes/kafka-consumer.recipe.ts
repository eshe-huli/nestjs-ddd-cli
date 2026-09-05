import * as path from 'node:path';
import * as fs from 'fs-extra';
import { readTemplate, writeFile } from '../../utils/file.utils';

const files = [
  ['kafka-consumer.ts.hbs', 'src/shared/kafka-consumer/kafka-consumer.ts'],
  ['migration.ts.hbs', 'src/migrations/1788600000000-KafkaConsumerReceipts.ts'],
  ['README.md.hbs', 'docs/platform/kafka-consumer.md'],
] as const;

export async function applyKafkaConsumerRecipe(basePath: string, dryRun = false): Promise<void> {
  const root = path.join(__dirname, '../../templates/recipes/kafka-consumer');
  const planned = await Promise.all(
    files.map(async ([source, target]) => ({
      target: path.join(basePath, target),
      content: await readTemplate(path.join(root, source)),
    })),
  );
  // Check all targets first; reruns must never overwrite application adaptations.
  for (const file of planned) {
    if (
      (await fs.pathExists(file.target)) &&
      (await fs.readFile(file.target, 'utf8')) !== file.content
    ) {
      throw new Error(`Kafka recipe target already differs: ${file.target}`);
    }
  }
  for (const file of planned) {
    if (dryRun) console.log(`Would generate: ${file.target}`);
    else if (!(await fs.pathExists(file.target))) await writeFile(file.target, file.content);
  }
}
