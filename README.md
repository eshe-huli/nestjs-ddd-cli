# NestJS DDD CLI

A CLI tool for generating NestJS boilerplate code following pragmatic DDD/CQRS patterns.

## Installation

```bash
cd nestjs-ddd-cli
chmod +x install.sh
./install.sh
```

Or manually:

```bash
npm install
npm run build
npm link
```

## Usage

### Generate Complete Scaffolding

Generate all files for a new entity (entity, repository, mapper, use cases, controller, etc.):

```bash
ddd scaffold Product -m inventory
```

### Generate Individual Components

```bash
# Generate a module
ddd generate module user-management

# Generate an entity
ddd generate entity User -m user-management

# Generate a use case
ddd generate usecase CreateUser -m user-management

# Generate everything for an entity within existing module
ddd generate all User -m user-management
```

### Options

- `-m, --module <name>`: Specify the module name
- `-p, --path <path>`: Base path for generation (defaults to current directory)
- `--skip-orm`: Skip ORM entity generation
- `--skip-mapper`: Skip mapper generation
- `--skip-repo`: Skip repository generation
- `--with-events`: Include domain events
- `--with-queries`: Include query handlers

## Generated Structure

```
modules/
└── [module-name]/
    ├── application/
    │   ├── commands/
    │   ├── controllers/
    │   ├── domain/
    │   │   ├── entities/
    │   │   ├── events/
    │   │   ├── services/
    │   │   └── usecases/
    │   ├── dto/
    │   │   ├── requests/
    │   │   └── responses/
    │   └── queries/
    ├── infrastructure/
    │   ├── mappers/
    │   ├── orm-entities/
    │   └── repositories/
    └── [module-name].module.ts
```

## Examples

### Create a new feature from scratch

```bash
# 1. Generate complete scaffolding for a Policy entity
ddd scaffold Policy -m policies

# 2. Update the generated files with business logic
# 3. Update index.ts files to export new classes
# 4. Run the generated migration
# 5. Import PoliciesModule in app.module.ts
```

### Add a new entity to existing module

```bash
# Generate entity with all related files
ddd generate all Coverage -m policies
```

### Add a new use case to existing entity

```bash
# Generate a new use case for an existing entity
ddd generate usecase ApproveCoverage -m policies
```

## Philosophy

This CLI follows the "code once, never touch" philosophy:
- Each feature is immutable once written
- Changes create new use cases, not modify existing ones
- Boilerplate is predictable and consistent
- Focus on business logic, not structure

## After Generation

1. **Update index.ts files**: Add new classes to the barrel exports
2. **Add entity properties**: Define domain properties in entities and DTOs
3. **Update mappers**: Add field mappings between domain and ORM entities
4. **Run migrations**: Execute the generated migration files
5. **Import module**: Add module to app.module.ts imports

## Development

To modify the CLI:

```bash
# Make changes
npm run dev -- generate entity Test -m test

# Rebuild
npm run build

# Test globally
ddd generate entity Test -m test
```