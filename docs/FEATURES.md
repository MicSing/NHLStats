# Features

Core features and functionality of NHL Stats 2.0.

**Table of Contents:**
- [User Features](#user-features)
- [Admin Features](#admin-features)
- [Core Concepts](#core-concepts)
- [Feature Matrix](#feature-matrix)

## User Features

### Authentication

**Public endpoints:**
- **Register** — Create new account with email and password
- **Login** — Authenticate with email and password, receive JWT token
- **Logout** — Clear session (client-side: remove token)

**Protected endpoints:**
- **Get Profile** — Retrieve current user info

**Password Requirements (Development):**
- Minimum 6 characters
- No uppercase/special character requirements for dev (customizable in Program.cs)

**Production notes:**
- Apply stricter password policy
- Implement email verification
- Add "forgot password" flow

### Dashboard

**Home Page** — After login, user sees:
- List of seasons they participate in
- Current season stats summary
- Quick links to recent matches
- Team affiliation and role

### Seasons Management

**Browse Seasons** — User can:
- View all active seasons
- Filter by status (current, completed, upcoming)
- See season details (hosted team, point reasons, rules)

**Join Season** — User can:
- Enlist in an upcoming or active season (if allowed by admin)
- Withdraw from season (if hasn't started or mid-season rules allow)

### Match Tracking

**View Matches** — User can:
- See all matches in current/selected season
- View match schedule (date, home team, away team, status)
- Filter by season or team

**Record Match Stats** — When match is playable:
- Enter `+/−` points for the match
- Record goals scored
- Record penalties received
- Submit stats before match is closed

**Match Workflow:**
1. Admin creates match in system
2. Users enlist on teams
3. Match is "Upcoming"
4. Match is "Live" (or "Playable")
5. Users enter stats
6. Admin closes match → "Final"
7. Payouts calculated
8. Users can view final stats

### User Stats & Analytics

**Personal Statistics** — User dashboard shows:
- **Points Summary**: Total +/− points earned this season
- **Goals**: Total goals scored
- **Penalties**: Total penalties received
- **Trend Chart**: Points over time (week or match-by-match)

**Statistics by Match** — User can:
- Click any match to see personal stats for that match
- View comparison with team average/league average

**Earnings Graph** — User can:
- See running balance of money earned/owed
- View breakdown by match
- Filter by season or date range

### Roster Management

**View NHL Roster** — For seasons with imported NHL roster:
- See all NHL players for a team
- Filter/search by position, name
- View player season stats (if season hasn't started)

**User Roster** — User sees:
- Their profile photo/info
- Their season stats so far
- Their team affiliation badge

### Earnings & Expenses

**Earnings Calculation** — User can:
- See how earnings are calculated (point values)
- Understand payout rules

**Expenses** — User can:
- See deductions/expenses entered by admin
- View balance after expenses
- (Download invoice? — future)

**Payout Status** — User can:
- See when last payout was issued
- View payout history
- Request payout (if eligible) — future

## Admin Features

### Dashboard

**Admin Portal** — Accessible by admin users only (determined by ASP.NET Identity role):
- Overview of all seasons
- Overview of all users
- Quick stats (total earned, pending payouts, etc.)
- Shortcuts to management pages

### Seasons Administration

**Create Season** — Admin can:
- Name the season (e.g., "2025-26 Regular Season", "Playoffs")
- Select hosted team
- Set start/end dates
- Define point reasons for the season
- Set money payout rates

**Edit Season** — Admin can:
- Update season details (if no matches started)
- Adjust point reasons
- Adjust money config rates

**Playoffs/Special Seasons** — Admin can:
- Link season to parent (e.g., "Playoffs 2025" → "Regular Season 2025")
- Create separate payout structure

**User Enrollment** — Admin can:
- Add/remove users from season
- Assign users to starting teams
- Manage team rosters

### Match Administration

**Create Matches** — Admin can:
- Bulk import matches from template (CSV, JSON)
- Manually create individual matches
- Set match sequence number within season
- Assign home/away teams
- Set match status

**Edit Matches** — Admin can:
- Change home/away teams (before match starts)
- Update match date/time
- Close match (finalize stats, trigger payout calculation)
- Re-open match (revert to "Playable")

**Bulk Actions** — Admin can:
- Create 20 matches at once (common in NHL, 1230 games per season)
- Export match list
- Import match results from external source (future)

### Point Reasons & Rules

**Manage Point Reasons** — Admin can:
- Create custom reasons (e.g., "+1 Win", "+0.5 OT", "-1 Loss")
- Assign point values (+3, +1, 0, -1, etc.)
- Enable/disable reasons
- View which reasons are active per season

**Rules Page** — Admins can:
- Publish game rules (markdown editor)
- Define scoring system
- Explain payout structure
- Users view as reference

### Money Configuration

**Payout Rates** — Admin can:
- Set earn rate per positive point (e.g., $5/point = +15 points = $75)
- Set deduction rate per negative point (e.g., -$2/point = -5 points = -$10)
- Set minimum payout threshold
- Set effective dates for different rates (supports rate changes mid-season)

**Payout History** — Admin can:
- View all user payouts (when paid, amount, reason)
- Export payout reports
- Generate tax documents (future)

### Expenses Management

**Create Expense** — Admin can:
- Add league-wide expense (e.g., $100 facility fee, $50 trophy)
- Allocate to specific season or teams
- Assign to specific users or apply to all

**Expense Types:**
- **League Fee** — Fixed cost per user this season
- **Equipment** — Shared cost split across users
- **Trophy/Prize** — Variable by performance

**Expense Tracking** — Admin can:
- View all expenses for season
- Edit expense before it's applied to payouts
- Delete erroneous expenses
- Export expense report

### User Management

**Manage Users** — Admin can:
- View all users and their profiles
- Search by email or name
- View user's season participation
- Promote user to admin
- Reset user password (future)
- Deactivate user (soft delete)
- Export user directory

**User Audit Trail** — Admin can:
- See when user joined
- See which seasons they participated in
- View their historical earnings/payouts

### Team Management

**View Teams** — List of 32 NHL teams used for match assignment:
- Edit team info (name, short code, logo)
- View team stats this season
- Manage team roster assignments

**Roster Import** — Admin can:
- Import current NHL roster via CSV
- Assign to season
- Map player names to IDs

### Reports & Analytics

**Season Reports** — Admin can:
- Points distribution (histogram)
- Earnings distribution
- Most played players
- Most penalties
- Top scorers

**Export Data** — Admin can:
- Export all match results to CSV
- Export user earnings to spreadsheet
- Export payout records for accounting
- Generate custom reports (future)

**Audit Logs** — Admin can:
- View admin actions (who created what when)
- Detect unauthorized changes
- Generate compliance reports

### Settings

**Global Configuration** — Admin can:
- Upload league logo/branding
- Set default season rules template
- Configure notification settings
- Manage API access (future)

## Core Concepts

### Point System

**Points** represent player performance in a match. Each match performance generates one `UserMatchPoint` entry.

Example:

```
Match: Rangers vs Devils
Player: John Doe (Rangers)

Actions:
  +3 points for Win
  +1 point for 2 Goals
  +2 points for Assist
  -1 point for High Penalty
---
Total: +5 points
```

**Point Reasons** are predefined by admin (e.g., "Win", "Goal", "Assist"). Each reason has a value (+3, +1, 0, -1, etc.).

### Money/Payouts

**Earnings** = Points × Money Config rate

Example:

```
Point Config: $5 per positive point, -$2 per negative point
User Stats This Season: +47 points, -3 points

Earnings = (47 × $5) + (-3 × -$2)
         = $235 + $6
         = $241

Minus Expenses:
League Fee: $50
Trophy Split: $10

Final Payout = $241 - $60 = $181
```

**Money Config** is effective-dated:

```
2026-01-01: $5/point
2026-04-01: $6/point (playoffs higher rate)
```

### Teams & Rosters

**Teams** — 32 NHL teams (predefined in seed data). Each team can:
- Host a season
- Participate in matches (home/away)
- Have a roster (list of assigned users)

**SeasonUsers** — Join table linking Season + User + Team. Allows tracking:
- Which users are in which season
- What team each user represents
- No duplicate season+user per team

**RosterPlayers** — NHL player roster for a season (if imported). Allows:
- Seeing real NHL players
- Associating user performance with real players (future feature)

### Seasons & Playoffs

**Seasons** represent tournaments/leagues:
- Regular season (January-April, typical NHL season)
- Playoffs (April-June, subset of users)

**Playoff Season** links to parent via `ParentSeasonId`:

```
Regular Season 2025-26 (ID: 1)
  └── Playoffs 2025-26 (ID: 2, ParentSeasonId: 1)
```

Payouts can have different rates in playoffs.

## Feature Matrix

| Feature | User | Admin | Implemented | Notes |
|---------|------|-------|-------------|-------|
| **Authentication** |
| Register | ✓ | ✓ | ✓ | With email verification (TBD) |
| Login | ✓ | ✓ | ✓ | Via JWT token |
| View Profile | ✓ | ✓ | ✓ | Current user info |
| **Seasons** |
| Browse Seasons | ✓ | ✓ | ✓ | List all seasons |
| Join Season | ✓ | ✗ | ▢ | User ability to self-enroll |
| Create Season | ✗ | ✓ | ✓ | With point reasons |
| Edit Season | ✗ | ✓ | ✓ | Before matches start |
| **Matches** |
| View Matches | ✓ | ✓ | ✓ | By season |
| Create Match | ✗ | ✓ | ✓ | Manually or bulk |
| Record Stats | ✓ | ✗ | ✓ | Points, goals, penalties |
| Close Match | ✗ | ✓ | ✓ | Finalize and trigger payouts |
| **Statistics** |
| View Personal Stats | ✓ | ✓ | ✓ | Points, goals, penalties |
| View Stats Chart | ✓ | ▢ | ✓ | Trend over time |
| View Earnings | ✓ | ✓ | ✓ | Running balance |
| **Point Reasons** |
| Manage Reasons | ✗ | ✓ | ✓ | Create, edit, disable |
| **Money Config** |
| View Payout Rates | ✓ | ✓ | ✓ | How earnings calculated |
| Edit Payout Rates | ✗ | ✓ | ✓ | Per season with effective dates |
| **Payouts** |
| View Payout History | ✓ | ✓ | ✓ | When and how much paid |
| Calculate Payouts | ✗ | ✓ | ▢ | Trigger calculation after season |
| Request Payout | ✓ | ✗ | ✗ | Future: on-demand payouts |
| **Expenses** |
| View Expenses | ✓ | ✓ | ✓ | Deductions |
| Create Expense | ✗ | ✓ | ✓ | For season or global |
| **Users** |
| View User Directory | ✕ | ✓ | ✓ | Admin only |
| Manage Users | ✗ | ✓ | ✓ | Promote, reset, deactivate |
| **Reports** |
| Export Earnings | ✕ | ✓ | ✓ | CSV/spreadsheet |
| Season Report | ✕ | ✓ | ✓ | Stats, distributions |

Legend:
- ✓ Implemented and tested
- ▢ Implemented, needs testing
- ✕ Not exposed to user but available
- ✗ Not yet implemented

Last Updated: March 2026
