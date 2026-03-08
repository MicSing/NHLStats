# Database

SQLite database schema, entity relationships, migrations, and data access patterns.

## Overview

- **Type**: SQLite
- **Location**: `$HOME/data/nhlstats.db` (auto-created on first run)
- **ORM**: Entity Framework Core 10
- **Schema**: ~20 tables including ASP.NET Identity tables
- **Access**: Read/write from NHLStats.Api only

Database is automatically migrated on application startup (`program.cs` calls `ctx.Database.Migrate()`).

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      ASP.NET Identity Tables                     │
├─────────────────────────────────────────────────────────────────┤
│ AspNetUsers (userid, username, email, password hash, ...)       │
│ AspNetRoles (roleid, rolename)                                  │
│ AspNetUserRoles (userid, roleid)                                │
│ AspNetUserClaims, AspNetRoleClaims, AspNetUserLogins, etc.      │
└────────────────┬────────────────────────────────────────────────┘
                 │ Foreign key relationship
┌────────────────▼────────────────────────────────────────────────┐
│                     Application Tables                          │
├─────────────────────────────────────────────────────────────────┤
│
│  Users (id, applicationuserId, name, [inherited from identity])
│    └("N") ─┬─ SeasonUsers (N-to-M with Season, Team)
│            └─ UserMatches ("1") ─┬─ UserMatchPoints
│                                  ├─ UserMatchGoals
│                                  └─ UserMatchPenalties
│
│  Teams (id, name, shortname)
│    └("N") ─ RosterPlayers (N-to-M with Season)
│    └("N") ─ Matches (home/away)
│
│  Seasons (id, name, hostedteamid, parentseasonid)
│    └("N") ─ SeasonUsers (N-to-M with User, Team)
│    └("N") ─ Matches
│    └("N") ─ PointReasons
│    └("N") ─ RosterPlayers (N-to-M with Team)
│    └("N") ─ Expenses
│
│  Matches (id, seasonid, matchnumber, hometeamid, awayteamid, ...)
│    └("N") ─ UserMatches
│
│  UserMatches (id, userid, matchid, seasonid, points_summary, ...)
│    └("N") ─ UserMatchPoints ─ PointReason
│    └("N") ─ UserMatchGoals
│    └("N") ─ UserMatchPenalties
│
│  PointReasons (id, name, value, seasonid)
│
│  UserMatchPoints (id, usermatchid, pointreasonid, value)
│  UserMatchGoals (id, usermatchid, count)
│  UserMatchPenalties (id, usermatchid, count)
│
│  MoneyConfig (id, positivepoints_rate, negativepoints_rate, ...)
│  Expenses (id, seasonid, userid, name, amount)
│  UserPayouts (id, userid, seasonid, amount, date)
│
└─────────────────────────────────────────────────────────────────┘
```

## Core Entities

### Users

Extends ASP.NET Identity's `AspNetUsers` table.

```sql
CREATE TABLE "Users" (
    "Id" TEXT NOT NULL PRIMARY KEY,
    "ApplicationUserId" TEXT NOT NULL,
    "Name" TEXT NOT NULL,
    
    FOREIGN KEY ("ApplicationUserId") REFERENCES "AspNetUsers" ("Id")
);
```

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| Id | GUID | ✗ | Primary key |
| ApplicationUserId | GUID | ✗ | Link to ASP.NET Identity user |
| Name | string | ✗ | Display name |

**Usage**: Custom application user with friendly name. Links `ApplicationUser` (identity) to app domain.

### Teams

```sql
CREATE TABLE "Teams" (
    "Id" GUID PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "ShortName" TEXT NOT NULL
);
```

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| Id | GUID | ✗ | Primary key |
| Name | string | ✗ | Full team name (e.g., "New York Rangers") |
| ShortName | string | ✗ | 3-char code (e.g., "NYR") |

**Seed Data**: 32 NHL teams. See `DbContext.OnModelCreating` or `SeedData.cs`.

### Seasons

```sql
CREATE TABLE "Seasons" (
    "Id" GUID PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "HostedTeamId" GUID NOT NULL,
    "ParentSeasonId" GUID,
    "CreatedAt" DATETIME,
    
    UNIQUE ("Name"),
    FOREIGN KEY ("HostedTeamId") REFERENCES "Teams" ("Id") ON DELETE RESTRICT,
    FOREIGN KEY ("ParentSeasonId") REFERENCES "Seasons" ("Id") ON DELETE RESTRICT
);
```

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| Id | GUID | ✗ | Primary key |
| Name | string | ✗ | Season name (e.g., "Regular Season 2025") |
| HostedTeamId | GUID | ✗ | Team running the season (for point center) |
| ParentSeasonId | GUID | ✓ | Null for regular season; set for playoffs (self-reference) |
| CreatedAt | DateTime | ✓ | When created |

**Relationships:**
- `HostedTeamId` → `Teams.Id` (Restrict delete)
- `ParentSeasonId` → `Seasons.Id` (Restrict delete, null for regular season)

**Examples:**
- Regular Season 2025: ParentSeasonId = NULL
- Playoffs 2025: ParentSeasonId = Regular Season 2025 ID

### SeasonUsers (Join Table)

```sql
CREATE TABLE "SeasonUsers" (
    "Id" GUID PRIMARY KEY,
    "SeasonId" GUID NOT NULL,
    "UserId" GUID NOT NULL,
    "TeamId" GUID NOT NULL,
    
    UNIQUE ("SeasonId", "UserId"),
    FOREIGN KEY ("SeasonId") REFERENCES "Seasons" ("Id") ON DELETE CASCADE,
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    FOREIGN KEY ("TeamId") REFERENCES "Teams" ("Id") ON DELETE CASCADE
);
```

**Relationships:**
- Many-to-many between `Seasons` and `Users`
- Tracks which team a user represents in a season
- Unique constraint: One user per season (prevents duplicate enrollment)

### Matches

```sql
CREATE TABLE "Matches" (
    "Id" GUID PRIMARY KEY,
    "SeasonId" GUID NOT NULL,
    "MatchNumber" INT NOT NULL,
    "HomeTeamId" GUID NOT NULL,
    "AwayTeamId" GUID NOT NULL,
    "HomeTeamScore" INT,
    "AwayTeamScore" INT,
    "MatchDate" DATETIME,
    "Status" TEXT,  -- "Upcoming", "Live", "Playable", "Final"
    
    UNIQUE ("SeasonId", "MatchNumber"),
    FOREIGN KEY ("SeasonId") REFERENCES "Seasons" ("Id") ON DELETE CASCADE,
    FOREIGN KEY ("HomeTeamId") REFERENCES "Teams" ("Id") ON DELETE RESTRICT,
    FOREIGN KEY ("AwayTeamId") REFERENCES "Teams" ("Id") ON DELETE RESTRICT
);
```

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| Id | GUID | ✗ | Primary key |
| SeasonId | GUID | ✗ | Parent season |
| MatchNumber | int | ✗ | 1-based sequence in season |
| HomeTeamId | GUID | ✗ | Home team |
| AwayTeamId | GUID | ✗ | Away team |
| HomeTeamScore | int | ✓ | Score (set when match final) |
| AwayTeamScore | int | ✓ | Score (set when match final) |
| MatchDate | DateTime | ✓ | Game datetime |
| Status | string | ✓ | State: Upcoming, Live, Playable, Final, Cancelled |

**Relationships:**
- `SeasonId` → `Seasons.Id` (Cascade delete)
- `HomeTeamId` → `Teams.Id` (Restrict delete — teams can't be deleted if referenced)
- `AwayTeamId` → `Teams.Id` (Restrict delete)

### UserMatches

```sql
CREATE TABLE "UserMatches" (
    "Id" GUID PRIMARY KEY,
    "UserId" GUID NOT NULL,
    "MatchId" GUID,
    "SeasonId" GUID NOT NULL,
    "Points" INT DEFAULT 0,
    "Goals" INT DEFAULT 0,
    "Penalties" INT DEFAULT 0,
    "CreatedAt" DATETIME,
    "UpdatedAt" DATETIME,
    
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    FOREIGN KEY ("MatchId") REFERENCES "Matches" ("Id") ON DELETE CASCADE,
    FOREIGN KEY ("SeasonId") REFERENCES "Seasons" ("Id") ON DELETE CASCADE
);
```

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| Id | GUID | ✗ | Primary key |
| UserId | GUID | ✗ | User |
| MatchId | GUID | ✓ | Match (null allows historical data entry) |
| SeasonId | GUID | ✗ | Season |
| Points | int | ✓ | Calculated summary +/− |
| Goals | int | ✓ | Total goals |
| Penalties | int | ✓ | Total penalties |
| CreatedAt | DateTime | ✓ | Entry timestamp |
| UpdatedAt | DateTime | ✓ | Last modification |

**Purpose**: User's performance in a single match. Aggregates `UserMatchPoints`, `UserMatchGoals`, `UserMatchPenalties`.

**Note**: `MatchId` nullable allows recording stats for historical matches or non-league matches.

### UserMatchPoints

```sql
CREATE TABLE "UserMatchPoints" (
    "Id" GUID PRIMARY KEY,
    "UserMatchId" GUID NOT NULL,
    "PointReasonId" GUID NOT NULL,
    "Value" INT,
    
    FOREIGN KEY ("UserMatchId") REFERENCES "UserMatches" ("Id") ON DELETE CASCADE,
    FOREIGN KEY ("PointReasonId") REFERENCES "PointReasons" ("Id") ON DELETE RESTRICT
);
```

Individual point entries for a match. Example:

```
UserMatch: John Doe, Match 1
  UserMatchPoint[1]: +3 points (PointReason: Win)
  UserMatchPoint[2]: +1 point (PointReason: Goal)
  UserMatchPoint[3]: +1 point (PointReason: Goal)
  UserMatchPoint[4]: -1 point (PointReason: Penalty)
  ---
  Sum: +4 points
```

### UserMatchGoals & UserMatchPenalties

```sql
CREATE TABLE "UserMatchGoals" (
    "Id" GUID PRIMARY KEY,
    "UserMatchId" GUID NOT NULL,
    "Count" INT,
    
    FOREIGN KEY ("UserMatchId") REFERENCES "UserMatches" ("Id") ON DELETE CASCADE
);

CREATE TABLE "UserMatchPenalties" (
    "Id" GUID PRIMARY KEY,
    "UserMatchId" GUID NOT NULL,
    "Count" INT,
    
    FOREIGN KEY ("UserMatchId") REFERENCES "UserMatches" ("Id") ON DELETE CASCADE
);
```

Counts of goals and penalties scored/received in a match (optional summaries).

### PointReasons

```sql
CREATE TABLE "PointReasons" (
    "Id" GUID PRIMARY KEY,
    "SeasonId" GUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Value" INT,
    "IsActive" BOOLEAN DEFAULT true,
    
    FOREIGN KEY ("SeasonId") REFERENCES "Seasons" ("Id") ON DELETE CASCADE
);
```

Predefined point categories. Examples:

| Name | Value |
|------|-------|
| Win | +3 |
| OT Win | +2 |
| Goal | +1 |
| Assist | +1 |
| High Penalty | -1 |
| Game Misconduct | -3 |

Admin creates/edits these per season. Users select these when entering stats.

### MoneyConfig

```sql
CREATE TABLE "MoneyConfigs" (
    "Id" GUID PRIMARY KEY,
    "PositivePointsRate" DECIMAL(10, 2),
    "NegativePointsRate" DECIMAL(10, 2),
    "MinimumPayout" DECIMAL(10, 2) DEFAULT 0,
    "EffectiveDate" DATETIME,
    
    UNIQUE ("EffectiveDate")
);
```

Payout rates applied to points. Examples:

| EffectiveDate | PositiveRate | NegativeRate |
|---|---|---|
| 2026-01-01 | 5.00 | -2.00 |
| 2026-04-01 | 6.00 | -2.50 |

**Calculation**:

```
User points: +47, -3
Earnings = (47 × 5.00) + (-3 × -2.00)
         = 235 + 6
         = $241
```

Effective dates allow mid-season rate changes (e.g., playoffs have higher rate).

### Expenses

```sql
CREATE TABLE "Expenses" (
    "Id" GUID PRIMARY KEY,
    "SeasonId" GUID,
    "UserId" GUID,
    "Name" TEXT NOT NULL,
    "Amount" DECIMAL(10, 2),
    "CreatedAt" DATETIME,
    
    FOREIGN KEY ("SeasonId") REFERENCES "Seasons" ("Id") ON DELETE CASCADE,
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
);
```

Deductions from user payouts (fees, shared costs, etc.).

| Expense | Type | Amount | Applies To |
|---------|------|--------|-----------|
| League Fee | Fixed | $50 | All users in season |
| Trophy Fund | Variable | $10-100 | Top performers |

### UserPayouts

```sql
CREATE TABLE "UserPayouts" (
    "Id" GUID PRIMARY KEY,
    "UserId" GUID NOT NULL,
    "SeasonId" GUID NOT NULL,
    "Amount" DECIMAL(10, 2),
    "PointsEarned" INT,
    "ExpensesDeducted" DECIMAL(10, 2),
    "PayoutDate" DATETIME,
    "Notes" TEXT,
    
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
    FOREIGN KEY ("SeasonId") REFERENCES "Seasons" ("Id") ON DELETE CASCADE
);
```

Historical record of when users were paid. Example:

| UserId | SeasonId | Amount | PointsEarned | ExpensesDeducted | PayoutDate |
|--------|----------|--------|--------------|------------------|------------|
| user1 | season1 | $181.00 | 47 | $60.00 | 2026-06-30 |

### RosterPlayers

```sql
CREATE TABLE "RosterPlayers" (
    "Id" GUID PRIMARY KEY,
    "SeasonId" GUID NOT NULL,
    "TeamId" GUID NOT NULL,
    "Name" TEXT NOT NULL,
    "Position" TEXT,
    "NhlId" TEXT,
    
    FOREIGN KEY ("SeasonId") REFERENCES "Seasons" ("Id") ON DELETE CASCADE,
    FOREIGN KEY ("TeamId") REFERENCES "Teams" ("Id") ON DELETE CASCADE
);
```

NHL player roster for a season (if imported). Optional feature for associating user stats with real NHL players.

## Migrations

Migrations live in `backend/src/NHLStats.Domain/Migrations/`.

### Creating a Migration

```bash
cd backend

# Add a migration
dotnet ef migrations add AddExpireAtToUserMatch \
  --project src/NHLStats.Domain \
  --startup-project src/NHLStats.Api

# This creates:
# src/NHLStats.Domain/Migrations/20240305_AddExpireAtToUserMatch.cs
# src/NHLStats.Domain/Migrations/NhlStatsDbContextModelSnapshot.cs (auto-updated)
```

Edit the migration if needed, then:

```bash
# Apply migration
dotnet ef database update \
  --project src/NHLStats.Domain \
  --startup-project src/NHLStats.Api

# Or revert last migration
dotnet ef migrations remove \
  --project src/NHLStats.Domain \
  --startup-project src/NHLStats.Api
```

### Migration Best Practices

1. **Make migrations in the Domain project** — Startup project is Api, but models are in Domain
2. **One concept per migration** — Don't mix schema and data changes
3. **Test locally first** — Apply migration to local db and verify
4. **Never modify applied migrations** — Create a new migration to fix
5. **Include reversible operations** — Down() method should be idempotent (or provide rollback script)

## Data Access Patterns

### Reading Data

**Eager loading to avoid N+1 queries:**

```csharp
// Get season with all matches and users
var season = await db.Seasons
    .Include(s => s.Matches)
        .ThenInclude(m => m.UserMatches)
    .Include(s => s.SeasonUsers)
    .FirstOrDefaultAsync(s => s.Id == seasonId);
```

**Lazy loading (careful!):**

```csharp
// Only load season; matches loaded on access (multiple queries)
var season = await db.Seasons.FirstOrDefaultAsync(s => s.Id == seasonId);
var matchCount = season.Matches.Count;  // Triggers another query if not included
```

### Writing Data

**Create:**

```csharp
var user = new User { Name = "John Doe", ApplicationUserId = userId };
db.Users.Add(user);
await db.SaveChangesAsync();
```

**Update:**

```csharp
var user = await db.Users.FindAsync(userId);
user.Name = "Jane Doe";
await db.SaveChangesAsync();  // Detects change and updates
```

**Delete:**

```csharp
var user = await db.Users.FindAsync(userId);
db.Users.Remove(user);
// Or soft delete:
user.IsActive = false;
```

## Database Indexes

Common indexes for performance:

```sql
CREATE INDEX idx_usermatches_userid_seasonid ON UserMatches(UserId, SeasonId);
CREATE INDEX idx_usermatchpoints_usermatchid ON UserMatchPoints(UserMatchId);
CREATE INDEX idx_matches_seasonid ON Matches(SeasonId);
CREATE INDEX idx_seasonusers_userid ON SeasonUsers(UserId);
```

These are defined in `OnModelCreating()` via Fluent API.

## Backup & Recovery

### Local Development

Database stored in `~/data/nhlstats.db`. Back up file:

```bash
cp ~/data/nhlstats.db ~/data/nhlstats.db.backup
```

### Production (Azure)

Use regular SQLite backup:

```bash
# SSH to app service and backup
sqlite3 /data/nhlstats.db ".backup '/data/nhlstats.db.backup'"
```

Or use Azure App Service backup feature for the SQLite file path.

## Common Queries

### Total points for a user in a season

```sql
SELECT SUM(ump.Value)
FROM UserMatchPoints ump
JOIN UserMatches um ON ump.UserMatchId = um.Id
WHERE um.UserId = @userId AND um.SeasonId = @seasonId;
```

### User earnings for a season

```sql
SELECT (
    (SELECT SUM(Value) FROM UserMatchPoints ump
     JOIN UserMatches um ON ump.UserMatchId = um.Id
     WHERE um.UserId = @userId AND um.SeasonId = @seasonId) * 
    COALESCE(mc.PositivePointsRate, 0)
) as earnings;
```

### All users and their teams in a season

```sql
SELECT u.Name, t.Name as TeamName
FROM SeasonUsers su
JOIN Users u ON su.UserId = u.Id
JOIN Teams t ON su.TeamId = t.Id
WHERE su.SeasonId = @seasonId;
```

Last Updated: March 2026
