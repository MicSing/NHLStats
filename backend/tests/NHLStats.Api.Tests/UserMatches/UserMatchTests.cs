using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class UserMatchTests : ApiTestBase
{
    public UserMatchTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async Task<int> CreateSeasonAsync(HttpClient client, string name)
    {
        var resp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name,
            startedOn = "2024-01-01T00:00:00"
        });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task<int> CreateUserAsync(HttpClient client, string name)
    {
        var resp = await client.PostAsJsonAsync("/api/users", new { name });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task AssignUserToSeasonAsync(HttpClient client, int seasonId, int userId)
    {
        var resp = await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        resp.EnsureSuccessStatusCode();
    }

    private async Task<int> CreateMatchAsync(HttpClient client, int seasonId)
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2
        });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task<int> CreateRosterPlayerAsync(HttpClient client, int seasonId)
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster", new
        {
            firstName = "Connor",
            surname = "McDavid",
            position = "C",
            teamId = 1
        });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    // ─── UserMatch — Create for Match ─────────────────────────────────────────

    [Fact]
    public async Task CreateForMatch_returns_201_with_matchId()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM CreateForMatch");
        var userId = await CreateUserAsync(client, "Player A");
        await AssignUserToSeasonAsync(client, seasonId, userId);
        var matchId = await CreateMatchAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("matchId").GetInt32().Should().Be(matchId);
        body.GetProperty("seasonId").GetInt32().Should().Be(seasonId);
        body.GetProperty("userId").GetInt32().Should().Be(userId);
        body.GetProperty("totalPlus").GetInt32().Should().Be(0);
        body.GetProperty("totalMinus").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task CreateForMatch_user_not_in_season_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM UserNotInSeason");
        var userId = await CreateUserAsync(client, "Unassigned Player");
        // deliberately NOT assigning user to season
        var matchId = await CreateMatchAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreateForMatch_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync(
            "/api/seasons/1/matches/1/usermatches",
            new { userId = 1 });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ─── UserMatch — Aggregated (MatchId = null) ──────────────────────────────

    [Fact]
    public async Task CreateAggregated_returns_201_with_null_matchId()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM Aggregated");
        var userId = await CreateUserAsync(client, "Aggregated Player");
        await AssignUserToSeasonAsync(client, seasonId, userId);

        var resp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/usermatches",
            new { userId });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("matchId").ValueKind.Should().Be(JsonValueKind.Null);
        body.GetProperty("seasonId").GetInt32().Should().Be(seasonId);
        body.GetProperty("userId").GetInt32().Should().Be(userId);
    }

    [Fact]
    public async Task CreateAggregated_user_not_in_season_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM Aggregated NoUser");
        var userId = await CreateUserAsync(client, "No Season Player");
        // not assigned

        var resp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/usermatches",
            new { userId });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ─── UserMatch — Get ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetByMatch_returns_200_array()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM GetByMatch");
        var userId = await CreateUserAsync(client, "Get Player");
        await AssignUserToSeasonAsync(client, seasonId, userId);
        var matchId = await CreateMatchAsync(client, seasonId);

        await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{matchId}/usermatches");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(1);
    }

    // ─── UserMatch — Initialize Users ─────────────────────────────────────────

    [Fact]
    public async Task InitializeUsers_creates_usermatches_for_all_season_users()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM Initialize");
        var userId1 = await CreateUserAsync(client, "Init Player 1");
        var userId2 = await CreateUserAsync(client, "Init Player 2");
        await AssignUserToSeasonAsync(client, seasonId, userId1);
        await AssignUserToSeasonAsync(client, seasonId, userId2);
        var matchId = await CreateMatchAsync(client, seasonId);

        var resp = await client.PostAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches/initialize", null);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("created").GetInt32().Should().Be(2);

        // Re-initializing should create 0 more
        var resp2 = await client.PostAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches/initialize", null);
        var body2 = await resp2.Content.ReadFromJsonAsync<JsonElement>();
        body2.GetProperty("created").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task InitializeUsers_skips_existing_usermatches()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM InitializeSkip");
        var userId1 = await CreateUserAsync(client, "Skip Player 1");
        var userId2 = await CreateUserAsync(client, "Skip Player 2");
        await AssignUserToSeasonAsync(client, seasonId, userId1);
        await AssignUserToSeasonAsync(client, seasonId, userId2);
        var matchId = await CreateMatchAsync(client, seasonId);

        // Pre-create one user match
        await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId = userId1 });

        var resp = await client.PostAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches/initialize", null);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        // Only userId2 should be created
        body.GetProperty("created").GetInt32().Should().Be(1);
    }

    // ─── UserMatchPoint — Add & totals recalculation ─────────────────────────

    [Fact]
    public async Task AddPoint_negative_reason_increments_TotalMinus()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM AddPointNeg");
        var userId = await CreateUserAsync(client, "Point Player Neg");
        await AssignUserToSeasonAsync(client, seasonId, userId);
        var matchId = await CreateMatchAsync(client, seasonId);

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        var umId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        // PointReason 1 = "Penalty" (IsPositive=false)
        var addResp = await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/points",
            new { pointReasonId = 1, count = 2 });

        addResp.StatusCode.Should().Be(HttpStatusCode.Created);

        var getResp = await client.GetAsync($"/api/usermatches/{umId}");
        var um = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        um.GetProperty("totalMinus").GetInt32().Should().Be(2);
        um.GetProperty("totalPlus").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task AddPoint_positive_reason_increments_TotalPlus()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM AddPointPos");
        var userId = await CreateUserAsync(client, "Point Player Pos");
        await AssignUserToSeasonAsync(client, seasonId, userId);
        var matchId = await CreateMatchAsync(client, seasonId);

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        var umId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        // PointReason 4 = "Scoring 10 Goals" (IsPositive=true)
        await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/points",
            new { pointReasonId = 4, count = 3 });

        var getResp = await client.GetAsync($"/api/usermatches/{umId}");
        var um = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        um.GetProperty("totalPlus").GetInt32().Should().Be(3);
        um.GetProperty("totalMinus").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task UpdatePoint_recalculates_totals()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM UpdatePoint");
        var userId = await CreateUserAsync(client, "Update Point Player");
        await AssignUserToSeasonAsync(client, seasonId, userId);
        var matchId = await CreateMatchAsync(client, seasonId);

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        var umId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        // Add negative point (reason 1, count=2)
        var addResp = await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/points",
            new { pointReasonId = 1, count = 2 });
        var pointId = (await addResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        // Update to positive reason (reason 4, count=5)
        var updateResp = await client.PutAsJsonAsync(
            $"/api/usermatches/{umId}/points/{pointId}",
            new { pointReasonId = 4, count = 5 });
        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var getResp = await client.GetAsync($"/api/usermatches/{umId}");
        var um = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        um.GetProperty("totalPlus").GetInt32().Should().Be(5);
        um.GetProperty("totalMinus").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task DeletePoint_recalculates_totals()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM DeletePoint");
        var userId = await CreateUserAsync(client, "Delete Point Player");
        await AssignUserToSeasonAsync(client, seasonId, userId);
        var matchId = await CreateMatchAsync(client, seasonId);

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        var umId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        // Add two entries
        var add1 = await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/points",
            new { pointReasonId = 1, count = 3 });
        var pointId = (await add1.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/points",
            new { pointReasonId = 1, count = 2 });

        // Delete the first entry
        var delResp = await client.DeleteAsync($"/api/usermatches/{umId}/points/{pointId}");
        delResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // Remaining: count=2 negative
        var getResp = await client.GetAsync($"/api/usermatches/{umId}");
        var um = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        um.GetProperty("totalMinus").GetInt32().Should().Be(2);
    }

    // ─── UserMatchGoal — Season validation ────────────────────────────────────

    [Fact]
    public async Task AddGoal_with_player_from_correct_season_returns_201()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM Goal Correct");
        var userId = await CreateUserAsync(client, "Goal Player Correct");
        await AssignUserToSeasonAsync(client, seasonId, userId);
        var matchId = await CreateMatchAsync(client, seasonId);
        var playerId = await CreateRosterPlayerAsync(client, seasonId);

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        var umId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var addResp = await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/goals",
            new { rosterPlayerId = playerId, count = 2 });

        addResp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await addResp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("rosterPlayerId").GetInt32().Should().Be(playerId);
        body.GetProperty("count").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task AddGoal_with_player_from_wrong_season_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var season1 = await CreateSeasonAsync(client, "UM Goal Season 1");
        var season2 = await CreateSeasonAsync(client, "UM Goal Season 2");
        var userId = await CreateUserAsync(client, "Goal Wrong Season Player");
        await AssignUserToSeasonAsync(client, season1, userId);
        var matchId = await CreateMatchAsync(client, season1);
        var playerInSeason2 = await CreateRosterPlayerAsync(client, season2); // belongs to season2!

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{season1}/matches/{matchId}/usermatches",
            new { userId });
        var umId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var addResp = await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/goals",
            new { rosterPlayerId = playerInSeason2, count = 1 });

        addResp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    // ─── UserMatchPenalty — Season validation ─────────────────────────────────

    [Fact]
    public async Task AddPenalty_with_player_from_correct_season_returns_201()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM Penalty Correct");
        var userId = await CreateUserAsync(client, "Penalty Player");
        await AssignUserToSeasonAsync(client, seasonId, userId);
        var matchId = await CreateMatchAsync(client, seasonId);
        var playerId = await CreateRosterPlayerAsync(client, seasonId);

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        var umId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var addResp = await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/penalties",
            new { rosterPlayerId = playerId, count = 1 });

        addResp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await addResp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("rosterPlayerId").GetInt32().Should().Be(playerId);
    }

    // ─── Delete UserMatch ─────────────────────────────────────────────────────

    [Fact]
    public async Task DeleteUserMatch_returns_204()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM Delete");
        var userId = await CreateUserAsync(client, "Delete UM Player");
        await AssignUserToSeasonAsync(client, seasonId, userId);
        var matchId = await CreateMatchAsync(client, seasonId);

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        var umId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var delResp = await client.DeleteAsync($"/api/usermatches/{umId}");
        delResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await client.GetAsync($"/api/usermatches/{umId}");
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ─── Points — GET list ────────────────────────────────────────────────────

    [Fact]
    public async Task GetPoints_returns_200_array()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "UM GetPoints");
        var userId = await CreateUserAsync(client, "GetPoints Player");
        await AssignUserToSeasonAsync(client, seasonId, userId);
        var matchId = await CreateMatchAsync(client, seasonId);

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        var umId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var resp = await client.GetAsync($"/api/usermatches/{umId}/points");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
    }
}
