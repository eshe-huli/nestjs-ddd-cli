import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { writeFile, ensureDir } from '../utils/file.utils';

export interface ApiDocsOptions {
  path?: string;
  output?: string;
  format?: 'markdown' | 'html' | 'json';
  includeExamples?: boolean;
  groupByModule?: boolean;
}

interface EndpointDoc {
  method: string;
  path: string;
  summary: string;
  description?: string;
  module: string;
  controller: string;
  parameters: ParameterDoc[];
  requestBody?: RequestBodyDoc;
  responses: ResponseDoc[];
  auth?: string;
  deprecated?: boolean;
  examples?: ExampleDoc[];
}

interface ParameterDoc {
  name: string;
  in: 'path' | 'query' | 'header';
  type: string;
  required: boolean;
  description?: string;
}

interface RequestBodyDoc {
  type: string;
  required: boolean;
  properties: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
  }>;
}

interface ResponseDoc {
  status: number;
  description: string;
  type?: string;
}

interface ExampleDoc {
  name: string;
  request?: any;
  response?: any;
}

export async function generateApiDocs(basePath: string, options: ApiDocsOptions = {}): Promise<void> {
  console.log(chalk.bold.blue('\n📚 Generating API Documentation\n'));

  const modulesPath = path.join(basePath, 'src/modules');

  if (!fs.existsSync(modulesPath)) {
    console.log(chalk.red('❌ No modules directory found.'));
    return;
  }

  // Scan all controllers
  const endpoints = await scanEndpoints(modulesPath);

  console.log(chalk.cyan(`Found ${endpoints.length} endpoints\n`));

  // Generate documentation
  const format = options.format || 'markdown';
  const outputDir = path.join(basePath, options.output || 'docs/api');

  await ensureDir(outputDir);

  switch (format) {
    case 'markdown':
      await generateMarkdownDocs(endpoints, outputDir, options);
      break;
    case 'html':
      await generateHtmlDocs(endpoints, outputDir, options);
      break;
    case 'json':
      await generateJsonDocs(endpoints, outputDir);
      break;
  }

  console.log(chalk.green(`\n✅ API documentation generated in ${outputDir}`));
}

async function scanEndpoints(modulesPath: string): Promise<EndpointDoc[]> {
  const endpoints: EndpointDoc[] = [];
  const modules = fs.readdirSync(modulesPath).filter(f =>
    fs.statSync(path.join(modulesPath, f)).isDirectory()
  );

  for (const moduleName of modules) {
    const modulePath = path.join(modulesPath, moduleName);
    const controllerFiles = findFiles(modulePath, '.controller.ts');

    for (const file of controllerFiles) {
      const moduleEndpoints = parseController(file, moduleName);
      endpoints.push(...moduleEndpoints);
    }
  }

  return endpoints;
}

function parseController(filePath: string, moduleName: string): EndpointDoc[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const endpoints: EndpointDoc[] = [];

  // Extract controller base path
  const controllerMatch = content.match(/@Controller\(['"]([^'"]*)['"]\)/);
  const basePath = controllerMatch ? `/${controllerMatch[1]}` : '';

  // Extract controller name
  const classMatch = content.match(/export\s+class\s+(\w+Controller)/);
  const controllerName = classMatch ? classMatch[1] : 'Unknown';

  // HTTP method patterns
  const methods = ['Get', 'Post', 'Put', 'Patch', 'Delete'];

  for (const method of methods) {
    const regex = new RegExp(
      `@${method}\\((['"]([^'"]*)['"]\)?)?\\)` +
      `[\\s\\S]*?` +
      `(?:@ApiOperation\\(\\{[^}]*summary:\\s*['"]([^'"]+)['"])?` +
      `[\\s\\S]*?` +
      `(?:@ApiResponse\\(\\{[^}]*status:\\s*(\\d+)[^}]*description:\\s*['"]([^'"]+)['"])?` +
      `[\\s\\S]*?` +
      `(?:async\\s+)?(\\w+)\\s*\\(([^)]*)\\)`,
      'g'
    );

    let match;
    while ((match = regex.exec(content)) !== null) {
      const routePath = match[2] || '';
      const summary = match[3] || `${method.toUpperCase()} ${routePath || basePath}`;
      const responseStatus = match[4] ? parseInt(match[4]) : 200;
      const responseDesc = match[5] || 'Success';
      const methodName = match[6];
      const params = match[7];

      const endpoint: EndpointDoc = {
        method: method.toUpperCase(),
        path: `${basePath}${routePath ? '/' + routePath : ''}`.replace(/\/+/g, '/') || '/',
        summary,
        module: moduleName,
        controller: controllerName,
        parameters: parseParameters(params, content, methodName),
        responses: [{ status: responseStatus, description: responseDesc }],
      };

      // Check for auth
      if (content.includes('@UseGuards') || content.includes('@Auth')) {
        endpoint.auth = 'Bearer Token';
      }

      // Check for deprecation
      if (content.includes('@Deprecated') || content.includes('deprecated')) {
        endpoint.deprecated = true;
      }

      // Parse request body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        endpoint.requestBody = parseRequestBody(params, content);
      }

      endpoints.push(endpoint);
    }
  }

  return endpoints;
}

function parseParameters(params: string, content: string, methodName: string): ParameterDoc[] {
  const parameters: ParameterDoc[] = [];

  // Parse @Param
  const paramMatches = params.match(/@Param\(['"](\w+)['"]\)\s*(\w+):\s*(\w+)/g) || [];
  for (const match of paramMatches) {
    const parts = match.match(/@Param\(['"](\w+)['"]\)\s*(\w+):\s*(\w+)/);
    if (parts) {
      parameters.push({
        name: parts[1],
        in: 'path',
        type: parts[3],
        required: true,
      });
    }
  }

  // Parse @Query
  const queryMatches = params.match(/@Query\(['"]?(\w+)['"]?\)\s*(\w+)(?:\?)?:\s*(\w+)/g) || [];
  for (const match of queryMatches) {
    const parts = match.match(/@Query\(['"]?(\w+)['"]?\)\s*(\w+)(\?)?:\s*(\w+)/);
    if (parts) {
      parameters.push({
        name: parts[1],
        in: 'query',
        type: parts[4],
        required: !parts[3],
      });
    }
  }

  return parameters;
}

function parseRequestBody(params: string, content: string): RequestBodyDoc | undefined {
  const bodyMatch = params.match(/@Body\(\)\s*(\w+):\s*(\w+)/);
  if (!bodyMatch) return undefined;

  const dtoName = bodyMatch[2];

  // Try to find DTO class and extract properties
  const dtoRegex = new RegExp(`class\\s+${dtoName}[^{]*\\{([^}]+)\\}`, 's');
  const dtoMatch = content.match(dtoRegex);

  const properties: RequestBodyDoc['properties'] = [];

  if (dtoMatch) {
    const propsContent = dtoMatch[1];
    const propRegex = /(\w+)(\?)?:\s*(\w+)/g;
    let propMatch;

    while ((propMatch = propRegex.exec(propsContent)) !== null) {
      properties.push({
        name: propMatch[1],
        type: propMatch[3],
        required: !propMatch[2],
      });
    }
  }

  return {
    type: dtoName,
    required: true,
    properties,
  };
}

async function generateMarkdownDocs(endpoints: EndpointDoc[], outputDir: string, options: ApiDocsOptions): Promise<void> {
  let markdown = `# API Documentation

Generated: ${new Date().toISOString()}

## Table of Contents

`;

  // Group by module if requested
  const grouped = options.groupByModule
    ? groupByModule(endpoints)
    : { 'All Endpoints': endpoints };

  // TOC
  for (const [group, eps] of Object.entries(grouped)) {
    markdown += `- [${group}](#${toAnchor(group)})\n`;
    for (const ep of eps) {
      markdown += `  - [${ep.method} ${ep.path}](#${toAnchor(`${ep.method}-${ep.path}`)})\n`;
    }
  }

  markdown += '\n---\n\n';

  // Endpoint details
  for (const [group, eps] of Object.entries(grouped)) {
    markdown += `## ${group}\n\n`;

    for (const ep of eps) {
      markdown += `### ${ep.method} ${ep.path}\n\n`;

      if (ep.deprecated) {
        markdown += `> ⚠️ **DEPRECATED**\n\n`;
      }

      markdown += `${ep.summary}\n\n`;

      if (ep.auth) {
        markdown += `**Authentication:** ${ep.auth}\n\n`;
      }

      // Parameters
      if (ep.parameters.length > 0) {
        markdown += `#### Parameters\n\n`;
        markdown += `| Name | In | Type | Required | Description |\n`;
        markdown += `|------|-----|------|----------|-------------|\n`;
        for (const param of ep.parameters) {
          markdown += `| ${param.name} | ${param.in} | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description || '-'} |\n`;
        }
        markdown += '\n';
      }

      // Request body
      if (ep.requestBody) {
        markdown += `#### Request Body\n\n`;
        markdown += `\`\`\`typescript\n`;
        markdown += `interface ${ep.requestBody.type} {\n`;
        for (const prop of ep.requestBody.properties) {
          markdown += `  ${prop.name}${prop.required ? '' : '?'}: ${prop.type};\n`;
        }
        markdown += `}\n`;
        markdown += `\`\`\`\n\n`;
      }

      // Responses
      markdown += `#### Responses\n\n`;
      markdown += `| Status | Description |\n`;
      markdown += `|--------|-------------|\n`;
      for (const res of ep.responses) {
        markdown += `| ${res.status} | ${res.description} |\n`;
      }
      markdown += '\n';

      // Examples
      if (options.includeExamples) {
        markdown += `#### Example\n\n`;
        markdown += `\`\`\`bash\n`;
        markdown += `curl -X ${ep.method} "http://localhost:3000${ep.path}"`;
        if (ep.auth) {
          markdown += ` \\\n  -H "Authorization: Bearer <token>"`;
        }
        if (ep.requestBody) {
          markdown += ` \\\n  -H "Content-Type: application/json" \\\n  -d '{}'`;
        }
        markdown += `\n\`\`\`\n\n`;
      }

      markdown += '---\n\n';
    }
  }

  await writeFile(path.join(outputDir, 'API.md'), markdown);
  console.log(chalk.green('  ✓ Generated API.md'));
}

async function generateHtmlDocs(endpoints: EndpointDoc[], outputDir: string, options: ApiDocsOptions): Promise<void> {
  const grouped = options.groupByModule ? groupByModule(endpoints) : { 'All': endpoints };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Documentation</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; display: flex; }
    .sidebar { width: 280px; height: 100vh; overflow-y: auto; background: #f5f5f5; padding: 20px; position: fixed; }
    .content { margin-left: 280px; padding: 40px; max-width: 900px; }
    h1 { color: #333; }
    .method { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px; }
    .method.GET { background: #61affe; color: white; }
    .method.POST { background: #49cc90; color: white; }
    .method.PUT { background: #fca130; color: white; }
    .method.PATCH { background: #50e3c2; color: white; }
    .method.DELETE { background: #f93e3e; color: white; }
    .endpoint { border: 1px solid #ddd; border-radius: 8px; margin: 20px 0; overflow: hidden; }
    .endpoint-header { padding: 15px; background: #fafafa; border-bottom: 1px solid #ddd; cursor: pointer; }
    .endpoint-body { padding: 20px; display: none; }
    .endpoint.open .endpoint-body { display: block; }
    .path { font-family: monospace; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; border: 1px solid #ddd; text-align: left; }
    th { background: #f5f5f5; }
    pre { background: #2d2d2d; color: #f8f8f2; padding: 15px; border-radius: 4px; overflow-x: auto; }
    .deprecated { opacity: 0.6; }
    .deprecated::after { content: ' (Deprecated)'; color: #f93e3e; }
    .nav-group { margin-bottom: 20px; }
    .nav-group h3 { font-size: 14px; color: #666; margin-bottom: 10px; }
    .nav-link { display: block; padding: 5px 10px; color: #333; text-decoration: none; font-size: 13px; }
    .nav-link:hover { background: #e0e0e0; }
  </style>
</head>
<body>
  <nav class="sidebar">
    <h2>API Docs</h2>
    ${Object.entries(grouped).map(([group, eps]) => `
      <div class="nav-group">
        <h3>${group}</h3>
        ${eps.map(ep => `
          <a class="nav-link" href="#${toAnchor(`${ep.method}-${ep.path}`)}">
            <span class="method ${ep.method}">${ep.method}</span>
            ${ep.path}
          </a>
        `).join('')}
      </div>
    `).join('')}
  </nav>
  <main class="content">
    <h1>API Documentation</h1>
    <p>Generated: ${new Date().toISOString()}</p>

    ${Object.entries(grouped).map(([group, eps]) => `
      <h2>${group}</h2>
      ${eps.map(ep => `
        <div class="endpoint${ep.deprecated ? ' deprecated' : ''}" id="${toAnchor(`${ep.method}-${ep.path}`)}">
          <div class="endpoint-header" onclick="this.parentElement.classList.toggle('open')">
            <span class="method ${ep.method}">${ep.method}</span>
            <span class="path">${ep.path}</span>
            <span style="float:right">${ep.summary}</span>
          </div>
          <div class="endpoint-body">
            ${ep.parameters.length > 0 ? `
              <h4>Parameters</h4>
              <table>
                <tr><th>Name</th><th>In</th><th>Type</th><th>Required</th></tr>
                ${ep.parameters.map(p => `
                  <tr><td>${p.name}</td><td>${p.in}</td><td>${p.type}</td><td>${p.required ? 'Yes' : 'No'}</td></tr>
                `).join('')}
              </table>
            ` : ''}
            ${ep.requestBody ? `
              <h4>Request Body</h4>
              <pre>${JSON.stringify(ep.requestBody, null, 2)}</pre>
            ` : ''}
            <h4>Responses</h4>
            <table>
              <tr><th>Status</th><th>Description</th></tr>
              ${ep.responses.map(r => `
                <tr><td>${r.status}</td><td>${r.description}</td></tr>
              `).join('')}
            </table>
          </div>
        </div>
      `).join('')}
    `).join('')}
  </main>
</body>
</html>`;

  await writeFile(path.join(outputDir, 'index.html'), html);
  console.log(chalk.green('  ✓ Generated index.html'));
}

async function generateJsonDocs(endpoints: EndpointDoc[], outputDir: string): Promise<void> {
  const doc = {
    generated: new Date().toISOString(),
    totalEndpoints: endpoints.length,
    endpoints,
  };

  await writeFile(path.join(outputDir, 'api.json'), JSON.stringify(doc, null, 2));
  console.log(chalk.green('  ✓ Generated api.json'));
}

function groupByModule(endpoints: EndpointDoc[]): Record<string, EndpointDoc[]> {
  const grouped: Record<string, EndpointDoc[]> = {};

  for (const ep of endpoints) {
    if (!grouped[ep.module]) {
      grouped[ep.module] = [];
    }
    grouped[ep.module].push(ep);
  }

  return grouped;
}

function toAnchor(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function findFiles(dir: string, extension: string): string[] {
  const files: string[] = [];
  function scan(d: string) {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) scan(p);
      else if (e.name.endsWith(extension)) files.push(p);
    }
  }
  scan(dir);
  return files;
}
