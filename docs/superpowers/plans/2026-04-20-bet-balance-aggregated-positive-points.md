# Bet Balance: Include Aggregated Positive Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `UserSeasonAggregatedData.TotalPlus * 0.25m` to the betting balance so historical aggregated positive points count toward a player's available betting balance.

**Architecture:** Single change in `BettingBalanceService.GetBalanceAsync` — after computing `totalPositiveCash` from `UserMatchPoints`, query `UserSeasonAggregatedData` for the user, sum `TotalPlus`, multiply by `0.25m`, and fold the result into `totalPositiveCash`. No DTO or frontend changes needed.

**Tech Stack:** ASP.NET Core (.NET 10), Entity Framework Core, SQLite, xUnit, FluentAssertions

---

### Task 1: Add aggregated positive points to BettingBalanceService

**Files:**
- Modify: `backend/src/NHLStats.Application/Services/BettingBalanceService.cs:27-32`
- Test: `backend/tests/NHLStats.Api.Tests/Bets/BetsTests.cs`

- [ ] **Step 1: Write the failing test**

Add this test to `BetsTests` (after `Get_betting_balance_returns_200`):

```csharp
[Fact]
public async Task Get_betting_balance_includes_aggregated_positive_points()
{
    var client = await CreateAuthenticatedClientAsync();

    // Resolve userId from /api/auth/me
    var meResp = await client.GetAsync("/api/auth/me");
    meResp.EnsureSuccessStatusCode();
    var me = await meResp.Content.ReadFromJsonAsync<JsonElement>();

    int userId;
    if (me.TryGetProperty("userId", out var userIdProp) && userIdProp.ValueKind != JsonValueKind.Null)
    {
        userId = userIdProp.GetInt32();
    }
    else
    {
        var createUserResp = await client.PostAsJsonAsync("/api/users", new { name = "Agg Balance User" });
        createUserResp.EnsureSuccessStatusCode();
        var createdUser = await createUserResp.Content.ReadFromJsonAsync<JsonElement>();
        userId = createdUser.GetProperty("id").GetInt32();

        var loginId = me.GetProperty("id").GetString()!;
        var attachResp = await client.PutAsJsonAsync($"/api/auth/users/{loginId}/attach-user", new { userId });
        attachResp.EnsureSuccessStatusCode();
    }

    // Get balance before seeding aggregated data
    var before = await client.GetAsync("/api/betting/balance");
    before.EnsureSuccessStatusCode();
    var beforeBody = await before.Content.ReadFromJsonAsync<JsonElement>();
    var balanceBefore = beforeBody.GetProperty("availableBalance").GetDecimal();
    var positiveCashBefore = beforeBody.GetProperty("totalPositiveCash").GetDecimal();

    // Create a season and seed aggregated data: TotalPlus = 4 → 4 * 0.25 = 1.00€
    var seasonResp = await client.PostAsJsonAsync("/api/seasons", new
    {
        name = "Agg Balance Season",
        startedOn = "2020-01-01T00:00:00"
    });
    seasonResp.EnsureSuccessStatusCode();
    var season = await seasonResp.Content.ReadFromJsonAsync<JsonElement>();
    var seasonId = season.GetProperty("id").GetInt32();

    await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);

    var aggResp = await client.PostAsJsonAsync(
        $"/api/users/{userId}/seasons/{seasonId}/aggregated-data",
        new { totalPlus = 4, totalMinus = 0, matchesPlayed = 0 });
    aggResp.EnsureSuccessStatusCode();

    // Get balance after seeding
    var after = await client.GetAsync("/api/betting/balance");
    after.EnsureSuccessStatusCode();
    var afterBody = await after.Content.ReadFromJsonAsync<JsonElement>();
    var balanceAfter = afterBody.GetProperty("availableBalance").GetDecimal();
    var positiveCashAfter = afterBody.GetProperty("totalPositiveCash").GetDecimal();

    positiveCashAfter.Should().Be(positiveCashBefore + 1.00m,
        "4 aggregated positive points × 0.25€ = 1.00€ added to totalPositiveCash");
    balanceAfter.Should().Be(balanceBefore + 1.00m,
        "available balance increases by the same 1.00€");
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0/backend"
dotnet test tests/NHLStats.Api.Tests --filter "FullyQualifiedName~Get_betting_balance_includes_aggregated_positive_points" -v
```

Expected: FAIL — balance delta is 0, not 1.00€.

- [ ] **Step 3: Update BettingBalanceService to include aggregated positive points**

In `backend/src/NHLStats.Application/Services/BettingBalanceService.cs`, replace the block starting at line 27:

```csharp
        // Sum of positive point cash — client-side because SQLite can't SumAsync decimal
        var positivePoints = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch!.UserId == userId.Value && p.PointReason!.PointType == PointType.Positive)
            .Select(p => p.Amount)
            .ToListAsync();
        var totalPositiveCash = positivePoints.Sum();
```

with:

```csharp
        // Sum of positive point cash — client-side because SQLite can't SumAsync decimal
        var positivePoints = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch!.UserId == userId.Value && p.PointReason!.PointType == PointType.Positive)
            .Select(p => p.Amount)
            .ToListAsync();
        var totalPositiveCash = positivePoints.Sum();

        // Aggregated positive points (historical seasons) are always worth 0.25€ each
        var aggregatedPlusPoints = await _db.UserSeasonAggregatedData
            .Where(a => a.UserId == userId.Value)
            .Select(a => a.TotalPlus)
            .ToListAsync();
        totalPositiveCash += aggregatedPlusPoints.Sum() * 0.25m;
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0/backend"
dotnet test tests/NHLStats.Api.Tests --filter "FullyQualifiedName~Get_betting_balance_includes_aggregated_positive_points" -v
```

Expected: PASS

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
cd "/Users/michalsinger/Developement/Singent/NHLStats 2.0/backend"
dotnet test
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/NHLStats.Application/Services/BettingBalanceService.cs
git add backend/tests/NHLStats.Api.Tests/Bets/BetsTests.cs
git commit -m "feat: include aggregated positive points in betting balance (0.25€ each)"
```
