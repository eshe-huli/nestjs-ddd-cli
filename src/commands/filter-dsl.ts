/**
 * Query & Filter DSL (Specification Pattern)
 * Provides standardized filtering, sorting, and search capabilities
 */

import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../utils/file.utils';

export interface FilterDSLOptions {
  path?: string;
  module?: string;
  entity?: string;
}

export async function generateFilterDSL(basePath: string, options: FilterDSLOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n🔍 Generating Filter DSL System\n'));

  const sharedPath = path.join(basePath, 'src/shared');
  const filtersPath = path.join(sharedPath, 'filters');

  await ensureDir(filtersPath);

  // Generate base filter types
  await generateBaseFilterTypes(filtersPath);

  // Generate filter builder
  await generateFilterBuilder(filtersPath);

  // Generate specification pattern
  await generateSpecificationPattern(filtersPath);

  // Generate TypeORM filter adapter
  await generateTypeORMAdapter(filtersPath);

  // Generate Prisma filter adapter
  await generatePrismaAdapter(filtersPath);

  // Generate filter DTO templates
  await generateFilterDTOTemplates(filtersPath);

  // Generate index
  await writeFile(path.join(filtersPath, 'index.ts'), `export * from './filter.types';
export * from './filter.builder';
export * from './specification';
export * from './typeorm.adapter';
export * from './prisma.adapter';
export * from './filter.dto';
`);

  console.log(chalk.green('\n✅ Filter DSL system generated!'));
}

async function generateBaseFilterTypes(filtersPath: string): Promise<void> {
  const content = `/**
 * Base filter types for query DSL
 */

export type FilterOperator =
  | 'eq'        // equals
  | 'ne'        // not equals
  | 'gt'        // greater than
  | 'gte'       // greater than or equal
  | 'lt'        // less than
  | 'lte'       // less than or equal
  | 'in'        // in array
  | 'nin'       // not in array
  | 'like'      // LIKE pattern
  | 'ilike'     // case-insensitive LIKE
  | 'between'   // between two values
  | 'isNull'    // is null
  | 'isNotNull' // is not null
  | 'contains'  // contains substring
  | 'startsWith'// starts with
  | 'endsWith'; // ends with

export type SortDirection = 'ASC' | 'DESC';

export interface FilterCondition<T = any> {
  field: string;
  operator: FilterOperator;
  value: T;
}

export interface SortCondition {
  field: string;
  direction: SortDirection;
  nulls?: 'first' | 'last';
}

export interface PaginationOptions {
  page: number;
  limit: number;
  offset?: number;
}

export interface FilterQuery {
  conditions: FilterCondition[];
  sort?: SortCondition[];
  pagination?: PaginationOptions;
  search?: SearchOptions;
  include?: string[];
  select?: string[];
}

export interface SearchOptions {
  query: string;
  fields: string[];
  mode?: 'any' | 'all' | 'phrase';
  fuzzy?: boolean;
}

export interface FilterResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface FilterGroup {
  type: 'and' | 'or';
  conditions: (FilterCondition | FilterGroup)[];
}

/**
 * Type-safe filter definition for an entity
 */
export type EntityFilter<T> = {
  [K in keyof T]?: FilterValue<T[K]>;
};

export type FilterValue<T> =
  | T
  | { eq: T }
  | { ne: T }
  | { gt: T }
  | { gte: T }
  | { lt: T }
  | { lte: T }
  | { in: T[] }
  | { nin: T[] }
  | { like: string }
  | { ilike: string }
  | { between: [T, T] }
  | { isNull: boolean }
  | { contains: string }
  | { startsWith: string }
  | { endsWith: string };

/**
 * Range filter for numeric/date fields
 */
export interface RangeFilter<T = number | Date> {
  from?: T;
  to?: T;
  inclusive?: boolean;
}

/**
 * Date range presets
 */
export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear'
  | 'last7Days'
  | 'last30Days'
  | 'last90Days';

export function getDateRange(preset: DateRangePreset): { from: Date; to: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return { from: today, to: now };
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: yesterday, to: today };
    case 'thisWeek':
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return { from: weekStart, to: now };
    case 'lastWeek':
      const lastWeekEnd = new Date(today);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay());
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      return { from: lastWeekStart, to: lastWeekEnd };
    case 'thisMonth':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case 'lastMonth':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0),
      };
    case 'thisYear':
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    case 'lastYear':
      return {
        from: new Date(now.getFullYear() - 1, 0, 1),
        to: new Date(now.getFullYear() - 1, 11, 31),
      };
    case 'last7Days':
      const week = new Date(today);
      week.setDate(week.getDate() - 7);
      return { from: week, to: now };
    case 'last30Days':
      const month = new Date(today);
      month.setDate(month.getDate() - 30);
      return { from: month, to: now };
    case 'last90Days':
      const quarter = new Date(today);
      quarter.setDate(quarter.getDate() - 90);
      return { from: quarter, to: now };
  }
}
`;

  await writeFile(path.join(filtersPath, 'filter.types.ts'), content);
  console.log(chalk.green('  ✓ Filter types'));
}

async function generateFilterBuilder(filtersPath: string): Promise<void> {
  const content = `import {
  FilterCondition,
  FilterGroup,
  FilterOperator,
  FilterQuery,
  PaginationOptions,
  SearchOptions,
  SortCondition,
  SortDirection,
} from './filter.types';

/**
 * Fluent filter builder for constructing queries
 */
export class FilterBuilder {
  private query: FilterQuery = {
    conditions: [],
    sort: [],
  };

  private currentGroup: FilterGroup | null = null;

  /**
   * Add a filter condition
   */
  where(field: string, operator: FilterOperator, value: any): this {
    const condition: FilterCondition = { field, operator, value };

    if (this.currentGroup) {
      this.currentGroup.conditions.push(condition);
    } else {
      this.query.conditions.push(condition);
    }

    return this;
  }

  /**
   * Shorthand for equals
   */
  eq(field: string, value: any): this {
    return this.where(field, 'eq', value);
  }

  /**
   * Shorthand for not equals
   */
  ne(field: string, value: any): this {
    return this.where(field, 'ne', value);
  }

  /**
   * Shorthand for greater than
   */
  gt(field: string, value: any): this {
    return this.where(field, 'gt', value);
  }

  /**
   * Shorthand for greater than or equal
   */
  gte(field: string, value: any): this {
    return this.where(field, 'gte', value);
  }

  /**
   * Shorthand for less than
   */
  lt(field: string, value: any): this {
    return this.where(field, 'lt', value);
  }

  /**
   * Shorthand for less than or equal
   */
  lte(field: string, value: any): this {
    return this.where(field, 'lte', value);
  }

  /**
   * Filter by value in array
   */
  in(field: string, values: any[]): this {
    return this.where(field, 'in', values);
  }

  /**
   * Filter by value not in array
   */
  notIn(field: string, values: any[]): this {
    return this.where(field, 'nin', values);
  }

  /**
   * Filter by LIKE pattern
   */
  like(field: string, pattern: string): this {
    return this.where(field, 'like', pattern);
  }

  /**
   * Filter by case-insensitive LIKE pattern
   */
  ilike(field: string, pattern: string): this {
    return this.where(field, 'ilike', pattern);
  }

  /**
   * Filter by value between two values
   */
  between(field: string, from: any, to: any): this {
    return this.where(field, 'between', [from, to]);
  }

  /**
   * Filter by null
   */
  isNull(field: string): this {
    return this.where(field, 'isNull', true);
  }

  /**
   * Filter by not null
   */
  isNotNull(field: string): this {
    return this.where(field, 'isNotNull', true);
  }

  /**
   * Filter by contains substring
   */
  contains(field: string, value: string): this {
    return this.where(field, 'contains', value);
  }

  /**
   * Filter by starts with
   */
  startsWith(field: string, value: string): this {
    return this.where(field, 'startsWith', value);
  }

  /**
   * Filter by ends with
   */
  endsWith(field: string, value: string): this {
    return this.where(field, 'endsWith', value);
  }

  /**
   * Start an AND group
   */
  andWhere(builder: (fb: FilterBuilder) => FilterBuilder): this {
    const group: FilterGroup = { type: 'and', conditions: [] };
    const nestedBuilder = new FilterBuilder();
    nestedBuilder.currentGroup = group;
    builder(nestedBuilder);
    this.query.conditions.push(group as any);
    return this;
  }

  /**
   * Start an OR group
   */
  orWhere(builder: (fb: FilterBuilder) => FilterBuilder): this {
    const group: FilterGroup = { type: 'or', conditions: [] };
    const nestedBuilder = new FilterBuilder();
    nestedBuilder.currentGroup = group;
    builder(nestedBuilder);
    this.query.conditions.push(group as any);
    return this;
  }

  /**
   * Add sort condition
   */
  orderBy(field: string, direction: SortDirection = 'ASC', nulls?: 'first' | 'last'): this {
    this.query.sort = this.query.sort || [];
    this.query.sort.push({ field, direction, nulls });
    return this;
  }

  /**
   * Sort ascending
   */
  asc(field: string): this {
    return this.orderBy(field, 'ASC');
  }

  /**
   * Sort descending
   */
  desc(field: string): this {
    return this.orderBy(field, 'DESC');
  }

  /**
   * Set pagination
   */
  paginate(page: number, limit: number): this {
    this.query.pagination = {
      page,
      limit,
      offset: (page - 1) * limit,
    };
    return this;
  }

  /**
   * Set offset-based pagination
   */
  skip(offset: number): this {
    this.query.pagination = this.query.pagination || { page: 1, limit: 10 };
    this.query.pagination.offset = offset;
    return this;
  }

  /**
   * Set limit
   */
  take(limit: number): this {
    this.query.pagination = this.query.pagination || { page: 1, limit };
    this.query.pagination.limit = limit;
    return this;
  }

  /**
   * Add full-text search
   */
  search(query: string, fields: string[], options?: Partial<SearchOptions>): this {
    this.query.search = {
      query,
      fields,
      mode: options?.mode || 'any',
      fuzzy: options?.fuzzy || false,
    };
    return this;
  }

  /**
   * Include relations
   */
  include(...relations: string[]): this {
    this.query.include = [...(this.query.include || []), ...relations];
    return this;
  }

  /**
   * Select specific fields
   */
  select(...fields: string[]): this {
    this.query.select = [...(this.query.select || []), ...fields];
    return this;
  }

  /**
   * Build the filter query
   */
  build(): FilterQuery {
    return { ...this.query };
  }

  /**
   * Create a new builder
   */
  static create(): FilterBuilder {
    return new FilterBuilder();
  }
}

/**
 * Helper function to create filter builder
 */
export function filter(): FilterBuilder {
  return FilterBuilder.create();
}
`;

  await writeFile(path.join(filtersPath, 'filter.builder.ts'), content);
  console.log(chalk.green('  ✓ Filter builder'));
}

async function generateSpecificationPattern(filtersPath: string): Promise<void> {
  const content = `/**
 * Specification Pattern Implementation
 * For composable business rules
 */

export interface Specification<T> {
  isSatisfiedBy(candidate: T): boolean;
  and(other: Specification<T>): Specification<T>;
  or(other: Specification<T>): Specification<T>;
  not(): Specification<T>;
  toSQL?(): { where: string; params: any[] };
}

/**
 * Base specification class
 */
export abstract class BaseSpecification<T> implements Specification<T> {
  abstract isSatisfiedBy(candidate: T): boolean;

  and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other);
  }

  or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other);
  }

  not(): Specification<T> {
    return new NotSpecification(this);
  }
}

/**
 * AND composite specification
 */
export class AndSpecification<T> extends BaseSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) && this.right.isSatisfiedBy(candidate);
  }

  toSQL(): { where: string; params: any[] } {
    const leftSql = this.left.toSQL?.() || { where: '1=1', params: [] };
    const rightSql = this.right.toSQL?.() || { where: '1=1', params: [] };

    return {
      where: \`(\${leftSql.where}) AND (\${rightSql.where})\`,
      params: [...leftSql.params, ...rightSql.params],
    };
  }
}

/**
 * OR composite specification
 */
export class OrSpecification<T> extends BaseSpecification<T> {
  constructor(
    private readonly left: Specification<T>,
    private readonly right: Specification<T>
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.left.isSatisfiedBy(candidate) || this.right.isSatisfiedBy(candidate);
  }

  toSQL(): { where: string; params: any[] } {
    const leftSql = this.left.toSQL?.() || { where: '1=1', params: [] };
    const rightSql = this.right.toSQL?.() || { where: '1=1', params: [] };

    return {
      where: \`(\${leftSql.where}) OR (\${rightSql.where})\`,
      params: [...leftSql.params, ...rightSql.params],
    };
  }
}

/**
 * NOT specification
 */
export class NotSpecification<T> extends BaseSpecification<T> {
  constructor(private readonly spec: Specification<T>) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return !this.spec.isSatisfiedBy(candidate);
  }

  toSQL(): { where: string; params: any[] } {
    const sql = this.spec.toSQL?.() || { where: '1=1', params: [] };
    return {
      where: \`NOT (\${sql.where})\`,
      params: sql.params,
    };
  }
}

/**
 * Field equals value specification
 */
export class FieldEqualsSpecification<T, K extends keyof T> extends BaseSpecification<T> {
  constructor(
    private readonly field: K,
    private readonly value: T[K]
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return candidate[this.field] === this.value;
  }

  toSQL(): { where: string; params: any[] } {
    return {
      where: \`\${String(this.field)} = ?\`,
      params: [this.value],
    };
  }
}

/**
 * Field greater than specification
 */
export class FieldGreaterThanSpecification<T, K extends keyof T> extends BaseSpecification<T> {
  constructor(
    private readonly field: K,
    private readonly value: T[K]
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return candidate[this.field] > this.value;
  }

  toSQL(): { where: string; params: any[] } {
    return {
      where: \`\${String(this.field)} > ?\`,
      params: [this.value],
    };
  }
}

/**
 * Field in array specification
 */
export class FieldInSpecification<T, K extends keyof T> extends BaseSpecification<T> {
  constructor(
    private readonly field: K,
    private readonly values: T[K][]
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return this.values.includes(candidate[this.field]);
  }

  toSQL(): { where: string; params: any[] } {
    const placeholders = this.values.map(() => '?').join(', ');
    return {
      where: \`\${String(this.field)} IN (\${placeholders})\`,
      params: this.values,
    };
  }
}

/**
 * Field contains substring specification
 */
export class FieldContainsSpecification<T, K extends keyof T> extends BaseSpecification<T> {
  constructor(
    private readonly field: K,
    private readonly substring: string
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    const value = candidate[this.field];
    return typeof value === 'string' && value.includes(this.substring);
  }

  toSQL(): { where: string; params: any[] } {
    return {
      where: \`\${String(this.field)} LIKE ?\`,
      params: [\`%\${this.substring}%\`],
    };
  }
}

/**
 * Field is null specification
 */
export class FieldIsNullSpecification<T, K extends keyof T> extends BaseSpecification<T> {
  constructor(private readonly field: K) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    return candidate[this.field] === null || candidate[this.field] === undefined;
  }

  toSQL(): { where: string; params: any[] } {
    return {
      where: \`\${String(this.field)} IS NULL\`,
      params: [],
    };
  }
}

/**
 * Date range specification
 */
export class DateRangeSpecification<T, K extends keyof T> extends BaseSpecification<T> {
  constructor(
    private readonly field: K,
    private readonly from: Date,
    private readonly to: Date
  ) {
    super();
  }

  isSatisfiedBy(candidate: T): boolean {
    const value = candidate[this.field];
    if (!(value instanceof Date)) return false;
    return value >= this.from && value <= this.to;
  }

  toSQL(): { where: string; params: any[] } {
    return {
      where: \`\${String(this.field)} BETWEEN ? AND ?\`,
      params: [this.from, this.to],
    };
  }
}

/**
 * Helper functions to create specifications
 */
export const spec = {
  equals: <T, K extends keyof T>(field: K, value: T[K]) =>
    new FieldEqualsSpecification<T, K>(field, value),

  greaterThan: <T, K extends keyof T>(field: K, value: T[K]) =>
    new FieldGreaterThanSpecification<T, K>(field, value),

  in: <T, K extends keyof T>(field: K, values: T[K][]) =>
    new FieldInSpecification<T, K>(field, values),

  contains: <T, K extends keyof T>(field: K, substring: string) =>
    new FieldContainsSpecification<T, K>(field, substring),

  isNull: <T, K extends keyof T>(field: K) =>
    new FieldIsNullSpecification<T, K>(field),

  dateRange: <T, K extends keyof T>(field: K, from: Date, to: Date) =>
    new DateRangeSpecification<T, K>(field, from, to),
};
`;

  await writeFile(path.join(filtersPath, 'specification.ts'), content);
  console.log(chalk.green('  ✓ Specification pattern'));
}

async function generateTypeORMAdapter(filtersPath: string): Promise<void> {
  const content = `import { SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { FilterCondition, FilterQuery, FilterResult, FilterGroup } from './filter.types';

/**
 * TypeORM adapter for filter queries
 */
export class TypeORMFilterAdapter {
  /**
   * Apply filter query to TypeORM query builder
   */
  static apply<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    query: FilterQuery,
    alias?: string
  ): SelectQueryBuilder<T> {
    const tableAlias = alias || qb.alias;

    // Apply conditions
    for (const condition of query.conditions) {
      if ('type' in condition) {
        // It's a filter group
        this.applyGroup(qb, condition as unknown as FilterGroup, tableAlias);
      } else {
        this.applyCondition(qb, condition, tableAlias);
      }
    }

    // Apply search
    if (query.search) {
      const searchConditions = query.search.fields.map(field => {
        const paramName = \`search_\${field.replace('.', '_')}\`;
        qb.setParameter(paramName, \`%\${query.search!.query}%\`);
        return \`\${tableAlias}.\${field} ILIKE :\${paramName}\`;
      });

      const operator = query.search.mode === 'all' ? ' AND ' : ' OR ';
      qb.andWhere(\`(\${searchConditions.join(operator)})\`);
    }

    // Apply sorting
    if (query.sort?.length) {
      for (const sort of query.sort) {
        qb.addOrderBy(
          \`\${tableAlias}.\${sort.field}\`,
          sort.direction,
          sort.nulls === 'first' ? 'NULLS FIRST' : sort.nulls === 'last' ? 'NULLS LAST' : undefined
        );
      }
    }

    // Apply pagination
    if (query.pagination) {
      qb.skip(query.pagination.offset ?? (query.pagination.page - 1) * query.pagination.limit);
      qb.take(query.pagination.limit);
    }

    // Apply relations
    if (query.include?.length) {
      for (const relation of query.include) {
        qb.leftJoinAndSelect(\`\${tableAlias}.\${relation}\`, relation);
      }
    }

    // Apply field selection
    if (query.select?.length) {
      qb.select(query.select.map(f => \`\${tableAlias}.\${f}\`));
    }

    return qb;
  }

  /**
   * Apply a single condition
   */
  private static applyCondition<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    condition: FilterCondition,
    alias: string
  ): void {
    const field = \`\${alias}.\${condition.field}\`;
    const paramName = \`\${condition.field.replace('.', '_')}_\${Date.now()}\`;

    switch (condition.operator) {
      case 'eq':
        qb.andWhere(\`\${field} = :\${paramName}\`, { [paramName]: condition.value });
        break;
      case 'ne':
        qb.andWhere(\`\${field} != :\${paramName}\`, { [paramName]: condition.value });
        break;
      case 'gt':
        qb.andWhere(\`\${field} > :\${paramName}\`, { [paramName]: condition.value });
        break;
      case 'gte':
        qb.andWhere(\`\${field} >= :\${paramName}\`, { [paramName]: condition.value });
        break;
      case 'lt':
        qb.andWhere(\`\${field} < :\${paramName}\`, { [paramName]: condition.value });
        break;
      case 'lte':
        qb.andWhere(\`\${field} <= :\${paramName}\`, { [paramName]: condition.value });
        break;
      case 'in':
        qb.andWhere(\`\${field} IN (:\${paramName})\`, { [paramName]: condition.value });
        break;
      case 'nin':
        qb.andWhere(\`\${field} NOT IN (:\${paramName})\`, { [paramName]: condition.value });
        break;
      case 'like':
        qb.andWhere(\`\${field} LIKE :\${paramName}\`, { [paramName]: condition.value });
        break;
      case 'ilike':
        qb.andWhere(\`\${field} ILIKE :\${paramName}\`, { [paramName]: condition.value });
        break;
      case 'between':
        const [from, to] = condition.value;
        qb.andWhere(\`\${field} BETWEEN :\${paramName}_from AND :\${paramName}_to\`, {
          [\`\${paramName}_from\`]: from,
          [\`\${paramName}_to\`]: to,
        });
        break;
      case 'isNull':
        qb.andWhere(\`\${field} IS NULL\`);
        break;
      case 'isNotNull':
        qb.andWhere(\`\${field} IS NOT NULL\`);
        break;
      case 'contains':
        qb.andWhere(\`\${field} ILIKE :\${paramName}\`, { [paramName]: \`%\${condition.value}%\` });
        break;
      case 'startsWith':
        qb.andWhere(\`\${field} ILIKE :\${paramName}\`, { [paramName]: \`\${condition.value}%\` });
        break;
      case 'endsWith':
        qb.andWhere(\`\${field} ILIKE :\${paramName}\`, { [paramName]: \`%\${condition.value}\` });
        break;
    }
  }

  /**
   * Apply a filter group (AND/OR)
   */
  private static applyGroup<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    group: FilterGroup,
    alias: string
  ): void {
    // Create a subquery builder for the group
    const conditions: string[] = [];
    const params: Record<string, any> = {};

    for (const condition of group.conditions) {
      if ('type' in condition) {
        // Nested group - recursive
        // For simplicity, we'll handle one level of nesting
        continue;
      }

      const cond = condition as FilterCondition;
      const field = \`\${alias}.\${cond.field}\`;
      const paramName = \`\${cond.field.replace('.', '_')}_\${Date.now()}_\${Math.random().toString(36).slice(2, 7)}\`;

      switch (cond.operator) {
        case 'eq':
          conditions.push(\`\${field} = :\${paramName}\`);
          params[paramName] = cond.value;
          break;
        case 'ne':
          conditions.push(\`\${field} != :\${paramName}\`);
          params[paramName] = cond.value;
          break;
        // Add other operators as needed
      }
    }

    if (conditions.length > 0) {
      const joinOperator = group.type === 'and' ? ' AND ' : ' OR ';
      qb.andWhere(\`(\${conditions.join(joinOperator)})\`, params);
    }
  }

  /**
   * Execute query and return paginated result
   */
  static async execute<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    query: FilterQuery
  ): Promise<FilterResult<T>> {
    const [data, total] = await qb.getManyAndCount();

    const page = query.pagination?.page || 1;
    const limit = query.pagination?.limit || data.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
`;

  await writeFile(path.join(filtersPath, 'typeorm.adapter.ts'), content);
  console.log(chalk.green('  ✓ TypeORM adapter'));
}

async function generatePrismaAdapter(filtersPath: string): Promise<void> {
  const content = `import { FilterCondition, FilterQuery, FilterResult, FilterGroup } from './filter.types';

/**
 * Prisma adapter for filter queries
 */
export class PrismaFilterAdapter {
  /**
   * Convert filter query to Prisma where clause
   */
  static toWhereClause(query: FilterQuery): Record<string, any> {
    const where: Record<string, any> = {};

    for (const condition of query.conditions) {
      if ('type' in condition) {
        // It's a filter group
        const group = condition as unknown as FilterGroup;
        const groupConditions = this.groupToWhere(group);

        if (group.type === 'and') {
          where.AND = where.AND || [];
          where.AND.push(groupConditions);
        } else {
          where.OR = where.OR || [];
          where.OR.push(groupConditions);
        }
      } else {
        const prismaCondition = this.conditionToWhere(condition);
        Object.assign(where, prismaCondition);
      }
    }

    // Apply search
    if (query.search) {
      const searchConditions = query.search.fields.map(field => ({
        [field]: { contains: query.search!.query, mode: 'insensitive' },
      }));

      if (query.search.mode === 'all') {
        where.AND = [...(where.AND || []), ...searchConditions];
      } else {
        where.OR = [...(where.OR || []), ...searchConditions];
      }
    }

    return where;
  }

  /**
   * Convert a single condition to Prisma format
   */
  private static conditionToWhere(condition: FilterCondition): Record<string, any> {
    const { field, operator, value } = condition;

    switch (operator) {
      case 'eq':
        return { [field]: value };
      case 'ne':
        return { [field]: { not: value } };
      case 'gt':
        return { [field]: { gt: value } };
      case 'gte':
        return { [field]: { gte: value } };
      case 'lt':
        return { [field]: { lt: value } };
      case 'lte':
        return { [field]: { lte: value } };
      case 'in':
        return { [field]: { in: value } };
      case 'nin':
        return { [field]: { notIn: value } };
      case 'like':
        return { [field]: { contains: value.replace(/%/g, '') } };
      case 'ilike':
        return { [field]: { contains: value.replace(/%/g, ''), mode: 'insensitive' } };
      case 'between':
        return { [field]: { gte: value[0], lte: value[1] } };
      case 'isNull':
        return { [field]: null };
      case 'isNotNull':
        return { [field]: { not: null } };
      case 'contains':
        return { [field]: { contains: value, mode: 'insensitive' } };
      case 'startsWith':
        return { [field]: { startsWith: value, mode: 'insensitive' } };
      case 'endsWith':
        return { [field]: { endsWith: value, mode: 'insensitive' } };
      default:
        return {};
    }
  }

  /**
   * Convert filter group to Prisma format
   */
  private static groupToWhere(group: FilterGroup): Record<string, any> {
    const conditions = group.conditions.map(c => {
      if ('type' in c) {
        return this.groupToWhere(c as FilterGroup);
      }
      return this.conditionToWhere(c as FilterCondition);
    });

    return group.type === 'and' ? { AND: conditions } : { OR: conditions };
  }

  /**
   * Convert filter query to Prisma orderBy
   */
  static toOrderBy(query: FilterQuery): Record<string, 'asc' | 'desc'>[] {
    if (!query.sort?.length) return [];

    return query.sort.map(sort => ({
      [sort.field]: sort.direction.toLowerCase() as 'asc' | 'desc',
    }));
  }

  /**
   * Convert filter query to Prisma include
   */
  static toInclude(query: FilterQuery): Record<string, boolean> | undefined {
    if (!query.include?.length) return undefined;

    const include: Record<string, boolean> = {};
    for (const relation of query.include) {
      include[relation] = true;
    }
    return include;
  }

  /**
   * Convert filter query to Prisma select
   */
  static toSelect(query: FilterQuery): Record<string, boolean> | undefined {
    if (!query.select?.length) return undefined;

    const select: Record<string, boolean> = {};
    for (const field of query.select) {
      select[field] = true;
    }
    return select;
  }

  /**
   * Build complete Prisma query args
   */
  static toQueryArgs(query: FilterQuery): {
    where?: Record<string, any>;
    orderBy?: Record<string, 'asc' | 'desc'>[];
    include?: Record<string, boolean>;
    select?: Record<string, boolean>;
    skip?: number;
    take?: number;
  } {
    const args: any = {};

    const where = this.toWhereClause(query);
    if (Object.keys(where).length > 0) {
      args.where = where;
    }

    const orderBy = this.toOrderBy(query);
    if (orderBy.length > 0) {
      args.orderBy = orderBy;
    }

    const include = this.toInclude(query);
    if (include) {
      args.include = include;
    }

    const select = this.toSelect(query);
    if (select) {
      args.select = select;
    }

    if (query.pagination) {
      args.skip = query.pagination.offset ?? (query.pagination.page - 1) * query.pagination.limit;
      args.take = query.pagination.limit;
    }

    return args;
  }

  /**
   * Execute query and return paginated result
   */
  static async execute<T>(
    model: any,
    query: FilterQuery
  ): Promise<FilterResult<T>> {
    const args = this.toQueryArgs(query);

    const [data, total] = await Promise.all([
      model.findMany(args),
      model.count({ where: args.where }),
    ]);

    const page = query.pagination?.page || 1;
    const limit = query.pagination?.limit || data.length;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}
`;

  await writeFile(path.join(filtersPath, 'prisma.adapter.ts'), content);
  console.log(chalk.green('  ✓ Prisma adapter'));
}

async function generateFilterDTOTemplates(filtersPath: string): Promise<void> {
  const content = `import { IsOptional, IsString, IsInt, Min, Max, IsIn, IsArray, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Base pagination query DTO
 */
export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

/**
 * Base sorting query DTO
 */
export class SortQueryDto {
  @ApiPropertyOptional({ description: 'Field to sort by' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  @Transform(({ value }) => value?.toUpperCase())
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}

/**
 * Base search query DTO
 */
export class SearchQueryDto {
  @ApiPropertyOptional({ description: 'Search query string' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Fields to search in', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  searchFields?: string[];
}

/**
 * Combined filter query DTO
 */
export class BaseFilterQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Field to sort by' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC' })
  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  @Transform(({ value }) => value?.toUpperCase())
  sortOrder?: 'ASC' | 'DESC' = 'ASC';

  @ApiPropertyOptional({ description: 'Search query string' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Relations to include' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  include?: string[];

  @ApiPropertyOptional({ description: 'Fields to select' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',') : value))
  select?: string[];
}

/**
 * Date range filter DTO
 */
export class DateRangeFilterDto {
  @ApiPropertyOptional({ description: 'Start date' })
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @ApiPropertyOptional({ description: 'End date' })
  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @ApiPropertyOptional({
    description: 'Preset date range',
    enum: ['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'last7Days', 'last30Days'],
  })
  @IsOptional()
  @IsString()
  preset?: string;
}

/**
 * Numeric range filter DTO
 */
export class NumericRangeFilterDto {
  @ApiPropertyOptional({ description: 'Minimum value' })
  @IsOptional()
  @Type(() => Number)
  min?: number;

  @ApiPropertyOptional({ description: 'Maximum value' })
  @IsOptional()
  @Type(() => Number)
  max?: number;
}

/**
 * String filter DTO
 */
export class StringFilterDto {
  @ApiPropertyOptional({ description: 'Exact match' })
  @IsOptional()
  @IsString()
  eq?: string;

  @ApiPropertyOptional({ description: 'Contains substring' })
  @IsOptional()
  @IsString()
  contains?: string;

  @ApiPropertyOptional({ description: 'Starts with' })
  @IsOptional()
  @IsString()
  startsWith?: string;

  @ApiPropertyOptional({ description: 'Ends with' })
  @IsOptional()
  @IsString()
  endsWith?: string;

  @ApiPropertyOptional({ description: 'In list', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  in?: string[];
}

/**
 * Factory to create entity-specific filter DTOs
 */
export function createFilterDto<T>(
  entityName: string,
  filterableFields: (keyof T)[]
): any {
  // This is a placeholder - actual implementation would use
  // class-transformer and class-validator dynamically
  return BaseFilterQueryDto;
}
`;

  await writeFile(path.join(filtersPath, 'filter.dto.ts'), content);
  console.log(chalk.green('  ✓ Filter DTOs'));
}
