import * as path from 'path';
import chalk from 'chalk';
import { generateModule } from './generate-module';
import { generateEntity } from './generate-entity';
import { generateUseCase } from './generate-usecase';
import { getModulePath, prepareTemplateData, generateFromTemplate, fileExists } from '../utils/file.utils';
import { toKebabCase } from '../utils/naming.utils';

export async function generateAll(entityName: string, options: any) {
  console.log(chalk.blue(`🚀 Generating complete scaffolding for: ${entityName}`));
  
  const moduleName = options.module || entityName;
  const basePath = options.path || process.cwd();
  const modulePath = getModulePath(basePath, moduleName);
  
  // Check if module exists, create if not
  const moduleFilePath = path.join(modulePath, `${toKebabCase(moduleName)}.module.ts`);
  if (!(await fileExists(moduleFilePath))) {
    console.log(chalk.yellow(`Module ${moduleName} doesn't exist. Creating...`));
    await generateModule(moduleName, options);
  }
  
  // Generate entity with all related files
  await generateEntity(entityName, { ...options, module: moduleName });
  
  // Generate CRUD use cases
  const useCases = ['Create', 'Update', 'Delete'];
  for (const action of useCases) {
    const useCaseName = `${action}${entityName}`;
    await generateUseCase(useCaseName, { ...options, module: moduleName });
  }
  
  // Generate controller
  const templateData = prepareTemplateData(entityName, moduleName);
  const controllerTemplatePath = path.join(__dirname, '../templates/controller/controller.hbs');
  const controllerOutputPath = path.join(
    modulePath,
    'application/controllers',
    `${toKebabCase(entityName)}.controller.ts`
  );
  
  await generateFromTemplate(controllerTemplatePath, controllerOutputPath, templateData);
  
  // Generate migration file
  await generateMigration(entityName, basePath);
  
  console.log(chalk.green(`\n✅ Complete scaffolding generated successfully!`));
  console.log(chalk.cyan(`\n📁 Generated files:`));
  console.log(`   Module: ${modulePath}`);
  console.log(`   Entity: ${entityName}`);
  console.log(`   Use Cases: Create, Update, Delete`);
  console.log(`   Controller: ${entityName}Controller`);
  console.log(`   Repository: ${entityName}Repository`);
  console.log(`   Mapper: ${entityName}Mapper`);
  
  console.log(chalk.yellow(`\n⚠️  Next steps:`));
  console.log(`   1. Update the index.ts files in each directory`);
  console.log(`   2. Add properties to your entity and DTOs`);
  console.log(`   3. Update the mapper with proper field mappings`);
  console.log(`   4. Run the migration to create the database table`);
  console.log(`   5. Import ${moduleName}Module in your app.module.ts`);
}

async function generateMigration(entityName: string, basePath: string) {
  const timestamp = Date.now();
  const tableName = toKebabCase(entityName).replace(/-/g, '_') + 's';
  const migrationName = `create_${tableName}_table`;
  const fileName = `${timestamp}-${migrationName}.ts`;
  
  const content = `import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class Create${entityName}Table${timestamp} implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "${tableName}",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            generationStrategy: "uuid",
            default: "uuid_generate_v4()",
          },
          {
            name: "is_active",
            type: "boolean",
            default: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "deleted_at",
            type: "timestamp",
            isNullable: true,
          },
          // Add your custom columns here
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("${tableName}");
  }
}
`;
  
  const migrationPath = path.join(basePath, 'src/migrations', fileName);
  await require('../utils/file.utils').writeFile(migrationPath, content);
  console.log(chalk.green(`   Migration: ${fileName}`));
}