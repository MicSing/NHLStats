# Testing Strategy

Testing approach in NHL Stats 2.0 using TDD (Test-Driven Development).

**Philosophy**: Write failing test first, then implement code to pass it.

## Backend Testing

### test Frameworks & Tools

- **xUnit** — Test framework
- **FluentAssertions** — Fluent assertions library
- **WebApplicationFactory** — Integration tests
- **Testcontainers** — Docker-based test dependencies (SQLite in-memory)
- **Moq** — Mocking framework (future use)

### Test Project Structure

```
backend/tests/
├── NHLStats.Api.Tests/                          # Integration & API tests
│   ├── ApiTestBase.cs                           # Base class with WebApplicationFactory
│   ├── CustomWebApplicationFactory.cs           # Factory configuration
│   ├── HealthTests.cs                           # Health endpoint
│   ├── Auth/LoginTests.cs                       # Login scenarios
│   ├── Auth/RegisterTests.cs                    # Registration scenarios
│   ├── Seasons/SeasonCreationTests.cs          # Season CRUD
│   ├── Matches/MatchCreationTests.cs           # Match CRUD
│   ├── UserMatches/UserMatchTests.cs           # Stats recording
│   ├── Stats/StatsCalculationTests.cs          # Stats aggregation
│   ├── Payouts/PayoutCalculationTests.cs       # Payout logic
│   └── ... (mirror controller structure)
│
├── NHLStats.Application.Tests/                 # Service layer tests
│   ├── UserServiceTests.cs
│   ├── SeasonServiceTests.cs
│   ├── MatchServiceTests.cs
│   ├── StatsServiceTests.cs
│   └── ...
│
└── NHLStats.Domain.Tests/                      # Entity & DbContext tests
    ├── EntityValidationTests.cs
    ├── DbContextTests.cs
    └── MigrationTests.cs
```

### Running Backend Tests

```bash
cd backend

# Run all tests
dotnet test

# Run specific test project
dotnet test tests/NHLStats.Api.Tests

# Run single test class
dotnet test tests/NHLStats.Api.Tests --filter "ClassName=LoginTests"

# Run single test by method name
dotnet test tests/NHLStats.Api.Tests --filter "FullyQualifiedName~LoginTests.ValidLogin_ReturnsToken"

# With verbose output
dotnet test --verbosity normal

# With coverage
dotnet test /p:CollectCoverage=true /p:CoverageFormat=opencover
```

### Integration Test Pattern (xUnit + WebApplicationFactory)

Example: User registration test

```csharp
public class RegisterTests : IAsyncLifetime
{
    private CustomWebApplicationFactory _factory;
    private HttpClient _httpClient;

    public async Task InitializeAsync()
    {
        _factory = new CustomWebApplicationFactory();
        _httpClient = _factory.CreateClient();
    }

    public async Task DisposeAsync()
    {
        _factory?.Dispose();
        _httpClient?.Dispose();
    }

    [Fact]
    public async Task Register_WithValidEmail_Creates_User()
    {
        // Arrange
        var registerRequest = new { email = "new@test.com", password = "Pass123" };

        // Act
        var response = await _httpClient.PostAsJsonAsync(
            "/api/auth/register", 
            registerRequest
        );

        // Assert
        response.StatusCode.Should().Be(System.Net.HttpStatusCode.Created);
        var content = await response.Content.ReadAsAsync<dynamic>();
        content.email.Should().Be("new@test.com");
    }

    [Fact]
    public async Task Register_WithExistingEmail_Returns_409()
    {
        // Arrange: Create first user
        var registerRequest = new { email = "exists@test.com", password = "Pass123" };
        await _httpClient.PostAsJsonAsync("/api/auth/register", registerRequest);

        // Act: Try to register again
        var response = await _httpClient.PostAsJsonAsync(
            "/api/auth/register", 
            registerRequest
        );

        // Assert
        response.StatusCode.Should().Be(System.Net.HttpStatusCode.Conflict);
    }
}
```

### CustomWebApplicationFactory

Setup in `CustomWebApplicationFactory.cs`:

```csharp
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Replace production services with test versions
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<NhlStatsDbContext>));
            
            if (descriptor != null)
                services.Remove(descriptor);

            // Use in-memory SQLite for tests
            services.AddDbContext<NhlStatsDbContext>(options =>
            {
                options.UseSqlite("Data Source=:memory:");
            });

            // Build service provider and ensure DB created
            var sp = services.BuildServiceProvider();
            using var scope = sp.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<NhlStatsDbContext>();
            dbContext.Database.EnsureCreated();
        });
    }
}
```

### Unit Test Pattern (Services Layer)

Example: Stats calculation test

```csharp
public class StatsServiceTests
{
    private Mock<NhlStatsDbContext> _mockContext;
    private IStatsService _service;

    public StatsServiceTests()
    {
        _mockContext = new Mock<NhlStatsDbContext>();
        _service = new StatsService(_mockContext.Object);
    }

    [Fact]
    public async Task CalculateEarnings_WithPoints_ReturnsCorrectAmount()
    {
        // Arrange
        var userId = Guid.NewGuid();
        var seasonId = Guid.NewGuid();
        var moneyConfig = new MoneyConfig 
        { 
            PositivePointsRate = 5.00m,
            NegativePointsRate = -2.00m
        };
        
        var mockUserMatches = new[]
        {
            new UserMatch { Points = 47 },
            new UserMatch { Points = -3 }
        }.AsQueryable().BuildMockDbSet();

        _mockContext.Setup(c => c.UserMatches)
            .Returns(mockUserMatches.Object);

        // Act
        var earnings = await _service.CalculateEarningsAsync(userId, seasonId);

        // Assert
        earnings.Should().Be(241.00m);  // (47 * 5.00) + (-3 * -2.00) = 241
    }
}
```

### Assertion Styles (FluentAssertions)

```csharp
// Strings
result.Should().Be("expected");
result.Should().StartWith("prefix");
result.Should().Contain("substring");

// Numerics
points.Should().Be(5);
earnings.Should().BeGreaterThan(0);
rate.Should().BeApproximately(5.00m, 0.01m);

// Collections
users.Should().HaveCount(3);
users.Should().Contain(u => u.Email == "john@test.com");
users.Should().AllSatisfy(u => u.IsActive.Should().BeTrue());

// Objects
response.Should().NotBeNull();
response.Should().BeOfType<UserDto>();

// Exceptions
var ex = Assert.Throws<ArgumentException>(() => service.Create(null));
ex.Message.Should().Contain("required");
```

### Test Data Builders

Create reusable test data with builders:

```csharp
public class UserBuilder
{
    private string _email = "test@test.com";
    private string _name = "Test User";

    public UserBuilder WithEmail(string email)
    {
        _email = email;
        return this;
    }

    public UserBuilder WithName(string name)
    {
        _name = name;
        return this;
    }

    public User Build()
    {
        return new User { Email = _email, Name = _name };
    }
}

// Usage
var user = new UserBuilder()
    .WithEmail("john@test.com")
    .WithName("John Doe")
    .Build();
```

## Frontend Testing

### Test Frameworks & Tools

- **Vitest** — Test runner (Vite-native, fast)
- **React Testing Library** — Component testing
- **@testing-library/user-event** — User interactions
- **MSW (Mock Service Worker)** — API mocking
- **JSDOM** — Browser DOM simulation

### Test Project Structure

```
frontend/src/
├── __tests__/                               # Test files mirror structure
│   ├── pages/
│   │   ├── LoginPage.test.tsx
│   │   ├── DashboardPage.test.tsx
│   │   └── ...
│   ├── components/
│   │   ├── Header.test.tsx
│   │   └── ...
│   ├── services/
│   │   ├── apiClient.test.ts
│   │   └── ...
│   └── context/
│       ├── AuthContext.test.tsx
│       └── ...
│
├── mocks/
│   ├── handlers.ts                          # MSW mock endpoints
│   └── server.ts                            # MSW setup
│
└── vitest.config.ts                         # Vitest configuration
```

### Running Frontend Tests

```bash
cd frontend

# Run once
npm test

# Watch mode (re-run on file change)
npm run test:watch

# With UI
npm test -- --ui

# Specific test file
npm test -- pages/LoginPage.test.tsx

# Specific test by name
npm test -- --grep "user can login"

# With coverage
npm test -- --coverage
```

### Component Test Pattern (React Testing Library)

Example: Login page test

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';
import { AuthProvider } from '../context/AuthContext';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('LoginPage', () => {
  useLayoutEffect(() => {
    server.listen();
    return () => server.close();
  });

  it('should allow user to login', async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    // Act
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'Pass123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/welcome/i)).toBeInTheDocument();
    });
  });

  it('should show error on invalid credentials', async () => {
    // Arrange
    server.use(
      http.post('/api/auth/login', () => {
        return HttpResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      })
    );
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    // Act
    await user.type(screen.getByLabelText(/email/i), 'test@test.com');
    await user.type(screen.getByLabelText(/password/i), 'WrongPass');
    await user.click(screen.getByRole('button', { name: /login/i }));

    // Assert
    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
  });
});
```

### MSW Mock Handlers

Setup in `src/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as any;
    
    if (body.email === 'test@test.com' && body.password === 'Pass123') {
      return HttpResponse.json(
        { token: 'fake-jwt-token' },
        { status: 200 }
      );
    }
    
    return HttpResponse.json(
      { error: 'Invalid credentials' },
      { status: 401 }
    );
  }),

  http.get('/api/seasons', () => {
    return HttpResponse.json([
      {
        id: 'season-1',
        name: 'Regular Season 2025',
        hostedTeamName: 'New York Rangers',
        matchCount: 20,
      },
    ]);
  }),

  http.post('/api/matches', () => {
    return HttpResponse.json(
      { id: 'match-1', matchNumber: 1 },
      { status: 201 }
    );
  }),
];
```

### Service Test Pattern

Example: API client test

```typescript
import { apiClient } from './apiClient';
import { server } from '../mocks/server';
import { http, HttpResponse } from 'msw';

describe('apiClient', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('should attach JWT token to requests', async () => {
    // Arrange
    let capturedHeader = '';
    server.use(
      http.get('/api/seasons', ({ request }) => {
        capturedHeader = request.headers.get('Authorization') || '';
        return HttpResponse.json([]);
      })
    );
    localStorage.setItem('token', 'test-token');

    // Act
    await apiClient.get('/api/seasons');

    // Assert
    expect(capturedHeader).toBe('Bearer test-token');
  });
});
```

### Context Test Pattern

Example: AuthContext test

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './AuthContext';
import { server } from '../mocks/server';

function TestComponent() {
  const { user, token, login, logout } = useAuth();
  
  return (
    <div>
      {token ? <p>Logged in as {user?.email}</p> : <p>Not logged in</p>}
      <button onClick={() => login('test@test.com', 'Pass123')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeAll(() => server.listen());
  afterAll(() => server.close());

  it('should login user and store token', async () => {
    // Arrange
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Act
    await user.click(screen.getByText('Login'));

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Logged in as/i)).toBeInTheDocument();
    });
    expect(localStorage.getItem('token')).toBe('test-token');
  });
});
```

## Testing Best Practices

### General

1. **One assertion per test** (or closely related assertions)
   ```csharp
   // ✓ Good
   [Fact]
   public void User_FirstName_ShouldBeSet() => firstName.Should().Be("John");

   // ✗ Bad (tests multiple things)
   [Fact]
   public void User_ShouldHaveCorrectName()
   {
       firstName.Should().Be("John");
       lastName.Should().Be("Doe");
       email.Should().Be("john@test.com");
   }
   ```

2. **Use descriptive test names**
   ```
   ✓ User_WithValidEmail_RegistersSuccessfully
   ✗ TestRegister
   ```

3. **Arrange-Act-Assert pattern**
   - Arrange: Set up test data
   - Act: Execute the operation
   - Assert: Verify results

4. **Test behavior, not implementation**
   ```typescript
   // ✓ Good: Tests what it does
   expect(screen.getByText(/login successful/i)).toBeInTheDocument();

   // ✗ Bad: Tests implementation details
   expect(component.state.isLoading).toBe(false);
   ```

5. **Mock external dependencies**
   - Don't test API calls (mock with MSW or Moq)
   - Don't test database access in unit tests (mock DbContext)
   - Focus on the function/component under test

6. **Test edge cases**
   ```csharp
   // Happy path
   [Fact]
   public void CalculateEarnings_WithPositivePoints_ReturnsPositiveAmount()

   // Edge cases
   [Fact]
   public void CalculateEarnings_WithNegativePoints_ReturnsNegativeAmount()

   [Fact]
   public void CalculateEarnings_WithZeroPoints_ReturnsZero()

   [Fact]
   public void CalculateEarnings_WithNullMoneyConfig_ThrowsArgumentException()
   ```

### Backend Specific

1. **Use xUnit facts for deterministic tests**
   ```csharp
   [Fact]  // Deterministic, single assertion per fact
   public void User_Email_ShouldBeUnique()
   ```

2. **Use xUnit theories for parameterized tests**
   ```csharp
   [Theory]
   [InlineData(0, 0)]
   [InlineData(47, 235)]
   [InlineData(-3, 6)]
   public void CalculateEarnings_ReturnsExpected(int points, decimal expected)
   {
       var result = service.CalculateEarnings(points);
       result.Should().Be(expected);
   }
   ```

3. **Test controller response codes**
   ```csharp
   [Fact]
   public async Task Create_WithValidData_Returns201Created()
   {
       var response = await _httpClient.PostAsJsonAsync(
           "/api/seasons",
           new { name = "Test" }
       );
       response.StatusCode.Should().Be(HttpStatusCode.Created);
   }
   ```

### Frontend Specific

1. **Query elements by accessible selectors**
   ```typescript
   // ✓ Good: Use semantic queries
   screen.getByRole('button', { name: /submit/i })
   screen.getByLabelText(/email/i)

   // ✗ Bad: Implementation details
   screen.getByTestId('submit-button')
   screen.getByClassName('input-field')
   ```

2. **Wait for async changes**
   ```typescript
   // ✓ Good: Wait for element
   expect(await screen.findByText(/loaded/i)).toBeInTheDocument();

   // ✗ Bad: Assumes immediate render
   expect(screen.getByText(/loaded/i)).toBeInTheDocument();
   ```

3. **Test user interactions, not implementation**
   ```typescript
   // ✓ Good: Simulate user action
   await user.type(screen.getByRole('textbox'), 'text');

   // ✗ Bad: Test implementation
   fireEvent.change(input, { target: { value: 'text' } });
   ```

## Coverage Goals

| Layer | Target |
|-------|--------|
| Backend API (integration) | 80%+ |
| Backend Services (unit) | 85%+ |
| Frontend Components | 75%+ |
| Frontend Pages | 70%+ |

Generate coverage report:

**Backend:**
```bash
dotnet test /p:CollectCoverage=true /p:CoverageFormat=opencover /p:CoverageDirectory=coverage
```

**Frontend:**
```bash
npm test -- --coverage
```

## Continuous Integration

GitHub Actions runs tests on every PR and push to main.

See `.github/workflows/pr-check.yml` for CI configuration.

Tests must pass before merging to main.

Last Updated: March 2026
