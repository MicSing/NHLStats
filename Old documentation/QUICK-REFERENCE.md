# NHLStats Quick Reference

Fast lookup guide for common commands and information.

---

## 🚀 Quick Start Commands

### Backend

```bash
# Navigate to backend
cd Backend

# Build
dotnet build

# Run (development)
cd src/Api
dotnet run

# Run with watch (auto-reload)
dotnet watch run

# Run tests
cd ../..
dotnet test

# Create migration
cd src/Domain
dotnet ef migrations add <Name> --startup-project ../Api

# Apply migrations
dotnet ef database update --startup-project ../Api
```

### Frontend

```bash
# Navigate to frontend
cd Frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

---

## 🌐 Default URLs

| Service | Development URL | Port |
|---------|----------------|------|
| Backend API | `http://localhost:5000` | 5000 |
| Swagger UI | `http://localhost:5000/swagger` | 5000 |
| Frontend | `http://localhost:3000` | 3000 |
| Health Check | `http://localhost:5000/health` | 5000 |

---

## 📡 Key API Endpoints

### Health & Info
```
GET /health                        # Health check
```

### Users
```
GET    /api/User                   # List all users
GET    /api/User/{id}              # Get user by ID
POST   /api/User                   # Create user
PUT    /api/User/{id}              # Update user
DELETE /api/User/{id}              # Delete user
```

### Teams
```
GET    /api/Team                   # List all teams
GET    /api/Team/{id}              # Get team by ID
POST   /api/Team                   # Create team
PUT    /api/Team/{id}              # Update team
```

### Matches
```
GET    /api/Match                  # List matches
GET    /api/Match/{id}             # Get match by ID
POST   /api/Match                  # Create match
POST   /api/Match/bulk             # Create multiple matches
PUT    /api/Match/{id}             # Update match
```

### Players
```
GET    /api/Player                 # List all players
GET    /api/Player/search?q={term} # Search players
POST   /api/Player                 # Create player
PUT    /api/Player/{id}            # Update player
```

### User Stats
```
GET /api/UserStats/SeasonsStats              # Stats by season
GET /api/UserStats/ActiveUsersAllSeasons     # All seasons aggregate
GET /api/UserStats/ActiveUsersLastSeason     # Last season only
GET /api/UserStats/ActiveUsersSeasonBreakdown # Per-season breakdown
```

**Full API documentation:** [docs/API.md](API.md)

---

## 🗄️ Database

### Tables
- `users` - Application users
- `teams` - NHL teams
- `season_phases` - Regular/playoff seasons
- `players` - Player roster
- `matches` - Games
- `user_match_relations` - User plus/minus per match
- `user_match_relations_with_players` - Per-player stats
- `user_match_score_entries` - Detailed score breakdown

### Key Relationships
```
User ←→ UserMatchRelation ←→ Match
                ↓
    UserMatchScoreEntry
                ↓
    UserMatchRelationWithPlayer → Player
```

**Full schema:** [docs/DATABASE.md](DATABASE.md)

---

## 🏗️ Project Structure

```
NHLStats/
├── Backend/
│   ├── src/
│   │   ├── Api/              # HTTP endpoints
│   │   ├── Application/      # Business logic
│   │   └── Domain/           # Entities, DbContext
│   ├── tests/
│   │   └── Api.IntegrationTests/
│   └── db/migrations/        # SQL migration scripts
├── Frontend/
│   └── src/
│       ├── features/         # Feature modules
│       ├── components/       # Shared components
│       ├── App.tsx           # Root component
│       └── main.tsx          # Entry point
└── docs/                     # Documentation
```

---

## 🔧 Configuration

### Backend Environment Variables

```bash
# Database connection
export ConnectionStrings__Primary="Host=localhost;Database=nhlstats;..."

# Environment
export ASPNETCORE_ENVIRONMENT=Development  # or Production

# Swagger (Development only)
export EnableSwagger=true
```

### Frontend Environment Variables

```bash
# API base URL
export VITE_API_BASE_URL=http://localhost:5000
```

---

## 🧪 Testing

### Backend Tests

```bash
# Run all tests
dotnet test

# Run specific test file
dotnet test --filter FullyQualifiedName~MatchEndpointTests

# Run specific test
dotnet test --filter FullyQualifiedName~MatchEndpointTests.GetMatch_ReturnsMatch

# Verbose output
dotnet test --verbosity detailed
```

### Frontend Tests (Planned)

```bash
npm run test
```

---

## 🔨 Common Tasks

### Add New Entity

1. Create entity class in `Backend/src/Domain/Entities/`
2. Add DbSet to `NHLStatsDbContext.cs`
3. Create migration: `dotnet ef migrations add Add<Entity> --startup-project ../Api`
4. Apply: `dotnet ef database update --startup-project ../Api`

### Add New API Endpoint

1. Create DTO in `Backend/src/Api/<Resource>/`
2. Add service method in `Backend/src/Application/Services/`
3. Create controller action in `Backend/src/Api/Controllers/`
4. Add tests in `Backend/tests/Api.IntegrationTests/`

### Add New Component

1. Create file: `Frontend/src/components/<Name>.tsx`
2. Define props interface
3. Export component
4. Import and use in features

**Detailed guides:** [docs/DEVELOPMENT.md#common-tasks](DEVELOPMENT.md#common-tasks)

---

## 📝 Code Conventions

### C# Naming
```csharp
// PascalCase
public class MatchService { }
public string TeamName { get; set; }

// camelCase
private readonly IMatchRepository _matchRepository;
public void CreateMatch(string teamName) { }

// Async suffix
public async Task<Match> GetMatchAsync(Guid id) { }
```

### React/TypeScript
```tsx
// Function components (not React.FC)
export function MatchCard({ match }: { match: Match }) {
  return <div>{match.homeTeamName}</div>;
}

// Interfaces for props
interface MatchCardProps {
  match: Match;
  onSelect?: (id: string) => void;
}
```

### Git Commits
```
<type>(<scope>): <subject>

feat(api): add match creation endpoint
fix(frontend): resolve loading spinner alignment
docs(readme): update installation instructions
```

---

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Find process
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port
dotnet run --urls "http://localhost:5001"
```

### Database Connection Failed

```bash
# Test PostgreSQL connection
psql -U your_user -d nhlstats -c "SELECT 1;"

# Check service status
systemctl status postgresql
```

### Migration Errors

```bash
# List migrations
dotnet ef migrations list --startup-project ../Api

# Rollback
dotnet ef database update <PreviousMigration> --startup-project ../Api

# Remove last migration (if not applied)
dotnet ef migrations remove --startup-project ../Api
```

### Frontend Build Errors

```bash
# Clear cache
rm -rf node_modules package-lock.json

# Reinstall
npm install

# Clear Vite cache
rm -rf node_modules/.vite
```

**Full troubleshooting:** [docs/DEVELOPMENT.md#troubleshooting](DEVELOPMENT.md#troubleshooting)

---

## 📚 Documentation Links

- **[Development Guide](DEVELOPMENT.md)** - Complete setup and workflow
- **[API Reference](API.md)** - All endpoints with examples
- **[Database Schema](DATABASE.md)** - Tables, relationships, migrations
- **[Architecture Guide](ARCHITECTURE.md)** - Design patterns and decisions
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment

---

## 🎯 Key Enums

### MatchLifecycleState
`0` Scheduled | `1` InProgress | `2` Completed | `3` Cancelled

### MatchCompletionType
`0` None | `1` RegularTime | `2` Overtime | `3` Shootout

### SeasonPhaseType
`0` Regular | `1` Playoff | `2` Both

### HockeyPosition
`0` Goalie | `1` Defenseman | `2` LeftWing | `3` Center | `4` RightWing

### ScoreEntryType
`1` Plus | `2` Minus

**All enums:** [docs/API.md#enum-reference](API.md#enum-reference)

---

## 🔐 Security Checklist

**Pre-Deployment:**
- [ ] Secrets in environment variables (not code)
- [ ] HTTPS enforced
- [ ] Strong database passwords
- [ ] Swagger disabled in production
- [ ] CORS configured properly

**Full checklist:** [docs/DEPLOYMENT.md#security-checklist](DEPLOYMENT.md#security-checklist)

---

## 🆘 Getting Help

- **Documentation**: [docs/](.)
- **Issues**: [GitHub Issues](#)
- **Discussions**: [GitHub Discussions](#)

---

**Quick Reference Version:** 1.0  
**Last Updated:** March 1, 2026
