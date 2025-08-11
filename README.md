# NestJS DDD CLI

A CLI tool for generating NestJS boilerplate code following pragmatic DDD/CQRS patterns.

## Installation

**From NPM (Recommended):**
```bash
npm install -g nestjs-ddd-cli
```

**From Source:**
```bash
git clone https://github.com/eshe-huli/nestjs-ddd-cli
cd nestjs-ddd-cli
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

# Generate a domain service
ddd generate service UserValidation -m user-management

# Generate a domain event
ddd generate event UserCreated -m user-management

# Generate a query handler
ddd generate query GetUser -m user-management

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

## Available Generators

| Generator | Command | Description |
|-----------|---------|-------------|
| **Module** | `ddd generate module <name>` | Creates complete DDD module structure |
| **Entity** | `ddd generate entity <name> -m <module>` | Domain entity with ORM mapping |
| **Use Case** | `ddd generate usecase <name> -m <module>` | CQRS command handler |
| **Domain Service** | `ddd generate service <name> -m <module>` | Domain service for business logic |
| **Domain Event** | `ddd generate event <name> -m <module>` | Domain event for CQRS |
| **Query Handler** | `ddd generate query <name> -m <module>` | CQRS query handler |
| **Complete CRUD** | `ddd scaffold <name> -m <module>` | All files for an entity |
| **All Entity Files** | `ddd generate all <name> -m <module>` | Entity + related files |

## Generated Structure

```
modules/
└── [module-name]/
    ├── application/
    │   ├── commands/           # CQRS command handlers
    │   ├── controllers/        # REST controllers
    │   ├── domain/
    │   │   ├── entities/       # Domain entities
    │   │   ├── events/         # Domain events
    │   │   ├── services/       # Domain services
    │   │   └── usecases/       # Use cases/command handlers
    │   ├── dto/
    │   │   ├── requests/       # Request DTOs
    │   │   └── responses/      # Response DTOs
    │   └── queries/            # CQRS query handlers
    ├── infrastructure/
    │   ├── mappers/            # Domain ↔ ORM mappers
    │   ├── orm-entities/       # Database entities
    │   └── repositories/       # Repository implementations
    └── [module-name].module.ts # NestJS module
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

### Add individual DDD components

```bash
# Generate a new use case
ddd generate usecase ApproveCoverage -m policies

# Generate a domain service for business logic
ddd generate service PolicyValidation -m policies

# Generate a domain event
ddd generate event PolicyApproved -m policies

# Generate a query handler
ddd generate query GetPolicyDetails -m policies
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