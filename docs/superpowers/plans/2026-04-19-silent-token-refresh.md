# Silent Token Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent users from being forced to re-login by silently refreshing their JWT before it expires, keeping them logged in as long as they are actively using the app.

**Architecture:** A new `POST /api/auth/refresh` endpoint on the backend validates the current JWT using a secondary bearer scheme with a 5-minute clock skew, then issues a fresh 60-minute token. The frontend checks the token expiry before every API request; if fewer than 5 minutes remain it calls the refresh endpoint and stores the new token. On refresh failure the user is logged out and redirected to `/login`.

**Tech Stack:** ASP.NET Core JWT Bearer (named scheme), `JwtSecurityTokenHandler`, native `fetch`, `localStorage`, Vitest `vi.stubGlobal`

---

## File Map

| File | Change |
|---|---|
| `backend/src/NHLStats.Api/Program.cs` | Add `"RefreshBearer"` named JWT scheme with `ClockSkew = 5 min` |
| `backend/src/NHLStats.Api/Controllers/AuthController.cs` | Add `POST /api/auth/refresh` endpoint |
| `backend/tests/NHLStats.Api.Tests/Auth/AuthTests.cs` | Add two integration tests for the refresh endpoint |
| `frontend/src/services/apiClient.ts` | Add `ensureFreshToken()` helper; call it in `get/post/put/delete` |
| `frontend/src/__tests__/apiClient.test.ts` | New file — unit tests for `ensureFreshToken` behaviour |

---

## Task 1: Backend — refresh endpoint (TDD)

**Files:**
- Test: `backend/tests/NHLStats.Api.Tests/Auth/AuthTests.cs`
- Modify: `backend/src/NHLStats.Api/Program.cs`
- Modify: `backend/src/NHLStats.Api/Controllers/AuthController.cs`

- [ ] **Step 1: Write the failing tests**

Append these two tests inside the `AuthTests` class in `backend/tests/NHLStats.Api.Tests/Auth/AuthTests.cs`:

```csharp
// -----------------------------------------------------------------------
// Refresh
// -----------------------------------------------------------------------

[Fact]
public async Task Refresh_with_valid_token_returns_200_and_new_token()
{
    var client = _factory.CreateClient();

    // Obtain a fresh token first
    var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
    {
        email = AdminEmail,
        password = AdminPassword
    });
    loginResp.EnsureSuccessStatusCode();
    var loginBody = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
    var token = loginBody.GetProperty("token").GetString()!;

    // Call refresh with that token
    var refreshClient = _factory.CreateClient();
    refreshClient.DefaultRequestHeaders.Authorization =
        new AuthenticationHeaderValue("Bearer", token);

    var resp = await refreshClient.PostAsync("/api/auth/refresh", null);

    resp.StatusCode.Should().Be(HttpStatusCode.OK);
    var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
    body.GetProperty("token").GetString()
        .Should().NotBeNullOrWhiteSpace();
}

[Fact]
public async Task Refresh_without_token_returns_401()
{
    var client = _factory.CreateClient();

    var resp = await client.PostAsync("/api/auth/refresh", null);

    resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0/backend"
dotnet test tests/NHLStats.Api.Tests --filter "FullyQualifiedName~Refresh" --no-build 2>&1 | tail -20
```

Expected: two failing tests — `Refresh_with_valid_token_returns_200_and_new_token` and `Refresh_without_token_returns_401`.

- [ ] **Step 3: Add the "RefreshBearer" named JWT scheme in Program.cs**

In `backend/src/NHLStats.Api/Program.cs`, find the `.AddJwtBearer(options =>` block (ends around line 58). Immediately after its closing `);`, add:

```csharp
    .AddJwtBearer("RefreshBearer", options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = key,
            ValidateIssuer = true,
            ValidIssuer = jwtIssuer,
            ValidateAudience = true,
            ValidAudience = jwtAudience,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(5)
        };
    });
```

The result of the `.AddAuthentication(...)` call should now chain **two** `.AddJwtBearer(...)` calls — the existing default one and the new `"RefreshBearer"` one.

- [ ] **Step 4: Add the refresh endpoint in AuthController.cs**

In `backend/src/NHLStats.Api/Controllers/AuthController.cs`, add this method after the `Login` action (around line 68):

```csharp
[HttpPost("refresh")]
[Authorize(AuthenticationSchemes = "RefreshBearer")]
public async Task<IActionResult> Refresh()
{
    var user = await GetCurrentUser();
    if (user == null) return Unauthorized();
    var token = await GenerateJwtToken(user);
    return Ok(new { token });
}
```

- [ ] **Step 5: Build and run the two refresh tests**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0/backend"
dotnet build --no-restore 2>&1 | tail -5
dotnet test tests/NHLStats.Api.Tests --filter "FullyQualifiedName~Refresh" 2>&1 | tail -20
```

Expected: build succeeds, both tests pass.

- [ ] **Step 6: Run the full backend test suite to check for regressions**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0/backend"
dotnet test tests/NHLStats.Api.Tests 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0"
git add backend/src/NHLStats.Api/Program.cs \
        backend/src/NHLStats.Api/Controllers/AuthController.cs \
        backend/tests/NHLStats.Api.Tests/Auth/AuthTests.cs
git commit -m "feat: add POST /api/auth/refresh endpoint with RefreshBearer scheme"
```

---

## Task 2: Frontend — silent token refresh (TDD)

**Files:**
- Create: `frontend/src/__tests__/apiClient.test.ts`
- Modify: `frontend/src/services/apiClient.ts`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/__tests__/apiClient.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import apiClient from '../services/apiClient'

function makeJwt(expiresInSeconds: number): string {
    const payload = { exp: Math.floor(Date.now() / 1000) + expiresInSeconds, sub: 'user-1' }
    const encoded = btoa(JSON.stringify(payload))
    return `eyJhbGciOiJIUzI1NiJ9.${encoded}.signature`
}

describe('apiClient silent token refresh', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('skips refresh when token has more than 5 minutes remaining', async () => {
        localStorage.setItem('token', makeJwt(600))
        const fetchMock = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({}), { status: 200 })
        )
        vi.stubGlobal('fetch', fetchMock)

        await apiClient.get('/api/test')

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0][0]).not.toContain('/api/auth/refresh')
    })

    it('calls refresh and stores new token when expiry is within 5 minutes', async () => {
        const oldToken = makeJwt(60)
        const newToken = makeJwt(3600)
        localStorage.setItem('token', oldToken)

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ token: newToken }), { status: 200 })
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({}), { status: 200 })
            )
        vi.stubGlobal('fetch', fetchMock)

        await apiClient.get('/api/test')

        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(fetchMock.mock.calls[0][0]).toContain('/api/auth/refresh')
        expect(localStorage.getItem('token')).toBe(newToken)
    })

    it('clears localStorage and sets location to /login when refresh fails', async () => {
        localStorage.setItem('token', makeJwt(60))
        localStorage.setItem('user', JSON.stringify({ id: '1' }))

        const fetchMock = vi.fn()
            .mockResolvedValueOnce(new Response(null, { status: 401 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))
        vi.stubGlobal('fetch', fetchMock)

        Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })

        await apiClient.get('/api/test')

        expect(localStorage.getItem('token')).toBeNull()
        expect(localStorage.getItem('user')).toBeNull()
        expect(window.location.href).toBe('/login')
    })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0/frontend"
npm test -- apiClient --run 2>&1 | tail -20
```

Expected: all three tests fail (function doesn't exist yet).

- [ ] **Step 3: Implement ensureFreshToken in apiClient.ts**

Replace the full contents of `frontend/src/services/apiClient.ts` with:

```typescript
// Empty string = relative URLs, so the Vite dev proxy (or same-origin in prod) handles routing.
// Override with VITE_API_BASE_URL for deployments that host API on a different domain.
const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function ensureFreshToken(): Promise<void> {
    const token = localStorage.getItem('token')
    if (!token) return

    try {
        const parts = token.split('.')
        if (parts.length !== 3) return
        const payload = JSON.parse(atob(parts[1])) as { exp?: number }
        const expMs = (payload.exp ?? 0) * 1000
        if (expMs - Date.now() > 5 * 60 * 1000) return

        const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        })

        if (!response.ok) throw new Error('Refresh failed')

        const data = await response.json() as { token: string }
        localStorage.setItem('token', data.token)
    } catch {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
    }
}

function getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }
    const token = localStorage.getItem('token')
    if (token) {
        headers['Authorization'] = `Bearer ${token}`
    }
    return headers
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`)
    }
    // 204 No Content — return null (typed as T, callers should use T | null)
    if (response.status === 204) {
        return null as T
    }
    return response.json() as Promise<T>
}

const apiClient = {
    async get<T>(path: string): Promise<T> {
        await ensureFreshToken()
        const response = await fetch(`${BASE_URL}${path}`, {
            headers: getHeaders(),
        })
        return handleResponse<T>(response)
    },

    async post<T>(path: string, body: unknown): Promise<T> {
        await ensureFreshToken()
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(body),
        })
        return handleResponse<T>(response)
    },

    async put<T>(path: string, body: unknown): Promise<T> {
        await ensureFreshToken()
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(body),
        })
        return handleResponse<T>(response)
    },

    async delete<T>(path: string): Promise<T> {
        await ensureFreshToken()
        const response = await fetch(`${BASE_URL}${path}`, {
            method: 'DELETE',
            headers: getHeaders(),
        })
        return handleResponse<T>(response)
    },
}

export default apiClient
```

- [ ] **Step 4: Run the new unit tests**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0/frontend"
npm test -- apiClient --run 2>&1 | tail -20
```

Expected: all three tests pass.

- [ ] **Step 5: Run the full frontend test suite to check for regressions**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0/frontend"
npm test -- --run 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0"
git add frontend/src/services/apiClient.ts \
        frontend/src/__tests__/apiClient.test.ts
git commit -m "feat: silent JWT refresh in apiClient before each request"
```

---

## Verification

1. Log in to the app. Open DevTools → Application → Local Storage, copy the `token` value and paste it at [jwt.io](https://jwt.io) to read the `exp` claim.
2. Manually edit the token in localStorage to one that expires in ~2 minutes (any JWT-encoded token with an `exp` ~120 seconds in the future and the correct signature — or simply wait).
3. Make any app action (navigate to a page, load data). In the Network tab, verify a `POST /api/auth/refresh` request fired before the data request, and that the token in LocalStorage now has a new, later `exp`.
4. Let the token and the 5-minute grace window both expire. Make an app action and verify you are redirected to `/login`.
