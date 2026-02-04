import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

export interface OpenApiExportOptions {
  output?: string;
  format?: 'json' | 'yaml';
  postman?: boolean;
  title?: string;
  version?: string;
}

interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags?: Array<{ name: string; description?: string }>;
}

interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: Array<{ key: string; value: string }>;
}

interface PostmanItem {
  name: string;
  item?: PostmanItem[];
  request?: {
    method: string;
    header?: Array<{ key: string; value: string }>;
    url: {
      raw: string;
      host: string[];
      path: string[];
      query?: Array<{ key: string; value: string }>;
    };
    body?: {
      mode: string;
      raw?: string;
      options?: { raw: { language: string } };
    };
  };
}

export async function exportOpenApi(basePath: string, options: OpenApiExportOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n📄 Exporting OpenAPI Specification...\n'));

  const modulesPath = path.join(basePath, 'src/modules');

  if (!fs.existsSync(modulesPath)) {
    console.log(chalk.red('❌ No modules directory found.'));
    return;
  }

  // Scan modules for controllers and extract API info
  const spec = await buildOpenApiSpec(modulesPath, options);

  // Export OpenAPI spec
  const format = options.format || 'json';
  const outputFile = options.output || `openapi.${format}`;
  const outputPath = path.join(basePath, outputFile);

  if (format === 'yaml') {
    const yaml = jsonToYaml(spec);
    fs.writeFileSync(outputPath, yaml);
  } else {
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
  }

  console.log(chalk.green(`✓ OpenAPI spec exported to ${outputFile}`));
  console.log(chalk.gray(`  Paths: ${Object.keys(spec.paths).length}`));
  console.log(chalk.gray(`  Schemas: ${Object.keys(spec.components.schemas).length}`));

  // Export Postman collection if requested
  if (options.postman) {
    const collection = convertToPostman(spec);
    const postmanPath = path.join(basePath, 'postman-collection.json');
    fs.writeFileSync(postmanPath, JSON.stringify(collection, null, 2));
    console.log(chalk.green(`✓ Postman collection exported to postman-collection.json`));
  }
}

async function buildOpenApiSpec(modulesPath: string, options: OpenApiExportOptions): Promise<OpenApiSpec> {
  const spec: OpenApiSpec = {
    openapi: '3.0.3',
    info: {
      title: options.title || 'API Documentation',
      version: options.version || '1.0.0',
      description: 'Auto-generated API documentation from NestJS DDD CLI',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development server' },
    ],
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [],
  };

  const modules = fs.readdirSync(modulesPath).filter(f =>
    fs.statSync(path.join(modulesPath, f)).isDirectory()
  );

  for (const moduleName of modules) {
    const modulePath = path.join(modulesPath, moduleName);

    // Add tag for module
    spec.tags!.push({
      name: capitalize(moduleName),
      description: `${capitalize(moduleName)} operations`,
    });

    // Scan for controllers
    await scanControllers(modulePath, moduleName, spec);

    // Scan for DTOs/schemas
    await scanSchemas(modulePath, moduleName, spec);
  }

  return spec;
}

async function scanControllers(modulePath: string, moduleName: string, spec: OpenApiSpec): Promise<void> {
  const files = getAllFiles(modulePath).filter(f =>
    f.endsWith('.controller.ts') || f.endsWith('.resolver.ts')
  );

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');

    // Extract controller path
    const controllerMatch = content.match(/@Controller\(['"]([^'"]*)['"]\)/);
    const basePath = controllerMatch ? `/${controllerMatch[1]}` : `/${moduleName}`;

    // Extract routes
    const routePatterns = [
      { decorator: '@Get', method: 'get' },
      { decorator: '@Post', method: 'post' },
      { decorator: '@Put', method: 'put' },
      { decorator: '@Patch', method: 'patch' },
      { decorator: '@Delete', method: 'delete' },
    ];

    for (const { decorator, method } of routePatterns) {
      const regex = new RegExp(`${decorator.replace('@', '@')}\\(([^)]*)\\)[\\s\\S]*?(?:@ApiOperation\\(\\{[^}]*summary:\\s*['"]([^'"]+)['"])?[\\s\\S]*?(?:async\\s+)?(\\w+)\\s*\\(`, 'g');

      let match;
      while ((match = regex.exec(content)) !== null) {
        const routePath = match[1]?.replace(/['"]/g, '') || '';
        const summary = match[2] || `${method.toUpperCase()} ${routePath || basePath}`;
        const methodName = match[3];

        const fullPath = routePath ? `${basePath}/${routePath}`.replace(/\/+/g, '/') : basePath;

        if (!spec.paths[fullPath]) {
          spec.paths[fullPath] = {};
        }

        spec.paths[fullPath][method] = {
          tags: [capitalize(moduleName)],
          summary,
          operationId: methodName,
          parameters: extractParameters(content, methodName),
          responses: {
            '200': {
              description: 'Successful response',
            },
            '400': {
              description: 'Bad request',
            },
            '401': {
              description: 'Unauthorized',
            },
          },
        };

        // Add request body for POST/PUT/PATCH
        if (['post', 'put', 'patch'].includes(method)) {
          const bodyMatch = content.match(new RegExp(`${methodName}[\\s\\S]*?@Body\\(\\)\\s*\\w+:\\s*(\\w+)`));
          if (bodyMatch) {
            spec.paths[fullPath][method].requestBody = {
              required: true,
              content: {
                'application/json': {
                  schema: { $ref: `#/components/schemas/${bodyMatch[1]}` },
                },
              },
            };
          }
        }
      }
    }
  }
}

function extractParameters(content: string, methodName: string): any[] {
  const params: any[] = [];

  // Find method and extract @Param decorators
  const methodMatch = content.match(new RegExp(`${methodName}\\s*\\([^)]*@Param\\(['"]?(\\w+)['"]?\\)[^)]*\\)`));
  if (methodMatch) {
    params.push({
      name: methodMatch[1],
      in: 'path',
      required: true,
      schema: { type: 'string' },
    });
  }

  // Extract @Query decorators
  const queryRegex = new RegExp(`${methodName}[\\s\\S]*?@Query\\(['"]?(\\w+)['"]?\\)`, 'g');
  let queryMatch;
  while ((queryMatch = queryRegex.exec(content)) !== null) {
    params.push({
      name: queryMatch[1],
      in: 'query',
      required: false,
      schema: { type: 'string' },
    });
  }

  return params;
}

async function scanSchemas(modulePath: string, moduleName: string, spec: OpenApiSpec): Promise<void> {
  const dtoFiles = getAllFiles(modulePath).filter(f =>
    f.endsWith('.dto.ts') || f.includes('/dto/')
  );

  for (const file of dtoFiles) {
    const content = fs.readFileSync(file, 'utf-8');

    // Extract class definitions
    const classRegex = /export\s+class\s+(\w+)\s*(?:extends\s+\w+)?\s*\{([^}]+)\}/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const classBody = match[2];

      const schema: any = {
        type: 'object',
        properties: {},
        required: [],
      };

      // Extract properties
      const propRegex = /(?:@(?:ApiProperty|IsString|IsNumber|IsBoolean|IsEmail|IsOptional|IsNotEmpty)\([^)]*\)\s*)*(\w+)(?:\?)?:\s*(\w+(?:\[\])?)/g;

      let propMatch;
      while ((propMatch = propRegex.exec(classBody)) !== null) {
        const propName = propMatch[1];
        const propType = propMatch[2];

        schema.properties[propName] = typeToSchema(propType);

        // Check if required (no ? and has @IsNotEmpty or no @IsOptional)
        const propContext = classBody.substring(
          Math.max(0, classBody.indexOf(propName) - 200),
          classBody.indexOf(propName)
        );

        if (!propContext.includes('?:') && !propContext.includes('@IsOptional')) {
          schema.required.push(propName);
        }
      }

      if (schema.required.length === 0) {
        delete schema.required;
      }

      spec.components.schemas[className] = schema;
    }
  }
}

function typeToSchema(type: string): any {
  const typeMap: Record<string, any> = {
    'string': { type: 'string' },
    'number': { type: 'number' },
    'boolean': { type: 'boolean' },
    'Date': { type: 'string', format: 'date-time' },
    'string[]': { type: 'array', items: { type: 'string' } },
    'number[]': { type: 'array', items: { type: 'number' } },
  };

  return typeMap[type] || { type: 'string' };
}

function convertToPostman(spec: OpenApiSpec): PostmanCollection {
  const collection: PostmanCollection = {
    info: {
      name: spec.info.title,
      description: spec.info.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: [],
    variable: [
      { key: 'baseUrl', value: spec.servers?.[0]?.url || 'http://localhost:3000' },
    ],
  };

  // Group by tags
  const byTag = new Map<string, PostmanItem[]>();

  for (const [pathUrl, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
      const tag = operation.tags?.[0] || 'Default';

      if (!byTag.has(tag)) {
        byTag.set(tag, []);
      }

      const item: PostmanItem = {
        name: operation.summary || `${method.toUpperCase()} ${pathUrl}`,
        request: {
          method: method.toUpperCase(),
          header: [
            { key: 'Content-Type', value: 'application/json' },
            { key: 'Authorization', value: 'Bearer {{token}}' },
          ],
          url: {
            raw: `{{baseUrl}}${pathUrl}`,
            host: ['{{baseUrl}}'],
            path: pathUrl.split('/').filter(Boolean),
          },
        },
      };

      // Add request body
      if (operation.requestBody) {
        item.request!.body = {
          mode: 'raw',
          raw: JSON.stringify({}, null, 2),
          options: { raw: { language: 'json' } },
        };
      }

      // Add query params
      if (operation.parameters) {
        const queryParams = operation.parameters.filter((p: any) => p.in === 'query');
        if (queryParams.length > 0) {
          item.request!.url.query = queryParams.map((p: any) => ({
            key: p.name,
            value: '',
          }));
        }
      }

      byTag.get(tag)!.push(item);
    }
  }

  // Build collection structure
  for (const [tag, items] of byTag) {
    collection.item.push({
      name: tag,
      item: items,
    });
  }

  return collection;
}

function jsonToYaml(obj: any, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object') {
          yaml += `${spaces}- ${jsonToYaml(item, indent + 2).trim().replace(/^\s+/, '')}\n`;
        } else {
          yaml += `${spaces}- ${item}\n`;
        }
      }
    } else if (typeof value === 'object') {
      yaml += `${spaces}${key}:\n`;
      yaml += jsonToYaml(value, indent + 1);
    } else if (typeof value === 'string' && (value.includes(':') || value.includes('#'))) {
      yaml += `${spaces}${key}: "${value}"\n`;
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
