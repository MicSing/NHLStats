# Neutral Points & PP/SH Goal Popup — Implementation Plan

## Summary

Add neutral points support by replacing `IsPositive` (bool) with a `PointType` enum (`Negative=0`, `Positive=1`, `Neutral=2`) across backend and frontend. Seed **"Shorthanded Goal"** as the first neutral reason. Enhance PP/SH goal buttons with a modal that lets user pick a point reason + any match user, then creates both a point and a goal in one flow.

### Key Decisions

| Decision | Choice |
|----------|--------|
| Schema approach | Replace `IsPositive` bool with `PointType` int enum (cleaner, single column) |
| Neutral financial impact | **None** — excluded from both `totalPlus` and `totalMinus` |
| Neutral badge color | Gray (`bg-border text-text-muted`) |
| PP/SH popup user scope | Any user in the match (not just the card's user) |
| Seeded neutral reason | "Shorthanded Goal" (Id=17) |
| API serialization | `PointType` enum serialized as string via `JsonStringEnumConverter` |

---

## Phase 1: Backend — PointType Enum & Migration

### Step 1.1: Create PointType enum

- **File:** `backend/src/NHLStats.Domain/Entities/PointType.cs` *(new)*
- Define: `public enum PointType { Negative = 0, Positive = 1, Neutral = 2 }`

### Step 1.2: Update PointReason entity

- **File:** `backend/src/NHLStats.Domain/Entities/PointReason.cs`
- Replace `public bool IsPositive { get; set; }` → `public PointType PointType { get; set; }`
- Keep `IsActive` unchanged

### Step 1.3: Update NhlStatsDbContext — model config & seed data

- **File:** `backend/src/NHLStats.Domain/NhlStatsDbContext.cs`
- Add `.HasConversion<int>()` for `PointType` property in model configuration
- Update all 16 seeded PointReasons:
  - `IsPositive=false` → `PointType=PointType.Negative`
  - `IsPositive=true` → `PointType=PointType.Positive`
- Add seed entry: `new PointReason { Id=17, Name="Shorthanded Goal", PointType=PointType.Neutral, IsActive=true }`

### Step 1.4: Add EF Core migration

- Run: `dotnet ef migrations add AddPointTypeEnum --project src/NHLStats.Domain --startup-project src/NHLStats.Api`
- Generated migration will:
  - Add `PointType` int column
  - Drop `IsPositive` column
  - Insert seed row for "Shorthanded Goal" (Id=17)
- **Manual edit required:** Add SQL data migration to convert existing boolean values before dropping `IsPositive`:
  ```sql
  -- Preserve existing data: IsPositive=1 → PointType=1 (Positive), IsPositive=0 → PointType=0 (Negative)
  UPDATE PointReasons SET PointType = IsPositive WHERE PointType IS NULL;
  ```

### Step 1.5: Update DTOs

- **File:** `backend/src/NHLStats.Application/DTOs/PointReasonDto.cs`
  - `PointReasonDto` — replace `bool IsPositive` → `PointType PointType`
  - `CreatePointReasonDto` — replace `bool IsPositive` → `PointType PointType`
  - `UpdatePointReasonDto` — same
- **File:** `backend/src/NHLStats.Application/DTOs/UserMatchDto.cs`
  - `UserMatchPointDto` — replace `bool IsPositive` → `string PointType`

### Step 1.6: Update PointReasonService

- **File:** `backend/src/NHLStats.Application/Services/PointReasonService.cs`
- `ToDto`: map `p.PointType` directly (enum serialized as string)
- `CreateAsync`: use `dto.PointType` directly (enum from JSON)
- `UpdateAsync`: same

### Step 1.7: Update UserMatchService — point DTO mapping

- **File:** `backend/src/NHLStats.Application/Services/UserMatchService.cs`
- `ToPointDto`: replace `p.PointReason?.IsPositive ?? false` → `p.PointReason?.PointType.ToString() ?? "Negative"`
- Review any other `IsPositive` references in aggregation methods

### Step 1.8: Update StatsService — earnings & aggregation

- **File:** `backend/src/NHLStats.Application/Services/StatsService.cs`
- Replace all `.Where(p => p.PointReason.IsPositive)` → `.Where(p => p.PointReason.PointType == PointType.Positive)`
- Replace all `!p.PointReason.IsPositive` → `p.PointReason.PointType == PointType.Negative`
- Neutral points are **excluded** from both `totalPlus` and `totalMinus`
- `RawEarnings` method unchanged (takes `totalPlus`/`totalMinus` as params)
- Update all `IsPositive` ternary references (~3 places)
- ~15 filter sites total

### Step 1.9: Update backend tests

- **File:** `backend/tests/NHLStats.Api.Tests/PointReasons/PointReasonsTests.cs`
  - Update assertions: `IsPositive` → `PointType`
  - Update POST/PUT payloads to send `pointType` string
- **File:** `backend/tests/NHLStats.Api.Tests/Stats/StatsTests.cs`
  - Update PointReason creation to use `PointType`
- Other test files referencing `IsPositive` in PointReason context

---

## Phase 2: Frontend — Type Updates, Neutral Points & PP/SH Modal

*Can start in parallel with Phase 1 once the API contract (Step 1.5) is defined.*

### Step 2.1: Update frontend types

- **File:** `frontend/src/types/pointReason.ts`
  - Add: `export type PointType = 'Negative' | 'Positive' | 'Neutral'`
  - Change `PointReason.isPositive: boolean` → `pointType: PointType`
  - Change `CreatePointReasonDto.isPositive` → `pointType: PointType`
  - Change `UpdatePointReasonDto.isPositive` → `pointType: PointType`
- **File:** `frontend/src/types/userMatch.ts`
  - Change `UserMatchPoint.isPositive: boolean` → `pointType: PointType`

### Step 2.2: Update UserMatchCard — Points tab

- **File:** `frontend/src/components/UserMatchCard.tsx`
- Replace filter logic:
  - `pointReasons.filter(r => r.isPositive)` → `.filter(r => r.pointType === 'Positive')`
  - `pointReasons.filter(r => !r.isPositive)` → `.filter(r => r.pointType === 'Negative')`
  - Add: `neutralReasons = pointReasons.filter(r => r.pointType === 'Neutral')`
- Update `totalPlus`/`totalMinus` filtering to use `p.pointType === 'Positive'` / `'Negative'`
- Update point badge colors:
  - Positive → green (`bg-success/20 text-success`)
  - Negative → red (`bg-danger/20 text-danger`)
  - **Neutral → gray** (`bg-border text-text-muted`)
- Add neutral points form row (same pattern as positive/negative rows)

### Step 2.3: Update UserMatchCard — PP/SH buttons → modal popup

- **File:** `frontend/src/components/UserMatchCard.tsx`
- Remove inline dropdown (`showGoalTypes` state, absolute-positioned div)
- When user clicks **+ PP** or **+ SH**, open a `Modal` dialog:

  **Modal Contents:**
  1. **Point Reason selector** (`SearchableSelect`):
     - PP → show only positive (`pointType === 'Positive'`) active reasons
     - SH → show only neutral (`pointType === 'Neutral'`) active reasons
     - If only 1 reason exists, **preselect it**
  2. **User selector** (`SearchableSelect`): all `UserMatch` entries from the match
  3. **Roster Player selector** (`SearchableSelect`): same player picker as goal form
  4. **Count** input (default 1)
  5. **Confirm** button — executes two sequential API calls:
     - `POST /api/usermatches/{selectedUserMatchId}/points` with `{ pointReasonId, count: 1 }`
     - `POST /api/usermatches/{selectedUserMatchId}/goals` with `{ rosterPlayerId, count, goalType }`
  6. **Cancel** button — closes modal

- **Props change:** `UserMatchCard` needs new prop `allUserMatches: UserMatch[]`
- **File:** `frontend/src/pages/MatchPage.tsx` — pass `allUserMatches` to each `UserMatchCard`

### Step 2.4: Update admin PointReasonsPage

- **File:** `frontend/src/pages/admin/PointReasonsPage.tsx`
- `PointReasonForm`: expand 2 radio buttons → 3 radio buttons (Negative / Positive / Neutral)
- Update `addForm` default: `{ name: '', pointType: 'Negative' }`
- Update `editForm` mapping
- Table badge display: add neutral badge style (gray)

### Step 2.5: Update RulesPage

- **File:** `frontend/src/pages/RulesPage.tsx`
- Add neutral section: `activeReasons.filter(r => r.pointType === 'Neutral')`
- Display neutral reasons alongside existing Positive/Negative sections

### Step 2.6: Update i18n translations

**English** (`frontend/src/i18n/locales/en.json`):
| Key | Value |
|-----|-------|
| `common.neutral` | `"Neutral"` |
| `userMatchCard.addNeutral` | `"+ Neutral"` |
| `userMatchCard.ppGoalTitle` | `"Add Power Play Goal"` |
| `userMatchCard.shGoalTitle` | `"Add Shorthanded Goal"` |
| `userMatchCard.selectUser` | `"Select user"` |
| `userMatchCard.confirm` | `"Confirm"` |
| `rules.neutralLabel` | `"○ Neutral"` |

**Slovak** (`frontend/src/i18n/locales/sk.json`):
| Key | Value |
|-----|-------|
| `common.neutral` | `"Neutrálny"` |
| `userMatchCard.addNeutral` | `"+ Neutrálny"` |
| `userMatchCard.ppGoalTitle` | `"Pridať gól v presilovke"` |
| `userMatchCard.shGoalTitle` | `"Pridať gól v oslabení"` |
| `userMatchCard.selectUser` | `"Vybrať používateľa"` |
| `userMatchCard.confirm` | `"Potvrdiť"` |
| `rules.neutralLabel` | `"○ Neutrálny"` |

### Step 2.7: Update frontend tests

- **File:** `frontend/src/__tests__/MatchPage.test.tsx`
  - Update mock point reason data: `isPositive` → `pointType`
  - Update mock point data similarly
  - Add test: neutral points display with gray badge
  - Add test: PP button opens modal
  - Add test: SH button opens modal with preselected neutral reason

### Step 2.8: Update remaining isPositive references

- Search all frontend files for remaining `isPositive` references
- Includes stats pages, dashboard, any charts filtering by point type

---

## Phase 3: Verification

### Backend Verification

| # | Check | Command / Action |
|---|-------|-----------------|
| 1 | Compilation | `dotnet build` |
| 2 | Tests pass | `dotnet test` |
| 3 | Migration applies | Verify on existing DB — data migration preserves positive/negative values |
| 4 | API returns 17 reasons | `GET /api/pointreasons` returns all 17 with `pointType` field |
| 5 | Create neutral | `POST /api/pointreasons` with `pointType: "Neutral"` succeeds |

### Frontend Verification

| # | Check | Command / Action |
|---|-------|-----------------|
| 1 | Lint clean | `npm run lint` |
| 2 | Tests pass | `npm test` |
| 3 | Points tab colors | Positive=green, Negative=red, Neutral=gray |
| 4 | PP modal flow | PP → modal → positive reason + user + player → confirm → creates point + PP goal |
| 5 | SH modal flow | SH → modal → neutral reason preselected + user + player → confirm → creates neutral point + SH goal |
| 6 | Admin page | PointReasons page shows 3-way radio (Negative/Positive/Neutral) and neutral badge |

---

## Files Changed

### Backend — Modified

| File | Change |
|------|--------|
| `backend/src/NHLStats.Domain/Entities/PointReason.cs` | Replace `IsPositive` with `PointType` |
| `backend/src/NHLStats.Domain/NhlStatsDbContext.cs` | Update seed data, add enum conversion |
| `backend/src/NHLStats.Application/DTOs/PointReasonDto.cs` | Update all 3 DTOs |
| `backend/src/NHLStats.Application/DTOs/UserMatchDto.cs` | Update `UserMatchPointDto` |
| `backend/src/NHLStats.Application/Services/PointReasonService.cs` | Update `ToDto`, `CreateAsync`, `UpdateAsync` |
| `backend/src/NHLStats.Application/Services/UserMatchService.cs` | Update `ToPointDto` |
| `backend/src/NHLStats.Application/Services/StatsService.cs` | Update ~15 `IsPositive` filter sites |
| `backend/tests/NHLStats.Api.Tests/PointReasons/PointReasonsTests.cs` | Update assertions & payloads |
| `backend/tests/NHLStats.Api.Tests/Stats/StatsTests.cs` | Update PointReason references |

### Backend — New

| File | Purpose |
|------|---------|
| `backend/src/NHLStats.Domain/Entities/PointType.cs` | `PointType` enum definition |
| `backend/src/NHLStats.Domain/Migrations/[timestamp]_AddPointTypeEnum.cs` | EF Core migration |

### Frontend — Modified

| File | Change |
|------|--------|
| `frontend/src/types/pointReason.ts` | Add `PointType` union, replace `isPositive` |
| `frontend/src/types/userMatch.ts` | Update `UserMatchPoint` |
| `frontend/src/components/UserMatchCard.tsx` | Neutral section, PP/SH modal, new prop |
| `frontend/src/pages/MatchPage.tsx` | Pass `allUserMatches` prop |
| `frontend/src/pages/admin/PointReasonsPage.tsx` | 3-way radio, gray badge |
| `frontend/src/pages/RulesPage.tsx` | Neutral section |
| `frontend/src/i18n/locales/en.json` | New translation keys |
| `frontend/src/i18n/locales/sk.json` | New translation keys |
| `frontend/src/__tests__/MatchPage.test.tsx` | Update mocks, add neutral/modal tests |
