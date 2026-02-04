# NestJS DDD CLI

**An opinionated CLI for pragmatic Domain-Driven Design with NestJS**

Stop writing boilerplate. Start building business logic.

Generate production-ready, security-hardened NestJS code following proven DDD/CQRS patterns with consistent structure and immutable architecture principles.

## What's New in v3.2

- **Security-Hardened Generation**: 25 security iterations following OWASP Top 10
- **Enterprise Patterns**: Circuit breaker, distributed tracing, feature flags
- **Advanced Caching**: Cache-aside, write-through, invalidation strategies
- **Observability**: OpenTelemetry tracing, Prometheus metrics, Grafana dashboards
- **Database Optimization**: DataLoader, query analysis, connection pooling
- **Kubernetes-Ready**: Health probes, graceful shutdown, liveness/readiness
- **GraphQL Subscriptions**: Real-time with PubSub and connection management

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

# Set up security patterns
ddd security-patterns

# Add observability
ddd observability
```

## Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `ddd init <name>` | Initialize new NestJS project with DDD structure |
| `ddd scaffold <entity> -m <module>` | Generate complete CRUD with all layers |
| `ddd generate <type> <name> -m <module>` | Generate individual components |
| `ddd recipe [name]` | Apply common patterns (auth, caching, etc.) |
| `ddd shared` | Generate shared utilities and base classes |

### Enterprise Commands

| Command | Description |
|---------|-------------|
| `ddd security-patterns` | RBAC, encryption, OWASP middleware, JWT security |
| `ddd circuit-breaker` | Resilience patterns (retry, timeout, fallback) |
| `ddd observability` | OpenTelemetry distributed tracing |
| `ddd feature-flags` | Feature flags with A/B testing support |
| `ddd caching-advanced` | Multi-layer caching strategies |
| `ddd db-optimization` | DataLoader, query analyzer, connection pooling |
| `ddd database-seeding` | Seed runner with fixture factories |
| `ddd health-probes` | Kubernetes liveness/readiness/startup probes |
| `ddd metrics-prometheus` | Prometheus metrics with Grafana dashboard |
| `ddd graphql-subscriptions` | Real-time GraphQL with PubSub |

### Utility Commands

| Command | Description |
|---------|-------------|
| `ddd update` | Update CLI to latest version |
| `ddd update-deps` | Update project dependencies |

## Field-Aware Generation

Generate complete typed entities, DTOs, and migrations:

```bash
ddd scaffold Product -m inventory --fields "name:string price:number:optional sku:string:unique"
```

**Field Format:** `name:type:modifier1:modifier2`

| Types | Modifiers |
|-------|-----------|
| `string`, `text` | `optional` |
| `number`, `int`, `float`, `decimal` | `unique` |
| `boolean` | `relation` |
| `date`, `datetime`, `timestamp` | `OneToOne`, `OneToMany`, `ManyToOne`, `ManyToMany` |
| `uuid`, `json`, `enum` | |

**Relations:**
```bash
# ManyToOne relation
ddd scaffold Order -m orders --fields "customer:relation:Customer:ManyToOne"

# OneToMany relation
ddd scaffold Customer -m customers --fields "orders:relation:Order:OneToMany:customer"
```

## Security Features

The CLI generates security-hardened code following OWASP Top 10:

### Generated Security Patterns

```bash
ddd security-patterns
```

Creates:
- **Encryption Service** - AES-256-GCM with PBKDF2 (600,000 iterations)
- **RBAC/ABAC Service** - Role and attribute-based access control
- **OWASP Middleware** - XSS, SQL injection, path traversal prevention
- **JWT Security** - Algorithm confusion prevention, claim validation
- **CORS Configuration** - Strict origin validation
- **Cookie Security** - HttpOnly, Secure, SameSite flags
- **Security Headers** - CSP, HSTS, X-Frame-Options, Permissions-Policy
- **Input Sanitizer** - HTML, shell, filename, URL sanitization
- **Secret Vault** - Encrypted secret storage with rotation

### Built-in Protections

- Path traversal prevention in all file operations
- Input validation with MaxLength on all string fields
- Sensitive data masking in logs (credit cards, SSN, tokens)
- Secure error handling (hides internals in production)
- Brute force detection with IP blocking
- CSRF token validation

## Recipes

```bash
# List available recipes
ddd recipe

# Apply with dependency installation
ddd recipe auth-jwt --install-deps
```

| Recipe | Description |
|--------|-------------|
| `auth-jwt` | JWT authentication with guards and decorators |
| `pagination` | Shared pagination DTOs and utilities |
| `soft-delete` | Base entity and repository with soft delete |
| `audit-log` | Entity change tracking with sensitive data masking |
| `caching` | Redis caching with decorators |

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
│       │   └── dto/
│       │       ├── requests/       # Input DTOs with validation
│       │       └── responses/      # Output DTOs
│       └── domain/
│           ├── entities/           # Domain entities
│           ├── events/             # Domain events
│           ├── services/           # Domain services
│           └── usecases/           # Business logic
│       └── infrastructure/
│           ├── repositories/       # Data access
│           ├── orm-entities/       # Database schemas
│           └── mappers/            # Entity mapping
├── shared/
│   ├── security/                   # Security services
│   ├── observability/              # Tracing, metrics
│   ├── resilience/                 # Circuit breaker, retry
│   └── infrastructure/             # Base classes, utilities
└── migrations/
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

## Real-World Examples

### E-commerce with Security

```bash
ddd init ecommerce-api
cd ecommerce-api

# Core security
ddd security-patterns
ddd recipe auth-jwt --install-deps

# Domain modules
ddd scaffold Product -m inventory --fields "name:string price:decimal sku:string:unique stock:int"
ddd scaffold Order -m orders --fields "total:decimal status:enum:pending,paid,shipped customerId:uuid"
ddd scaffold Customer -m customers --fields "email:string:unique name:string"

# Enterprise features
ddd circuit-breaker
ddd observability
ddd caching-advanced
```

### Microservice with Observability

```bash
ddd init payment-service
cd payment-service

# Infrastructure
ddd security-patterns
ddd observability
ddd metrics-prometheus
ddd health-probes

# Domain
ddd scaffold Transaction -m payments --fields "amount:decimal currency:string status:enum:pending,completed,failed"
ddd circuit-breaker
```

### GraphQL API with Real-time

```bash
ddd init realtime-api
cd realtime-api

ddd scaffold Message -m chat --fields "content:text senderId:uuid roomId:uuid"
ddd graphql-subscriptions
ddd caching-advanced
```

## AI Integration

The CLI generates a `CLAUDE.md` file with project context for AI assistants:
- Project structure documentation
- CLI command reference
- Naming conventions
- Architecture rules
- Security patterns
- Common patterns

## API Conventions

All generated APIs follow RESTful conventions with security:

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

## Philosophy

### Security First
- OWASP Top 10 compliance built-in
- Secure defaults, not optional add-ons
- Production-ready from day one

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
