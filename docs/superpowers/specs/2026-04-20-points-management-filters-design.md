# Points Management — User & Season Filters

**Date:** 2026-04-20

## Goal

Extend the admin Points Management page so admins can filter the points list by Player and Season, in addition to the existing Point Type filter.

## Backend

### Interface change (`IPointManagementService`)

Add `int? userId` parameter:

```csharp
Task<(IEnumerable<PointListItemDto> Items, int TotalCount)> GetPointsPagedAsync(
    int? seasonId, string? pointType, int? userId, int page, int pageSize);
```

### Service change (`PointManagementService`)

Add a filter clause after the existing `seasonId` filter:

```csharp
if (userId.HasValue)
    query = query.Where(p => p.UserMatch!.UserId == userId.Value);
```

### Controller change (`PointsManagementController`)

Add `[FromQuery] int? userId` to `GetPoints` and pass it through to the service call.

## Frontend

### Data loading

On mount, fetch two lists in parallel:
- `GET /api/seasons` → populate Season dropdown
- `GET /api/users` → populate Player dropdown

Both endpoints already exist.

### Filter bar

Add two `<select>` dropdowns alongside the existing Type dropdown:

| Dropdown | Default option | Value |
|----------|---------------|-------|
| Season   | "All seasons" | `''`  |
| Player   | "All players" | `''`  |

On change: update state and reset to page 1 (same pattern as `pointTypeFilter`).

### API call

Include `seasonId` and `userId` in `URLSearchParams` when non-empty (mirrors existing `pointType` handling).

## Out of scope

- Search/typeahead for dropdowns
- Multi-select filters
- Any changes to the bulk-update flow
