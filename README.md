# NestJS DDD CLI

🏗️ **An opinionated CLI for pragmatic Domain-Driven Design with NestJS**

Stop writing boilerplate. Start building business logic.

Generate production-ready NestJS code following proven DDD/CQRS patterns with consistent structure and immutable architecture principles.

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

## Quick Start

### 🚀 **Generate Your First Feature**

```bash
# 1. Create complete scaffolding for a User management feature
ddd scaffold User -m user-management

# 2. Add business logic to the generated files
# 3. Update index.ts exports
# 4. Run migrations  
# 5. Import module in app.module.ts
```

**What you get in seconds:**
```
📁 modules/user-management/
├── 📄 user-management.module.ts      ✅ NestJS module configured
├── 📁 application/
│   ├── 📁 controllers/
│   │   └── 📄 user.controller.ts     ✅ REST endpoints (GET, POST, PUT, DELETE)
│   ├── 📁 domain/
│   │   ├── 📁 entities/
│   │   │   └── 📄 user.entity.ts     ✅ Domain entity with interfaces
│   │   └── 📁 usecases/
│   │       ├── 📄 create-user.usecase.ts ✅ Business logic for creation
│   │       ├── 📄 update-user.usecase.ts ✅ Business logic for updates  
│   │       └── 📄 delete-user.usecase.ts ✅ Business logic for deletion
│   └── 📁 dto/
│       ├── 📁 requests/
│       │   ├── 📄 create-user.dto.ts ✅ Request validation schemas
│       │   └── 📄 update-user.dto.ts ✅ Update validation schemas
│       └── 📁 responses/
│           └── 📄 user.response.ts   ✅ Response data contracts
└── 📁 infrastructure/
    ├── 📁 repositories/
    │   └── 📄 user.repository.ts     ✅ CRUD operations + custom queries
    ├── 📁 orm-entities/
    │   └── 📄 user.orm-entity.ts     ✅ Database schema (TypeORM)
    └── 📁 mappers/
        └── 📄 user.mapper.ts         ✅ Domain ↔ Database mapping
```

> **🚀 From zero to production-ready in under 30 seconds**

## Real-World Examples

### 🏢 **E-commerce Platform**

```bash
# Generate order management
ddd scaffold Order -m orders

# Add payment processing
ddd generate service PaymentProcessor -m orders
ddd generate event OrderPaid -m orders

# Add inventory checking  
ddd generate query CheckStock -m inventory
ddd generate service StockValidator -m inventory
```

**Result:** Complete order system with payment processing and inventory management
```
📁 modules/orders/
├── 📄 orders.module.ts
├── 📁 application/domain/services/
│   └── 📄 payment-processor.service.ts  🆕 Payment business logic
├── 📁 application/domain/events/  
│   └── 📄 order-paid.event.ts          🆕 Order payment event
└── ... (all CRUD operations)

📁 modules/inventory/
├── 📁 application/queries/
│   └── 📄 check-stock.handler.ts       🆕 Stock checking query
├── 📁 application/domain/services/
│   └── 📄 stock-validator.service.ts   🆕 Stock validation logic
└── ... (all CRUD operations)
```

### 🏥 **Healthcare System**

```bash
# Patient management
ddd scaffold Patient -m patients

# Medical records with events
ddd scaffold MedicalRecord -m medical-records
ddd generate event RecordCreated -m medical-records
ddd generate event RecordUpdated -m medical-records

# Appointment scheduling
ddd generate query FindAvailableSlots -m appointments
ddd generate service AppointmentScheduler -m appointments
```

### 🎓 **Learning Management System**

```bash
# Course management
ddd scaffold Course -m courses
ddd generate service CourseEnrollment -m courses
ddd generate event StudentEnrolled -m courses

# Progress tracking
ddd generate query GetStudentProgress -m progress
ddd generate service ProgressCalculator -m progress
```

> **🎯 Each example follows identical patterns** - Learn once, apply everywhere.

## Philosophy & Principles

This CLI embodies **pragmatic Domain-Driven Design** with unwavering consistency:

### 🔒 **Immutable Architecture**
- **"Code once, never touch"** - Each generated component remains unchanged after creation
- **Evolution over modification** - New requirements create new use cases, never modify existing ones
- **Predictable structure** - Every project follows identical patterns, enabling instant developer onboarding

### 🎯 **Opinionated by Design**
- **Zero configuration fatigue** - One way to do things, the right way
- **Consistent naming** - PascalCase entities, kebab-case modules, predictable file names
- **Proven patterns** - Battle-tested DDD/CQRS structure from real-world enterprise applications

### 🚀 **Developer Experience First**
- **No bikeshedding** - Spend time on business logic, not folder structure debates
- **IDE-friendly** - Barrel exports, clear interfaces, TypeScript-first approach
- **Team consistency** - Every developer generates identical code structure

### 🏗️ **Enterprise Ready**
- **Separation of concerns** - Domain logic isolated from infrastructure
- **CQRS compliance** - Commands for writes, queries for reads
- **Testable by default** - Clean interfaces enable easy unit testing

## What Makes This Different?

### 🎨 **Structure That Scales**

Every module follows this **identical, battle-tested structure**:

```
modules/
└── [feature-name]/                           # 🏠 Feature boundary
    ├── [feature-name].module.ts              # 🔧 NestJS module wiring
    ├── application/                          # 📋 Application layer
    │   ├── commands/                         # ✍️  CQRS commands (writes)
    │   │   ├── create-[entity].command.ts    #    └─ Create operations
    │   │   ├── update-[entity].command.ts    #    └─ Update operations  
    │   │   ├── delete-[entity].command.ts    #    └─ Delete operations
    │   │   └── index.ts                      #    └─ Barrel exports
    │   ├── controllers/                      # 🌐 HTTP/GraphQL endpoints
    │   │   ├── [entity].controller.ts        #    └─ REST API endpoints
    │   │   └── index.ts                      #    └─ Barrel exports
    │   ├── domain/                           # 🧠 Pure business logic
    │   │   ├── entities/                     # 📦 Business objects
    │   │   │   ├── [entity].entity.ts        #    └─ Domain entity
    │   │   │   └── index.ts                  #    └─ Barrel exports
    │   │   ├── events/                       # 🎯 Domain events
    │   │   │   ├── [entity]-created.event.ts #    └─ Event definitions
    │   │   │   └── index.ts                  #    └─ Barrel exports
    │   │   ├── services/                     # ⚙️  Domain services
    │   │   │   ├── [entity].service.ts       #    └─ Business rules
    │   │   │   └── index.ts                  #    └─ Barrel exports
    │   │   └── usecases/                     # 🎬 Use case operations
    │   │       ├── create-[entity].usecase.ts#    └─ Create business logic
    │   │       ├── update-[entity].usecase.ts#    └─ Update business logic
    │   │       ├── delete-[entity].usecase.ts#    └─ Delete business logic
    │   │       └── index.ts                  #    └─ Barrel exports
    │   ├── dto/                              # 📄 Data contracts
    │   │   ├── requests/                     # 📤 Inbound data
    │   │   │   ├── create-[entity].dto.ts    #    └─ Create request
    │   │   │   ├── update-[entity].dto.ts    #    └─ Update request
    │   │   │   └── index.ts                  #    └─ Barrel exports
    │   │   ├── responses/                    # 📥 Outbound data
    │   │   │   ├── [entity].response.ts      #    └─ Entity response
    │   │   │   └── index.ts                  #    └─ Barrel exports
    │   │   └── index.ts                      #    └─ Barrel exports
    │   └── queries/                          # 🔍 CQRS queries (reads)
    │       ├── get-[entity].handler.ts       #    └─ Single entity query
    │       ├── list-[entities].handler.ts    #    └─ Multiple entities query
    │       └── index.ts                      #    └─ Barrel exports
    └── infrastructure/                       # 🏗️  Infrastructure layer
        ├── mappers/                          # 🔄 Data transformation
        │   ├── [entity].mapper.ts            #    └─ Domain ↔ ORM mapping
        │   └── index.ts                      #    └─ Barrel exports
        ├── orm-entities/                     # 🗄️  Database schema
        │   ├── [entity].orm-entity.ts        #    └─ TypeORM entity
        │   └── index.ts                      #    └─ Barrel exports
        └── repositories/                     # 💾 Data access
            ├── [entity].repository.ts        #    └─ Repository implementation
            └── index.ts                      #    └─ Barrel exports
```

> **🎯 Every feature looks identical** - No surprises, no confusion, just consistency.

### 🧠 **Smart Defaults & Conventions**

```bash
# Naming follows strict patterns
ddd generate entity UserProfile    # → user-profile.entity.ts
ddd generate service OrderValidator # → order-validator.service.ts  
ddd generate event PaymentProcessed # → payment-processed.event.ts
```

**Built-in Intelligence:**
- **🔄 Barrel exports** - Automatic `index.ts` files for clean imports
- **🔒 TypeScript strict** - Zero `any` types, full type safety  
- **💉 DI ready** - Injectable decorators configured
- **📋 Interface first** - Clear contracts between layers
- **📁 Predictable paths** - Same location every time

### 💡 **Enterprise Patterns**

```typescript
// ✅ Commands (writes) - Tell, don't ask
@CommandHandler(CreateUserCommand)
export class CreateUserHandler {
  async execute(command: CreateUserCommand): Promise<void> {
    // Returns nothing - just does the work
  }
}

// ✅ Queries (reads) - Ask, don't tell  
@QueryHandler(GetUserQuery)
export class GetUserHandler {
  async execute(query: GetUserQuery): Promise<UserResponse> {
    // Returns data - no side effects
  }
}

// ✅ Domain Events - Loose coupling
export class UserCreatedEvent implements IEvent {
  constructor(public readonly userId: string) {}
}
```

**Battle-tested principles:**
- **Command/Query Separation** - Writes vs reads clearly separated
- **Domain Events** - Decoupled communication between bounded contexts
- **Repository Pattern** - Abstract data access from business logic
- **Clean Architecture** - Dependencies point inward to domain

## After Generation

### 🔧 **Your 5-Minute Setup Checklist:**

```bash
# ✅ 1. Generated files are ready - Review structure
ls -la modules/your-feature/

# ✅ 2. Add business properties to entities
# Edit: application/domain/entities/[entity].entity.ts
#   Add: name: string; email: string; etc.

# ✅ 3. Update DTOs with validation rules  
# Edit: application/dto/requests/create-[entity].dto.ts
#   Add: @IsEmail() email: string; @IsNotEmpty() name: string;

# ✅ 4. Configure database mappings
# Edit: infrastructure/orm-entities/[entity].orm-entity.ts  
#   Add: @Column() name: string; @Column() email: string;

# ✅ 5. Wire up the module
# Edit: app.module.ts
#   Add: YourFeatureModule to imports array
```

### 🎯 **Focus on Business Value:**
```typescript
// ✅ Write business rules in domain services
export class OrderValidator {
  validateBusinessRules(order: Order): ValidationResult {
    // Your domain logic here - not infrastructure concerns
  }
}

// ✅ Add complex queries for reporting
@QueryHandler(GetMonthlyRevenueQuery) 
export class GetMonthlyRevenueHandler {
  async execute(query: GetMonthlyRevenueQuery) {
    // Complex business queries - not CRUD
  }
}

// ✅ Handle domain events for integration
@EventsHandler(OrderCreatedEvent)
export class OrderCreatedHandler {
  async handle(event: OrderCreatedEvent) {
    // Send emails, update analytics, etc.
  }
}
```

> **🚀 From scaffolding to production in minutes, not days**

## Why This CLI Exists

### 😤 **The Problem**
- Endless debates about folder structure
- Inconsistent naming across team members
- Copy-pasting boilerplate between features  
- Mixed patterns in the same codebase
- New developers spending weeks learning "our way"

### 🎯 **The Solution**
- **One structure** that works for all features
- **Zero configuration** - works out of the box
- **Battle-tested patterns** from real enterprise apps
- **Instant onboarding** - same structure everywhere
- **Focus on business logic** instead of architecture decisions

### 🏆 **The Result**
- 10x faster feature development
- Consistent codebase architecture
- Easy code reviews and maintenance
- New developers productive from day one
- No more "where does this file go?" questions

---

## Contributing & Development

### 🔧 **Local Development**

```bash
# Clone and setup
git clone https://github.com/eshe-huli/nestjs-ddd-cli
cd nestjs-ddd-cli
npm install

# Test changes locally
npm run dev -- generate entity Test -m test

# Build for production  
npm run build

# Test globally installed version
ddd generate entity Test -m test
```

### 🧪 **Testing Your Changes**

```bash
# Create a test project
mkdir test-project && cd test-project

# Test scaffolding
ddd scaffold Product -m inventory

# Verify structure matches expectations
tree modules/inventory/

# Test individual generators  
ddd generate service ProductValidator -m inventory
ddd generate event ProductCreated -m inventory
ddd generate query GetProductsByCategory -m inventory
```

### 📋 **Template Structure**
```
src/templates/
├── 📁 entity/           # Domain entity templates
├── 📁 service/          # Domain service templates  
├── 📁 event/            # Domain event templates
├── 📁 query/            # Query handler templates
├── 📁 usecase/          # Use case templates
├── 📁 controller/       # Controller templates
├── 📁 repository/       # Repository templates
└── 📁 ... (more templates)
```

> **🤝 Pull requests welcome!** Help make DDD development even better.

## License

MIT - Build amazing things 🚀