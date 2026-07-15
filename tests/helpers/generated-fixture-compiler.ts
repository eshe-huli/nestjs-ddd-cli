import * as fs from 'fs-extra';
import * as path from 'path';
import ts from 'typescript';

export type FixtureOrm = 'typeorm' | 'prisma';

function getGeneratedDependencyTypes(softDelete: boolean): string {
  return `
declare module "@nestjs/common" {
  export function Injectable(): ClassDecorator;
  export class NotFoundException extends Error {}
}

declare module "@nestjs/typeorm" {
  export function InjectRepository(entity: unknown): ParameterDecorator;
  export function getRepositoryToken(entity: unknown): string;
}

declare module "@nestjs/testing" {
  export interface TestingModule {
    get<T = any>(token: unknown): T;
  }

  export const Test: {
    createTestingModule(metadata: unknown): {
      compile(): Promise<TestingModule>;
    };
  };
}

declare module "@nestjs/cqrs" {
  export interface IQueryHandler<TQuery, TResult> {
    execute(query: TQuery): Promise<TResult> | TResult;
  }
  export function QueryHandler(query: Function): ClassDecorator;
}

declare module "@nestjs/swagger" {
  export function ApiProperty(options?: unknown): PropertyDecorator;
  export function ApiPropertyOptional(options?: unknown): PropertyDecorator;
}

declare module "class-transformer" {
  export function Expose(): PropertyDecorator;
  export function Type(factory: () => unknown): PropertyDecorator;
}

declare module "class-validator" {
  export function IsOptional(): PropertyDecorator;
  export function IsInt(): PropertyDecorator;
  export function Min(value: number): PropertyDecorator;
  export function Max(value: number): PropertyDecorator;
  export function IsString(): PropertyDecorator;
  export function IsIn(values: readonly unknown[]): PropertyDecorator;
}

declare module "typeorm" {
  export type FindOptionsOrder<T> = {
    [P in keyof T]?: "ASC" | "DESC";
  };

  export interface Repository<T> {
    save(entity: Partial<T>): Promise<T>;
    findOne(options: unknown): Promise<T | null>;
    find(options?: unknown): Promise<T[]>;
    findAndCount(options?: unknown): Promise<[T[], number]>;
    update(id: string, entity: Partial<T>): Promise<{ affected?: number }>;
    delete(id: string): Promise<{ affected?: number }>;
    count(options?: unknown): Promise<number>;
  }

  export function Entity(name: string): ClassDecorator;
  export function PrimaryGeneratedColumn(strategy?: string): PropertyDecorator;
  export function Column(options?: unknown): PropertyDecorator;
  export function CreateDateColumn(options?: unknown): PropertyDecorator;
  export function UpdateDateColumn(options?: unknown): PropertyDecorator;
  export function DeleteDateColumn(options?: unknown): PropertyDecorator;
}

declare module "@prisma/client" {
  export interface Invoice {
    id: string;
    amount: number;
    reference: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
${softDelete ? '    deleted_at: Date | null;' : ''}
  }

  export namespace Prisma {
    export type SortOrder = "asc" | "desc";

    export interface InvoiceWhereInput {
      id?: string;
      amount?: number;
      reference?: string;
      is_active?: boolean;
      created_at?: Date;
      updated_at?: Date;
${softDelete ? '      deleted_at?: Date | null;' : ''}
    }

    export interface InvoiceOrderByWithRelationInput {
      id?: SortOrder;
      amount?: SortOrder;
      reference?: SortOrder;
      is_active?: SortOrder;
      created_at?: SortOrder;
      updated_at?: SortOrder;
${softDelete ? '      deleted_at?: SortOrder;' : ''}
    }
  }
}

declare module "@prisma/prisma.service" {
  import type { Invoice } from "@prisma/client";

  interface InvoiceDelegate {
    create(options: unknown): Promise<Invoice>;
    findFirst(options: unknown): Promise<Invoice | null>;
    findMany(options?: unknown): Promise<Invoice[]>;
    count(options?: unknown): Promise<number>;
    update(options: unknown): Promise<Invoice>;
    delete(options: unknown): Promise<Invoice>;
  }

  export class PrismaService {
    invoice: InvoiceDelegate;
  }
}
`;
}

export async function compileGeneratedRepositoryFixture(
  fixturePath: string,
  orm: FixtureOrm,
  softDelete: boolean,
): Promise<string[]> {
  const typesPath = path.join(fixturePath, 'generated-dependency-types.d.ts');
  await fs.writeFile(typesPath, getGeneratedDependencyTypes(softDelete), 'utf-8');

  const modulePath = path.join(fixturePath, 'src/modules/billing');
  const rootNames = [
    typesPath,
    path.join(modulePath, 'application/domain/entities/invoice.entity.ts'),
    path.join(modulePath, 'application/queries/get-all-invoices.query.ts'),
    path.join(modulePath, 'infrastructure/mappers/invoice.mapper.ts'),
    path.join(modulePath, 'infrastructure/repositories/invoice.repository.ts'),
    path.join(modulePath, 'infrastructure/repositories/invoice.repository.spec.ts'),
  ];

  if (orm === 'typeorm') {
    rootNames.push(path.join(modulePath, 'infrastructure/orm-entities/invoice.orm-entity.ts'));
  }

  const program = ts.createProgram({
    rootNames,
    options: {
      baseUrl: path.join(fixturePath, 'src'),
      esModuleInterop: true,
      experimentalDecorators: true,
      forceConsistentCasingInFileNames: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      noEmit: true,
      paths: {
        '@modules/*': ['modules/*'],
      },
      skipLibCheck: true,
      strict: true,
      strictPropertyInitialization: false,
      target: ts.ScriptTarget.ES2020,
      typeRoots: [path.resolve(__dirname, '../../node_modules/@types')],
      types: ['jest'],
    },
  });

  return ts
    .getPreEmitDiagnostics(program)
    .map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine));
}
