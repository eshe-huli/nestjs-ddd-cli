import * as path from 'path';
import chalk from 'chalk';
import {
  generateFromTemplate,
  getModulePath,
  prepareTemplateData,
  updateBarrelFile,
} from '../utils/file.utils';
import { toKebabCase } from '../utils/naming.utils';

export const DTO_KINDS = [
  'create',
  'update',
  'response',
  'filter',
  'filter-query',
  'pagination',
  'paginated-response',
] as const;

export type DtoKind = (typeof DTO_KINDS)[number];

const REQUEST_KINDS: DtoKind[] = ['create', 'update', 'filter', 'filter-query', 'pagination'];

interface DtoKindConfig {
  template: string;
  subdir: 'requests' | 'responses';
  fileName: (entityKebab: string) => string;
  exportPath: (entityKebab: string) => string;
}

const DTO_KIND_CONFIG: Record<DtoKind, DtoKindConfig> = {
  create: {
    template: 'create-dto.hbs',
    subdir: 'requests',
    fileName: (entityKebab) => `create-${entityKebab}.dto.ts`,
    exportPath: (entityKebab) => `./create-${entityKebab}.dto`,
  },
  update: {
    template: 'update-dto.hbs',
    subdir: 'requests',
    fileName: (entityKebab) => `update-${entityKebab}.dto.ts`,
    exportPath: (entityKebab) => `./update-${entityKebab}.dto`,
  },
  response: {
    template: 'response-dto.hbs',
    subdir: 'responses',
    fileName: (entityKebab) => `${entityKebab}.response.dto.ts`,
    exportPath: (entityKebab) => `./${entityKebab}.response.dto`,
  },
  filter: {
    template: 'filter-dto.hbs',
    subdir: 'requests',
    fileName: (entityKebab) => `${entityKebab}-filter.dto.ts`,
    exportPath: (entityKebab) => `./${entityKebab}-filter.dto`,
  },
  'filter-query': {
    template: 'filter-query.dto.hbs',
    subdir: 'requests',
    fileName: (entityKebab) => `${entityKebab}-query.dto.ts`,
    exportPath: (entityKebab) => `./${entityKebab}-query.dto`,
  },
  pagination: {
    template: 'pagination-query.dto.hbs',
    subdir: 'requests',
    fileName: () => 'pagination-query.dto.ts',
    exportPath: () => './pagination-query.dto',
  },
  'paginated-response': {
    template: 'paginated-response.dto.hbs',
    subdir: 'responses',
    fileName: () => 'paginated-response.dto.ts',
    exportPath: () => './paginated-response.dto',
  },
};

export function resolveDtoKind(kind?: string): DtoKind {
  const normalized = (kind || 'create').toLowerCase();
  if (!DTO_KINDS.includes(normalized as DtoKind)) {
    throw new Error(`Unknown DTO kind: ${kind}. Allowed kinds: ${DTO_KINDS.join(', ')}`);
  }
  return normalized as DtoKind;
}

export async function generateDto(dtoName: string, options: any) {
  if (!options.module) {
    throw new Error('Module name is required. Use -m or --module option.');
  }

  const kind = resolveDtoKind(options.kind);
  const dryRun = !!options.dryRun;
  const entityKebab = toKebabCase(dtoName);
  const config = DTO_KIND_CONFIG[kind];

  console.log(chalk.blue(`Generating ${kind} DTO: ${dtoName}`));

  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, options.module);
  const templateData = prepareTemplateData(dtoName, options.module, options.fields);

  const outputPath = path.join(
    modulePath,
    'application/dto',
    config.subdir,
    config.fileName(entityKebab),
  );

  await generateFromTemplate(
    path.join(__dirname, '../templates/dto', config.template),
    outputPath,
    templateData,
    dryRun,
  );

  const barrelPath = path.join(
    modulePath,
    'application/dto',
    REQUEST_KINDS.includes(kind) ? 'requests/index.ts' : 'responses/index.ts',
  );

  await updateBarrelFile(barrelPath, {
    exports: [`export * from '${config.exportPath(entityKebab)}';`],
    dryRun,
  });

  console.log(
    chalk.green(
      dryRun
        ? `${kind} DTO ${dtoName} preview complete.`
        : `✅ ${kind} DTO ${dtoName} generated successfully!`,
    ),
  );
}
