# NHLStats API Reference

Complete documentation of all REST API endpoints in the NHLStats backend.

**Base URL**: `/api`

**Common Headers**:
- All responses include `X-Correlation-Id` and `X-Trace-Id` for request tracing
- `Content-Type: application/json` for all request/response bodies

**Error Response Format**:
```json
{
  "code": "ErrorCode",
  "message": "Human-readable error description",
  "traceId": "f1e2d3c4-b5a6-7890-cdef-ab9876543210",
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "validationErrors": {
    "fieldName": ["Error message 1", "Error message 2"]
  }
}
```

**HTTP Status Codes**:
- `200 OK` - Successful GET/PUT request
- `201 Created` - Successful POST request
- `204 No Content` - Successful DELETE request
- `400 Bad Request` - Validation error or invalid request
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate entry)
- `500 Internal Server Error` - Unexpected server error

---

## Table of Contents

1. [Match Endpoints](#match-endpoints)
2. [Player Endpoints](#player-endpoints)
3. [Season Endpoints](#season-endpoints)
4. [Team Endpoints](#team-endpoints)
5. [User Endpoints](#user-endpoints)
6. [User Match Relation Endpoints](#user-match-relation-endpoints)
7. [User Stats Endpoints](#user-stats-endpoints)
8. [Enum Reference](#enum-reference)

---

## Match Endpoints

### List All Matches

```http
GET /api/Match?seasonPhaseId={guid}
```

Gets all matches, optionally filtered by season phase.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `seasonPhaseId` | `Guid` | No | Filter matches by season phase ID |

**Response**: `200 OK`
```json
[
  {
    "id": "guid",
    "seasonPhaseId": "guid",
    "homeTeamId": "guid",
    "homeTeamName": "Colorado Avalanche",
    "awayTeamId": "guid",
    "awayTeamName": "Edmonton Oilers",
    "homeScore": 3,
    "awayScore": 1,
    "lifecycleState": 2,
    "completionType": 1,
    "isSeasonAggregate": false,
    "matchIndex": 1,
    "matchDate": "2026-01-15T00:00:00Z",
    "activeUserMatchRelations": []
  }
]
```

---

### Get Match by ID

```http
GET /api/Match/{id}
```

Gets a single match by its ID.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `200 OK` - Returns `MatchDto`

**Errors**:
- `404 Not Found` - Match does not exist

---

### Create Match

```http
POST /api/Match
```

Creates a new match.

**Request Body** (`CreateMatchDto`):
```json
{
  "seasonPhaseId": "guid",
  "homeTeamId": "guid",
  "awayTeamId": "guid",
  "isSeasonAggregate": false,
  "matchIndex": null
}
```

**Validation**:
- `seasonPhaseId` - Required, must be valid GUID
- `homeTeamId` - Required, must be valid GUID
- `awayTeamId` - Required, must be valid GUID
- `isSeasonAggregate` - Optional, defaults to `false`
- `matchIndex` - Optional integer, auto-calculated if null

**Response**: `201 Created` - Returns `MatchDto` with `Location` header

**Errors**:
- `400 Bad Request` - Validation failure

---

### Create Multiple Matches

```http
POST /api/Match/bulk
```

Creates multiple matches in a single request.

**Request Body**: Array of `CreateMatchDto` (must be non-empty)

**Response**: `200 OK` - Returns array of `MatchDto`

**Errors**:
- `400 Bad Request` - Validation failure or empty array

---

### Update Match

```http
PUT /api/Match/{id}
```

Updates an existing match.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Request Body** (`UpdateMatchDto`):
```json
{
  "seasonPhaseId": "guid",
  "homeTeamId": "guid",
  "awayTeamId": "guid",
  "homeScore": 3,
  "awayScore": 1,
  "lifecycleState": 2,
  "completionType": 1,
  "isSeasonAggregate": false,
  "matchIndex": 1,
  "matchDate": "2026-01-15T00:00:00Z"
}
```

**Validation**:
- All fields required except `homeScore`, `awayScore`, `matchIndex`, and `matchDate` (nullable)
- Scores must be ≥ 0 if provided
- `matchIndex` must be ≥ 0 if provided

**Response**: `200 OK` - Returns updated `MatchDto`

**Errors**:
- `400 Bad Request` - Validation failure
- `404 Not Found` - Match does not exist

---

### Delete Match

```http
DELETE /api/Match/{id}
```

Deletes a match.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `204 No Content`

**Errors**:
- `404 Not Found` - Match does not exist

---

## Player Endpoints

### List All Players

```http
GET /api/Player
```

Gets all players.

**Response**: `200 OK`
```json
[
  {
    "id": "guid",
    "firstName": "Connor",
    "surname": "McDavid",
    "playerPosition": 3,
    "isActive": true
  }
]
```

---

### Search Players

```http
GET /api/Player/search?q={term}
```

Searches players by name (first name or surname).

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | `string` | Yes | Search term |

**Response**: `200 OK` - Returns array of `PlayerDto` matching the search term

---

### Get Player by ID

```http
GET /api/Player/{id}
```

Gets a single player by ID.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `200 OK` - Returns `PlayerDto`

**Errors**:
- `404 Not Found` - Player does not exist

---

### Create Player

```http
POST /api/Player
```

Creates a new player.

**Request Body** (`CreatePlayerDto`):
```json
{
  "firstName": "Connor",
  "surname": "McDavid",
  "playerPosition": 3,
  "isActive": true
}
```

**Validation**:
- `firstName` - Required, 1-100 characters
- `surname` - Required, 1-100 characters
- `playerPosition` - Required, valid `HockeyPosition` enum value (0-4)
- `isActive` - Optional, defaults to `true`

**Response**: `201 Created` - Returns `PlayerDto` with `Location` header

**Errors**:
- `400 Bad Request` - Validation failure

---

### Update Player

```http
PUT /api/Player/{id}
```

Updates an existing player.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Request Body** (`UpdatePlayerDto`):
```json
{
  "firstName": "Connor",
  "surname": "McDavid",
  "playerPosition": 3,
  "isActive": true
}
```

**Response**: `200 OK` - Returns updated `PlayerDto`

**Errors**:
- `400 Bad Request` - Validation failure
- `404 Not Found` - Player does not exist

---

### Delete Player

```http
DELETE /api/Player/{id}
```

Deletes a player.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `204 No Content`

**Errors**:
- `404 Not Found` - Player does not exist

---

## Season Endpoints

### List All Season Phases

```http
GET /api/Season
```

Gets all season phases.

**Response**: `200 OK`
```json
[
  {
    "id": "guid",
    "name": "Season 1 - Regular",
    "hostedTeamId": "guid",
    "nhlVersion": 26,
    "startedOn": "2025-10-01T00:00:00Z",
    "seasonStatus": 0,
    "seasonPhaseType": 0,
    "parentSeasonPhaseId": null,
    "teamName": "Colorado Avalanche"
  }
]
```

---

### Get Season Phase by ID

```http
GET /api/Season/{id}
```

Gets a season phase by ID.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `200 OK` - Returns `SeasonPhaseDto`

**Errors**:
- `404 Not Found` - Season phase does not exist

---

### Get Playoff Season by Parent

```http
GET /api/Season/playoff/{parentSeasonPhaseId}
```

Gets the playoff season phase linked to a given regular-season parent.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `parentSeasonPhaseId` | `Guid` | Yes |

**Response**: `200 OK` - Returns `SeasonPhaseDto`

**Errors**:
- `404 Not Found` - No playoff phase found for the given parent

---

### Create Season Phase

```http
POST /api/Season
```

Creates a new season phase.

**Request Body** (`CreateSeasonPhaseDto`):
```json
{
  "name": "Season 1 - Regular",
  "hostedTeamId": "guid",
  "nhlVersion": 26,
  "startedOn": "2025-10-01T00:00:00Z",
  "seasonStatus": 0,
  "seasonPhaseType": 0,
  "parentSeasonPhaseId": null
}
```

**Validation**:
- `name` - Required, max 200 characters
- `hostedTeamId` - Required, must be valid GUID
- `nhlVersion` - Required, valid `NhlVersion` enum value
- `startedOn` - Required, valid DateTime
- `seasonStatus` - Optional, defaults to `Active` (0)
- `seasonPhaseType` - Optional, defaults to `Regular` (0)
- `parentSeasonPhaseId` - Optional, must be valid GUID if provided

**Response**: `201 Created` - Returns `SeasonPhaseDto` with `Location` header

**Errors**:
- `400 Bad Request` - Validation failure or invalid parent reference

---

### Update Season Phase

```http
PUT /api/Season/{id}
```

Updates an existing season phase.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Request Body** (`UpdateSeasonPhaseDto`):
```json
{
  "name": "Season 1 - Regular",
  "hostedTeamId": "guid",
  "nhlVersion": 26,
  "startedOn": "2025-10-01T00:00:00Z",
  "seasonStatus": 0,
  "seasonPhaseType": 0,
  "parentSeasonPhaseId": null
}
```

**Response**: `200 OK` - Returns updated `SeasonPhaseDto`

**Errors**:
- `400 Bad Request` - Validation failure or invalid argument
- `404 Not Found` - Season phase does not exist

---

### Delete Season Phase

```http
DELETE /api/Season/{id}
```

Deletes a season phase.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `204 No Content`

**Errors**:
- `404 Not Found` - Season phase does not exist

---

## Team Endpoints

### List All Teams

```http
GET /api/Team
```

Gets all teams.

**Response**: `200 OK`
```json
[
  {
    "id": "guid",
    "name": "Colorado Avalanche",
    "shortName": "COL",
    "franchise": "Avalanche",
    "isActive": true
  }
]
```

---

### Get Team by ID

```http
GET /api/Team/{id}
```

Gets a team by ID.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `200 OK` - Returns `TeamDto`

**Errors**:
- `404 Not Found` - Team does not exist

---

### Create Team

```http
POST /api/Team
```

Creates a new team.

**Request Body** (`CreateTeamDto`):
```json
{
  "name": "Colorado Avalanche",
  "shortName": "COL",
  "franchise": "Avalanche",
  "isActive": true
}
```

**Validation**:
- `name` - Required, 1-200 characters
- `shortName` - Required, exactly 3 characters
- `franchise` - Required, 1-200 characters
- `isActive` - Optional, defaults to `true`

**Response**: `201 Created` - Returns `TeamDto` with `Location` header

**Errors**:
- `400 Bad Request` - Validation failure

---

### Update Team

```http
PUT /api/Team/{id}
```

Updates an existing team.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Request Body** (`UpdateTeamDto`):
```json
{
  "name": "Colorado Avalanche",
  "shortName": "COL",
  "franchise": "Avalanche",
  "isActive": true
}
```

**Response**: `200 OK` - Returns updated `TeamDto`

**Errors**:
- `400 Bad Request` - Validation failure
- `404 Not Found` - Team does not exist

---

### Delete Team

```http
DELETE /api/Team/{id}
```

Deletes a team.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `204 No Content`

**Errors**:
- `404 Not Found` - Team does not exist

---

## User Endpoints

### List All Users

```http
GET /api/User
```

Gets all users.

**Response**: `200 OK`
```json
[
  {
    "id": "guid",
    "name": "John Doe",
    "isActive": true,
    "index": 0
  }
]
```

---

### Get User by ID

```http
GET /api/User/{id}
```

Gets a user by ID.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `200 OK` - Returns `UserDto`

**Errors**:
- `404 Not Found` - User does not exist

---

### Create User

```http
POST /api/User
```

Creates a new user.

**Request Body** (`CreateUserDto`):
```json
{
  "name": "John Doe",
  "isActive": true,
  "index": 0
}
```

**Validation**:
- `name` - Required, 1-100 characters
- `isActive` - Optional, defaults to `true`
- `index` - Optional, defaults to `0`

**Response**: `201 Created` - Returns `UserDto` with `Location` header

**Errors**:
- `400 Bad Request` - Validation failure

---

### Update User

```http
PUT /api/User/{id}
```

Updates an existing user.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Request Body** (`UpdateUserDto`):
```json
{
  "name": "John Doe",
  "isActive": true,
  "index": 0
}
```

**Response**: `200 OK` - Returns updated `UserDto`

**Errors**:
- `400 Bad Request` - Validation failure
- `404 Not Found` - User does not exist

---

### Delete User

```http
DELETE /api/User/{id}
```

Deletes a user.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `204 No Content`

**Errors**:
- `404 Not Found` - User does not exist

---

## User Match Relation Endpoints

### List User Match Relations

```http
GET /api/UserMatchRelation?matchId={guid}
```

Gets all user match relations, optionally filtered by match ID.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `matchId` | `Guid` | No | Filter relations by match ID |

**Response**: `200 OK`
```json
[
  {
    "id": "guid",
    "user": {
      "id": "guid",
      "name": "John Doe",
      "isActive": true,
      "index": 0
    },
    "matchId": "guid",
    "plus": 5,
    "minus": 2,
    "totalGoals": 12,
    "totalPenalties": 3,
    "scoreEntries": [
      {
        "id": "guid",
        "userMatchRelationId": "guid",
        "reason": 1,
        "type": 1,
        "count": 2
      }
    ],
    "playerRelations": [
      {
        "id": "guid",
        "playerId": "guid",
        "goal": 3,
        "penalty": 1
      }
    ]
  }
]
```

---

### Get Active User Relations for Match

```http
GET /api/UserMatchRelation/match/{matchId}/active
```

Gets all user match relations for **active users only** for a specific match.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `matchId` | `Guid` | Yes |

**Response**: `200 OK` - Returns array of `UserMatchRelationDto`

---

### Get User Match Relation by ID

```http
GET /api/UserMatchRelation/{id}
```

Gets a user match relation by ID.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `200 OK` - Returns `UserMatchRelationDto`

**Errors**:
- `404 Not Found` - Relation does not exist

---

### Get Score Entries for Relation

```http
GET /api/UserMatchRelation/{id}/score-entries
```

Gets all score entries for a specific user match relation.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `200 OK` - Returns array of `UserMatchScoreEntryDto`

**Errors**:
- `404 Not Found` - Relation does not exist

---

### Get Player Relations for Relation

```http
GET /api/UserMatchRelation/{id}/player-relations
```

Gets all player relations for a specific user match relation.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `200 OK` - Returns array of `UserMatchRelationWithPlayerDto`

**Errors**:
- `404 Not Found` - Relation does not exist

---

### Get Relation by User and Match

```http
GET /api/UserMatchRelation/user/{userId}/match/{matchId}
```

Gets a user match relation by user ID and match ID pair.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `userId` | `Guid` | Yes |
| `matchId` | `Guid` | Yes |

**Response**: `200 OK` - Returns `UserMatchRelationDto`

**Errors**:
- `404 Not Found` - No relation found for the user/match pair

---

### Create User Match Relation

```http
POST /api/UserMatchRelation
```

Creates a new user match relation.

**Request Body** (`CreateUserMatchRelationDto`):
```json
{
  "userId": "guid",
  "matchId": "guid",
  "plus": 0,
  "minus": 0
}
```

**Validation**:
- `userId` - Required, must be valid GUID
- `matchId` - Required, must be valid GUID
- `plus` - Optional, must be ≥ 0, defaults to 0
- `minus` - Optional, must be ≥ 0, defaults to 0

**Response**: `201 Created` - Returns `UserMatchRelationDto` with `Location` header

**Errors**:
- `400 Bad Request` - Validation failure or invalid argument
- `409 Conflict` - Relation already exists for the user/match pair

---

### Initialize Relations for Match

```http
POST /api/UserMatchRelation/match/{matchId}/initialize
```

Creates user match relations for **all active users** for a given match. Only creates relations for users that don't already have one.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `matchId` | `Guid` | Yes |

**Response**: `200 OK` - Returns `int` (number of relations created)

**Errors**:
- `404 Not Found` - Match does not exist

---

### Update User Match Relation

```http
PUT /api/UserMatchRelation/{id}
```

Updates an existing user match relation (plus/minus values).

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Request Body** (`UpdateUserMatchRelationDto`):
```json
{
  "plus": 5,
  "minus": 2
}
```

**Validation**:
- `plus` - Required, must be ≥ 0
- `minus` - Required, must be ≥ 0

**Response**: `200 OK` - Returns updated `UserMatchRelationDto`

**Errors**:
- `400 Bad Request` - Validation failure
- `404 Not Found` - Relation does not exist

---

### Delete User Match Relation

```http
DELETE /api/UserMatchRelation/{id}
```

Deletes a user match relation.

**Path Parameters**:
| Parameter | Type | Required |
|-----------|------|----------|
| `id` | `Guid` | Yes |

**Response**: `204 No Content`

**Errors**:
- `404 Not Found` - Relation does not exist

---

### Add Score Entries

```http
POST /api/UserMatchRelation/score-entries
```

Adds score entries to a user match relation and recalculates plus/minus totals.

**Request Body** (`AddScoreEntriesDto`):
```json
{
  "userMatchRelationId": "guid",
  "type": 1,
  "reasons": [
    {
      "id": null,
      "reason": 1,
      "count": 2
    }
  ]
}
```

**Validation**:
- `userMatchRelationId` - Required, must be valid GUID
- `type` - Required, must be `1` (Plus) or `2` (Minus)
- `reasons` - Required, non-empty array
  - `id` - Optional GUID (null for new, existing ID for update)
  - `reason` - Required, valid `ScoreReason` enum value
  - `count` - Optional, defaults to 1, must be ≥ 0

**Response**: `200 OK` - Returns updated `UserMatchRelationDto`

**Errors**:
- `400 Bad Request` - Validation failure
- `404 Not Found` - Relation does not exist

---

### Add Player Relations

```http
POST /api/UserMatchRelation/player-relations
```

Adds or updates player relations (goals/penalties per player) for a user match relation.

**Request Body** (`AddPlayerRelationsDto`):
```json
{
  "userMatchRelationId": "guid",
  "relationType": 1,
  "playerMatchRelations": [
    {
      "id": "guid",
      "playerId": "guid",
      "goal": 3,
      "penalty": 1
    }
  ]
}
```

**Validation**:
- `userMatchRelationId` - Required, must be valid GUID
- `relationType` - Required, must be `1` (Goal) or `2` (Penalty)
- `playerMatchRelations` - Required, non-empty array
  - `id` - Required GUID
  - `playerId` - Required GUID
  - `goal` - Optional nullable integer
  - `penalty` - Optional nullable integer

**Response**: `200 OK` - Returns updated `UserMatchRelationDto`

**Errors**:
- `400 Bad Request` - Validation failure
- `404 Not Found` - Relation or player does not exist

---

## User Stats Endpoints

### Get Season Stats

```http
GET /api/UserStats/SeasonsStats?seasonPhaseType={type}
```

Returns user plus/minus statistics grouped by season phase, optionally filtered by season phase type.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `seasonPhaseType` | `SeasonPhaseType` | No | Filter: `0`=Regular, `1`=Playoff, `2`=Both |

**Response**: `200 OK`
```json
[
  {
    "seasonPhaseId": "guid",
    "seasonName": "Season 1 - Regular",
    "userStats": [
      {
        "userId": "guid",
        "userName": "John Doe",
        "plus": 10,
        "minus": 4
      }
    ]
  }
]
```

---

### Get Active Users All Seasons Stats

```http
GET /api/UserStats/ActiveUsersAllSeasons
```

Returns all active users with their aggregated plus/minus across **all** seasons.

**Response**: `200 OK`
```json
[
  {
    "userId": "guid",
    "userName": "John Doe",
    "totalPlus": 42,
    "totalMinus": 18
  }
]
```

---

### Get Active Users Last Season Stats

```http
GET /api/UserStats/ActiveUsersLastSeason
```

Returns all active users with their plus/minus for the **last (most recent) season phase**.

**Response**: `200 OK` - Returns array of `UserAllSeasonStatsDto` (same schema as above)

---

### Get Active Users Season Breakdown

```http
GET /api/UserStats/ActiveUsersSeasonBreakdown
```

Returns all active users with plus/minus broken down by each season.

**Response**: `200 OK`
```json
[
  {
    "userId": "guid",
    "userName": "John Doe",
    "seasonStats": [
      {
        "seasonPhaseId": "guid",
        "seasonName": "Season 1 - Regular",
        "plus": 10,
        "minus": 4
      }
    ]
  }
]
```

---

### Get Season Earnings

```http
GET /api/UserStats/SeasonEarnings
```

Returns user earnings and payouts per season.

**Response**: `200 OK`
```json
[
  {
    "name": "Season 1 - Regular",
    "earnings": 150.00,
    "payouts": 80.00,
    "userId": "guid",
    "userName": "John Doe"
  }
]
```

---

## Enum Reference

### MatchLifecycleState
| Value | Name | Description |
|-------|------|-------------|
| 0 | Scheduled | Match is scheduled but not started |
| 1 | InProgress | Match is currently in progress |
| 2 | Completed | Match has been completed |
| 3 | Cancelled | Match was cancelled |

### MatchCompletionType
| Value | Name | Description |
|-------|------|-------------|
| 0 | None | No completion type (match not completed) |
| 1 | RegularTime | Completed in regular time |
| 2 | Overtime | Completed in overtime |
| 3 | Shootout | Completed via shootout |

### SeasonStatus
| Value | Name | Description |
|-------|------|-------------|
| 0 | Active | Season is currently active |
| 1 | Completed | Season has been completed |
| 2 | Cancelled | Season was cancelled |

### SeasonPhaseType
| Value | Name | Description |
|-------|------|-------------|
| 0 | Regular | Regular season phase |
| 1 | Playoff | Playoff season phase |
| 2 | Both | Aggregate of both regular and playoff |

### NhlVersion
| Value | Name |
|-------|------|
| 22 | Nhl22 |
| 23 | Nhl23 |
| 24 | Nhl24 |
| 26 | Nhl26 |

### HockeyPosition
| Value | Name |
|-------|------|
| 0 | Goalie |
| 1 | Defenseman |
| 2 | LeftWing |
| 3 | Center |
| 4 | RightWing |

### ScoreEntryType
| Value | Name | Description |
|-------|------|-------------|
| 1 | Plus | Positive score entry |
| 2 | Minus | Negative score entry |

### ScoreReason
| Value | Name |
|-------|------|
| 1 | Scoring10Goals |
| 2 | NotScoringAGoal |
| 3 | LastMinuteAction |
| 4 | SecondaryPenalty |
| 5 | Penalty |
| 6 | Prediction |
| 7 | OwnGoal |
| 8 | ErrorInDefense |

### UserMatchRelationCreationType
| Value | Name | Description |
|-------|------|-------------|
| 1 | Goal | Player relation for goals |
| 2 | Penalty | Player relation for penalties |

---

## Summary

**Total Endpoints**: 50+

**Resources**:
- Matches - Full CRUD + bulk creation
- Players - Full CRUD + search
- Seasons - Full CRUD + playoff lookup
- Teams - Full CRUD
- Users - Full CRUD
- User Match Relations - Complex relations with score entries and player stats
- User Stats - Aggregated statistics across seasons

All endpoints follow RESTful conventions and return consistent error responses with correlation/trace IDs for debugging.
