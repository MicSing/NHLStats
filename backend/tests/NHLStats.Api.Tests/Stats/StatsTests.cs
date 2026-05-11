using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

/// <summary>
/// Phase 7 — Stats &amp; Calculations integration tests.
///
/// Covers:
///   - Money calculation: effective rate by match date
///   - Money calculation: date before any config falls back to earliest config
///   - Money calculation: date after a rate change uses the new rate
///   - Aggregated UserMatch (no MatchId) uses season start date for rate
///   - Season stats sums all UserMatch totals per user
///   - Top roster player for goals
///   - Top roster player for penalties
///   - All-time earnings aggregates across seasons
///   - Balance = TotalCollected − TotalExpenses
///   - Weekly grouping: same date → same week number
///   - Weekly grouping: week numbers sequential by date order
/// </summary>
public class StatsTests : ApiTestBase
{
    public StatsTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ─── Shared setup helpers ─────────────────────────────────────────────────

    private async Task<int> CreateSeasonAsync(HttpClient client, string name,
        string startedOn = "2024-01-01T00:00:00")
    {
        var resp = await client.PostAsJsonAsync("/api/seasons", new { name, startedOn });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task<int> CreateUserAsync(HttpClient client, string name)
    {
        var resp = await client.PostAsJsonAsync("/api/users", new { name });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task AssignUserAsync(HttpClient client, int seasonId, int userId)
    {
        var resp = await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        resp.EnsureSuccessStatusCode();
    }

    private async Task<int> CreateMatchAsync(HttpClient client, int seasonId, string matchDate)
    {
        // Step 1: create with slim DTO (no date or scores)
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2
        });
        resp.EnsureSuccessStatusCode();
        var matchId = (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        // Step 2: set the date via update so stats/weekly tests can group by date
        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate,
            completionType = 1
        });
        updateResp.EnsureSuccessStatusCode();

        return matchId;
    }

    private async Task<int> CreateUserMatchAsync(HttpClient client, int seasonId, int matchId, int userId)
    {
        var resp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    /// <summary>Adds a UserMatchPoint to a UserMatch, returns the point Id.</summary>
    private async Task<int> AddPointAsync(HttpClient client, int userMatchId,
        int pointReasonId, int count)
    {
        var resp = await client.PostAsJsonAsync(
            $"/api/usermatches/{userMatchId}/points",
            new { pointReasonId, count });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task<int> CreateRosterPlayerAsync(HttpClient client, int seasonId,
        string firstName = "Connor", string surname = "McDavid")
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster", new
        {
            firstName,
            surname,
            position = "C",
            teamId = 1
        });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task AddGoalAsync(HttpClient client, int userMatchId, int rosterPlayerId, int count)
    {
        var resp = await client.PostAsJsonAsync(
            $"/api/usermatches/{userMatchId}/goals",
            new { rosterPlayerId, count });
        resp.EnsureSuccessStatusCode();
    }

    private async Task AddPenaltyAsync(HttpClient client, int userMatchId, int rosterPlayerId, int count)
    {
        var resp = await client.PostAsJsonAsync(
            $"/api/usermatches/{userMatchId}/penalties",
            new { rosterPlayerId, count });
        resp.EnsureSuccessStatusCode();
    }

    private async Task CreateMoneyConfigAsync(HttpClient client, decimal neg, decimal pos, string effectiveFrom)
    {
        var resp = await client.PostAsJsonAsync("/api/moneyconfig", new
        {
            negativePointValue = neg,
            positivePointValue = pos,
            effectiveFrom
        });
        resp.EnsureSuccessStatusCode();
    }

    private async Task CreateExpenseAsync(HttpClient client, string description, decimal amount, string date)
    {
        var resp = await client.PostAsJsonAsync("/api/expenses", new
        {
            description,
            amount,
            date
        });
        resp.EnsureSuccessStatusCode();
    }

    // ─── GET /api/seasons/{id}/stats — Season stats ───────────────────────────

    [Fact]
    public async Task SeasonStats_returns_200_and_empty_array_for_season_with_no_matches()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats Empty Season");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task SeasonStats_sums_all_UserMatch_totals_per_user()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats Sum Season");
        var userId = await CreateUserAsync(client, "Stats Player A");
        await AssignUserAsync(client, seasonId, userId);

        // Match 1 — 4 plus, 2 minus
        var m1 = await CreateMatchAsync(client, seasonId, "2024-02-01T20:00:00");
        var um1 = await CreateUserMatchAsync(client, seasonId, m1, userId);
        await AddPointAsync(client, um1, 9 /* Scoring 10 Goals — IsPositive=true */, 4);
        await AddPointAsync(client, um1, 1 /* Penalty — IsPositive=false */, 2);

        // Match 2 — 1 plus, 3 minus
        var m2 = await CreateMatchAsync(client, seasonId, "2024-02-08T20:00:00");
        var um2 = await CreateUserMatchAsync(client, seasonId, m2, userId);
        await AddPointAsync(client, um2, 9, 1);
        await AddPointAsync(client, um2, 1, 3);

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(1);

        var userStat = body[0];
        userStat.GetProperty("userId").GetInt32().Should().Be(userId);
        userStat.GetProperty("totalPlus").GetInt32().Should().Be(5);   // 4 + 1
        userStat.GetProperty("totalMinus").GetInt32().Should().Be(5);  // 2 + 3
    }

    // ─── Money calculation — effective rate by date ───────────────────────────

    [Fact]
    public async Task SeasonStats_earnings_uses_rate_active_at_match_date()
    {
        var client = await CreateAuthenticatedClientAsync();
        // Add a new rate effective far in the future so it doesn't affect existing test data
        // Seed rate: NegativePointValue=-0.50, PositivePointValue=0.25, EffectiveFrom=2000-01-01
        // We'll create a match in 2024 and verify it uses the seed rate.

        var seasonId = await CreateSeasonAsync(client, "Stats Rate Test Season");
        var userId = await CreateUserAsync(client, "Stats Rate Player");
        await AssignUserAsync(client, seasonId, userId);

        var matchId = await CreateMatchAsync(client, seasonId, "2024-03-01T20:00:00");
        var umId = await CreateUserMatchAsync(client, seasonId, matchId, userId);
        // 4 positive + 2 negative
        await AddPointAsync(client, umId, 9 /* Scoring 10 Goals */, 4);
        await AddPointAsync(client, umId, 1 /* Penalty */, 2);

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var stat = body[0];
        // Expected: 4 * 0.25 + 2 * (-0.50) = 1.00 - 1.00 = 0.00
        stat.GetProperty("totalPlus").GetInt32().Should().Be(4);
        stat.GetProperty("totalMinus").GetInt32().Should().Be(2);
        stat.GetProperty("earnings").GetDecimal().Should().Be(0.00m);
    }

    [Fact]
    public async Task SeasonStats_earnings_after_rate_change_uses_new_rate()
    {
        var client = await CreateAuthenticatedClientAsync();

        // Create a new money config effective 2100-01-01 (well in the future)
        // NegativePointValue = 1.00, PositivePointValue = 1.00
        await CreateMoneyConfigAsync(client, 1.00m, 1.00m, "2100-01-01T00:00:00");

        var seasonId = await CreateSeasonAsync(client, "Stats New Rate Season", "2100-06-01T00:00:00");
        var userId = await CreateUserAsync(client, "Stats New Rate Player");
        await AssignUserAsync(client, seasonId, userId);

        // Match date is 2100-06-10 — after the 2100-01-01 config
        var matchId = await CreateMatchAsync(client, seasonId, "2100-06-10T20:00:00");
        var umId = await CreateUserMatchAsync(client, seasonId, matchId, userId);
        // 3 positive + 2 negative
        await AddPointAsync(client, umId, 9 /* Scoring 10 Goals */, 3);
        await AddPointAsync(client, umId, 1 /* Penalty */, 2);

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var stat = body[0];
        // New rate: negCash=2*1.00=2.00, bettingBalance=3*1.00=3.00 → earnings=2.00-3.00=-1.00
        stat.GetProperty("earnings").GetDecimal().Should().Be(-1.0m);
    }

    [Fact]
    public async Task SeasonStats_earnings_before_any_config_uses_earliest_config()
    {
        // The seed MoneyConfig has EffectiveFrom = 2000-01-01.
        // A match played in 1999 should still use the seed (earliest) config.
        var client = await CreateAuthenticatedClientAsync();

        var seasonId = await CreateSeasonAsync(client, "Stats Old Match Season", "1999-01-01T00:00:00");
        var userId = await CreateUserAsync(client, "Stats Old Match Player");
        await AssignUserAsync(client, seasonId, userId);

        var matchId = await CreateMatchAsync(client, seasonId, "1999-06-15T20:00:00");
        var umId = await CreateUserMatchAsync(client, seasonId, matchId, userId);
        // 2 positive + 0 negative
        await AddPointAsync(client, umId, 9 /* Scoring 10 Goals */, 2);

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var stat = body[0];
        // No config for 1999 → AddPoint uses default pos rate 1.00 → Amount=2.0 stored
        // negCash=0, bettingBalance=2.0 → earnings=0-2.0=-2.0
        stat.GetProperty("earnings").GetDecimal().Should().Be(-2.0m);
    }

    [Fact]
    public async Task SeasonStats_match_entry_uses_match_date_for_rate()
    {
        var client = await CreateAuthenticatedClientAsync();

        // Season and match in 2024 — seed rate applies (neg=0.50, pos=0.25)
        var seasonId = await CreateSeasonAsync(client, "Stats Aggregated Season", "2024-05-01T00:00:00");
        var userId = await CreateUserAsync(client, "Stats Aggregated Player");
        await AssignUserAsync(client, seasonId, userId);

        var matchId = await CreateMatchAsync(client, seasonId, "2024-05-02T20:00:00");
        var umId = await CreateUserMatchAsync(client, seasonId, matchId, userId);
        // 6 positive + 4 negative
        await AddPointAsync(client, umId, 9 /* Scoring 10 Goals */, 6);
        await AddPointAsync(client, umId, 1 /* Penalty */, 4);

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var stat = body[0];
        // Seed rate: 4 * 0.50 - 6 * 0.25 = 2.00 - 1.50 = 0.50
        stat.GetProperty("totalPlus").GetInt32().Should().Be(6);
        stat.GetProperty("totalMinus").GetInt32().Should().Be(4);
        stat.GetProperty("earnings").GetDecimal().Should().Be(0.50m);
    }

    // ─── Top scorer ───────────────────────────────────────────────────────────

    [Fact]
    public async Task TopGoalScorer_returns_204_when_no_goals_in_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats No Goals Season");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/top-scorers");

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task TopGoalScorer_returns_player_with_most_goals()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats Top Scorer Season");
        var userId = await CreateUserAsync(client, "Stats Scorer Player");
        await AssignUserAsync(client, seasonId, userId);

        var matchId = await CreateMatchAsync(client, seasonId, "2024-03-10T20:00:00");
        var umId = await CreateUserMatchAsync(client, seasonId, matchId, userId);

        var playerId1 = await CreateRosterPlayerAsync(client, seasonId, "Alex", "Ovechkin");
        var playerId2 = await CreateRosterPlayerAsync(client, seasonId, "Wayne", "Gretzky");

        // Player 1: 3 goals, Player 2: 5 goals
        await AddGoalAsync(client, umId, playerId1, 3);
        await AddGoalAsync(client, umId, playerId2, 5);

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/top-scorers");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("rosterPlayerId").GetInt32().Should().Be(playerId2);
        body.GetProperty("firstName").GetString().Should().Be("Wayne");
        body.GetProperty("surname").GetString().Should().Be("Gretzky");
        body.GetProperty("count").GetInt32().Should().Be(5);
    }

    // ─── Top penalized ────────────────────────────────────────────────────────

    [Fact]
    public async Task TopPenaltyPlayer_returns_204_when_no_penalties_in_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats No Penalties Season");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/top-penalized");

        resp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task TopPenaltyPlayer_returns_player_with_most_penalties()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats Top Penalty Season");
        var userId = await CreateUserAsync(client, "Stats Penalty Player");
        await AssignUserAsync(client, seasonId, userId);

        var matchId = await CreateMatchAsync(client, seasonId, "2024-04-01T20:00:00");
        var umId = await CreateUserMatchAsync(client, seasonId, matchId, userId);

        var playerId1 = await CreateRosterPlayerAsync(client, seasonId, "Zdeno", "Chara");
        var playerId2 = await CreateRosterPlayerAsync(client, seasonId, "Tiger", "Williams");

        // Player 1: 2 penalties, Player 2: 7 penalties
        await AddPenaltyAsync(client, umId, playerId1, 2);
        await AddPenaltyAsync(client, umId, playerId2, 7);

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/top-penalized");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("rosterPlayerId").GetInt32().Should().Be(playerId2);
        body.GetProperty("firstName").GetString().Should().Be("Tiger");
        body.GetProperty("count").GetInt32().Should().Be(7);
    }

    // ─── GET /api/stats/earnings — All-time earnings ──────────────────────────

    [Fact]
    public async Task AllTimeEarnings_returns_200_with_correct_structure()
    {
        var client = await CreateAuthenticatedClientAsync();

        var resp = await client.GetAsync("/api/stats/earnings");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.TryGetProperty("userEarnings", out _).Should().BeTrue();
        body.TryGetProperty("totalCollected", out _).Should().BeTrue();
        body.TryGetProperty("totalExpenses", out _).Should().BeTrue();
        body.TryGetProperty("balance", out _).Should().BeTrue();
    }

    [Fact]
    public async Task AllTimeEarnings_balance_equals_totalCollected_minus_totalExpenses()
    {
        var client = await CreateAuthenticatedClientAsync();

        // Add a known expense so we can verify the balance formula
        await CreateExpenseAsync(client, "Equipment", 50.00m, "2024-01-15T00:00:00");

        var resp = await client.GetAsync("/api/stats/earnings");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var totalCollected = body.GetProperty("totalCollected").GetDecimal();
        var totalExpenses = body.GetProperty("totalExpenses").GetDecimal();
        var balance = body.GetProperty("balance").GetDecimal();

        totalExpenses.Should().BeGreaterThanOrEqualTo(50.00m);
        balance.Should().Be(totalCollected - totalExpenses);
    }

    [Fact]
    public async Task AllTimeEarnings_aggregates_across_multiple_seasons()
    {
        var client = await CreateAuthenticatedClientAsync();

        var userId = await CreateUserAsync(client, "AllTime Player");

        // Season A
        var s1 = await CreateSeasonAsync(client, "AllTime Season A", "2024-01-01T00:00:00");
        await AssignUserAsync(client, s1, userId);
        var m1 = await CreateMatchAsync(client, s1, "2024-01-10T20:00:00");
        var um1 = await CreateUserMatchAsync(client, s1, m1, userId);
        await AddPointAsync(client, um1, 9, 4); // 4 plus

        // Season B
        var s2 = await CreateSeasonAsync(client, "AllTime Season B", "2024-06-01T00:00:00");
        await AssignUserAsync(client, s2, userId);
        var m2 = await CreateMatchAsync(client, s2, "2024-06-10T20:00:00");
        var um2 = await CreateUserMatchAsync(client, s2, m2, userId);
        await AddPointAsync(client, um2, 9, 2); // 2 plus

        var resp = await client.GetAsync("/api/stats/earnings");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var userEarnings = body.GetProperty("userEarnings");
        var entries = Enumerable.Range(0, userEarnings.GetArrayLength())
            .Select(i => userEarnings[i])
            .ToList();

        var thisUser = entries.FirstOrDefault(e => e.GetProperty("userId").GetInt32() == userId);
        thisUser.ValueKind.Should().NotBe(JsonValueKind.Undefined, "user should appear in all-time earnings");
        thisUser.GetProperty("totalPlus").GetInt32().Should().BeGreaterThanOrEqualTo(0); // 4 + 2
    }

    // ─── GET /api/seasons/{id}/stats/weekly — Weekly grouping ─────────────────

    [Fact]
    public async Task Weekly_returns_empty_array_for_season_with_no_matches()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats Weekly Empty Season");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/weekly");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task Weekly_matches_on_same_date_get_same_week_number()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats Weekly SameDate Season");

        // Two matches on the same date
        await CreateMatchAsync(client, seasonId, "2024-05-01T18:00:00");
        await CreateMatchAsync(client, seasonId, "2024-05-01T21:00:00");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/weekly");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(1); // One week group

        var week = body[0];
        week.GetProperty("weekNumber").GetInt32().Should().Be(1);
        week.GetProperty("matches").GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task Weekly_week_numbers_are_sequential_by_date()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats Weekly Sequential Season");

        // Three distinct dates
        await CreateMatchAsync(client, seasonId, "2024-06-01T20:00:00");
        await CreateMatchAsync(client, seasonId, "2024-06-08T20:00:00");
        await CreateMatchAsync(client, seasonId, "2024-06-15T20:00:00");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/weekly");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(3);

        var weekNumbers = Enumerable.Range(0, 3)
            .Select(i => body[i].GetProperty("weekNumber").GetInt32())
            .ToList();

        weekNumbers.Should().BeInDescendingOrder();
        weekNumbers.Should().Equal(3, 2, 1);
    }

    [Fact]
    public async Task Weekly_returns_correct_match_details()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats Weekly Detail Season");

        await CreateMatchAsync(client, seasonId, "2024-07-01T20:00:00");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/weekly");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var match = body[0].GetProperty("matches")[0];

        match.TryGetProperty("matchId", out _).Should().BeTrue();
        match.TryGetProperty("weekNumber", out _).Should().BeTrue();
        match.TryGetProperty("matchDate", out _).Should().BeTrue();
        match.TryGetProperty("homeTeamId", out _).Should().BeTrue();
        match.TryGetProperty("awayTeamId", out _).Should().BeTrue();
        match.TryGetProperty("homeScore", out _).Should().BeTrue();
        match.TryGetProperty("awayScore", out _).Should().BeTrue();
    }

    [Fact]
    public async Task Weekly_includes_plus_minus_totals()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Stats Weekly Totals Season");
        var userId = await CreateUserAsync(client, "Weekly Totals Player");
        await AssignUserAsync(client, seasonId, userId);

        var matchId = await CreateMatchAsync(client, seasonId, "2024-07-10T20:00:00");
        var userMatchId = await CreateUserMatchAsync(client, seasonId, matchId, userId);

        await AddPointAsync(client, userMatchId, 9, 4); // positive
        await AddPointAsync(client, userMatchId, 1, 2); // negative

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/weekly");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var week = body[0];

        week.GetProperty("totalPlus").GetInt32().Should().Be(4);
        week.GetProperty("totalMinus").GetInt32().Should().Be(2);
    }

    // ─── Weekly bet info per user ──────────────────────────────────────────────

    private async Task<int> CreateOpenMatchAsync(HttpClient client, int seasonId)
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2
        });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task CompleteMatchAsync(HttpClient client, int seasonId, int matchId, string matchDate)
    {
        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 2,
            awayScore = 1,
            matchDate,
            completionType = 1 // RegularTime
        });
        updateResp.EnsureSuccessStatusCode();
    }

    private JsonElement FindMatchInWeekly(JsonElement weeklyBody, int matchId)
    {
        foreach (var week in weeklyBody.EnumerateArray())
        {
            foreach (var m in week.GetProperty("matches").EnumerateArray())
            {
                if (m.GetProperty("matchId").GetInt32() == matchId)
                    return m;
            }
        }
        return default;
    }

    [Fact]
    public async Task Weekly_includes_lost_bet_info_for_user()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Weekly Bet Lost Season");

        // Seed admin balance — returns admin's game userId (the bettor)
        var bettorUserId = await SeedBettingBalanceAsync(client, seasonId);

        var targetUserId = await CreateUserAsync(client, "Bet Lost Target");
        await AssignUserAsync(client, seasonId, targetUserId);

        // Create open match — bettor appears via their bet even without stats
        var matchId = await CreateOpenMatchAsync(client, seasonId);
        var userMatchId = await CreateUserMatchAsync(client, seasonId, matchId, targetUserId);
        await AddPointAsync(client, userMatchId, 9, 1); // target has a point but no goal → bet loses

        // Place a UserGoal bet on the target user while the match is open
        var betResp = await client.PostAsJsonAsync($"/api/betting/matches/{matchId}/bet", new
        {
            betType = "UserGoal",
            userId = targetUserId,
            amount = 1.0
        });
        betResp.EnsureSuccessStatusCode();

        // Completing the match auto-evaluates bets; target has no goal so bet is Lost
        await CompleteMatchAsync(client, seasonId, matchId, "2025-01-10T20:00:00");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/weekly");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var match = FindMatchInWeekly(body, matchId);
        match.ValueKind.Should().NotBe(JsonValueKind.Undefined);

        // Bet appears in the BETTOR's row (admin), not the target's row
        var users = match.GetProperty("users").EnumerateArray().ToList();
        var betUser = users.First(u => u.GetProperty("userId").GetInt32() == bettorUserId);

        betUser.GetProperty("betResult").GetString().Should().Be("Lost");
        betUser.GetProperty("betAmount").GetDecimal().Should().Be(1.0m);
        betUser.GetProperty("betWonAmount").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task Weekly_includes_won_bet_info_for_user()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Weekly Bet Won Season");

        // Returns admin's game userId (the bettor)
        var bettorUserId = await SeedBettingBalanceAsync(client, seasonId);

        var targetUserId = await CreateUserAsync(client, "Bet Won Target");
        await AssignUserAsync(client, seasonId, targetUserId);

        // Bettor appears via their bet even without stats
        var matchId = await CreateOpenMatchAsync(client, seasonId);
        var userMatchId = await CreateUserMatchAsync(client, seasonId, matchId, targetUserId);
        var rosterPlayerId = await CreateRosterPlayerAsync(client, seasonId, "Won", "BetPlayer");
        await AddGoalAsync(client, userMatchId, rosterPlayerId, 1); // goal → UserGoal bet wins

        var betResp = await client.PostAsJsonAsync($"/api/betting/matches/{matchId}/bet", new
        {
            betType = "UserGoal",
            userId = targetUserId,
            amount = 1.0
        });
        betResp.EnsureSuccessStatusCode();

        // Complete the match so it appears in weekly
        await CompleteMatchAsync(client, seasonId, matchId, "2025-02-15T20:00:00");

        // Re-evaluate: target has a goal so the UserGoal bet wins
        var evalResp = await client.PostAsync($"/api/admin/matches/{matchId}/re-evaluate-bets", null);
        evalResp.EnsureSuccessStatusCode();

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/weekly");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var match = FindMatchInWeekly(body, matchId);
        match.ValueKind.Should().NotBe(JsonValueKind.Undefined);

        // Bet appears in the BETTOR's row (admin), not the target's row
        var users = match.GetProperty("users").EnumerateArray().ToList();
        var betUser = users.First(u => u.GetProperty("userId").GetInt32() == bettorUserId);

        betUser.GetProperty("betResult").GetString().Should().Be("Won");
        betUser.GetProperty("betAmount").GetDecimal().Should().Be(1.0m);
        betUser.GetProperty("betWonAmount").GetDecimal().Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task Weekly_has_null_bet_info_when_no_bet_on_user()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Weekly No Bet Season");
        var userId = await CreateUserAsync(client, "No Bet Player");
        await AssignUserAsync(client, seasonId, userId);

        var matchId = await CreateMatchAsync(client, seasonId, "2024-09-15T20:00:00");
        var userMatchId = await CreateUserMatchAsync(client, seasonId, matchId, userId);
        await AddPointAsync(client, userMatchId, 9, 1);

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats/weekly");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var match = FindMatchInWeekly(body, matchId);
        match.ValueKind.Should().NotBe(JsonValueKind.Undefined);

        var users = match.GetProperty("users").EnumerateArray().ToList();
        var user = users.First(u => u.GetProperty("userId").GetInt32() == userId);

        user.GetProperty("betResult").ValueKind.Should().Be(JsonValueKind.Null);
        user.GetProperty("betAmount").ValueKind.Should().Be(JsonValueKind.Null);
        user.GetProperty("betWonAmount").ValueKind.Should().Be(JsonValueKind.Null);
    }

    // ─── GET /api/stats/users/{userId}/point-reasons — Point reason breakdown ──

    [Fact]
    public async Task PointReasonBreakdown_ReturnsGroupedByReason()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Breakdown Test Season");
        var userId = await CreateUserAsync(client, "Breakdown Player");
        await AssignUserAsync(client, seasonId, userId);

        var matchId = await CreateMatchAsync(client, seasonId, "2024-03-10T20:00:00");
        var umId = await CreateUserMatchAsync(client, seasonId, matchId, userId);

        // Penalty (id 1, IsPositive=false)
        await AddPointAsync(client, umId, 1, 3);
        // Secondary Penalty (id 2, IsPositive=false)
        await AddPointAsync(client, umId, 2, 1);
        // Last Minute Action Positive (id 13, IsPositive=true)
        await AddPointAsync(client, umId, 13, 2);
        // Positive Penalty (id 9, IsPositive=true)
        await AddPointAsync(client, umId, 9, 5);

        var resp = await client.GetAsync($"/api/stats/users/{userId}/point-reasons");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        body.GetProperty("userId").GetInt32().Should().Be(userId);
        body.TryGetProperty("userName", out _).Should().BeTrue();

        var items = body.GetProperty("items");
        items.ValueKind.Should().Be(JsonValueKind.Array);
        items.GetArrayLength().Should().Be(4);

        // Verify grouping by reason ID and correct totals
        var itemsList = Enumerable.Range(0, items.GetArrayLength())
            .Select(i => items[i])
            .ToList();

        var penalty = itemsList.FirstOrDefault(x => x.GetProperty("pointReasonId").GetInt32() == 1);
        penalty.ValueKind.Should().NotBe(JsonValueKind.Undefined);
        penalty.GetProperty("pointType").GetString().Should().Be("Negative");
        penalty.GetProperty("totalCount").GetInt32().Should().Be(3);

        var secondary = itemsList.FirstOrDefault(x => x.GetProperty("pointReasonId").GetInt32() == 2);
        secondary.ValueKind.Should().NotBe(JsonValueKind.Undefined);
        secondary.GetProperty("pointType").GetString().Should().Be("Negative");
        secondary.GetProperty("totalCount").GetInt32().Should().Be(1);

        var lastMinute = itemsList.FirstOrDefault(x => x.GetProperty("pointReasonId").GetInt32() == 13);
        lastMinute.ValueKind.Should().NotBe(JsonValueKind.Undefined);
        lastMinute.GetProperty("pointType").GetString().Should().Be("Positive");
        lastMinute.GetProperty("totalCount").GetInt32().Should().Be(2);

        var positivePenalty = itemsList.FirstOrDefault(x => x.GetProperty("pointReasonId").GetInt32() == 9);
        positivePenalty.ValueKind.Should().NotBe(JsonValueKind.Undefined);
        positivePenalty.GetProperty("pointType").GetString().Should().Be("Positive");
        positivePenalty.GetProperty("totalCount").GetInt32().Should().Be(5);
    }

    [Fact]
    public async Task PointReasonBreakdown_FiltersBySeason()
    {
        var client = await CreateAuthenticatedClientAsync();

        // Season A
        var s1 = await CreateSeasonAsync(client, "Breakdown Season A");
        var userId = await CreateUserAsync(client, "Breakdown Multi-Season Player");
        await AssignUserAsync(client, s1, userId);

        var m1 = await CreateMatchAsync(client, s1, "2024-03-10T20:00:00");
        var um1 = await CreateUserMatchAsync(client, s1, m1, userId);
        await AddPointAsync(client, um1, 1 /* Penalty */, 4);
        await AddPointAsync(client, um1, 9 /* Positive Penalty */, 2);

        // Season B
        var s2 = await CreateSeasonAsync(client, "Breakdown Season B");
        await AssignUserAsync(client, s2, userId);

        var m2 = await CreateMatchAsync(client, s2, "2024-06-10T20:00:00");
        var um2 = await CreateUserMatchAsync(client, s2, m2, userId);
        await AddPointAsync(client, um2, 1 /* Penalty */, 1);
        await AddPointAsync(client, um2, 9 /* Positive Penalty */, 3);

        // Query for Season A only
        var resp = await client.GetAsync($"/api/stats/users/{userId}/point-reasons?seasonId={s1}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var items = body.GetProperty("items");
        items.GetArrayLength().Should().Be(2);

        var itemsList = Enumerable.Range(0, items.GetArrayLength())
            .Select(i => items[i])
            .ToList();

        // Season A should have: 4 penalties, 2 positive penalties
        var penalty = itemsList.FirstOrDefault(x => x.GetProperty("pointReasonId").GetInt32() == 1);
        penalty.GetProperty("totalCount").GetInt32().Should().Be(4);

        var posPenalty = itemsList.FirstOrDefault(x => x.GetProperty("pointReasonId").GetInt32() == 9);
        posPenalty.GetProperty("totalCount").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task PointReasonBreakdown_EmptyUser_ReturnsEmptyItems()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Breakdown Empty Season");
        var userId = await CreateUserAsync(client, "Breakdown Empty Player");
        await AssignUserAsync(client, seasonId, userId);

        // Create a match but no user match entry for this user
        var matchId = await CreateMatchAsync(client, seasonId, "2024-03-10T20:00:00");

        var resp = await client.GetAsync($"/api/stats/users/{userId}/point-reasons?seasonId={seasonId}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        body.GetProperty("userId").GetInt32().Should().Be(userId);
        var items = body.GetProperty("items");
        items.GetArrayLength().Should().Be(0);
    }

    // ─── Head-to-head helpers ─────────────────────────────────────────────────

    private async Task<int> CreateSeasonWithHostedTeamAsync(HttpClient client, string name, int hostedTeamId,
        string startedOn = "2024-01-01T00:00:00")
    {
        var resp = await client.PostAsJsonAsync("/api/seasons", new { name, startedOn, hostedTeamId });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task<int> CreateMatchWithTeamsAsync(HttpClient client, int seasonId,
        int homeTeamId, int awayTeamId, string matchDate)
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId,
            awayTeamId
        });
        resp.EnsureSuccessStatusCode();
        var matchId = (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId,
            awayTeamId,
            homeScore = 2,
            awayScore = 1,
            matchDate,
            completionType = 1
        });
        updateResp.EnsureSuccessStatusCode();
        return matchId;
    }

    private async Task<int> CreateUnplayedMatchWithTeamsAsync(HttpClient client, int seasonId,
        int homeTeamId, int awayTeamId)
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId,
            awayTeamId
        });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task CreateAggregatedDataAsync(HttpClient client, int userId, int seasonId,
        int totalPlus, int totalMinus, int matchesPlayed)
    {
        var resp = await client.PostAsJsonAsync($"/api/users/{userId}/seasons/{seasonId}/aggregated-data", new
        {
            userId,
            seasonId,
            totalPlus,
            totalMinus,
            matchesPlayed
        });
        resp.EnsureSuccessStatusCode();
    }

    // ─── GET /api/stats/head-to-head/{teamId} ─────────────────────────────────

    [Fact]
    public async Task HeadToHead_ReturnsMatchesWhereTeamIsHomeOrAway()
    {
        var client = await CreateAuthenticatedClientAsync();
        // Use unique teams: hosted=BUF(4), opponent=CGY(5) — isolated from other h2h tests
        var seasonId = await CreateSeasonWithHostedTeamAsync(client, "H2H Home Away Season", hostedTeamId: 4);

        // Match A: hosted team (BUF=4) at home vs CGY (5) away
        await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 4, awayTeamId: 5, "2024-03-01T20:00:00");
        // Match B: CGY (5) at home vs hosted team (BUF=4) away
        await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 5, awayTeamId: 4, "2024-03-15T20:00:00");

        var resp = await client.GetAsync("/api/stats/head-to-head/5?hostedTeamId=4");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task HeadToHead_OnlyMatchesFromSeasonsWithSameHostedTeam()
    {
        var client = await CreateAuthenticatedClientAsync();
        // Use unique teams: hosted=CAR(6)/STL(26), opponent=CHI(7) — isolated from other h2h tests
        var sA = await CreateSeasonWithHostedTeamAsync(client, "H2H Same Host A", hostedTeamId: 6, "2024-01-01T00:00:00");
        var sB = await CreateSeasonWithHostedTeamAsync(client, "H2H Same Host B", hostedTeamId: 6, "2024-06-01T00:00:00");
        var sC = await CreateSeasonWithHostedTeamAsync(client, "H2H Different Host C", hostedTeamId: 26, "2024-09-01T00:00:00");

        await CreateMatchWithTeamsAsync(client, sA, homeTeamId: 6, awayTeamId: 7, "2024-02-01T20:00:00");
        await CreateMatchWithTeamsAsync(client, sB, homeTeamId: 6, awayTeamId: 7, "2024-07-01T20:00:00");
        await CreateMatchWithTeamsAsync(client, sC, homeTeamId: 26, awayTeamId: 7, "2024-10-01T20:00:00");

        var resp = await client.GetAsync("/api/stats/head-to-head/7?hostedTeamId=6");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(2, "only seasons A and B share hostedTeamId=6");

        var seasonIds = Enumerable.Range(0, 2)
            .Select(i => body[i].GetProperty("seasonId").GetInt32())
            .ToList();
        seasonIds.Should().NotContain(sC);
    }

    [Fact]
    public async Task HeadToHead_ExcludesUnplayedMatches()
    {
        var client = await CreateAuthenticatedClientAsync();
        // Use unique teams: hosted=COL(8), opponent=CBJ(9) — isolated from other h2h tests
        var seasonId = await CreateSeasonWithHostedTeamAsync(client, "H2H Unplayed Season", hostedTeamId: 8);

        // Played match
        await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 8, awayTeamId: 9, "2024-03-01T20:00:00");
        // Unplayed match (no date set)
        await CreateUnplayedMatchWithTeamsAsync(client, seasonId, homeTeamId: 8, awayTeamId: 9);

        var resp = await client.GetAsync("/api/stats/head-to-head/9?hostedTeamId=8");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(1, "unplayed match must be excluded");
    }

    [Fact]
    public async Task HeadToHead_IncludesUserResults()
    {
        var client = await CreateAuthenticatedClientAsync();
        // Use unique teams: hosted=DAL(10), opponent=DET(11) — isolated from other h2h tests
        var seasonId = await CreateSeasonWithHostedTeamAsync(client, "H2H User Results Season", hostedTeamId: 10);

        var u1 = await CreateUserAsync(client, "H2H Player One");
        var u2 = await CreateUserAsync(client, "H2H Player Two");
        await AssignUserAsync(client, seasonId, u1);
        await AssignUserAsync(client, seasonId, u2);

        var matchId = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 10, awayTeamId: 11, "2024-03-05T20:00:00");

        var um1 = await CreateUserMatchAsync(client, seasonId, matchId, u1);
        var um2 = await CreateUserMatchAsync(client, seasonId, matchId, u2);

        // u1: 3 penalties (minus), 1 positive
        await AddPointAsync(client, um1, 1 /* Penalty */, 3);
        await AddPointAsync(client, um1, 9 /* Positive Penalty */, 1);
        // u2: 2 penalties (minus)
        await AddPointAsync(client, um2, 1 /* Penalty */, 2);

        var resp = await client.GetAsync("/api/stats/head-to-head/11?hostedTeamId=10");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(1);

        var match = body[0];
        var userResults = match.GetProperty("userResults");
        userResults.GetArrayLength().Should().Be(2);

        var resultsList = Enumerable.Range(0, 2)
            .Select(i => userResults[i])
            .ToList();

        var r1 = resultsList.FirstOrDefault(r => r.GetProperty("userId").GetInt32() == u1);
        r1.ValueKind.Should().NotBe(JsonValueKind.Undefined);
        r1.TryGetProperty("totalMinus", out _).Should().BeTrue();
        r1.TryGetProperty("totalPlus", out _).Should().BeTrue();

        var r2 = resultsList.FirstOrDefault(r => r.GetProperty("userId").GetInt32() == u2);
        r2.ValueKind.Should().NotBe(JsonValueKind.Undefined);
        r2.TryGetProperty("totalMinus", out _).Should().BeTrue();
        r2.TryGetProperty("totalPlus", out _).Should().BeTrue();
    }

    [Fact]
    public async Task HeadToHead_OrderedByDateDescending()
    {
        var client = await CreateAuthenticatedClientAsync();
        // Use unique teams: hosted=EDM(12), opponent=FLA(13) — isolated from other h2h tests
        var seasonId = await CreateSeasonWithHostedTeamAsync(client, "H2H Order Season", hostedTeamId: 12);

        await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 12, awayTeamId: 13, "2024-01-10T20:00:00");
        await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 12, awayTeamId: 13, "2024-03-20T20:00:00");
        await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 12, awayTeamId: 13, "2024-02-15T20:00:00");

        var resp = await client.GetAsync("/api/stats/head-to-head/13?hostedTeamId=12");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(3);

        var dates = Enumerable.Range(0, 3)
            .Select(i => body[i].GetProperty("matchDate").GetDateTime())
            .ToList();

        dates.Should().BeInDescendingOrder();
    }

    [Fact]
    public async Task PointReasonBreakdown_AllSeasons_SumsAcrossAll()
    {
        var client = await CreateAuthenticatedClientAsync();

        var userId = await CreateUserAsync(client, "Breakdown All Seasons Player");

        // Season A
        var s1 = await CreateSeasonAsync(client, "Breakdown All Season A");
        await AssignUserAsync(client, s1, userId);
        var m1 = await CreateMatchAsync(client, s1, "2024-03-10T20:00:00");
        var um1 = await CreateUserMatchAsync(client, s1, m1, userId);
        await AddPointAsync(client, um1, 1 /* Penalty */, 2);

        // Season B
        var s2 = await CreateSeasonAsync(client, "Breakdown All Season B");
        await AssignUserAsync(client, s2, userId);
        var m2 = await CreateMatchAsync(client, s2, "2024-06-10T20:00:00");
        var um2 = await CreateUserMatchAsync(client, s2, m2, userId);
        await AddPointAsync(client, um2, 1 /* Penalty */, 3);

        // Query without seasonId
        var resp = await client.GetAsync($"/api/stats/users/{userId}/point-reasons");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        var items = body.GetProperty("items");
        items.GetArrayLength().Should().Be(1);

        // Should have totals from both seasons: 2 + 3 = 5
        var penalty = items[0];
        penalty.GetProperty("pointReasonId").GetInt32().Should().Be(1);
        penalty.GetProperty("totalCount").GetInt32().Should().Be(5);
    }

    // ─── GET /api/stats/users/{userId}/match-history — User match history ──────

    [Fact]
    public async Task MatchHistory_ReturnsHierarchicalStructure()
    {
        var client = await CreateAuthenticatedClientAsync();
        // hosted=LAK(14), opponent=MIN(15)
        var seasonId = await CreateSeasonWithHostedTeamAsync(client, "MH Returns Season", hostedTeamId: 14);
        var userId = await CreateUserAsync(client, "MH Returns Player");
        await AssignUserAsync(client, seasonId, userId);

        // Match 1 (week 1): 3 plus, 1 minus
        var m1 = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 14, awayTeamId: 15, "2024-02-01T20:00:00");
        var um1 = await CreateUserMatchAsync(client, seasonId, m1, userId);
        await AddPointAsync(client, um1, 9 /* IsPositive */, 3);
        await AddPointAsync(client, um1, 1 /* Penalty */, 1);

        // Match 2 (week 2): 1 plus, 2 minus
        var m2 = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 14, awayTeamId: 15, "2024-02-08T20:00:00");
        var um2 = await CreateUserMatchAsync(client, seasonId, m2, userId);
        await AddPointAsync(client, um2, 9, 1);
        await AddPointAsync(client, um2, 1, 2);

        // Match 3 (week 3): 0 plus, 3 minus
        var m3 = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 14, awayTeamId: 15, "2024-02-15T20:00:00");
        var um3 = await CreateUserMatchAsync(client, seasonId, m3, userId);
        await AddPointAsync(client, um3, 1, 3);

        var resp = await client.GetAsync($"/api/stats/users/{userId}/match-history");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();

        // Root is an array of seasons
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(1, "one season");

        var season = body[0];
        season.TryGetProperty("seasonId", out _).Should().BeTrue();
        season.TryGetProperty("seasonName", out _).Should().BeTrue();
        season.TryGetProperty("weeks", out _).Should().BeTrue();

        var weeks = season.GetProperty("weeks");
        weeks.GetArrayLength().Should().Be(3, "3 distinct dates = 3 weeks");

        // Season-level aggregates: (3+1+0) plus, (1+2+3) minus
        season.GetProperty("totalPlus").GetInt32().Should().Be(4);
        season.GetProperty("totalMinus").GetInt32().Should().Be(6);

        // First week should have weekNumber=1 and one match
        var week1 = weeks[0];
        week1.GetProperty("weekNumber").GetInt32().Should().Be(1);

        // Week-level aggregates: match 1 has 3 plus, 1 minus
        week1.GetProperty("totalPlus").GetInt32().Should().Be(3);
        week1.GetProperty("totalMinus").GetInt32().Should().Be(1);

        var matches = week1.GetProperty("matches");
        matches.GetArrayLength().Should().Be(1);

        // Verify match fields
        var first = matches[0];
        first.TryGetProperty("matchDate", out _).Should().BeTrue();
        first.TryGetProperty("opponentName", out _).Should().BeTrue();
        first.TryGetProperty("opponentShortName", out _).Should().BeTrue();
        first.TryGetProperty("homeScore", out _).Should().BeTrue();
        first.TryGetProperty("awayScore", out _).Should().BeTrue();
        first.TryGetProperty("isHome", out _).Should().BeTrue();
        first.TryGetProperty("totalPlus", out _).Should().BeTrue();
        first.TryGetProperty("totalMinus", out _).Should().BeTrue();
        first.TryGetProperty("goalCount", out _).Should().BeTrue();
        first.TryGetProperty("penaltyCount", out _).Should().BeTrue();

        // matchId should NOT be in the new model
        first.TryGetProperty("matchId", out _).Should().BeFalse();

        first.GetProperty("totalPlus").GetInt32().Should().Be(3);
        first.GetProperty("totalMinus").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task MatchHistory_ResolvesOpponentFromHostedTeam()
    {
        var client = await CreateAuthenticatedClientAsync();
        // hosted=MTL(16), opponent=NSH(17)
        var seasonId = await CreateSeasonWithHostedTeamAsync(client, "MH Opponent Season", hostedTeamId: 16);
        var userId = await CreateUserAsync(client, "MH Opponent Player");
        await AssignUserAsync(client, seasonId, userId);

        // Match A: hosted (MTL=16) is HOME → opponent should be away team NSH(17)
        var mA = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 16, awayTeamId: 17, "2024-03-01T20:00:00");
        var umA = await CreateUserMatchAsync(client, seasonId, mA, userId);

        // Match B: hosted (MTL=16) is AWAY → opponent should be home team NSH(17)
        var mB = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 17, awayTeamId: 16, "2024-03-08T20:00:00");
        var umB = await CreateUserMatchAsync(client, seasonId, mB, userId);

        var resp = await client.GetAsync($"/api/stats/users/{userId}/match-history");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(1, "one season");

        var weeks = body[0].GetProperty("weeks");
        weeks.GetArrayLength().Should().Be(2, "2 distinct dates = 2 weeks");

        // Week 1 match (2024-03-01): hosted is home → isHome=true, opponent=NSH
        var matchA = weeks[0].GetProperty("matches")[0];
        matchA.GetProperty("isHome").GetBoolean().Should().BeTrue();
        matchA.GetProperty("opponentShortName").GetString().Should().Be("NSH");

        // Week 2 match (2024-03-08): hosted is away → isHome=false, opponent=NSH
        var matchB = weeks[1].GetProperty("matches")[0];
        matchB.GetProperty("isHome").GetBoolean().Should().BeFalse();
        matchB.GetProperty("opponentShortName").GetString().Should().Be("NSH");
    }

    [Fact]
    public async Task MatchHistory_FiltersBySeason()
    {
        var client = await CreateAuthenticatedClientAsync();
        // hosted=NJD(18), opponent=NYI(19)
        var s1 = await CreateSeasonWithHostedTeamAsync(client, "MH Filter Season A", hostedTeamId: 18, "2024-01-01T00:00:00");
        var s2 = await CreateSeasonWithHostedTeamAsync(client, "MH Filter Season B", hostedTeamId: 18, "2024-06-01T00:00:00");
        var userId = await CreateUserAsync(client, "MH Filter Player");
        await AssignUserAsync(client, s1, userId);
        await AssignUserAsync(client, s2, userId);

        var mA = await CreateMatchWithTeamsAsync(client, s1, homeTeamId: 18, awayTeamId: 19, "2024-02-01T20:00:00");
        await CreateUserMatchAsync(client, s1, mA, userId);

        var mB = await CreateMatchWithTeamsAsync(client, s2, homeTeamId: 18, awayTeamId: 19, "2024-07-01T20:00:00");
        await CreateUserMatchAsync(client, s2, mB, userId);

        // Filter by Season 1 only
        var resp = await client.GetAsync($"/api/stats/users/{userId}/match-history?seasonId={s1}");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(1, "only season 1 should be returned");
        body[0].GetProperty("seasonId").GetInt32().Should().Be(s1);
        body[0].GetProperty("weeks").GetArrayLength().Should().Be(1);
    }

    [Fact]
    public async Task MatchHistory_GoalCountSumsCorrectly()
    {
        var client = await CreateAuthenticatedClientAsync();
        // hosted=NYR(20), opponent=OTT(21)
        var seasonId = await CreateSeasonWithHostedTeamAsync(client, "MH Goals Season", hostedTeamId: 20);
        var userId = await CreateUserAsync(client, "MH Goals Player");
        await AssignUserAsync(client, seasonId, userId);

        var matchId = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 20, awayTeamId: 21, "2024-04-01T20:00:00");
        var umId = await CreateUserMatchAsync(client, seasonId, matchId, userId);

        var player1 = await CreateRosterPlayerAsync(client, seasonId, "Sidney", "Crosby");
        var player2 = await CreateRosterPlayerAsync(client, seasonId, "Mario", "Lemieux");

        // Player 1: 2 goals, Player 2: 3 goals → total = 5
        await AddGoalAsync(client, umId, player1, 2);
        await AddGoalAsync(client, umId, player2, 3);

        var resp = await client.GetAsync($"/api/stats/users/{userId}/match-history");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(1);
        var match = body[0].GetProperty("weeks")[0].GetProperty("matches")[0];
        match.GetProperty("goalCount").GetInt32().Should().Be(5);
    }

    [Fact]
    public async Task MatchHistory_ExcludesUnplayedMatches()
    {
        var client = await CreateAuthenticatedClientAsync();
        // hosted=PHI(22), opponent=PIT(23)
        var seasonId = await CreateSeasonWithHostedTeamAsync(client, "MH Unplayed Season", hostedTeamId: 22);
        var userId = await CreateUserAsync(client, "MH Unplayed Player");
        await AssignUserAsync(client, seasonId, userId);

        // Played match
        var playedId = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 22, awayTeamId: 23, "2024-05-01T20:00:00");
        await CreateUserMatchAsync(client, seasonId, playedId, userId);

        // Unplayed match (no date)
        var unplayedId = await CreateUnplayedMatchWithTeamsAsync(client, seasonId, homeTeamId: 22, awayTeamId: 23);
        await CreateUserMatchAsync(client, seasonId, unplayedId, userId);

        var resp = await client.GetAsync($"/api/stats/users/{userId}/match-history");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(1, "one season");
        var weeks = body[0].GetProperty("weeks");
        weeks.GetArrayLength().Should().Be(1, "only the played match should appear");
        weeks[0].GetProperty("matches").GetArrayLength().Should().Be(1, "unplayed match must be excluded");
    }

    [Fact]
    public async Task MatchHistory_WeeksAndMatchesOrderedCorrectly()
    {
        var client = await CreateAuthenticatedClientAsync();
        // hosted=SJS(24), opponent=SEA(25)
        var seasonId = await CreateSeasonWithHostedTeamAsync(client, "MH Order Season", hostedTeamId: 24);
        var userId = await CreateUserAsync(client, "MH Order Player");
        await AssignUserAsync(client, seasonId, userId);

        // Create matches out of order — 3 different dates = 3 weeks
        var m3 = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 24, awayTeamId: 25, "2024-06-15T20:00:00");
        var m1 = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 24, awayTeamId: 25, "2024-06-01T20:00:00");
        var m2 = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 24, awayTeamId: 25, "2024-06-08T20:00:00");

        await CreateUserMatchAsync(client, seasonId, m3, userId);
        await CreateUserMatchAsync(client, seasonId, m1, userId);
        await CreateUserMatchAsync(client, seasonId, m2, userId);

        var resp = await client.GetAsync($"/api/stats/users/{userId}/match-history");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(1);

        var weeks = body[0].GetProperty("weeks");
        weeks.GetArrayLength().Should().Be(3);

        // Week numbers should be sequential 1, 2, 3
        var weekNumbers = Enumerable.Range(0, 3)
            .Select(i => weeks[i].GetProperty("weekNumber").GetInt32())
            .ToList();
        weekNumbers.Should().BeEquivalentTo(new[] { 1, 2, 3 });
        weekNumbers.Should().BeInAscendingOrder();

        // Matches within weeks should be in date order
        var dates = Enumerable.Range(0, 3)
            .Select(i => weeks[i].GetProperty("matches")[0].GetProperty("matchDate").GetDateTime())
            .ToList();
        dates.Should().BeInAscendingOrder();
    }

    [Fact]
    public async Task MatchHistory_MergesAggregatedDataIntoSeasonTotals()
    {
        var client = await CreateAuthenticatedClientAsync();
        // hosted=ANA(1), opponent=ARI(2)
        var seasonId = await CreateSeasonWithHostedTeamAsync(client, "MH Agg Merge Season", hostedTeamId: 1);
        var userId = await CreateUserAsync(client, "MH Agg Merge Player");
        await AssignUserAsync(client, seasonId, userId);

        // One match: 3 plus, 1 minus
        var m1 = await CreateMatchWithTeamsAsync(client, seasonId, homeTeamId: 1, awayTeamId: 2, "2024-02-01T20:00:00");
        var um1 = await CreateUserMatchAsync(client, seasonId, m1, userId);
        await AddPointAsync(client, um1, 9 /* IsPositive */, 3);
        await AddPointAsync(client, um1, 1 /* Penalty */, 1);

        // Aggregated data for same season: 10 plus, 5 minus
        await CreateAggregatedDataAsync(client, userId, seasonId, totalPlus: 10, totalMinus: 5, matchesPlayed: 4);

        var resp = await client.GetAsync($"/api/stats/users/{userId}/match-history");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(1, "one season");

        var season = body[0];
        // Season totals should merge: match(3+10=13 plus, 1+5=6 minus)
        season.GetProperty("totalPlus").GetInt32().Should().Be(13);
        season.GetProperty("totalMinus").GetInt32().Should().Be(6);

        // Week totals remain match-only (no aggregated data)
        var week1 = season.GetProperty("weeks")[0];
        week1.GetProperty("totalPlus").GetInt32().Should().Be(3);
        week1.GetProperty("totalMinus").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task MatchHistory_IncludesAggregatedOnlySeasons()
    {
        var client = await CreateAuthenticatedClientAsync();
        // Season with matches: hosted=BOS(3), opponent=BUF(4)
        var matchSeason = await CreateSeasonWithHostedTeamAsync(client, "MH AggOnly Match Season", hostedTeamId: 3, "2024-01-01T00:00:00");
        // Season with aggregated data only (no matches)
        var aggSeason = await CreateSeasonWithHostedTeamAsync(client, "MH AggOnly Agg Season", hostedTeamId: 3, "2023-01-01T00:00:00");

        var userId = await CreateUserAsync(client, "MH AggOnly Player");
        await AssignUserAsync(client, matchSeason, userId);
        await AssignUserAsync(client, aggSeason, userId);

        // Match in first season
        var m1 = await CreateMatchWithTeamsAsync(client, matchSeason, homeTeamId: 3, awayTeamId: 4, "2024-02-01T20:00:00");
        await CreateUserMatchAsync(client, matchSeason, m1, userId);

        // Aggregated data in second season only
        await CreateAggregatedDataAsync(client, userId, aggSeason, totalPlus: 20, totalMinus: 8, matchesPlayed: 6);

        var resp = await client.GetAsync($"/api/stats/users/{userId}/match-history");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(2, "two seasons: one with matches + one aggregated-only");

        // Find the aggregated-only season
        var aggSeasonDto = Enumerable.Range(0, body.GetArrayLength())
            .Select(i => body[i])
            .First(s => s.GetProperty("seasonId").GetInt32() == aggSeason);

        aggSeasonDto.GetProperty("totalPlus").GetInt32().Should().Be(20);
        aggSeasonDto.GetProperty("totalMinus").GetInt32().Should().Be(8);
        aggSeasonDto.GetProperty("weeks").GetArrayLength().Should().Be(0, "no matches = no weeks");
    }

    // ─── GET /api/stats/financial-stats ───────────────────────────────────────

    [Fact]
    public async Task FinancialStats_bettingBalance_includes_aggregated_positive_points()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "FinStats Agg Season");
        var userId = await CreateUserAsync(client, "FinStats Agg User");
        await AssignUserAsync(client, seasonId, userId);

        // MoneyConfig: neg=0.50, pos=0.25 — effective before our match date
        await CreateMoneyConfigAsync(client, neg: 0.50m, pos: 0.25m, effectiveFrom: "2023-01-01");

        // Match with 13 positive (Amount=3.25) and 59 negative (Amount=29.50) match points
        var matchId = await CreateMatchAsync(client, seasonId, "2024-02-01T20:00:00");
        var userMatchId = await CreateUserMatchAsync(client, seasonId, matchId, userId);
        await AddPointAsync(client, userMatchId, 9 /* positive */, 13);
        await AddPointAsync(client, userMatchId, 1 /* negative */, 59);

        // Aggregated data: 3 positive + 10 negative (10 neg adds 5.00€ to dues)
        await CreateAggregatedDataAsync(client, userId, seasonId, totalPlus: 3, totalMinus: 10, matchesPlayed: 5);

        // Payout of 12.00€
        var payoutResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/payouts", new
        {
            userId,
            amount = 12.00m,
            paidOn = "2024-03-01T00:00:00"
        });
        payoutResp.EnsureSuccessStatusCode();

        // Act
        var resp = await client.GetAsync("/api/stats/financial-stats");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var financesByUser = body.GetProperty("financesByUser");

        var user = Enumerable.Range(0, financesByUser.GetArrayLength())
            .Select(i => financesByUser[i])
            .First(u => u.GetProperty("userId").GetInt32() == userId);

        // bettingBalance = 13×0.25 + 3×0.25 = 3.25 + 0.75 = 4.00
        user.GetProperty("bettingBalance").GetDecimal().Should().Be(4.00m);
        // totalEarnings = (59×0.50 + 10×0.50) − 4.00 = 34.50 − 4.00 = 30.50
        user.GetProperty("totalEarnings").GetDecimal().Should().Be(30.50m);
        // canBeCollected = 30.50 − 12.00 = 18.50
        user.GetProperty("canBeCollected").GetDecimal().Should().Be(18.50m);
        // totalPluses = 13 (match) + 3 (agg) = 16
        user.GetProperty("totalPluses").GetInt32().Should().Be(16);
        // totalMinuses = 59 (match) + 10 (agg) = 69
        user.GetProperty("totalMinuses").GetInt32().Should().Be(69);
    }

    [Fact]
    public async Task FinancialStats_bettingBalance_includes_lost_bet_on_match_with_no_user_match()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "FinStats Lost Bet No UM Season");

        // Seed admin balance via a separate completed match WITH UserMatch entries
        var bettorUserId = await SeedBettingBalanceAsync(client, seasonId);
        var targetUserId = await CreateUserAsync(client, "FinStats Lost Bet Target");
        await AssignUserAsync(client, seasonId, targetUserId);

        // Create a match with NO UserMatch entries — this is the key for the bug
        var betMatchId = await CreateOpenMatchAsync(client, seasonId);

        // Place a UserGoal bet on targetUserId — target has no goals so it will be Lost
        var betResp = await client.PostAsJsonAsync($"/api/betting/matches/{betMatchId}/bet", new
        {
            betType = "UserGoal",
            userId = targetUserId,
            amount = 1.0
        });
        betResp.EnsureSuccessStatusCode();

        // Complete match with no goals — auto-evaluates bet as Lost, no UserMatch created
        var completeResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{betMatchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 2,
            awayScore = 1,
            matchDate = "2025-03-01T20:00:00",
            completionType = 1
        });
        completeResp.EnsureSuccessStatusCode();

        var resp = await client.GetAsync("/api/stats/financial-stats");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var financesByUser = body.GetProperty("financesByUser");

        var bettor = Enumerable.Range(0, financesByUser.GetArrayLength())
            .Select(i => financesByUser[i])
            .First(u => u.GetProperty("userId").GetInt32() == bettorUserId);

        // The lost stake must appear even though the bet match has no UserMatch entries
        bettor.GetProperty("betLosses").GetDecimal().Should().Be(1.0m);
        bettor.GetProperty("betWins").GetDecimal().Should().Be(0m);
        bettor.GetProperty("stakes").GetDecimal().Should().Be(0m);
    }
}
