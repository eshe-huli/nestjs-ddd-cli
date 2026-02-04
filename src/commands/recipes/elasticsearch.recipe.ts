import * as path from 'path';
import chalk from 'chalk';
import { ensureDir, writeFile } from '../../utils/file.utils';

export async function applyElasticsearchRecipe(basePath: string) {
  const sharedPath = path.join(basePath, 'src/shared');
  const searchPath = path.join(sharedPath, 'search');

  await ensureDir(searchPath);
  await ensureDir(path.join(searchPath, 'decorators'));

  // Search types
  const searchTypesContent = `export interface SearchQuery {
  query: string;
  fields?: string[];
  filters?: SearchFilter[];
  sort?: SearchSort[];
  pagination?: SearchPagination;
  highlight?: boolean;
  fuzzy?: boolean;
  fuzziness?: number | "AUTO";
}

export interface SearchFilter {
  field: string;
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "range" | "exists";
  value: any;
}

export interface SearchSort {
  field: string;
  order: "asc" | "desc";
}

export interface SearchPagination {
  page: number;
  limit: number;
}

export interface SearchResult<T> {
  hits: SearchHit<T>[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  aggregations?: Record<string, any>;
}

export interface SearchHit<T> {
  id: string;
  score: number;
  source: T;
  highlight?: Record<string, string[]>;
}

export interface IndexConfig {
  index: string;
  settings?: {
    numberOfShards?: number;
    numberOfReplicas?: number;
    refreshInterval?: string;
    analysis?: {
      analyzer?: Record<string, any>;
      tokenizer?: Record<string, any>;
      filter?: Record<string, any>;
    };
  };
  mappings?: {
    properties: Record<string, MappingProperty>;
  };
}

export interface MappingProperty {
  type: "text" | "keyword" | "long" | "integer" | "double" | "boolean" | "date" | "nested" | "object";
  analyzer?: string;
  searchAnalyzer?: string;
  fields?: Record<string, MappingProperty>;
  properties?: Record<string, MappingProperty>;
  index?: boolean;
}

export interface AutocompleteQuery {
  query: string;
  field: string;
  size?: number;
  filters?: SearchFilter[];
}

export interface AutocompleteResult {
  suggestions: string[];
}
`;
  await writeFile(path.join(searchPath, 'search.types.ts'), searchTypesContent);

  // Elasticsearch Service
  const esServiceContent = `import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Client } from "@elastic/elasticsearch";
import {
  SearchQuery,
  SearchResult,
  SearchHit,
  IndexConfig,
  AutocompleteQuery,
  AutocompleteResult,
} from "./search.types";

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client: Client;

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
      auth: process.env.ELASTICSEARCH_USERNAME
        ? {
            username: process.env.ELASTICSEARCH_USERNAME,
            password: process.env.ELASTICSEARCH_PASSWORD || "",
          }
        : undefined,
    });
  }

  async onModuleInit() {
    try {
      const info = await this.client.info();
      this.logger.log(\`Connected to Elasticsearch \${info.version.number}\`);
    } catch (error) {
      this.logger.error("Failed to connect to Elasticsearch:", error);
    }
  }

  /**
   * Create or update an index
   */
  async createIndex(config: IndexConfig): Promise<void> {
    const exists = await this.client.indices.exists({ index: config.index });

    if (exists) {
      this.logger.log(\`Index \${config.index} already exists\`);
      return;
    }

    await this.client.indices.create({
      index: config.index,
      body: {
        settings: config.settings,
        mappings: config.mappings,
      },
    });

    this.logger.log(\`Created index \${config.index}\`);
  }

  /**
   * Index a document
   */
  async indexDocument<T>(
    index: string,
    id: string,
    document: T,
    refresh: boolean = false
  ): Promise<void> {
    await this.client.index({
      index,
      id,
      body: document,
      refresh: refresh ? "wait_for" : false,
    });
  }

  /**
   * Bulk index documents
   */
  async bulkIndex<T>(
    index: string,
    documents: Array<{ id: string; document: T }>
  ): Promise<{ success: number; failed: number }> {
    const body = documents.flatMap(({ id, document }) => [
      { index: { _index: index, _id: id } },
      document,
    ]);

    const result = await this.client.bulk({ body, refresh: true });

    let success = 0;
    let failed = 0;

    if (result.items) {
      for (const item of result.items) {
        if (item.index?.error) {
          failed++;
          this.logger.error(\`Failed to index: \${item.index.error.reason}\`);
        } else {
          success++;
        }
      }
    }

    return { success, failed };
  }

  /**
   * Delete a document
   */
  async deleteDocument(index: string, id: string): Promise<void> {
    await this.client.delete({ index, id });
  }

  /**
   * Update a document
   */
  async updateDocument<T>(
    index: string,
    id: string,
    partialDoc: Partial<T>
  ): Promise<void> {
    await this.client.update({
      index,
      id,
      body: { doc: partialDoc },
    });
  }

  /**
   * Search documents
   */
  async search<T>(index: string, query: SearchQuery): Promise<SearchResult<T>> {
    const { page = 1, limit = 10 } = query.pagination || {};
    const from = (page - 1) * limit;

    const esQuery = this.buildQuery(query);

    const result = await this.client.search({
      index,
      body: {
        from,
        size: limit,
        query: esQuery,
        sort: this.buildSort(query.sort),
        highlight: query.highlight
          ? {
              fields: (query.fields || ["*"]).reduce(
                (acc, field) => ({ ...acc, [field]: {} }),
                {}
              ),
              pre_tags: ["<em>"],
              post_tags: ["</em>"],
            }
          : undefined,
      },
    });

    const total =
      typeof result.hits.total === "number"
        ? result.hits.total
        : result.hits.total?.value || 0;

    const hits: SearchHit<T>[] = result.hits.hits.map((hit: any) => ({
      id: hit._id,
      score: hit._score,
      source: hit._source,
      highlight: hit.highlight,
    }));

    return {
      hits,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      aggregations: result.aggregations,
    };
  }

  /**
   * Autocomplete suggestions
   */
  async autocomplete(
    index: string,
    query: AutocompleteQuery
  ): Promise<AutocompleteResult> {
    const { query: text, field, size = 10, filters } = query;

    const must: any[] = [
      {
        match_phrase_prefix: {
          [field]: {
            query: text,
            max_expansions: 50,
          },
        },
      },
    ];

    if (filters) {
      must.push(...this.buildFilters(filters));
    }

    const result = await this.client.search({
      index,
      body: {
        size,
        query: { bool: { must } },
        _source: [field],
      },
    });

    const suggestions = result.hits.hits
      .map((hit: any) => hit._source[field])
      .filter((v: any, i: number, a: any[]) => a.indexOf(v) === i);

    return { suggestions };
  }

  /**
   * Count documents
   */
  async count(index: string, query?: SearchQuery): Promise<number> {
    const esQuery = query ? this.buildQuery(query) : { match_all: {} };

    const result = await this.client.count({
      index,
      body: { query: esQuery },
    });

    return result.count;
  }

  /**
   * Check if document exists
   */
  async exists(index: string, id: string): Promise<boolean> {
    return await this.client.exists({ index, id });
  }

  /**
   * Get document by ID
   */
  async getById<T>(index: string, id: string): Promise<T | null> {
    try {
      const result = await this.client.get({ index, id });
      return result._source as T;
    } catch (error: any) {
      if (error.meta?.statusCode === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Aggregate data
   */
  async aggregate(
    index: string,
    aggregations: Record<string, any>,
    query?: SearchQuery
  ): Promise<Record<string, any>> {
    const esQuery = query ? this.buildQuery(query) : { match_all: {} };

    const result = await this.client.search({
      index,
      body: {
        size: 0,
        query: esQuery,
        aggs: aggregations,
      },
    });

    return result.aggregations || {};
  }

  /**
   * Build Elasticsearch query from SearchQuery
   */
  private buildQuery(query: SearchQuery): any {
    const must: any[] = [];
    const filter: any[] = [];

    // Text search
    if (query.query) {
      const fields = query.fields || ["*"];

      if (query.fuzzy) {
        must.push({
          multi_match: {
            query: query.query,
            fields,
            fuzziness: query.fuzziness || "AUTO",
            prefix_length: 2,
          },
        });
      } else {
        must.push({
          multi_match: {
            query: query.query,
            fields,
            type: "best_fields",
          },
        });
      }
    }

    // Filters
    if (query.filters) {
      filter.push(...this.buildFilters(query.filters));
    }

    if (must.length === 0 && filter.length === 0) {
      return { match_all: {} };
    }

    return {
      bool: {
        ...(must.length > 0 ? { must } : {}),
        ...(filter.length > 0 ? { filter } : {}),
      },
    };
  }

  /**
   * Build filter clauses
   */
  private buildFilters(filters: SearchQuery["filters"]): any[] {
    if (!filters) return [];

    return filters.map((f) => {
      switch (f.operator) {
        case "eq":
          return { term: { [f.field]: f.value } };
        case "ne":
          return { bool: { must_not: { term: { [f.field]: f.value } } } };
        case "gt":
          return { range: { [f.field]: { gt: f.value } } };
        case "gte":
          return { range: { [f.field]: { gte: f.value } } };
        case "lt":
          return { range: { [f.field]: { lt: f.value } } };
        case "lte":
          return { range: { [f.field]: { lte: f.value } } };
        case "in":
          return { terms: { [f.field]: f.value } };
        case "range":
          return { range: { [f.field]: f.value } };
        case "exists":
          return { exists: { field: f.field } };
        default:
          return { term: { [f.field]: f.value } };
      }
    });
  }

  /**
   * Build sort clause
   */
  private buildSort(sort?: SearchQuery["sort"]): any[] | undefined {
    if (!sort || sort.length === 0) return undefined;

    return sort.map((s) => ({
      [s.field]: { order: s.order },
    }));
  }

  /**
   * Delete an index
   */
  async deleteIndex(index: string): Promise<void> {
    await this.client.indices.delete({ index });
    this.logger.log(\`Deleted index \${index}\`);
  }

  /**
   * Reindex documents
   */
  async reindex(sourceIndex: string, destIndex: string): Promise<void> {
    await this.client.reindex({
      body: {
        source: { index: sourceIndex },
        dest: { index: destIndex },
      },
    });
    this.logger.log(\`Reindexed \${sourceIndex} to \${destIndex}\`);
  }
}
`;
  await writeFile(path.join(searchPath, 'elasticsearch.service.ts'), esServiceContent);

  // Searchable decorator
  const searchableDecoratorContent = `import { SetMetadata } from "@nestjs/common";
import { IndexConfig, MappingProperty } from "../search.types";

export const SEARCHABLE_METADATA = "search:searchable";
export const SEARCH_FIELD_METADATA = "search:field";

export interface SearchableConfig {
  index: string;
  settings?: IndexConfig["settings"];
}

/**
 * Mark an entity as searchable
 */
export function Searchable(config: SearchableConfig): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(SEARCHABLE_METADATA, config, target);
  };
}

/**
 * Mark a field as searchable with mapping configuration
 */
export function SearchField(mapping?: Partial<MappingProperty>): PropertyDecorator {
  return (target, propertyKey) => {
    const existingFields =
      Reflect.getMetadata(SEARCH_FIELD_METADATA, target.constructor) || {};

    existingFields[propertyKey] = {
      type: "text",
      ...mapping,
    };

    Reflect.defineMetadata(SEARCH_FIELD_METADATA, existingFields, target.constructor);
  };
}

/**
 * Mark a field as keyword (exact match)
 */
export function SearchKeyword(): PropertyDecorator {
  return SearchField({ type: "keyword" });
}

/**
 * Mark a field as text with autocomplete support
 */
export function SearchText(analyzer?: string): PropertyDecorator {
  return SearchField({
    type: "text",
    analyzer,
    fields: {
      keyword: { type: "keyword" },
      autocomplete: {
        type: "text",
        analyzer: "autocomplete",
      },
    },
  });
}
`;
  await writeFile(path.join(searchPath, 'decorators/searchable.decorator.ts'), searchableDecoratorContent);

  // Search repository base
  const searchRepoContent = `import { ElasticsearchService } from "./elasticsearch.service";
import { SearchQuery, SearchResult, IndexConfig } from "./search.types";

/**
 * Base class for searchable repositories
 */
export abstract class SearchableRepository<T> {
  protected abstract readonly index: string;
  protected abstract readonly mapping: IndexConfig["mappings"];

  constructor(protected readonly esService: ElasticsearchService) {}

  /**
   * Initialize the index with mappings
   */
  async initializeIndex(settings?: IndexConfig["settings"]): Promise<void> {
    await this.esService.createIndex({
      index: this.index,
      settings: {
        numberOfShards: 1,
        numberOfReplicas: 0,
        analysis: {
          analyzer: {
            autocomplete: {
              type: "custom",
              tokenizer: "autocomplete",
              filter: ["lowercase"],
            },
            autocomplete_search: {
              type: "custom",
              tokenizer: "standard",
              filter: ["lowercase"],
            },
          },
          tokenizer: {
            autocomplete: {
              type: "edge_ngram",
              min_gram: 2,
              max_gram: 20,
              token_chars: ["letter", "digit"],
            },
          },
        },
        ...settings,
      },
      mappings: this.mapping,
    });
  }

  /**
   * Index a single document
   */
  async index(id: string, document: T): Promise<void> {
    await this.esService.indexDocument(this.index, id, document);
  }

  /**
   * Bulk index multiple documents
   */
  async bulkIndex(
    documents: Array<{ id: string; document: T }>
  ): Promise<{ success: number; failed: number }> {
    return this.esService.bulkIndex(this.index, documents);
  }

  /**
   * Remove document from index
   */
  async remove(id: string): Promise<void> {
    await this.esService.deleteDocument(this.index, id);
  }

  /**
   * Update indexed document
   */
  async update(id: string, partialDoc: Partial<T>): Promise<void> {
    await this.esService.updateDocument(this.index, id, partialDoc);
  }

  /**
   * Search documents
   */
  async search(query: SearchQuery): Promise<SearchResult<T>> {
    return this.esService.search<T>(this.index, query);
  }

  /**
   * Get document by ID
   */
  async findById(id: string): Promise<T | null> {
    return this.esService.getById<T>(this.index, id);
  }

  /**
   * Autocomplete query
   */
  async autocomplete(
    text: string,
    field: string,
    size?: number
  ): Promise<string[]> {
    const result = await this.esService.autocomplete(this.index, {
      query: text,
      field,
      size,
    });
    return result.suggestions;
  }

  /**
   * Sync entity with search index
   */
  async syncFromDatabase(
    entities: T[],
    idExtractor: (entity: T) => string
  ): Promise<{ success: number; failed: number }> {
    const documents = entities.map((entity) => ({
      id: idExtractor(entity),
      document: entity,
    }));
    return this.bulkIndex(documents);
  }
}
`;
  await writeFile(path.join(searchPath, 'searchable.repository.ts'), searchRepoContent);

  // Search module
  const moduleContent = `import { Module, Global, DynamicModule } from "@nestjs/common";
import { ElasticsearchService } from "./elasticsearch.service";

export interface SearchModuleOptions {
  url?: string;
  username?: string;
  password?: string;
}

@Global()
@Module({})
export class SearchModule {
  static forRoot(options: SearchModuleOptions = {}): DynamicModule {
    // Set environment variables if provided
    if (options.url) {
      process.env.ELASTICSEARCH_URL = options.url;
    }
    if (options.username) {
      process.env.ELASTICSEARCH_USERNAME = options.username;
    }
    if (options.password) {
      process.env.ELASTICSEARCH_PASSWORD = options.password;
    }

    return {
      module: SearchModule,
      providers: [ElasticsearchService],
      exports: [ElasticsearchService],
    };
  }
}
`;
  await writeFile(path.join(searchPath, 'search.module.ts'), moduleContent);

  // Index exports
  await writeFile(path.join(searchPath, 'index.ts'), `export * from "./search.types";
export * from "./elasticsearch.service";
export * from "./searchable.repository";
export * from "./decorators/searchable.decorator";
export * from "./search.module";
`);

  await writeFile(path.join(searchPath, 'decorators/index.ts'), `export * from "./searchable.decorator";
`);

  console.log(chalk.green('  ✓ Search types and interfaces'));
  console.log(chalk.green('  ✓ Elasticsearch service (CRUD, search, autocomplete, aggregations)'));
  console.log(chalk.green('  ✓ Searchable repository base class'));
  console.log(chalk.green('  ✓ @Searchable, @SearchField decorators'));
  console.log(chalk.green('  ✓ Search module'));
}
