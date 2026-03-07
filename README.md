# NHL Stats 2.0

Full-stack web application for tracking NHL (PlayStation/Xbox) player statistics, earnings, and payouts.

**[→ Start Here: Quick Setup](docs/SETUP.md)**

## Overview

- **Backend**: ASP.NET Core 10 Web API with Clean Architecture, Entity Framework Core, SQLite
- **Frontend**: React 18 + Vite + TypeScript, Tailwind CSS, Recharts for data visualization
- **Auth**: ASP.NET Identity + JWT tokens
- **Deployment**: Azure App Service (API) + Azure Static Web Apps (frontend)
- **Dev Approach**: TDD with xUnit (backend) and Vitest (frontend)

## Quick Start

### Prerequisites
- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- Git

### 3-Minute Setup

```bash
# 1. Clone & navigate
git clone https://github.com/singent/nhl-stats-2.0.git
cd "NHLStats 2.0"

# 2. Backend (port 5267)
cd backend
dotnet restore
dotnet run --project src/NHLStats.Api

# 3. In new terminal, Frontend (port 5173)
cd frontend
npm install
npm run dev

# 4. Open browser
open http://localhost:5173
```

**Full setup guide:** [docs/SETUP.md](docs/SETUP.md)

## Documentation

Complete documentation for developers, operations, and maintainers:

| Document | Purpose |
|----------|---------|
| **[STRUCTURE.md](docs/STRUCTURE.md)** | Documentation map — where to find what |
| **[SETUP.md](docs/SETUP.md)** | Complete local development setup |
| **[ENVIRONMENT.md](docs/ENVIRONMENT.md)** | All environment variables and configuration |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | System design, layers, data flow |
| **[FEATURES.md](docs/FEATURES.md)** | Core features and functionality |
| **[DATABASE.md](docs/DATABASE.md)** | Database schema, entities, migrations |
| **[API.md](docs/API.md)** | REST API endpoint reference |
| **[TESTING.md](docs/TESTING.md)** | Testing strategy and patterns |
| **[CONTRIBUTING.md](docs/CONTRIBUTING.md)** | Developer guidelines and workflow |
| **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** | Production deployment on Azure |
| **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** | Common issues and solutions |

**→ [Full Documentation Index](docs/STRUCTURE.md)**

## Project Structure

```
NHLStats 2.0/
├── backend/
│   ├── src/
│   │   ├── NHLStats.Api/              # Web API controllers
│   │   ├── NHLStats.Application/      # Business logic services
│   │   └── NHLStats.Domain/           # Entities, DbContext, migrations
│   └── tests/
│       ├── NHLStats.Api.Tests/        # Integration tests
│       ├── NHLStats.Application.Tests/
│       └── NHLStats.Domain.Tests/
│
├── frontend/
│   └── src/
│       ├── pages/                      # Page components
│       ├── components/                 # Reusable components
│       ├── context/                    # Global state (Auth, Theme, Toast)
│       ├── services/                   # API client, auth service
│       ├── mocks/                      # MSW mock handlers (testing)
│       └── __tests__/                  # Component tests
│
├── docs/                               # Documentation (this folder)
└── .github/workflows/                  # CI/CD pipelines
```

## Key Features

### User Features
- User registration and login
- Browse seasons and join teams
- Record match statistics (points, goals, penalties)
- Track personal earnings and payouts
- View performance charts and leaderboards

### Admin Features
- Manage seasons and matches
- Configure point reasons and payout rates
- Track expenses and calculate payouts
- Manage users and teams
- Export reports and analytics

## Development

### Running Tests

**Backend:**
```bash
cd backend
dotnet test                              # Run all tests
dotnet test tests/NHLStats.Api.Tests    # Specific test project
```

**Frontend:**
```bash
cd frontend
npm test                                 # Run once
npm run test:watch                       # Watch mode
```

### Building for Production

**Backend:**
```bash
cd backend
dotnet build --configuration Release
```

**Frontend:**
```bash
cd frontend
npm run build                            # Creates dist/
npm run preview                          # Preview production build
```

## Contributing

We follow TDD (Test-Driven Development) and a structured workflow.

**[→ Contributing Guidelines](docs/CONTRIBUTING.md)**

1. **Create feature branch** from `main`
2. **Write failing test first**
3. **Implement code to pass test**
4. **Submit pull request**
5. **Wait for review and CI/CD to pass**
6. **Merge to main**

## Deployment

Deployed on Azure with GitHub Actions CI/CD.

- **Backend**: Azure App Service (http://localhost:5267)
- **Frontend**: Azure Static Web Apps
- **Database**: SQLite (development) / Azure SQL (production)

**[→ Deployment Guide](docs/DEPLOYMENT.md)**

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 | UI framework |
| **Frontend** | Vite | Build tool |
| **Frontend** | TypeScript | Type safety |
| **Frontend** | Tailwind CSS | Styling |
| **Frontend** | Recharts | Data visualization |
| **Frontend** | React Router 7 | Client-side routing |
| **Frontend** | i18next | Internationalization |
| **Frontend** | Vitest | Testing framework |
| **Frontend** | MSW | API mocking |
| **Backend** | ASP.NET Core 10 | Web API |
| **Backend** | Entity Framework Core | ORM |
| **Backend** | SQLite | Database |
| **Backend** | ASP.NET Identity | Authentication |
| **Backend** | JWT | Token-based auth |
| **Backend** | xUnit | Testing framework |
| **Backend** | FluentAssertions | Test assertions |
| **DevOps** | GitHub Actions | CI/CD |
| **DevOps** | Azure App Service | Backend hosting |
| **DevOps** | Azure Static Web Apps | Frontend hosting |

## Architecture Highlights

- **Clean Architecture** — Separation of concerns with three layers (API, Application, Domain)
- **Dependency Injection** — Loose coupling and testability
- **JWT Authentication** — Stateless, token-based auth
- **TDD Approach** — Write tests first, implement code
- **Responsive Frontend** — Works on desktop, tablet, mobile
- **Azure Cloud** — Scalable, managed platform

**[→ Architecture Deep Dive](docs/ARCHITECTURE.md)**

## Health Check

Verify everything is working:

```bash
# Backend health
curl http://localhost:5267/health
# Response: {"status":"Healthy"}

# Frontend
open http://localhost:5173
# Should see login page
```

## Troubleshooting

Common issues and solutions:

- **Port in use**: [TROUBLESHOOTING.md#port-already-in-use](docs/TROUBLESHOOTING.md)
- **Database locked**: [TROUBLESHOOTING.md#database-connection-failed](docs/TROUBLESHOOTING.md)
- **CORS errors**: [TROUBLESHOOTING.md#cors-errors-in-browser](docs/TROUBLESHOOTING.md)
- **API calls failing**: [TROUBLESHOOTING.md#api-calls-returning-404](docs/TROUBLESHOOTING.md)

**[→ Full Troubleshooting Guide](docs/TROUBLESHOOTING.md)**

## Environment Variables

Development comes with sensible defaults. Production requires secrets in environment:

**Backend:**
```
Jwt__Secret=<min-32-chars>
Jwt__Issuer=NHLStats
Jwt__Audience=NHLStatsClient
AllowedOrigins=https://frontend.example.com
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<secure-password>
```

**Frontend:**
```
VITE_API_BASE_URL=https://api.example.com
```

**[→ Full Environment Configuration](docs/ENVIRONMENT.md)**

## Performance

- **Database**: Optimized queries with EF Core includes
- **Frontend**: Code splitting with Vite (React, Recharts, i18n chunks)
- **API**: Health check endpoint at `/health`
- **CDN**: Azure Static Web Apps serves from global CDN

## Security

- **Authentication**: JWT token validation
- **Authorization**: Role-based access control via ASP.NET Identity
- **CORS**: Configured to allowed origins only
- **Secrets**: Stored in environment variables / Azure Key Vault
- **Password**: Hashed with ASP.NET Identity
- **Validation**: Input validation on frontend and backend

## Support

- **Issues**: GitHub Issues
- **Docs**: [docs/](docs/)
- **Email**: admin@nhl-stats.local (development)

## License

Internal project.

## Last Updated

March 2026

---

**[→ Start with Setup Guide](docs/SETUP.md)** | **[→ View All Docs](docs/STRUCTURE.md)**
