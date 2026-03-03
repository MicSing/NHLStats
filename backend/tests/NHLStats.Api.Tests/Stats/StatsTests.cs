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
            completionType = 0
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

    private async Task<int> CreateAggregatedUserMatchAsync(HttpClient client, int seasonId, int userId)
    {
        var resp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/usermatches",
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
        // New rate: 3 * 1.00 + 2 * (-1.00) = 3.00 - 2.00 = 1.00
        stat.GetProperty("earnings").GetDecimal().Should().Be(0);
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
        // Earliest config: 2 * 0.25 = 0.50
        stat.GetProperty("earnings").GetDecimal().Should().Be(0m);
    }

    [Fact]
    public async Task SeasonStats_aggregated_UserMatch_uses_season_start_date_for_rate()
    {
        var client = await CreateAuthenticatedClientAsync();

        // Season starts in 2024 — seed rate applies (neg=-0.50, pos=0.25)
        var seasonId = await CreateSeasonAsync(client, "Stats Aggregated Season", "2024-05-01T00:00:00");
        var userId = await CreateUserAsync(client, "Stats Aggregated Player");
        await AssignUserAsync(client, seasonId, userId);

        // Aggregated UserMatch (no MatchId)
        var umId = await CreateAggregatedUserMatchAsync(client, seasonId, userId);
        // 6 positive + 4 negative
        await AddPointAsync(client, umId, 9 /* Scoring 10 Goals */, 6);
        await AddPointAsync(client, umId, 1 /* Penalty */, 4);

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/stats");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var stat = body[0];
        // Seed rate: 6 * 0.25 + 4 * (-0.50) = 1.50 - 2.00 = -0.50
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

        weekNumbers.Should().BeInAscendingOrder();
        weekNumbers.Should().Equal(1, 2, 3);
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
}
