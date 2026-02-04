# NestJS DDD CLI

**An opinionated CLI for pragmatic Domain-Driven Design with NestJS**

Stop writing boilerplate. Start building business logic.

Generate production-ready NestJS code following proven DDD/CQRS patterns with consistent structure and immutable architecture principles.

## What's New in v3.0

- **Field-Aware Generation**: Generate complete typed entities, DTOs, and migrations with `--fields`
- **Recipe System**: Apply common patterns like JWT auth, caching, audit logging
- **Shared Module**: Generate base classes, interceptors, filters, and utilities
- **Test Generation**: Generate unit tests with `--with-tests`
- **AI-Ready**: Generates `CLAUDE.md` context file for AI assistants
- **Full CQRS**: Complete command/query handlers with pagination

## Installation

```bash
npm install -g nestjs-ddd-cli
```

## Quick Start

```bash
# Initialize a new project
ddd init my-project

# Generate complete CRUD with typed fields
ddd scaffold User -m users --fields "name:string email:string:unique age:number:optional"

# Apply authentication recipe
ddd recipe auth-jwt --install-deps

# Generate shared utilities
ddd shared
```

## Commands

### Initialize Project

```bash
ddd init <projectName> [options]
```

Options:
- `-p, --path <path>` - Project location
- `--skip-install` - Skip npm install
- `--with-ddd` - Set up DDD structure (default: true)

Creates a NestJS project with:
- DDD folder structure
- Path aliases (`@modules/*`, `@shared/*`)
- Configuration file (`.dddrc.json`)
- AI context file (`CLAUDE.md`)

### Generate Scaffolding

```bash
ddd scaffold <entityName> -m <module> [options]
```

Options:
- `-m, --module <module>` - Module name (required)
- `-f, --fields <fields>` - Entity fields
- `--with-tests` - Generate test files
- `--dry-run` - Preview without writing
- `--install-deps` - Install dependencies

**Field Format:** `name:type:modifier1:modifier2`

Types: `string`, `number`, `boolean`, `date`, `uuid`, `enum`, `json`, `text`

Modifiers: `optional`, `unique`, `relation`

Examples:
```bash
# Basic entity
ddd scaffold Product -m inventory

# With fields
ddd scaffold User -m users --fields "name:string email:string:unique role:enum:admin,user"

# With tests
ddd scaffold Order -m orders --fields "total:number status:string" --with-tests
```

### Generate Individual Components

```bash
ddd generate <type> <name> -m <module>
```

Types:
- `module` - NestJS module with DDD structure
- `entity` - Domain entity + ORM entity + mapper + repository
- `usecase` - Use case with command handler
- `service` - Domain service
- `event` - Domain event
- `query` - Query handler

### Apply Recipes

```bash
ddd recipe [recipeName] [options]
```

Available recipes:

| Recipe | Description |
|--------|-------------|
| `auth-jwt` | JWT authentication with guards and decorators |
| `pagination` | Shared pagination DTOs and utilities |
| `soft-delete` | Base entity and repository with soft delete |
| `audit-log` | Entity change tracking |
| `caching` | Redis caching with decorators |

```bash
# List available recipes
ddd recipe

# Apply with auto-install
ddd recipe auth-jwt --install-deps
```

### Generate Shared Module

```bash
ddd shared
```

Generates:
- Base ORM and domain entities
- Exception filters
- Transform and logging interceptors
- Validation pipe
- Date and string utilities

### CLI Management

```bash
ddd update              # Update CLI to latest version
ddd update-deps         # Update project dependencies
```

## Generated Structure

```
src/
├── modules/
│   └── [module-name]/
│       ├── [module].module.ts
│       ├── application/
│       │   ├── commands/           # CQRS commands
│       │   ├── queries/            # CQRS queries (paginated)
│       │   ├── controllers/        # REST endpoints
│       │   ├── dto/
│       │   │   ├── requests/       # Input DTOs with validation
│       │   │   └── responses/      # Output DTOs
│       │   └── domain/
│       │       ├── entities/       # Domain entities
│       │       ├── events/         # Domain events
│       │       ├── services/       # Domain services
│       │       └── usecases/       # Business logic
│       └── infrastructure/
│           ├── repositories/       # Data access
│           ├── orm-entities/       # Database schemas
│           └── mappers/            # Entity mapping
├── shared/                         # Shared utilities
└── migrations/                     # Database migrations
```

## Configuration

Create `.dddrc.json` in your project root:

```json
{
  "$schema": "https://unpkg.com/nestjs-ddd-cli/ddd.schema.json",
  "orm": "typeorm",
  "database": "postgres",
  "naming": {
    "table": "snake_case",
    "dto": "snake_case",
    "file": "kebab-case"
  },
  "features": {
    "swagger": true,
    "pagination": true,
    "softDelete": true,
    "timestamps": true,
    "tests": false,
    "events": false
  },
  "paths": {
    "modules": "src/modules",
    "migrations": "src/migrations",
    "shared": "src/shared"
  }
}
```

## AI Integration

The CLI generates a `CLAUDE.md` file with project context for AI assistants:
- Project structure documentation
- CLI command reference
- Naming conventions
- Architecture rules
- Common patterns

## API Conventions

All generated APIs follow RESTful conventions:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/entities` | List with pagination |
| GET | `/entities/:id` | Get single entity |
| POST | `/entities` | Create new entity |
| PUT | `/entities/:id` | Update entity |
| DELETE | `/entities/:id` | Soft delete entity |

### Pagination

```
GET /entities?page=1&limit=10&sortBy=createdAt&sortOrder=DESC
```

Response:
```json
{
  "items": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

## Real-World Examples

### E-commerce

```bash
ddd scaffold Product -m inventory --fields "name:string price:number sku:string:unique stock:number"
ddd scaffold Order -m orders --fields "total:number status:enum:pending,paid,shipped customerId:uuid"
ddd generate service PriceCalculator -m orders
ddd generate event OrderPaid -m orders
```

### User Management

```bash
ddd scaffold User -m users --fields "email:string:unique name:string role:enum:admin,user" --with-tests
ddd recipe auth-jwt --install-deps
```

### Multi-tenant SaaS

```bash
ddd scaffold Tenant -m tenants --fields "name:string subdomain:string:unique"
ddd scaffold User -m users --fields "email:string:unique name:string tenantId:uuid"
ddd recipe audit-log
```

## Philosophy

### Immutable Architecture
- Each generated component remains unchanged after creation
- New requirements create new use cases, never modify existing ones
- Predictable structure enables instant developer onboarding

### Opinionated by Design
- Zero configuration fatigue - one way to do things
- Consistent naming across all projects
- Battle-tested patterns from enterprise applications

### CQRS Compliance
- Commands for writes, queries for reads
- Clear separation of concerns
- Testable by default

## Contributing

```bash
git clone https://github.com/eshe-huli/nestjs-ddd-cli
cd nestjs-ddd-cli
npm install
npm run build
npm link

# Test locally
ddd scaffold Test -m test-module --fields "name:string"
```

## License

MIT
