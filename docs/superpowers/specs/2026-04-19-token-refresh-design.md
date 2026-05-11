# Token Refresh Design

**Date:** 2026-04-19  
**Status:** Approved

## Problem

JWT tokens expire after 60 minutes with no renewal mechanism, forcing active users to re-login. The goal is to keep users logged in as long as they are actively using the app.

## Approach: Silent Token Renewal

Keep 60-minute JWTs. Add a `/api/auth/refresh` endpoint that issues a new token while the current one is still valid (or within a small grace window). The frontend proactively refreshes before each request when the token is close to expiry.

No refresh token storage in the DB. The existing JWT is proof of identity.

---

## Backend

### New Endpoint

`POST /api/auth/refresh` in `AuthController`

- Protected with `[Authorize]` using a **separate JWT bearer scheme** that has `ClockSkew` set to 5 minutes (allows tokens expiring soon or just-expired to still be accepted)
- Extracts user ID from `ClaimTypes.NameIdentifier`
- Loads user via `UserManager<ApplicationUser>`
- Calls existing `GenerateJwtToken()` — no new logic
- Returns `{ "token": "..." }` — same shape as login response

### JWT Validation for Refresh

Register a second named scheme (e.g., `"RefreshBearer"`) in `Program.cs` with `ClockSkew = TimeSpan.FromMinutes(5)` and `ValidateLifetime = true`. Apply this scheme only to the refresh endpoint via `[Authorize(AuthenticationSchemes = "RefreshBearer")]`.

**Files to modify:**
- `backend/src/NHLStats.Api/Program.cs` — add second bearer scheme
- `backend/src/NHLStats.Api/Controllers/AuthController.cs` — add refresh endpoint

---

## Frontend

### Token Freshness Check

Add `ensureFreshToken()` in `frontend/src/services/apiClient.ts`:

1. Read token from `localStorage`
2. Base64-decode the JWT payload (middle segment), parse JSON, read `exp` (Unix seconds)
3. If `exp - now < 5 minutes`, call `POST /api/auth/refresh` with current token in `Authorization` header
4. On success: write new token to `localStorage`
5. On failure (401 / network error): clear `localStorage` keys `token` and `user`, redirect to `/login`

### Integration

Call `ensureFreshToken()` at the top of `get()`, `post()`, `put()`, and `delete()` in `apiClient.ts`, before `getHeaders()`.

`AuthContext` requires no changes — it reads token from `localStorage` on each render.

**Files to modify:**
- `frontend/src/services/apiClient.ts` — add `ensureFreshToken()`, call it in all request methods

---

## Data Flow

```
User makes action
  → apiClient method called
  → ensureFreshToken()
      → token expiry < 5 min? → POST /api/auth/refresh → store new token
      → refresh failed?       → logout + redirect /login
  → getHeaders() (picks up fresh token)
  → fetch(...)
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Token valid, > 5 min left | No refresh, proceed normally |
| Token expiring soon (< 5 min) | Refresh silently, proceed |
| Token already expired, within 5-min grace | Refresh succeeds (ClockSkew), proceed |
| Token expired beyond grace window | Refresh returns 401 → logout |
| Network error during refresh | Treat as logout |

---

## Verification

1. Log in and note token expiry (decode JWT at jwt.io)
2. Wait until < 5 min before expiry, make any API call — verify a new token is stored in localStorage with a fresh expiry
3. Let token expire completely (beyond 5-min grace), make an API call — verify redirect to `/login`
4. Run backend tests: `dotnet test tests/NHLStats.Api.Tests`
5. Run frontend tests: `cd frontend && npm test`
