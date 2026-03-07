# Architecture

High-level architecture of NHL Stats 2.0, including system design, layers, data flow, and deployment topology.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client Browsers                             │
└───────────────────────┬─────────────────────────────────────────┘
                        │ HTTPS / HTTP (dev)
                        │
┌───────────────────────▼─────────────────────────────────────────┐
│             Azure Static Web Apps / S3 / Any CDN                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  React 18 + Vite (SPA)                                   │   │
│  │  - Pages (Login, Matches, Stats, Admin)                  │   │
│  │  - Context (Auth, Theme, Toasts)                         │   │
│  │  - Services (API Client, Auth)                           │   │
│  └──────────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────────┘
                        │ REST + JWT Token
                        │ /api/...
┌───────────────────────▼─────────────────────────────────────────┐
│            Azure App Service / On-Premise Server                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ASP.NET Core 10 Web API                                 │   │
│  │  - 15 REST Controllers                                   │   │
│  │  - Auth (JWT), CORS, Content Negotiation                 │   │
│  │  - Dependency Injection Container                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                        │                                         │
│  ┌─────────────────────▼──────────────────────────────────┐    │
│  │  Application Layer (Business Logic)                     │    │
│  │  - IUserService, ISeasonService, IMatchService, ...    │    │
│  │  - IStatsService, IUserPayoutService, ...              │    │
│  │  - DTOs, Mappers                                        │    │
│  └─────────────────────┬──────────────────────────────────┘    │
│                        │                                         │
│  ┌─────────────────────▼──────────────────────────────────┐    │
│  │  Domain Layer (Entities & Data Access)                  │    │
│  │  - Entity Framework Core DbContext                      │    │
│  │  - Entities: User, Team, Season, Match, UserMatch, ...  │    │
│  │  - Migrations, Seed Data                                │    │
│  └─────────────────────┬──────────────────────────────────┘    │
│                        │                                         │
│  ┌─────────────────────▼──────────────────────────────────┐    │
│  │  SQLite Database                                        │    │
│  │  - ~20 tables with relationships                        │    │
│  │  - Identity tables (Users, Roles)                       │    │
│  │  - Domain tables (Seasons, Matches, Stats, Payouts)    │    │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Backend Architecture: Clean/Layered Pattern

The backend follows Clean Architecture with three layers:

### 1. **NHLStats.Domain** — Database & Entities

Responsible for:
- **Entities:** User, Team, Season, Match, UserMatch, UserMatchPoint, MoneyConfig, Expense, etc.
- **DbContext:** `NhlStatsDbContext` extending `IdentityDbContext<ApplicationUser>`
- **Migrations:** EF Core migration history stored in `Migrations/` folder
- **Seed Data:** 32 NHL teams, default point reasons, money config

Key files:
- `NhlStatsDbContext.cs` — DbContext with all derived DbSets
- `Entities/` — Entity class definitions
- `Migrations/` — Auto-generated EF Core migrations
- `Identity/ApplicationUser.cs` — Extends ASP.NET Identity User

**Responsibilities:**
- Define what data exists
- Database schema via Fluent API
- No business logic; pure data modeling

### 2. **NHLStats.Application** — Business Logic & Services

Responsible for:
- **Service Interfaces:** `IUserService`, `ISeasonService`, `IMatchService`, `IStatsService`, etc.
- **Service Implementations:** Logic for users, seasons, matches, stats calculation, payouts
- **DTOs:** Data Transfer Objects for API contracts
- **Mappers:** Convert between entities and DTOs

Key files:
- `Interfaces/IUserService.cs`, `Services/UserService.cs` — User management
- `Interfaces/IStatsService.cs`, `Services/StatsService.cs` — Stats aggregation and calculations
- `Interfaces/ISeasonService.cs`, `Services/SeasonService.cs` — Season management
- `DTOs/` — Input/output contracts for APIs

**Responsibilities:**
- Implement business rules (how stats are calculated, payouts determined, etc.)
- Coordinate between controllers and database
- Validate inputs before persistence
- No HTTP/REST concerns; reusable across client types

### 3. **NHLStats.Api** — HTTP Layer

Responsible for:
- **Controllers:** 15 REST endpoints grouped by domain (Auth, Teams, Seasons, Matches, Stats, Users, etc.)
- **Dependency Injection:** Register all services in `Program.cs`
- **Authentication:** JWT Bearer token validation
- **CORS:** Cross-Origin Resource Sharing configuration
- **HTTP Middleware:** Error handling, logging, request/response pipelines

Key files:
- `Program.cs` — Startup configuration, service registration, middleware setup
- `Controllers/AuthController.cs` — Login, register, token generation
- `Controllers/{Resource}Controller.cs` — CRUD endpoints for each domain entity

**Responsibilities:**
- HTTP request/response handling
- Authentication & authorization
- Route definition and HTTP method mapping
- Status code selection (201, 400, 404, etc.)
- Delegate business logic to service layer

### Data Flow Example: Creating a Match

```
1. Frontend (React)
   ↓ POST /api/matches with JSON body
2. Controller (MatchesController.CreateAsync)
   ↓ Validate auth, extract JSON
3. Service (IMatchService.CreateAsync)
   ↓ Business logic: validate season exists, teams exist, etc.
4. Domain (NhlStatsDbContext)
   ↓ Save Match entity to SQLite
5. SQLite Database
   ↓ Persist and return ID
6. Service (returns MatchDto)
   ↓ Map Match entity to DTO (for API response)
7. Controller (returns 201 Created)
   ↓ HTTP 201 + JSON response
8. Frontend (React)
   ↓ Update state, display in UI
```

## Frontend Architecture: React + Context + Router

### Component Structure

```
frontend/src/
├── App.tsx                          # Root component, routes
├── index.tsx                        # Entry point, React DOM render
│
├── components/                      # Reusable UI components
│   ├── Header.tsx                   # Navigation, logout
│   ├── Sidebar.tsx                  # Admin navigation
│   ├── Forms/                       # Form components
│   └── ...
│
├── pages/                           # Page-level components (routes)
│   ├── LoginPage.tsx                # Public
│   ├── DashboardPage.tsx            # Protected
│   ├── admin/                       # Admin-only pages
│   │   ├── AdminDashboard.tsx
│   │   ├── UsersPage.tsx
│   │   └── ...
│   └── ...
│
├── context/                         # Global state (Context API)
│   ├── AuthContext.tsx              # User authentication state
│   ├── ThemeContext.tsx             # Dark/light mode
│   └── ToastContext.tsx             # Notifications
│
├── services/                        # Business logic (non-UI)
│   ├── apiClient.ts                 # Axios HTTP client with JWT interceptor
│   ├── authService.ts               # Auth-specific helpers
│   └── ...
│
├── hooks/                           # Custom React hooks
│   ├── useAuth.ts                   # Access AuthContext
│   ├── useToast.ts                  # Trigger notifications
│   └── ...
│
├── mocks/                           # MSW mock handlers (testing)
│   ├── handlers.ts                  # Mock API endpoints
│   └── server.ts                    # MSW setup
│
├── i18n/                            # Internationalization
│   ├── config.ts                    # i18next setup
│   └── locales/                     # Translation files
│
└── styles/
    ├── tailwind.css                 # Tailwind CSS config
    └── globals.css                  # Global styles
```

### State Management: React Context

Three global contexts handle app state:

#### 1. **AuthContext** — User & Authentication

```typescript
interface AuthContextType {
  user: User | null;                           // Current user
  token: string | null;                        // JWT token
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
}
```

- Stored in memory (cleared on page refresh)
- JWT token persisted in `localStorage`
- Axios interceptor auto-attaches token to requests

#### 2. **ThemeContext** — UI Theme

```typescript
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}
```

- Persisted in `localStorage`
- Synced across browser tabs via `storage` event

#### 3. **ToastContext** — Notifications

```typescript
interface ToastContextType {
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  toasts: Toast[];
}
```

- In-memory queue
- Auto-dismiss after 5 seconds

### Routing: React Router v7

```typescript
// Public routes
/                                   # Login/Home
/register                          # Registration

// Protected routes (require auth)
/dashboard                         # User dashboard
/stats                            # User stats
/matches/:id                       # Match detail

// Admin routes (require auth + admin role)
/admin/                            # Admin dashboard
/admin/users                       # User management
/admin/seasons                     # Season management
/admin/matches                     # Match management
/admin/stats                       # Stats management
/admin/payouts                     # Payout management
```

`ProtectedRoute` component wraps routes, redirects to login if not authenticated.

### Data Fetching & Caching

**Axios client** (`apiClient.ts`):
- Singleton instance
- JWT interceptor (adds token to all requests)
- Error interceptor (handles 401 → logout)
- Base URL: `http://localhost:5267` (dev) or environment variable (prod)

Example usage:

```typescript
const response = await apiClient.get('/api/seasons/current');
const season: Season = response.data;
```

No caching library (Redux, React Query) — each page fetches data independently. For complex data needs, add React Query or Zustand in future.

## Authentication Flow

```
Browser                         API Server
   │                              │
   ├─── POST /api/auth/login ────→│
   │     {email, password}         │
   │                              ├─ Find user
   │                              ├─ Verify password
   │                              ├─ Generate JWT
   │                              │
   │←─────── 200 OK ──────────────┤
   │         {token}              │
   │                              │
   ├─ Store token in localStorage │
   ├─ Set AuthContext.token       │
   │                              │
   ├─ GET /api/users/profile ────→│
   │ Authorization: Bearer <token>│
   │                              ├─ Validate JWT signature
   │                              ├─ Validate issuer/audience
   │                              ├─ Validate expiration
   │                              ├─ Extract user from claims
   │                              │
   │←───── 200 OK ────────────────┤
   │      {user data}             │
```

## Database Schema Relationships

```
ApplicationUser (ASP.NET Identity)
  ├── SeasonUsers (many) ─→ Season
  ├── UserMatches (many) ─→ Match, Season
  └── Expenses (many)

Team
  ├── SeasonUsers (many) ─→ Season, User
  ├── RosterPlayers (many) ─→ Season
  ├── Matches (many) [as home or away team]
  └── PointReasons (many)

Season
  ├── SeasonUsers (many) ─→ User, Team
  ├── Matches (many)
  ├── RosterPlayers (many) ─→ Team
  ├── Expenses (many)
  └── ParentSeason [self-reference, e.g., Playoffs]

Match
  ├── UserMatches (many) ─→ User, Season
  ├── Season
  ├── HomeTeam ─→ Team
  └── AwayTeam ─→ Team

UserMatch
  ├── UserMatchPoints (many) ─→ PointReason
  ├── UserMatchGoals (many)
  ├── UserMatchPenalties (many)
  ├── User
  ├── Match
  └── Season

MoneyConfig
  └── Applied to UserMatchPoints for payout calculations

Expense
  └── Deducted from payouts
```

## Deployment Topology

### Development (Local)

```
Localhost
├── Frontend (Vite dev server, port 5173)
│   └── Proxies /api → Backend
│
└── Backend (dotnet run, port 5267)
    └── Reads from SQLite ~/data/nhlstats.db
```

### Production (Azure)

```
Internet
  ├── HTTPS → Azure Static Web Apps (Frontend)
  │           - React SPA (index.html)
  │           - Fallback to index.html for SPA routing
  │           - Cached globally via CDN
  │
  └── HTTPS → Azure App Service (Backend)
              - ASP.NET Core API
              - SQLite database
              - Auto-scaling based on CPU/RAM

GitHub Actions CI/CD:
  ├── Push to main → Backend workflow
  │   ├── Build & test
  │   ├── Create artifact
  │   └── Deploy to App Service
  │
  └── Push to main → Frontend workflow
      ├── Build (tsc + vite)
      ├── Create artifact
      └── Deploy to Static Web Apps
```

## Key Design Principles

1. **Separation of Concerns**
   - Controllers → HTTP only
   - Services → Business logic only
   - Entities → Data modeling only

2. **Dependency Injection**
   - Services registered in DI container (`Program.cs`)
   - Controllers receive services via constructor

3. **Stateless APIs**
   - Each request is independent
   - No server-side session state
   - JWT enables stateless auth

4. **React Patterns**
   - Components are pure (same props → same render)
   - Context for global state
   - Hooks for reusable logic
   - Page components manage their own data fetching

5. **Security**
   - JWT tokens for auth
   - Password hashing (ASP.NET Identity)
   - CORS for browser security
   - [Authorize] attribute for endpoint protection

## Performance Considerations

### Backend

- **Query Optimization**: Use `.Include()` to avoid N+1 queries
- **Pagination**: Large datasets paginated (not implemented yet; add limit/offset params)
- **Caching**: Rarely-changing data (Teams, PointReasons) cached in memory (consider adding)

### Frontend

- **Code Splitting**: Vite splits React, Recharts, i18n into separate chunks
- **Lazy Loading**: Pages loaded on demand (add React.lazy if needed)
- **State Minimization**: Only essential state in Context

## Monitoring & Logging

### Backend

- Console logging via `ILogger`
- Application Insights integration (in progress)
- Health endpoint for load balancer: `GET /health`

### Frontend

- Browser console (dev)
- Sentry integration (future)
- User session tracking (future)

## Key Dependencies

### Backend

| Package | Purpose | Version |
|---------|---------|---------|
| Microsoft.AspNetCore.OpenApi | API docs | 10.x |
| Microsoft.AspNetCore.Identity.EntityFrameworkCore | Auth | 10.x |
| Microsoft.EntityFrameworkCore.Sqlite | ORM + SQLite | 10.x |
| xUnit | Testing | 2.x |
| FluentAssertions | Test assertions | 7.x |

### Frontend

| Package | Purpose | Version |
|---------|---------|---------|
| React | UI framework | 18.x |
| React Router | Routing | 7.x |
| Tailwind CSS | Styling | 3.x |
| Recharts | Charts | 3.x |
| i18next | Internationalization | 25.x |
| Vitest | Testing | 1.x |
| MSW | Mock API | 1.x |

Last Updated: March 2026
