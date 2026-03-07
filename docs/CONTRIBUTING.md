# Contributing

Developer guidelines, workflow, and standards for NHL Stats 2.0.

## Getting Started

1. **Fork & clone** the repository
2. **Complete [SETUP.md](SETUP.md)** to get your local environment working
3. **Read [ARCHITECTURE.md](ARCHITECTURE.md)** to understand the system
4. **Start with an issue** (see below)

## Development Workflow

### 1. Create a Branch

Branch from `main` with descriptive name:

```bash
git checkout -b feature/user-authentication
git checkout -b fix/match-calculation-bug
git checkout -b docs/update-api-reference
```

**Branch naming conventions:**

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/<name>` | `feature/user-stats-page` |
| Bug | `fix/<name>` | `fix/payout-calculation` |
| Documentation | `docs/<name>` | `docs/setup-guide` |
| Refactor | `refactor/<name>` | `refactor/service-layer` |
| Test | `test/<name>` | `test/auth-endpoints` |

### 2. Follow TDD (Test-Driven Development)

1. **Write failing test first**
   ```bash
   # Backend: Write test in NHLStats.Api.Tests/
   # Frontend: Write test in src/__tests__/
   ```

2. **Make the test pass** with minimal code
   ```bash
   cd backend && dotnet test
   cd frontend && npm test
   ```

3. **Refactor** if needed
   ```bash
   # Improve code while keeping tests passing
   dotnet test
   npm test
   ```

### 3. Code Before Committing

**Backend:**
```bash
cd backend
dotnet build --configuration Release
dotnet test
dotnet format  # Auto-format code
```

**Frontend:**
```bash
cd frontend
npm run lint   # Check linting errors
npm test       # Run tests
npm run build  # Verify production build
```

### 4. Commit with Clear Messages

```bash
git add .
git commit -m "feat: add user earnings chart to dashboard

- Implement EarningsService.CalculateMonthlyEarnings()
- Add ChartComponent with recharts
- Add to UserDashboard page
- Tests: all passing (92% coverage)

Fixes #123"
```

**Commit message format:**

```
<type>: <subject>

<body>

<footer>
```

| Type | Meaning |
|------|---------|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation |
| test | Test changes |
| refactor | Code restructuring |
| style | Formatting (no logic change) |
| chore | Build, dependency updates |

**Subject line:**
- Imperative mood ("add" not "added")
- 50 characters or less
- No period at end

**Body (optional):**
- Explain *what* and *why*, not *how*
- Wrap at 72 characters
- Separate from subject by blank line

**Footer (optional):**
- Reference issues: `Fixes #123` or `Resolves #456`
- Note breaking changes: `BREAKING CHANGE: ...`

### 5. Push and Create Pull Request

```bash
git push origin feature/user-authentication
```

Create pull request on GitHub with:

1. **Title** — Same as commit message subject
2. **Description** — What does this PR do?
   ```markdown
   ## Description
   Adds earnings chart to user dashboard showing monthly earnings trend.

   ## Type of Change
   - [x] New feature
   - [ ] Bug fix
   - [ ] Documentation
   - [ ] Breaking change

   ## Testing
   - [x] Added unit tests (new: 12 tests, all passing)
   - [x] Added integration tests
   - [x] Manual testing on login and Dashboard
   - Coverage: 92%

   ## Checklist
   - [x] Code follows style guidelines
   - [x] Comments added for complex logic
   - [x] Documentation updated
   - [x] Tests added/updated
   - [x] No new warnings generated
   - [x] Tested locally

   ## Screenshots (if applicable)
   [Add screenshots or GIFs]

   Fixes #123
   ```

### 6. Code Review

Wait for approval from code reviewers:

- **At least 1 approval** required before merge
- Address feedback in new commits: `git commit --amend` or new commit
- Ensure CI/CD pipeline passes (see next step)

### 7. CI/CD Pipeline

GitHub Actions automatically:

1. **Runs backend tests** (`.github/workflows/pr-check.yml`)
2. **Runs frontend tests** (`.github/workflows/pr-check.yml`)
3. **Lints code** (eslint for frontend, Code Analysis for backend)
4. **Verifies build** (dotnet build, npm run build)

All checks must pass before merging. Fix any failures:

```bash
# If tests fail
npm test -- --no-coverage
dotnet test --verbosity normal

# If lint fails
npm run lint -- --fix
```

### 8. Merge to Main

Once approved and CI passes:

1. **Rebase** (optional, but preferred to keep history clean)
   ```bash
   git rebase main
   git push --force-with-lease origin feature/user-authentication
   ```

2. **Merge** via GitHub (Squash or Merge commit)
   - **Squash & Merge** — Keep history clean (recommended for small PRs)
   - **Merge Commit** — Preserve all commits (use for complex features)

3. **Delete branch** — Cleanup after merge

## Code Standards

### Backend (C#)

**File structure:**
```
src/NHLStats.Api/
├── Controllers/
│   ├── AuthController.cs
│   ├── SeasonsController.cs
│   └── ...
├── Program.cs
└── appsettings.json

src/NHLStats.Application/
├── Interfaces/
│   └── ISeasonService.cs
├── Services/
│   └── SeasonService.cs
└── DTOs/
    └── SeasonDto.cs

src/NHLStats.Domain/
├── Entities/
│   └── Season.cs
├── NhlStatsDbContext.cs
└── Migrations/
    └── ...cs
```

**Naming conventions:**

```csharp
// Interfaces start with I
public interface IUserService { }

// Classes are PascalCase
public class UserService : IUserService { }

// Properties are PascalCase
public string UserName { get; set; }

// Private fields are _camelCase
private readonly IUserService _userService;

// Constants are UPPER_SNAKE_CASE
private const int MAX_ATTEMPTS = 3;

// Methods are PascalCase, verbs
public Task<User> GetUserAsync(Guid id)
public async Task CreateSeasonAsync(CreateSeasonDto dto)
```

**Code style:**

```csharp
// Use using declarations (C# 8+)
using var service = new UserService();

// Use nullable reference types
#nullable enable
public string? GetOptionalValue()

// Use async/await
public async Task<UserDto> GetUserAsync(Guid id)
    => await _context.Users.FirstOrDefaultAsync(u => u.Id == id);

// Use pattern matching
return user switch
{
    null => throw new ArgumentNullException(nameof(user)),
    { Id: Guid.Empty } => throw new ArgumentException("Invalid ID"),
    _ => user
};

// Dependency injection in constructor
public class UserService
{
    private readonly NhlStatsDbContext _context;
    
    public UserService(NhlStatsDbContext context)
    {
        _context = context ?? throw new ArgumentNullException(nameof(context));
    }
}
```

**Error handling:**

```csharp
// Validate inputs early
public void CreateUser(string email)
{
    if (string.IsNullOrWhiteSpace(email))
        throw new ArgumentException("Email required", nameof(email));
    
    // Continue...
}

// Use specific exceptions
try
{
    var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id);
    return user ?? throw new InvalidOperationException($"User {id} not found");
}
catch (DbException ex)
{
    _logger.LogError(ex, "Database error");
    throw;
}
```

### Frontend (TypeScript/React)

**File structure:**
```
src/
├── components/          # Reusable components
│   ├── Header.tsx
│   └── Forms/Button.tsx
├── pages/              # Page-level components
│   ├── LoginPage.tsx
│   └── admin/AdminPage.tsx
├── context/            # Global state
│   └── AuthContext.tsx
├── services/           # API & business logic
│   ├── apiClient.ts
│   └── authService.ts
├── hooks/              # Custom React hooks
│   └── useAuth.ts
├── mocks/              # Test mocks
│   └── handlers.ts
├── __tests__/          # Tests mirror src structure
│   └── components/LoginForm.test.tsx
└── types/              # Shared TypeScript types
    └── index.ts
```

**Naming conventions:**

```typescript
// Components are PascalCase
function UserProfile() {}

// Props interfaces end with Props
interface UserProfileProps {
  userId: string;
  onClose: () => void;
}

// Utility functions are camelCase
function formatDate(date: Date): string {}

// Constants are UPPER_SNAKE_CASE
const MAX_RETRIES = 3;

// Type aliases are PascalCase
type UserRole = 'admin' | 'user';
```

**Code style:**

```typescript
// Use named exports
export function LoginPage() {}

// Use TypeScript strictly
interface User {
  id: string;
  email: string;
  name: string;
}

// Use async/await
const handleLogin = async (email: string, password: string) => {
  try {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};

// Use React hooks
function useUser() {
  const [user, setUser] = useState<User | null>(null);
  
  useEffect(() => {
    fetchUser();
  }, []);
  
  return user;
}
```

**Error handling:**

```typescript
// Validate in component
if (!email || !password) {
  showError('Email and password required');
  return;
}

// Use error boundaries for component errors
<ErrorBoundary>
  <UserProfile userId={id} />
</ErrorBoundary>

// Handle API errors
try {
  await login(email, password);
} catch (error) {
  if (error instanceof AxiosError) {
    if (error.response?.status === 401) {
      showError('Invalid credentials');
    } else {
      showError('Server error');
    }
  }
}
```

## Documentation Standards

### Comments

**Good comments explain *why*, not *what*:**

```csharp
// ✓ Good: Explains business logic
public decimal CalculateEarnings(int points)
{
    // Positive points earn money, negative points cost money
    // This implements the league rule where you win $5 per point
    // but lose $2 per negative point (encourages participation)
    return (points * RATE_PER_POINT);
}

// ✗ Bad: Redundant, just restates code
public decimal CalculateEarnings(int points)
{
    // Multiply points by rate
    return (points * RATE_PER_POINT);
}
```

### XML Documentation (C#)

```csharp
/// <summary>
/// Calculates total user earnings for a season based on points and expenses.
/// </summary>
/// <param name="userId">The user's unique identifier.</param>
/// <param name="seasonId">The season's unique identifier.</param>
/// <returns>The calculated earnings for the user in this season.</returns>
/// <exception cref="ArgumentException">Thrown if userId or seasonId is empty.</exception>
public async Task<decimal> CalculateEarningsAsync(Guid userId, Guid seasonId)
{
    // Implementation
}
```

### JSDoc (TypeScript)

```typescript
/**
 * Calculates total user earnings for a season.
 * 
 * @param userId - The user's unique identifier
 * @param seasonId - The season's unique identifier
 * @returns Promise resolving to the calculated earnings
 * @throws {ArgumentError} If userId or seasonId is invalid
 * 
 * @example
 * const earnings = await calculateEarnings('user-123', 'season-2025');
 */
export async function calculateEarnings(userId: string, seasonId: string): Promise<number> {
  // Implementation
}
```

## Performance Considerations

### Backend

```csharp
// ✗ Bad: N+1 queries
var seasons = await _context.Seasons.ToListAsync();
foreach (var season in seasons)
{
    var userCount = season.Users.Count;  // Query per season
}

// ✓ Good: Eager loading
var seasons = await _context.Seasons
    .Include(s => s.SeasonUsers)
    .ToListAsync();
```

### Frontend

```typescript
// ✗ Bad: Unnecessary renders
function UserList() {
  const [users, setUsers] = useState([]);
  
  // Fetches on every render (no dependency array)
  useEffect(() => {
    fetchUsers();
  }); // Missing dependency array
  
  return <div>{users.map(u => <User key={u.id} {...u} />)}</div>;
}

// ✓ Good: Optimized
function UserList() {
  const [users, setUsers] = useState([]);
  
  // Fetch only once on mount
  useEffect(() => {
    fetchUsers();
  }, []);
  
  return <div>{users.map(u => <User key={u.id} {...u} />)}</div>;
}
```

## Security Checklist

Before submitting PR, ensure:

- [ ] **No secrets in code** — Passwords, API keys, tokens
- [ ] **Inputs validated** — Frontend and backend
- [ ] **SQL injection prevented** — Use parameterized queries
- [ ] **Authorization checked** — `[Authorize]` on protected endpoints
- [ ] **HTTPS enforced** — Production URLs are https
- [ ] **CORS properly configured** — Only allowed origins
- [ ] **Sensitive data logged** — Never log passwords/tokens
- [ ] **Errors not leaking info** — Don't expose system details in error messages

## Getting Help

**Stuck on something?**

1. **Check existing documentation** in [docs/](../docs/)
2. **Search GitHub issues** for similar problems
3. **Ask in team chat** or create a GitHub Discussion
4. **Create a GitHub issue** with detailed error message

## Code of Conduct

- Be respectful to all contributors
- Provide constructive feedback
- Assume good intent
- Report unethical behavior to maintainers

## Recognition

Contributors are recognized in:
- Git commit history
- GitHub contributors page
- Project README (for major contributions)

Thank you for contributing! 🎉

Last Updated: March 2026
