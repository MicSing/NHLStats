# NHLStats Development Guide

Complete guide for setting up, developing, and contributing to the NHLStats project.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting Started](#getting-started)
3. [Project Setup](#project-setup)
4. [Development Workflow](#development-workflow)
5. [Running the Application](#running-the-application)
6. [Database Management](#database-management)
7. [Testing](#testing)
8. [Code Style & Conventions](#code-style--conventions)
9. [Common Tasks](#common-tasks)
10. [Troubleshooting](#troubleshooting)
11. [Contributing](#contributing)

---

## Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| .NET SDK | 10.0+ | [Download](https://dotnet.microsoft.com/download) |
| Node.js | 18+ | [Download](https://nodejs.org/) |
| npm | 9+ | Included with Node.js |
| Git | Latest | [Download](https://git-scm.com/) |
| PostgreSQL | 14+ (production) | [Download](https://www.postgresql.org/) |

### Optional Tools

- **VS Code** - Recommended editor with extensions:
  - C# Dev Kit
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
- **Postman** or **Insomnia** - API testing
- **Docker** - For containerized development (planned)
- **pgAdmin** - PostgreSQL GUI

### Verify Installation

```bash
# Check .NET version
dotnet --version
# Should output: 10.0.x or higher

# Check Node.js version
node --version
# Should output: v18.x.x or higher

# Check npm version
npm --version
# Should output: 9.x.x or higher

# Check Git version
git --version
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/singent/NHLStats.git
cd NHLStats
```

### 2. Explore the Structure

```
NHLStats/
├── Backend/          # C# .NET backend
│   ├── src/          # Source code
│   ├── tests/        # Tests
│   └── db/           # Database migrations
├── Frontend/         # React TypeScript frontend
│   └── src/          # Source code
├── docs/             # Documentation
└── .github/          # GitHub workflows & instructions
```

---

## Project Setup

### Backend Setup

#### 1. Navigate to Backend Directory

```bash
cd Backend
```

#### 2. Restore NuGet Packages

```bash
dotnet restore
```

#### 3. Build the Solution

```bash
dotnet build
```

#### 4. Configure Database Connection

Create or edit `Backend/src/Api/appsettings.Development.json`:

```json
{
  "ConnectionStrings": {
    "Primary": "Host=localhost;Database=nhlstats;Username=your_user;Password=your_password"
  },
  "EnableSwagger": true
}
```

For SQLite (development only):
```json
{
  "ConnectionStrings": {
    "Primary": "Data Source=Backend/db/nhlstats.db"
  }
}
```

**Note**: You can also use environment variables:

```bash
export ConnectionStrings__Primary="Host=localhost;Database=nhlstats;..."
export DATABASE_FILE="/path/to/nhlstats.db"
```

#### 5. Apply Database Migrations

```bash
cd src/Domain
dotnet ef database update --startup-project ../Api
```

Or run the SQL migration scripts manually:

```bash
# Using psql (PostgreSQL)
psql -U your_user -d nhlstats -f db/migrations/001_add_user_table.sql
psql -U your_user -d nhlstats -f db/migrations/002_add_teams_table.sql
# ... and so on
```

#### 6. Seed Initial Data (Optional)

Run seed migration scripts:

```bash
psql -U your_user -d nhlstats -f db/migrations/008_seed_initial_data.sql
```

### Frontend Setup

#### 1. Navigate to Frontend Directory

```bash
cd Frontend
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Configure Environment

Create `.env.local` for local development:

```env
VITE_API_BASE_URL=http://localhost:5000
```

#### 4. Verify Setup

```bash
npm run build
# Should complete without errors
```

---

## Development Workflow

### Typical Development Session

#### 1. Start Backend

```bash
cd Backend/src/Api
dotnet run
# Or with watch mode (auto-rebuild on changes):
dotnet watch run
```

Backend will run on `http://localhost:5000` by default.

**Check health endpoint**:
```bash
curl http://localhost:5000/health
# Should return: {"status":"Healthy"}
```

**Access Swagger UI** (Development only):
```
http://localhost:5000/swagger
```

#### 2. Start Frontend

In a new terminal:

```bash
cd Frontend
npm run dev
```

Frontend will run on `http://localhost:3000` by default.

**Open browser**:
```
http://localhost:3000
```

### Hot Reload

- **Backend**: Use `dotnet watch run` for automatic rebuild on file changes
- **Frontend**: Vite provides automatic hot module replacement (HMR)

### Making Changes

#### Backend Changes

1. **Add/Modify Entity**:
   - Update entity in `Backend/src/Domain/Entities/`
   - Create EF Core migration:
     ```bash
     cd Backend/src/Domain
     dotnet ef migrations add <MigrationName> --startup-project ../Api
     ```
   - Review generated migration in `Migrations/` folder
   - Apply migration:
     ```bash
     dotnet ef database update --startup-project ../Api
     ```

2. **Add/Modify Service**:
   - Create service interface in `Backend/src/Application/Interfaces/`
   - Implement service in `Backend/src/Application/Services/`
   - Register in `Backend/src/Application/DependencyInjection.cs`

3. **Add/Modify Endpoint**:
   - Create or update controller in `Backend/src/Api/Controllers/`
   - Add XML documentation comments for Swagger
   - Create request/response DTOs if needed
   - Add validation

4. **Add Tests**:
   - Create test class in `Backend/tests/Api.IntegrationTests/`
   - Follow naming convention: `<Feature>Tests.cs`
   - Use existing test patterns

#### Frontend Changes

1. **Add Component**:
   - Create in `Frontend/src/components/` (shared) or `Frontend/src/features/` (feature-specific)
   - Follow naming convention: PascalCase for components
   - Use TypeScript interfaces for props

2. **Add Feature**:
   - Create new feature folder in `Frontend/src/features/`
   - Add feature components, types, and logic
   - Update routing in `App.tsx` if needed

3. **Update Styles**:
   - Use Tailwind utility classes when possible
   - Add custom CSS in `Frontend/src/styles.css` only when necessary
   - Follow design system color palette

---

## Running the Application

### Backend

#### Development Mode

```bash
cd Backend/src/Api
dotnet run --environment Development
```

Or use the VS Code task: **Run backend (Api)**

#### Production Mode

```bash
dotnet run --environment Production
```

#### With Specific Port

```bash
dotnet run --urls "http://localhost:5001"
```

#### Watch Mode (Auto-reload)

```bash
dotnet watch run
```

### Frontend

#### Development Server

```bash
cd Frontend
npm run dev
```

Default: `http://localhost:3000`

#### Production Build

```bash
npm run build
```

Outputs to `Frontend/dist/`

#### Preview Production Build

```bash
npm run preview
```

#### Lint Code

```bash
npm run lint
```

---

## Database Management

### Using EF Core Migrations

#### Create Migration

```bash
cd Backend/src/Domain
dotnet ef migrations add <MigrationName> --startup-project ../Api
```

**Example**:
```bash
dotnet ef migrations add AddUserTable --startup-project ../Api
```

#### Apply Migrations

```bash
dotnet ef database update --startup-project ../Api
```

#### Rollback Migration

```bash
# Rollback to specific migration
dotnet ef database update <PreviousMigrationName> --startup-project ../Api

# Rollback all migrations
dotnet ef database update 0 --startup-project ../Api
```

#### Remove Last Migration (If Not Applied)

```bash
dotnet ef migrations remove --startup-project ../Api
```

#### View Migration SQL

```bash
dotnet ef migrations script --startup-project ../Api
```

### Using SQL Scripts

#### Apply SQL Migration Manually

```bash
# PostgreSQL
psql -U your_user -d nhlstats -f Backend/db/migrations/001_add_user_table.sql

# SQLite
sqlite3 Backend/db/nhlstats.db < Backend/db/migrations/001_add_user_table.sql
```

#### Create New SQL Migration

1. Create file: `Backend/db/migrations/XXX_description.sql`
   - Use next sequential number (e.g., `023_add_new_column.sql`)

2. Write migration SQL:
   ```sql
   -- 023_add_new_column.sql
   ALTER TABLE users ADD COLUMN email VARCHAR(200);
   CREATE INDEX idx_users_email ON users(email);
   ```

3. Apply migration (see above)

4. Sync EF Core model:
   ```bash
   cd Backend/src/Domain
   dotnet ef migrations add SyncEmailColumn --startup-project ../Api
   ```

### Database Utilities

#### Reset Database (Development Only)

```bash
# Drop and recreate database
cd Backend/src/Domain
dotnet ef database drop --startup-project ../Api --force
dotnet ef database update --startup-project ../Api
```

#### Seed Data

Run seed scripts in order:
```bash
psql -U your_user -d nhlstats -f Backend/db/migrations/008_seed_initial_data.sql
psql -U your_user -d nhlstats -f Backend/db/migrations/010_seed_aggregate_matches_and_user_relations.sql
```

---

## Testing

### Backend Tests

#### Run All Tests

```bash
cd Backend
dotnet test
```

#### Run Specific Test Project

```bash
dotnet test tests/Api.IntegrationTests/Api.IntegrationTests.csproj
```

#### Run Specific Test Class

```bash
dotnet test --filter FullyQualifiedName~MatchEndpointTests
```

#### Run Specific Test Method

```bash
dotnet test --filter FullyQualifiedName~MatchEndpointTests.GetMatch_ReturnsMatch
```

#### Run with Detailed Output

```bash
dotnet test --verbosity detailed
```

#### Using VS Code Tasks

Use the task: **Run backend tests**

Or filter-specific: **Run user endpoint tests only**

#### Writing Tests

Example integration test:

```csharp
public class MatchEndpointTests : IClassFixture<TestApiFactory>
{
    private readonly HttpClient _client;
    
    public MatchEndpointTests(TestApiFactory factory)
    {
        _client = factory.CreateClient();
    }
    
    [Fact]
    public async Task GetMatch_WithValidId_ReturnsMatch()
    {
        // Arrange
        var matchId = await CreateTestMatchAsync();
        
        // Act
        var response = await _client.GetAsync($"/api/Match/{matchId}");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var match = await response.Content.ReadFromJsonAsync<MatchDto>();
        match.Should().NotBeNull();
        match!.Id.Should().Be(matchId);
    }
}
```

### Frontend Tests (Planned)

#### Setup Vitest

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

#### Run Tests

```bash
npm run test
```

#### Write Component Test

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MatchCard } from './MatchCard';

describe('MatchCard', () => {
  it('renders match details', () => {
    const match = {
      homeTeamName: 'Colorado Avalanche',
      awayTeamName: 'Edmonton Oilers',
      homeScore: 3,
      awayScore: 1
    };
    
    render(<MatchCard match={match} />);
    
    expect(screen.getByText('Colorado Avalanche')).toBeInTheDocument();
    expect(screen.getByText('3 - 1')).toBeInTheDocument();
  });
});
```

---

## Code Style & Conventions

### Backend (C#)

Follow instructions in `.github/instructions/csharp.instructions.md`:

#### Naming Conventions

- **PascalCase**: Classes, methods, properties, public members
  ```csharp
  public class MatchService { }
  public string TeamName { get; set; }
  ```

- **camelCase**: Private fields, local variables, parameters
  ```csharp
  private readonly IMatchRepository _matchRepository;
  public void CreateMatch(string teamName) { }
  ```

- **Interfaces**: Prefix with `I`
  ```csharp
  public interface IMatchService { }
  ```

#### Async Methods

- Suffix with `Async`
- Always return `Task` or `Task<T>`

```csharp
public async Task<MatchDto> GetMatchAsync(Guid id)
{
    var match = await _context.Matches.FindAsync(id);
    return MapToDto(match);
}
```

#### Error Handling

- Use domain-specific exceptions
- Never swallow exceptions silently
- Log with context

```csharp
if (match == null)
{
    _logger.LogWarning("Match {MatchId} not found", id);
    throw new NotFoundException($"Match {id} not found");
}
```

#### Logging

- Use structured logging
- Don't log sensitive data
- Include correlation context

```csharp
_logger.LogInformation(
    "Match {MatchId} created for season {SeasonId}",
    match.Id,
    match.SeasonPhaseId
);
```

### Frontend (React/TypeScript)

Follow instructions in `.github/instructions/react.instructions.md`:

#### Component Structure

```tsx
// Use function components (not React.FC)
export function MatchCard({ match }: { match: Match }) {
  return (
    <div className="card-glass">
      <h3>{match.homeTeamName} vs {match.awayTeamName}</h3>
      <p>{match.homeScore} - {match.awayScore}</p>
    </div>
  );
}
```

#### Type Definitions

```tsx
// Define types/interfaces for all props and data
interface MatchCardProps {
  match: Match;
  onSelect?: (matchId: string) => void;
}

export function MatchCard({ match, onSelect }: MatchCardProps) {
  // ...
}
```

#### State Management

```tsx
// Use descriptive names
const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
const [isLoading, setIsLoading] = useState(false);
```

#### Styling

- Use Tailwind utility classes first
- Follow design system color palette
- Use custom classes from `styles.css` when appropriate

```tsx
<button className="btn-primary">
  Create Match
</button>

<div className="card-glass">
  <StatBox label="Plus" value={stats.plus} className="text-cyan-400" />
</div>
```

### Git Commit Messages

Format:
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples**:
```
feat(api): add match creation endpoint

- Add POST /api/Match endpoint
- Add validation for match data
- Include integration tests

Closes #123
```

```
fix(frontend): resolve loading spinner alignment

The spinner was not centered in the dashboard view.
Updated flexbox classes to properly center.
```

---

## Common Tasks

### Add a New API Endpoint

1. **Create DTO** (`Backend/src/Api/<Resource>/<Name>Dto.cs`):
   ```csharp
   public record CreateMatchDto(
       Guid SeasonPhaseId,
       Guid HomeTeamId,
       Guid AwayTeamId
   );
   ```

2. **Add Service Method** (`Backend/src/Application/Services/<Name>Service.cs`):
   ```csharp
   public async Task<MatchDto> CreateMatchAsync(CreateMatchDto dto)
   {
       var match = new Match
       {
           Id = Guid.NewGuid(),
           SeasonPhaseId = dto.SeasonPhaseId,
           // ...
       };
       
       _context.Matches.Add(match);
       await _context.SaveChangesAsync();
       
       return MapToDto(match);
   }
   ```

3. **Add Controller Action** (`Backend/src/Api/Controllers/<Name>Controller.cs`):
   ```csharp
   /// <summary>
   /// Creates a new match
   /// </summary>
   [HttpPost]
   public async Task<ActionResult<MatchDto>> CreateMatch(CreateMatchDto dto)
   {
       var match = await _matchService.CreateMatchAsync(dto);
       return CreatedAtAction(nameof(GetMatch), new { id = match.Id }, match);
   }
   ```

4. **Add Tests** (`Backend/tests/Api.IntegrationTests/<Name>Tests.cs`):
   ```csharp
   [Fact]
   public async Task CreateMatch_WithValidData_ReturnsCreated()
   {
       // Arrange, Act, Assert
   }
   ```

### Add a New Database Table

1. **Create Entity** (`Backend/src/Domain/Entities/<Name>.cs`):
   ```csharp
   public class Match
   {
       public Guid Id { get; set; }
       public Guid SeasonPhaseId { get; set; }
       public SeasonPhase SeasonPhase { get; set; }
       // ...
   }
   ```

2. **Add DbSet** (`Backend/src/Domain/NHLStatsDbContext.cs`):
   ```csharp
   public DbSet<Match> Matches { get; set; }
   ```

3. **Configure Entity** (in `OnModelCreating`):
   ```csharp
   modelBuilder.Entity<Match>(entity =>
   {
       entity.HasKey(e => e.Id);
       entity.Property(e => e.HomeScore).IsRequired(false);
       entity.HasIndex(e => e.SeasonPhaseId);
   });
   ```

4. **Create Migration**:
   ```bash
   cd Backend/src/Domain
   dotnet ef migrations add AddMatchTable --startup-project ../Api
   ```

5. **Review and Apply**:
   ```bash
   dotnet ef database update --startup-project ../Api
   ```

### Add a New React Component

1. **Create Component File** (`Frontend/src/components/<Name>.tsx`):
   ```tsx
   interface MatchCardProps {
     match: Match;
   }
   
   export function MatchCard({ match }: MatchCardProps) {
     return (
       <div className="card-glass">
         <h3>{match.homeTeamName} vs {match.awayTeamName}</h3>
       </div>
     );
   }
   ```

2. **Export from Index** (if using barrel exports):
   ```tsx
   // Frontend/src/components/index.ts
   export { MatchCard } from './MatchCard';
   ```

3. **Use in Feature**:
   ```tsx
   import { MatchCard } from '../components/MatchCard';
   
   export function Dashboard() {
     return (
       <div>
         <MatchCard match={selectedMatch} />
       </div>
     );
   }
   ```

---

## Troubleshooting

### Backend Issues

#### Port Already in Use

```bash
# Find process using port 5000
lsof -i :5000
# Or on Windows
netstat -ano | findstr :5000

# Kill the process
kill -9 <PID>
```

Or run on different port:
```bash
dotnet run --urls "http://localhost:5001"
```

#### Database Connection Fails

1. **Check PostgreSQL is running**:
   ```bash
   pg_isready
   # Or check service status
   systemctl status postgresql
   ```

2. **Verify connection string**:
   ```bash
   # Test connection
   psql -U your_user -d nhlstats -c "SELECT 1;"
   ```

3. **Check environment variables**:
   ```bash
   echo $ConnectionStrings__Primary
   ```

#### Migration Errors

**Error**: "The migration has already been applied"
```bash
# View applied migrations
dotnet ef migrations list --startup-project ../Api

# Rollback if needed
dotnet ef database update <PreviousMigration> --startup-project ../Api
```

**Error**: "No DbContext was found"
```bash
# Ensure you're in the correct directory
cd Backend/src/Domain

# Specify context explicitly
dotnet ef migrations add MyMigration --context NHLStatsDbContext --startup-project ../Api
```

### Frontend Issues

#### Module Not Found

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Port 3000 Already in Use

Kill existing process or use different port:

```bash
# In package.json, update dev script:
"dev": "vite --port 3001"
```

#### TypeScript Errors

```bash
# Check TypeScript version
npm list typescript

# Rebuild type declarations
npm run build
```

#### Vite Build Errors

```bash
# Clear Vite cache
rm -rf node_modules/.vite

# Restart dev server
npm run dev
```

### Common Errors

#### CORS Errors (Frontend calling Backend)

Update `Backend/src/Api/Program.cs`:

```csharp
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

app.UseCors();
```

#### Swagger Not Accessible

1. Verify environment:
   ```bash
   echo $ASPNETCORE_ENVIRONMENT
   # Should be "Development"
   ```

2. Check `appsettings.Development.json`:
   ```json
   {
     "EnableSwagger": true
   }
   ```

3. Access at: `http://localhost:5000/swagger`

---

## Contributing

### Before Submitting Pull Request

1. **Run Tests**:
   ```bash
   cd Backend && dotnet test
   cd Frontend && npm run lint
   ```

2. **Check Build**:
   ```bash
   cd Backend && dotnet build
   cd Frontend && npm run build
   ```

3. **Format Code**:
   ```bash
   # Backend (if using dotnet-format)
   dotnet format
   
   # Frontend
   npm run lint --fix
   ```

4. **Update Documentation** if adding new features

5. **Write Clear Commit Messages** (see conventions above)

### Pull Request Checklist

- [ ] Code follows project conventions
- [ ] Tests pass
- [ ] New features have tests
- [ ] Documentation updated
- [ ] No merge conflicts
- [ ] Commit messages follow convention
- [ ] Code reviewed by yourself first

### Code Review Guidelines

**For Reviewers**:
- Be constructive and respectful
- Focus on code quality, not style preferences
- Suggest improvements, don't demand changes
- Approve if no major issues

**For Contributors**:
- Respond to all comments
- Ask questions if unclear
- Make requested changes promptly
- Mark conversations as resolved

---

## Additional Resources

### Documentation
- [API Reference](API.md)
- [Database Schema](DATABASE.md)
- [Architecture Guide](ARCHITECTURE.md)
- [Deployment Guide](DEPLOYMENT.md)

### External Links
- [ASP.NET Core Documentation](https://docs.microsoft.com/aspnet/core)
- [Entity Framework Core](https://docs.microsoft.com/ef/core)
- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)

### Project Guidelines
- `.github/instructions/general.instructions.md`
- `.github/instructions/csharp.instructions.md`
- `.github/instructions/react.instructions.md`
- `.github/instructions/sql.instructions.md`
- `.github/instructions/structure.instructions.md`

---

## Getting Help

- **Issues**: Create a GitHub issue for bugs or feature requests
- **Discussions**: Use GitHub Discussions for questions
- **Documentation**: Check docs/ folder first
- **Code Examples**: Look at existing endpoints/components

---

**Happy Coding! 🏒**
