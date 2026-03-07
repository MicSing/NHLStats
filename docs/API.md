# REST API Reference

Complete REST API endpoint documentation for NHL Stats 2.0.

**Base URL**: `http://localhost:5267/api` (development) or `https://api.nhlstats.azurewebsites.net/api` (production)

**Authentication**: JWT Bearer token in `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Response Format

All responses are JSON.

**Success** (2xx):
```json
{
  "id": "uuid",
  "name": "Season 2025",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

**Error** (4xx, 5xx):
```json
{
  "error": "User not found",
  "message": "The user with ID 'xyz' could not be found."
}
```

## Authentication Endpoints

### Register

Create new user account.

```
POST /api/auth/register
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "email": "user@example.com"
}
```

**Errors:**
- `409 Conflict` — Email already in use
- `400 Bad Request` — Invalid email or weak password

### Login

Authenticate and receive JWT token.

```
POST /api/auth/login
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:**
- `401 Unauthorized` — Invalid email or password

### Get Current User

Retrieve authenticated user's profile.

```
GET /api/auth/me
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com"
}
```

**Errors:**
- `401 Unauthorized` — No token or invalid token

## Users Endpoints

### List Users

Get all users (admin only).

```
GET /api/users
Authorization: Bearer <token>
```

**Query Parameters:**
- `pageSize` (int) — Items per page (default: 50)
- `pageNumber` (int) — Page number (default: 1)
- `search` (string) — Filter by name or email

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "John Doe",
    "email": "john@example.com",
    "createdAt": "2026-01-01T00:00:00Z"
  }
]
```

### Get User by ID

```
GET /api/users/{userId}
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "John Doe",
  "email": "john@example.com",
  "seasonUsers": [
    {
      "seasonId": "uuid",
      "teamId": "uuid",
      "teamName": "New York Rangers"
    }
  ]
}
```

**Errors:**
- `404 Not Found`

### Update User

```
PUT /api/users/{userId}
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Jane Doe"
}
```

**Response:** `200 OK` or `204 No Content`

**Errors:**
- `404 Not Found`
- `403 Forbidden` — Not authorized to update this user

## Seasons Endpoints

### List Seasons

Get all seasons.

```
GET /api/seasons
```

**Query Parameters:**
- `includeArchived` (bool) — Include completed seasons (default: false)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Regular Season 2025-26",
    "hostedTeamId": "uuid",
    "hostedTeamName": "New York Rangers",
    "createdAt": "2026-01-01T00:00:00Z",
    "matchCount": 20,
    "userCount": 12
  }
]
```

### Get Season by ID

```
GET /api/seasons/{seasonId}
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "Regular Season 2025-26",
  "hostedTeamId": "uuid",
  "hostedTeamName": "New York Rangers",
  "parentSeasonId": null,
  "pointReasons": [
    {
      "id": "uuid",
      "name": "Win",
      "value": 3
    },
    {
      "id": "uuid",
      "name": "Goal",
      "value": 1
    }
  ],
  "users": [
    {
      "userId": "uuid",
      "userName": "John Doe",
      "teamId": "uuid",
      "totalPoints": 47,
      "totalEarnings": 235.00
    }
  ]
}
```

### Create Season

Create new season (admin only).

```
POST /api/seasons
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "name": "Regular Season 2025-26",
  "hostedTeamId": "uuid",
  "parentSeasonId": null,
  "pointReasons": [
    {
      "name": "Win",
      "value": 3
    },
    {
      "name": "Goal",
      "value": 1
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "Regular Season 2025-26",
  "hostedTeamId": "uuid"
}
```

### Update Season

```
PUT /api/seasons/{seasonId}
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Updated Season Name"
}
```

**Response:** `200 OK` or `204 No Content`

### Delete Season

```
DELETE /api/seasons/{seasonId}
Authorization: Bearer <token>
```

**Response:** `204 No Content`

## Teams Endpoints

### List Teams

Get all 32 NHL teams.

```
GET /api/teams
```

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "New York Rangers",
    "shortName": "NYR"
  },
  {
    "id": "uuid",
    "name": "New York Islanders",
    "shortName": "NYI"
  }
]
```

### Get Team by ID

```
GET /api/teams/{teamId}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "New York Rangers",
  "shortName": "NYR"
}
```

## Matches Endpoints

### List Matches

Get matches for a season.

```
GET /api/matches?seasonId=uuid
```

**Query Parameters:**
- `seasonId` (GUID) — **Required**
- `status` (string) — Filter by: Upcoming, Live, Playable, Final
- `teamId` (GUID) — Filter by team (home or away)

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "seasonId": "uuid",
    "matchNumber": 1,
    "homeTeamId": "uuid",
    "homeTeamName": "New York Rangers",
    "awayTeamId": "uuid",
    "awayTeamName": "Boston Bruins",
    "homeTeamScore": 3,
    "awayTeamScore": 2,
    "matchDate": "2026-01-15T19:00:00Z",
    "status": "Final"
  }
]
```

### Get Match by ID

```
GET /api/matches/{matchId}
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "seasonId": "uuid",
  "matchNumber": 1,
  "homeTeamId": "uuid",
  "homeTeamName": "New York Rangers",
  "awayTeamId": "uuid",
  "awayTeamName": "Boston Bruins",
  "homeTeamScore": 3,
  "awayTeamScore": 2,
  "matchDate": "2026-01-15T19:00:00Z",
  "status": "Final",
  "userMatches": [
    {
      "userId": "uuid",
      "userName": "John Doe",
      "points": 5,
      "goals": 2,
      "penalties": 0
    }
  ]
}
```

### Create Match

```
POST /api/matches
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "seasonId": "uuid",
  "matchNumber": 1,
  "homeTeamId": "uuid",
  "awayTeamId": "uuid",
  "matchDate": "2026-01-15T19:00:00Z",
  "status": "Upcoming"
}
```

**Response:** `201 Created`

### Bulk Create Matches

```
POST /api/matches/bulk
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "seasonId": "uuid",
  "matches": [
    {
      "matchNumber": 1,
      "homeTeamId": "uuid",
      "awayTeamId": "uuid",
      "matchDate": "2026-01-15T19:00:00Z"
    }
  ]
}
```

**Response:** `201 Created`
```json
[
  {
    "id": "uuid",
    "matchNumber": 1
  }
]
```

### Update Match

```
PUT /api/matches/{matchId}
Authorization: Bearer <token>
```

**Request:**
```json
{
  "status": "Final",
  "homeTeamScore": 3,
  "awayTeamScore": 2
}
```

**Response:** `200 OK` or `204 No Content`

### Close Match

Finalize match and trigger payout calculation.

```
POST /api/matches/{matchId}/close
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "status": "Final",
  "payoutCalculated": true
}
```

## User Matches Endpoints

### Get User's Matches for Season

```
GET /api/user-matches?seasonId=uuid
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "matchId": "uuid",
    "matchNumber": 1,
    "points": 5,
    "goals": 2,
    "penalties": 0,
    "createdAt": "2026-01-15T20:00:00Z"
  }
]
```

### Create/Record User Match Stats

```
POST /api/user-matches
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "userId": "uuid",
  "matchId": "uuid",
  "seasonId": "uuid",
  "points": 5,
  "goals": 2,
  "penalties": 0,
  "pointEntries": [
    {
      "pointReasonId": "uuid",
      "value": 3
    },
    {
      "pointReasonId": "uuid",
      "value": 2
    }
  ]
}
```

**Response:** `201 Created`

### Update User Match

```
PUT /api/user-matches/{userMatchId}
Authorization: Bearer <token>
```

**Request:**
```json
{
  "points": 6,
  "goals": 3
}
```

**Response:** `200 OK` or `204 No Content`

## User Match Points Endpoints

### Get Points for a User Match

```
GET /api/user-match-points?userMatchId=uuid
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "userMatchId": "uuid",
    "pointReasonId": "uuid",
    "pointReasonName": "Win",
    "value": 3
  },
  {
    "id": "uuid",
    "userMatchId": "uuid",
    "pointReasonId": "uuid",
    "pointReasonName": "Goal",
    "value": 1
  }
]
```

### Add Point Entry

```
POST /api/user-match-points
Authorization: Bearer <token>
```

**Request:**
```json
{
  "userMatchId": "uuid",
  "pointReasonId": "uuid",
  "value": 3
}
```

**Response:** `201 Created`

### Delete Point Entry

```
DELETE /api/user-match-points/{pointId}
Authorization: Bearer <token>
```

**Response:** `204 No Content`

## Point Reasons Endpoints

### List Point Reasons

```
GET /api/point-reasons?seasonId=uuid
```

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Win",
    "value": 3,
    "isActive": true
  },
  {
    "id": "uuid",
    "name": "Goal",
    "value": 1,
    "isActive": true
  }
]
```

### Create Point Reason

```
POST /api/point-reasons
Authorization: Bearer <token>
```

**Request:**
```json
{
  "seasonId": "uuid",
  "name": "Assist",
  "value": 1
}
```

**Response:** `201 Created`

### Update Point Reason

```
PUT /api/point-reasons/{reasonId}
Authorization: Bearer <token>
```

**Request:**
```json
{
  "value": 2,
  "isActive": true
}
```

**Response:** `200 OK` or `204 No Content`

## Stats Endpoints

### Get User Stats for Season

```
GET /api/stats/user?seasonId=uuid&userId=uuid
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "userId": "uuid",
  "userName": "John Doe",
  "seasonId": "uuid",
  "totalPoints": 47,
  "totalGoals": 12,
  "totalPenalties": 3,
  "matchCount": 10,
  "earnings": 235.00,
  "pointsByMatch": [
    {
      "matchNumber": 1,
      "points": 5,
      "matchDate": "2026-01-15T19:00:00Z"
    }
  ]
}
```

### Get Season Leaderboard

```
GET /api/stats/leaderboard?seasonId=uuid
Authorization: Bearer <token>
```

**Query Parameters:**
- `sortBy` (string) — points, earnings, goals, penalties

**Response:** `200 OK`
```json
[
  {
    "rank": 1,
    "userId": "uuid",
    "userName": "John Doe",
    "points": 47,
    "earnings": 235.00,
    "goals": 12,
    "penalties": 3
  },
  {
    "rank": 2,
    "userId": "uuid",
    "userName": "Jane Smith",
    "points": 42,
    "earnings": 210.00,
    "goals": 10,
    "penalties": 5
  }
]
```

### Get Team Stats

```
GET /api/stats/team?seasonId=uuid&teamId=uuid
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "teamId": "uuid",
  "teamName": "New York Rangers",
  "seasonId": "uuid",
  "totalPoints": 500,
  "userCount": 12,
  "averagePointsPerUser": 41.67,
  "totalEarnings": 2500.00
}
```

## Money Configuration Endpoints

### Get Money Config

```
GET /api/money-config
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "positivePointsRate": 5.00,
  "negativePointsRate": -2.00,
  "minimumPayout": 0.00,
  "effectiveDate": "2026-01-01T00:00:00Z"
}
```

### Create or Update Money Config

```
POST /api/money-config
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "positivePointsRate": 5.00,
  "negativePointsRate": -2.00,
  "minimumPayout": 0.00,
  "effectiveDate": "2026-01-01T00:00:00Z"
}
```

**Response:** `201 Created` or `200 OK`

## Expenses Endpoints

### List Expenses

```
GET /api/expenses?seasonId=uuid
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "seasonId": "uuid",
    "userId": "uuid",
    "userName": "League",
    "name": "League Fee",
    "amount": 50.00,
    "createdAt": "2026-01-01T00:00:00Z"
  }
]
```

### Create Expense

```
POST /api/expenses
Authorization: Bearer <token>
```

**Request:**
```json
{
  "seasonId": "uuid",
  "userId": "uuid",
  "name": "Trophy Fund",
  "amount": 100.00
}
```

**Response:** `201 Created`

### Delete Expense

```
DELETE /api/expenses/{expenseId}
Authorization: Bearer <token>
```

**Response:** `204 No Content`

## Payouts Endpoints

### Get User Payouts

```
GET /api/user-payouts?seasonId=uuid
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "userId": "uuid",
    "seasonId": "uuid",
    "amount": 181.00,
    "pointsEarned": 47,
    "expensesDeducted": 60.00,
    "payoutDate": "2026-06-30T00:00:00Z",
    "notes": "Regular season final payout"
  }
]
```

### Create Payout

Trigger payout calculation for a user/season.

```
POST /api/user-payouts
Authorization: Bearer <token>
```

**Request:**
```json
{
  "userId": "uuid",
  "seasonId": "uuid"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "amount": 181.00,
  "payoutDate": "2026-06-30T00:00:00Z"
}
```

## Roster Endpoints

### Get Roster

```
GET /api/roster?seasonId=uuid&teamId=uuid
```

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "Connor McDavid",
    "position": "C",
    "nhlId": "8478402"
  }
]
```

### Import Roster (Bulk)

```
POST /api/roster/import
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "seasonId": "uuid",
  "teamId": "uuid",
  "players": [
    {
      "name": "Connor McDavid",
      "position": "C",
      "nhlId": "8478402"
    }
  ]
}
```

**Response:** `201 Created`

## Health Check

```
GET /health
```

**Response:** `200 OK`
```json
{
  "status": "Healthy"
}
```

## Error Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE or PUT with no response body |
| 400 | Bad Request | Invalid JSON, validation error |
| 401 | Unauthorized | Missing/invalid token |
| 403 | Forbidden | Authenticated but not authorized (e.g., not admin) |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Email already in use, duplicate entry |
| 500 | Internal Server Error | Unexpected server error |

## Rate Limiting

Not yet implemented. Add in future if API becomes public.

## Versioning

API is unversioned (v1). Breaking changes would increment to `/api/v2/`.

Last Updated: March 2026
