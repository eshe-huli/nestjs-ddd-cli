/**
 * Relationship & Association Management Engine
 * Handles entity relationships with validation and code generation
 */

import * as fs from 'fs';
import * as path from 'path';

export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

export interface Relation {
  name: string;
  type: RelationType;
  sourceEntity: string;
  targetEntity: string;
  sourceModule?: string;
  targetModule?: string;
  inverseSide?: string;
  joinColumn?: string;
  joinTable?: {
    name: string;
    joinColumn: string;
    inverseJoinColumn: string;
  };
  cascade?: CascadeOption[];
  eager?: boolean;
  nullable?: boolean;
  orphanedRowAction?: 'nullify' | 'delete' | 'soft-delete' | 'disable';
  onDelete?: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'NO ACTION' | 'RESTRICT';
}

export type CascadeOption = 'insert' | 'update' | 'remove' | 'soft-remove' | 'recover';

export interface RelationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RelationGraph {
  entities: Map<string, EntityNode>;
  edges: RelationEdge[];
}

export interface EntityNode {
  name: string;
  module: string;
  relations: Relation[];
}

export interface RelationEdge {
  from: string;
  to: string;
  type: RelationType;
  relation: Relation;
}

/**
 * Parse relation string into Relation object
 * Format: targetEntity:relationType[:inverseSide]
 * Examples:
 *   - User:many-to-one:posts
 *   - Posts:one-to-many:author
 *   - Profile:one-to-one:user
 */
export function parseRelationString(
  fieldName: string,
  relationStr: string,
  sourceEntity: string
): Relation {
  const parts = relationStr.split(':');
  const targetEntity = parts[0];
  const type = (parts[1] || 'many-to-one') as RelationType;
  const inverseSide = parts[2];

  return {
    name: fieldName,
    type,
    sourceEntity,
    targetEntity,
    inverseSide,
    nullable: true,
  };
}

/**
 * Generate inverse relation automatically
 */
export function generateInverseRelation(relation: Relation): Relation {
  const inverseTypeMap: Record<RelationType, RelationType> = {
    'one-to-one': 'one-to-one',
    'one-to-many': 'many-to-one',
    'many-to-one': 'one-to-many',
    'many-to-many': 'many-to-many',
  };

  return {
    name: relation.inverseSide || toCamelCase(relation.sourceEntity) + 's',
    type: inverseTypeMap[relation.type],
    sourceEntity: relation.targetEntity,
    targetEntity: relation.sourceEntity,
    sourceModule: relation.targetModule,
    targetModule: relation.sourceModule,
    inverseSide: relation.name,
    cascade: relation.type === 'one-to-many' ? ['insert', 'update'] : undefined,
  };
}

/**
 * Validate a relation definition
 */
export function validateRelation(
  relation: Relation,
  existingEntities: Set<string>
): RelationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check target entity exists
  if (!existingEntities.has(relation.targetEntity)) {
    errors.push(`Target entity '${relation.targetEntity}' does not exist`);
  }

  // Validate relation type
  const validTypes: RelationType[] = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'];
  if (!validTypes.includes(relation.type)) {
    errors.push(`Invalid relation type: ${relation.type}`);
  }

  // Warn about missing inverse side for bidirectional relations
  if ((relation.type === 'one-to-many' || relation.type === 'many-to-many') && !relation.inverseSide) {
    warnings.push(`Consider adding inverseSide for ${relation.type} relation to enable bidirectional navigation`);
  }

  // Validate cascade options
  if (relation.cascade) {
    const validCascade: CascadeOption[] = ['insert', 'update', 'remove', 'soft-remove', 'recover'];
    for (const opt of relation.cascade) {
      if (!validCascade.includes(opt)) {
        errors.push(`Invalid cascade option: ${opt}`);
      }
    }
  }

  // Warn about eager loading with many relations
  if (relation.eager && (relation.type === 'one-to-many' || relation.type === 'many-to-many')) {
    warnings.push(`Eager loading on ${relation.type} may cause performance issues`);
  }

  // Check for self-referential relation
  if (relation.sourceEntity === relation.targetEntity) {
    warnings.push(`Self-referential relation detected on ${relation.sourceEntity}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Build a relation graph from entities
 */
export function buildRelationGraph(modulesPath: string): RelationGraph {
  const graph: RelationGraph = {
    entities: new Map(),
    edges: [],
  };

  if (!fs.existsSync(modulesPath)) {
    return graph;
  }

  const modules = fs.readdirSync(modulesPath).filter(f =>
    fs.statSync(path.join(modulesPath, f)).isDirectory()
  );

  for (const moduleName of modules) {
    const entitiesPath = path.join(modulesPath, moduleName, 'domain', 'entities');
    if (!fs.existsSync(entitiesPath)) continue;

    const entityFiles = fs.readdirSync(entitiesPath).filter(f => f.endsWith('.entity.ts'));

    for (const file of entityFiles) {
      const content = fs.readFileSync(path.join(entitiesPath, file), 'utf-8');
      const entityName = extractEntityName(content);
      if (!entityName) continue;

      const relations = extractRelations(content, entityName);

      graph.entities.set(entityName, {
        name: entityName,
        module: moduleName,
        relations,
      });

      for (const relation of relations) {
        graph.edges.push({
          from: entityName,
          to: relation.targetEntity,
          type: relation.type,
          relation,
        });
      }
    }
  }

  return graph;
}

/**
 * Detect circular dependencies in relation graph
 */
export function detectCircularDependencies(graph: RelationGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(entity: string): boolean {
    visited.add(entity);
    recursionStack.add(entity);
    path.push(entity);

    const node = graph.entities.get(entity);
    if (node) {
      for (const relation of node.relations) {
        const target = relation.targetEntity;

        if (!visited.has(target)) {
          if (dfs(target)) {
            return true;
          }
        } else if (recursionStack.has(target)) {
          // Found cycle
          const cycleStart = path.indexOf(target);
          cycles.push([...path.slice(cycleStart), target]);
        }
      }
    }

    path.pop();
    recursionStack.delete(entity);
    return false;
  }

  for (const entity of graph.entities.keys()) {
    if (!visited.has(entity)) {
      dfs(entity);
    }
  }

  return cycles;
}

/**
 * Generate TypeORM relation decorator
 */
export function generateRelationDecorator(relation: Relation): string {
  const decoratorMap: Record<RelationType, string> = {
    'one-to-one': 'OneToOne',
    'one-to-many': 'OneToMany',
    'many-to-one': 'ManyToOne',
    'many-to-many': 'ManyToMany',
  };

  const decorator = decoratorMap[relation.type];
  const options: string[] = [];

  // Build options
  if (relation.eager) options.push('eager: true');
  if (relation.nullable !== undefined) options.push(`nullable: ${relation.nullable}`);
  if (relation.onDelete) options.push(`onDelete: '${relation.onDelete}'`);
  if (relation.onUpdate) options.push(`onUpdate: '${relation.onUpdate}'`);
  if (relation.orphanedRowAction) options.push(`orphanedRowAction: '${relation.orphanedRowAction}'`);
  if (relation.cascade?.length) {
    options.push(`cascade: [${relation.cascade.map(c => `'${c}'`).join(', ')}]`);
  }

  const optionsStr = options.length > 0 ? `, { ${options.join(', ')} }` : '';
  const inverseStr = relation.inverseSide
    ? `, (${toCamelCase(relation.targetEntity)}) => ${toCamelCase(relation.targetEntity)}.${relation.inverseSide}`
    : '';

  let result = `@${decorator}(() => ${relation.targetEntity}${inverseStr}${optionsStr})`;

  // Add JoinColumn for owning side
  if (relation.type === 'many-to-one' || (relation.type === 'one-to-one' && relation.joinColumn)) {
    const joinColOptions = relation.joinColumn ? `{ name: '${relation.joinColumn}' }` : '';
    result += `\n  @JoinColumn(${joinColOptions})`;
  }

  // Add JoinTable for many-to-many owning side
  if (relation.type === 'many-to-many' && relation.joinTable) {
    result += `\n  @JoinTable({
    name: '${relation.joinTable.name}',
    joinColumn: { name: '${relation.joinTable.joinColumn}' },
    inverseJoinColumn: { name: '${relation.joinTable.inverseJoinColumn}' },
  })`;
  }

  return result;
}

/**
 * Generate field type for relation
 */
export function generateRelationFieldType(relation: Relation): string {
  switch (relation.type) {
    case 'one-to-one':
    case 'many-to-one':
      return relation.nullable ? `${relation.targetEntity} | null` : relation.targetEntity;
    case 'one-to-many':
    case 'many-to-many':
      return `${relation.targetEntity}[]`;
  }
}

/**
 * Generate imports needed for relations
 */
export function generateRelationImports(relations: Relation[]): string[] {
  const imports = new Set<string>();

  imports.add(`import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';`);

  const decorators = new Set<string>();
  for (const rel of relations) {
    switch (rel.type) {
      case 'one-to-one':
        decorators.add('OneToOne');
        if (rel.joinColumn !== undefined) decorators.add('JoinColumn');
        break;
      case 'one-to-many':
        decorators.add('OneToMany');
        break;
      case 'many-to-one':
        decorators.add('ManyToOne');
        decorators.add('JoinColumn');
        break;
      case 'many-to-many':
        decorators.add('ManyToMany');
        if (rel.joinTable) decorators.add('JoinTable');
        break;
    }
  }

  if (decorators.size > 0) {
    const existing = [...decorators].filter(d =>
      !['Entity', 'Column', 'PrimaryGeneratedColumn'].includes(d)
    );
    if (existing.length > 0) {
      imports.add(`import { ${existing.join(', ')} } from 'typeorm';`);
    }
  }

  // Add entity imports
  for (const rel of relations) {
    if (rel.targetModule && rel.targetModule !== rel.sourceModule) {
      imports.add(`import { ${rel.targetEntity} } from '../../${rel.targetModule}/domain/entities/${toKebabCase(rel.targetEntity)}.entity';`);
    } else {
      imports.add(`import { ${rel.targetEntity} } from './${toKebabCase(rel.targetEntity)}.entity';`);
    }
  }

  return [...imports];
}

/**
 * Extract entity name from file content
 */
function extractEntityName(content: string): string | null {
  const match = content.match(/export\s+class\s+(\w+)/);
  return match ? match[1] : null;
}

/**
 * Extract relations from entity file content
 */
function extractRelations(content: string, sourceEntity: string): Relation[] {
  const relations: Relation[] = [];
  const relationPattern = /@(OneToOne|OneToMany|ManyToOne|ManyToMany)\s*\(\s*\(\)\s*=>\s*(\w+)/g;

  let match;
  while ((match = relationPattern.exec(content)) !== null) {
    const decoratorType = match[1];
    const targetEntity = match[2];

    const typeMap: Record<string, RelationType> = {
      'OneToOne': 'one-to-one',
      'OneToMany': 'one-to-many',
      'ManyToOne': 'many-to-one',
      'ManyToMany': 'many-to-many',
    };

    // Find the field name that follows
    const afterDecorator = content.slice(match.index + match[0].length);
    const fieldMatch = afterDecorator.match(/[\s\S]*?(\w+)\s*[?:]?\s*:/);
    const fieldName = fieldMatch ? fieldMatch[1] : toCamelCase(targetEntity);

    relations.push({
      name: fieldName,
      type: typeMap[decoratorType],
      sourceEntity,
      targetEntity,
    });
  }

  return relations;
}

function toCamelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Generate join table name for many-to-many
 */
export function generateJoinTableName(entity1: string, entity2: string): string {
  const sorted = [entity1, entity2].sort();
  return `${toSnakeCase(sorted[0])}_${toSnakeCase(sorted[1])}`;
}

function toSnakeCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Determine which side should own the relation
 */
export function determineOwningSide(relation: Relation): 'source' | 'target' {
  // Many-to-one: many side owns
  if (relation.type === 'many-to-one') return 'source';
  if (relation.type === 'one-to-many') return 'target';

  // One-to-one: the side with joinColumn owns
  if (relation.type === 'one-to-one') {
    return relation.joinColumn ? 'source' : 'target';
  }

  // Many-to-many: either side can own, prefer alphabetically first
  return relation.sourceEntity < relation.targetEntity ? 'source' : 'target';
}
