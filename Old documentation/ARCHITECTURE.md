# NHLStats Architecture Guide

This document provides a comprehensive overview of the NHLStats application architecture, design patterns, and technical decisions.

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Clean Architecture](#clean-architecture)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Data Flow](#data-flow)
7. [Design Patterns](#design-patterns)
8. [Cross-Cutting Concerns](#cross-cutting-concerns)
9. [Testing Strategy](#testing-strategy)
10. [Security](#security)
11. [Performance Considerations](#performance-considerations)

---

## Overview

NHLStats is a full-stack web application for tracking NHL player statistics and game results. It follows a clean architecture pattern with clear separation between:

- **Presentation Layer** (React Frontend + ASP.NET Core API)
- **Business Logic Layer** (Application Services)
- **Domain Layer** (Core Business Entities)
- **Data Access Layer** (Entity Framework Core)

The application is designed to run on Linux in containerized environments with emphasis on observability, maintainability, and testability.

---

## Technology Stack

### Backend
- **Runtime**: .NET 10.0
- **Framework**: ASP.NET Core (Minimal APIs & Controllers)
- **ORM**: Entity Framework Core
- **Database**: PostgreSQL (production) / SQLite (development)
- **Validation**: FluentValidation (planned)
- **Logging**: Microsoft.Extensions.Logging with structured logging

### Frontend
- **Runtime**: Node.js 18+
- **Framework**: React 18.3.1
- **Language**: TypeScript 5.3.3
- **Build Tool**: Vite 5.1.4
- **Styling**: Tailwind CSS 3.4.1
- **Icons**: Lucide React 0.344.0
- **Charts**: Recharts 2.12.0
- **State Management**: React Context (built-in)

### DevOps & Tools
- **Version Control**: Git
- **CI/CD**: GitHub Actions (planned)
- **Containerization**: Docker (planned)
- **Database Migrations**: SQL scripts + EF Core Migrations

---

## Clean Architecture

### Layers

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (API Controllers, React Components)    │
├─────────────────────────────────────────┤
│         Application Layer               │
│   (Services, DTOs, Validation)          │
├─────────────────────────────────────────┤
│           Domain Layer                  │
│  (Entities, Value Objects, Exceptions)  │
├─────────────────────────────────────────┤
│        Infrastructure Layer             │
│  (DbContext, Repositories, External)    │
└─────────────────────────────────────────┘
```

### Dependency Rules

1. **Domain** has no dependencies on other layers
2. **Application** depends only on Domain
3. **Infrastructure** depends on Domain and Application (abstractions)
4. **API** depends on Application (and Infrastructure for DI registration)

### Layer Responsibilities

#### Domain Layer (`Backend/src/Domain/`)
- **Purpose**: Pure business logic with no external dependencies
- **Contents**:
  - Entities (User, Team, Player, Match, etc.)
  - Enums (MatchLifecycleState, SeasonStatus, etc.)
  - Domain-specific exceptions
  - Business invariants and validation rules
  - EF Core DbContext and migrations
- **Rules**:
  - No framework dependencies (except EF Core for persistence)
  - No application logic or orchestration
  - Entities are POCO classes with minimal logic

#### Application Layer (`Backend/src/Application/`)
- **Purpose**: Application business logic and orchestration
- **Contents**:
  - Service interfaces and implementations
  - DTOs for data transfer
  - Validation services
  - Observability abstractions (correlation context)
- **Rules**:
  - Orchestrates domain objects and infrastructure
  - Maps between domain entities and DTOs
  - Implements use cases
  - No direct database access (uses abstractions)

#### Infrastructure Layer (Currently part of Domain)
- **Purpose**: External concerns and data access
- **Contents**:
  - EF Core DbContext implementation
  - Database migrations
  - Repository implementations
  - External service clients (future)
- **Rules**:
  - Implements application abstractions
  - Handles data persistence
  - Manages external integrations

#### API Layer (`Backend/src/Api/`)
- **Purpose**: HTTP endpoints and API concerns
- **Contents**:
  - Controllers (Match, Player, User, etc.)
  - API-specific DTOs and error responses
  - Middleware (correlation, error handling, security headers)
  - Swagger/OpenAPI configuration
  - DI composition root
- **Rules**:
  - Thin controllers - delegate to application services
  - Handle HTTP concerns only
  - Map between API DTOs and application DTOs
  - Return consistent error responses

---

## Backend Architecture

### Project Structure

```
Backend/
├── src/
│   ├── Api/                    # HTTP API layer
│   │   ├── Controllers/        # REST endpoints
│   │   ├── Middleware/         # Request pipeline
│   │   ├── Errors/             # Error response DTOs
│   │   └── Swagger/            # API documentation
│   ├── Application/            # Business logic
│   │   ├── Services/           # Application services
│   │   ├── Dtos/               # Data transfer objects
│   │   ├── Interfaces/         # Service abstractions
│   │   ├── Validation/         # Validation services
│   │   └── Observability/      # Correlation context
│   └── Domain/                 # Core domain
│       ├── Entities/           # Domain entities
│       ├── Enums/              # Domain enumerations
│       ├── Exceptions/         # Domain exceptions
│       └── Migrations/         # EF Core migrations
├── tests/
│   └── Api.IntegrationTests/   # API integration tests
└── db/
    └── migrations/             # SQL migration scripts
```

### Request Pipeline

```
HTTP Request
    ↓
[CorrelationMiddleware] → Generate/propagate correlation & trace IDs
    ↓
[SecurityHeadersMiddleware] → Add security headers
    ↓
[ExceptionHandlingMiddleware] → Catch exceptions, return error DTOs
    ↓
[Controller] → Route to action, validate request
    ↓
[Application Service] → Execute business logic
    ↓
[Repository/DbContext] → Query/persist data
    ↓
[Application Service] → Map to DTOs
    ↓
[Controller] → Return HTTP response
    ↓
HTTP Response (with X-Correlation-Id, X-Trace-Id)
```

### Dependency Injection

Each layer exposes a `DependencyInjection.cs` file with extension methods:

```csharp
// In Program.cs (Api layer)
builder.Services
    .AddDomainServices()           // Domain layer registration
    .AddApplicationServices()      // Application layer registration
    .AddApiServices();             // API layer registration
```

**Benefits**:
- Layer-specific service registration
- Composition root in API layer
- Easy to test and mock services

### Data Access Pattern

Currently using **EF Core DbContext** directly in services:

```csharp
public class MatchService
{
    private readonly NHLStatsDbContext _context;
    
    public async Task<MatchDto> GetMatchAsync(Guid id)
    {
        var match = await _context.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .FirstOrDefaultAsync(m => m.Id == id);
            
        return MapToDto(match);
    }
}
```

**Planned**: Repository pattern for complex queries and better testability.

---

## Frontend Architecture

### Project Structure

```
Frontend/
├── src/
│   ├── features/              # Feature modules
│   │   ├── Dashboard.tsx      # Dashboard view
│   │   ├── CurrentSeason.tsx  # Season view
│   │   └── History.tsx        # History view
│   ├── components/            # Shared UI components
│   │   ├── Sidebar.tsx        # Navigation
│   │   ├── TopBar.tsx         # Header
│   │   ├── Card.tsx           # Card components
│   │   ├── PlusMinusChart.tsx # Charts
│   │   ├── LoadingSpinner.tsx # Loading state
│   │   └── ErrorMessage.tsx   # Error display
│   ├── App.tsx                # Root component & routing
│   ├── main.tsx               # Entry point
│   ├── styles.css             # Global styles & design system
│   ├── config.ts              # Configuration
│   └── types.ts               # TypeScript types
├── index.html                 # HTML template
├── vite.config.ts             # Vite configuration
└── tailwind.config.js         # Tailwind CSS config
```

### Component Architecture

**Feature-Based Organization**:
- Each major feature has its own directory
- Feature components can import shared components
- Features are self-contained with their own types and logic

**Shared Components**:
- Reusable UI elements (buttons, cards, inputs)
- Layout components (sidebar, topbar)
- Generic utilities (loading, error states)

### Design System

Implemented via Tailwind CSS with custom theme:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#22d3ee',    // Cyan-400
        secondary: '#fb923c',  // Orange-400
        background: '#0f172a', // Slate-900
      }
    }
  }
}
```

**Custom CSS Classes** (in `styles.css`):
- `.glass` - Glass morphism effect
- `.glow` - Cyan glow shadow
- `.neon-text` - Accent text
- `.btn-primary` - Primary button
- `.card-glass` - Glass card

### State Management

Currently using **React built-in state**:
- `useState` for local component state
- `useContext` for shared state (planned)
- No external state library (Redux, Zustand) yet

**Planned**: Context API for user preferences and shared data.

---

## Data Flow

### Backend Data Flow

```
Controller
    ↓ (Request DTO)
Application Service
    ↓ (Domain operations)
DbContext/Repository
    ↓ (Query/Persist)
Database
    ↑ (Entity)
Application Service
    ↓ (Map to Response DTO)
Controller
    ↓ (HTTP Response)
Client
```

### Frontend Data Flow (Planned)

```
User Action
    ↓
Event Handler
    ↓
API Client (fetch)
    ↓
Backend API
    ↓
Response DTO
    ↓
State Update (useState/Context)
    ↓
Component Re-render
    ↓
UI Update
```

---

## Design Patterns

### Backend Patterns

#### 1. Service Layer Pattern
All business logic is encapsulated in service classes:

```csharp
public interface IMatchService
{
    Task<MatchDto> GetMatchAsync(Guid id);
    Task<MatchDto> CreateMatchAsync(CreateMatchDto dto);
    Task<MatchDto> UpdateMatchAsync(Guid id, UpdateMatchDto dto);
}
```

#### 2. DTO Pattern
Separate DTOs for API contracts vs domain entities:

```csharp
// API DTO
public record CreateMatchDto(
    Guid SeasonPhaseId,
    Guid HomeTeamId,
    Guid AwayTeamId
);

// Domain Entity
public class Match
{
    public Guid Id { get; set; }
    public Guid SeasonPhaseId { get; set; }
    public SeasonPhase SeasonPhase { get; set; }
    // ... navigation properties
}
```

#### 3. Repository Pattern (Planned)
Abstraction over data access:

```csharp
public interface IMatchRepository
{
    Task<Match?> GetByIdAsync(Guid id);
    Task<IEnumerable<Match>> GetAllAsync();
    Task AddAsync(Match match);
    Task UpdateAsync(Match match);
    Task DeleteAsync(Guid id);
}
```

#### 4. Unit of Work Pattern (via DbContext)
EF Core DbContext acts as a unit of work:

```csharp
await _context.Matches.AddAsync(match);
await _context.SaveChangesAsync();
```

### Frontend Patterns

#### 1. Component Composition
Building complex UIs from simple components:

```tsx
<Dashboard>
  <TopBar playerName="..." playerStats={...} />
  <Sidebar activePage="dashboard" />
  <StatCard title="Plus" value={stats.plus} />
</Dashboard>
```

#### 2. Custom Hooks (Planned)
Encapsulate reusable logic:

```tsx
function useMatchData(matchId: string) {
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchMatch(matchId).then(setMatch).finally(() => setLoading(false));
  }, [matchId]);
  
  return { match, loading };
}
```

#### 3. Container/Presenter Pattern
Separate data fetching from presentation:

```tsx
// Container (data logic)
function MatchContainer({ id }) {
  const { match, loading } = useMatchData(id);
  return <MatchPresenter match={match} loading={loading} />;
}

// Presenter (UI only)
function MatchPresenter({ match, loading }) {
  if (loading) return <LoadingSpinner />;
  return <div>{match.homeTeam} vs {match.awayTeam}</div>;
}
```

---

## Cross-Cutting Concerns

### Observability

#### Correlation & Trace IDs
Every request gets unique identifiers:

```
X-Correlation-Id: a1b2c3d4-e5f6-7890-abcd-ef1234567890  (logical operation)
X-Trace-Id: f1e2d3c4-b5a6-7890-cdef-ab9876543210       (single request)
```

**Implementation**:
- `CorrelationMiddleware` generates or propagates IDs
- `ICorrelationContextAccessor` provides access to IDs
- IDs are logged with every log entry
- IDs are included in all error responses

#### Structured Logging

```csharp
_logger.LogInformation(
    "Match {MatchId} created by user {UserId}",
    match.Id,
    correlationContext.UserId
);
```

**Log Output** (JSON):
```json
{
  "timestamp": "2026-03-01T10:15:30Z",
  "level": "Information",
  "message": "Match a1b2... created by user f1e2...",
  "correlationId": "a1b2c3d4-...",
  "traceId": "f1e2d3c4-...",
  "matchId": "a1b2...",
  "userId": "f1e2..."
}
```

### Error Handling

Centralized exception handling middleware:

```csharp
app.UseMiddleware<ExceptionHandlingMiddleware>();
```

**Exception → HTTP Response Mapping**:
- `NotFoundException` → 404 Not Found
- `ValidationException` → 400 Bad Request
- `ConflictException` → 409 Conflict
- `Exception` → 500 Internal Server Error

**Error Response**:
```json
{
  "code": "NOT_FOUND",
  "message": "Match not found",
  "traceId": "...",
  "correlationId": "...",
  "validationErrors": null
}
```

### Validation

Request validation at multiple levels:

1. **Data Annotations** (basic):
   ```csharp
   public record CreateMatchDto(
       [Required] Guid SeasonPhaseId,
       [Range(0, int.MaxValue)] int? HomeScore
   );
   ```

2. **Service Layer** (business rules):
   ```csharp
   if (dto.HomeTeamId == dto.AwayTeamId)
       throw new ValidationException("Home and away teams must be different");
   ```

3. **FluentValidation** (planned for complex validation)

### Security

#### Security Headers
Added by `SecurityHeadersMiddleware`:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

**Planned**:
- `Content-Security-Policy`
- `Strict-Transport-Security` (when HTTPS enforced)

#### Authentication & Authorization (Planned)
- JWT Bearer tokens
- Role-based access control (RBAC)
- API key authentication for service-to-service

---

## Testing Strategy

### Backend Testing

#### Integration Tests
Located in `Backend/tests/Api.IntegrationTests/`:

```csharp
public class MatchEndpointTests : IClassFixture<TestApiFactory>
{
    [Fact]
    public async Task GetMatch_ReturnsMatch()
    {
        // Arrange
        var client = _factory.CreateClient();
        
        // Act
        var response = await client.GetAsync("/api/Match/{id}");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

**Uses**:
- `WebApplicationFactory<T>` for in-memory test server
- In-memory SQLite database
- Real HTTP calls to endpoints

#### Unit Tests (Planned)
- Test services in isolation
- Mock DbContext/repositories
- Test business logic without database

### Frontend Testing (Planned)

#### Component Tests
Using Vitest + React Testing Library:

```tsx
describe('MatchCard', () => {
  it('renders match details', () => {
    render(<MatchCard match={mockMatch} />);
    expect(screen.getByText('COL vs EDM')).toBeInTheDocument();
  });
});
```

#### E2E Tests (Planned)
Using Playwright or Cypress for full user flows.

---

## Security

### Current Security Measures

1. **Security Headers** - Prevent common attacks (XSS, clickjacking)
2. **Input Validation** - Validate all user inputs
3. **SQL Injection Protection** - Parameterized queries via EF Core
4. **No Secrets in Code** - Configuration from environment variables

### Planned Security Enhancements

1. **Authentication**:
   - JWT bearer tokens
   - Refresh tokens
   - Token expiration

2. **Authorization**:
   - Role-based access control
   - Resource-based authorization
   - Least privilege principle

3. **HTTPS**:
   - TLS 1.2+ only
   - HSTS headers
   - Certificate pinning

4. **API Security**:
   - Rate limiting
   - CORS configuration
   - API versioning

5. **Data Protection**:
   - Sensitive data encryption
   - PII handling compliance
   - Audit logging

---

## Performance Considerations

### Backend Performance

#### Database Optimization
- **Indexes**: Created on foreign keys and frequently queried fields
- **Eager Loading**: Use `.Include()` to avoid N+1 queries
- **Pagination**: Implement for large result sets
- **Query Optimization**: Use compiled queries for repeated operations

```csharp
// Good: Single query with includes
var matches = await _context.Matches
    .Include(m => m.HomeTeam)
    .Include(m => m.AwayTeam)
    .ToListAsync();

// Bad: N+1 problem
var matches = await _context.Matches.ToListAsync();
foreach (var match in matches)
{
    var homeTeam = await _context.Teams.FindAsync(match.HomeTeamId);
}
```

#### Caching (Planned)
- In-memory caching for reference data (teams, seasons)
- Distributed caching (Redis) for session data
- Response caching for expensive queries

#### Async/Await
All I/O operations are asynchronous:

```csharp
public async Task<MatchDto> GetMatchAsync(Guid id)
{
    var match = await _context.Matches.FindAsync(id);
    return MapToDto(match);
}
```

### Frontend Performance

#### Code Splitting
Vite automatically splits code by route:

```tsx
const Dashboard = lazy(() => import('./features/Dashboard'));
const History = lazy(() => import('./features/History'));
```

#### Memoization
Use `useMemo` and `useCallback` for expensive computations:

```tsx
const sortedMatches = useMemo(
  () => matches.sort((a, b) => a.matchDate - b.matchDate),
  [matches]
);
```

#### Virtual Scrolling (Planned)
For large lists of matches or players.

---

## Database Strategy

### Migration Approach

**Dual Strategy**:
1. **SQL Scripts** (`Backend/db/migrations/`) - Sequential numbered scripts
2. **EF Core Migrations** (`Backend/src/Domain/Migrations/`) - Code-first migrations

**Why Both?**
- SQL scripts for explicit schema control
- EF Core migrations for model synchronization
- SQL scripts as source of truth for deployments

### Schema Evolution

1. Create SQL migration script (`XXX_description.sql`)
2. Apply to database manually or via migration tool
3. Generate EF Core migration to sync model
4. Commit both to version control

---

## Future Enhancements

### Backend
- [ ] Implement repository pattern
- [ ] Add FluentValidation
- [ ] Integrate distributed caching (Redis)
- [ ] Add background jobs (Hangfire)
- [ ] Implement domain events
- [ ] Add API versioning
- [ ] Integrate OpenTelemetry for tracing

### Frontend
- [ ] API integration with backend
- [ ] State management (Context API or Zustand)
- [ ] Real-time updates (SignalR)
- [ ] Progressive Web App (PWA) support
- [ ] Offline mode
- [ ] Mobile responsive improvements

### DevOps
- [ ] Docker containerization
- [ ] Kubernetes deployment
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Automated testing
- [ ] Infrastructure as Code (Terraform)
- [ ] Monitoring & alerting (Prometheus, Grafana)

---

## Conclusion

NHLStats follows modern software architecture principles with clear separation of concerns, testability, and maintainability. The clean architecture approach ensures the codebase can evolve without major refactoring, while the observability features provide deep insights into application behavior.

For specific implementation details, see:
- [API Reference](API.md)
- [Database Schema](DATABASE.md)
- [Development Guide](DEVELOPMENT.md)
