using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class BetsTests : ApiTestBase
{
    public BetsTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<int> CreateSeasonAsync(HttpClient client, string name = "Bet Test Season")
    {
        var resp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name,
            startedOn = "2024-01-01T00:00:00"
        });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetInt32();
    }

    private async Task<int> CreateFutureMatchAsync(HttpClient client, int seasonId, int homeTeamId = 1, int awayTeamId = 2)
    {
        var createResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId,
            awayTeamId
        });
        createResp.EnsureSuccessStatusCode();

        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var matchId = created.GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId,
            awayTeamId,
            homeScore = 0,
            awayScore = 0,
            matchDate = DateTime.UtcNow.AddDays(1).ToString("O"),
            completionType = 0
        });
        updateResp.EnsureSuccessStatusCode();

        return matchId;
    }

    /// <summary>
    /// Ensures the admin ApplicationUser has a linked User entity and seeds positive points for them.
    /// Returns the linked User id.
    /// </summary>
    private async Task<int> EnsureUserLinkedAndSeedPointsAsync(HttpClient client, int seasonId)
    {
        // Get current admin app user info
        var meResp = await client.GetAsync("/api/auth/me");
        meResp.EnsureSuccessStatusCode();
        var me = await meResp.Content.ReadFromJsonAsync<JsonElement>();
        var loginId = me.GetProperty("id").GetString()!;

        int userId;
        if (me.TryGetProperty("userId", out var userIdProp) && userIdProp.ValueKind != JsonValueKind.Null)
        {
            userId = userIdProp.GetInt32();
        }
        else
        {
            // Create a User entity and attach it to the admin
            var createUserResp = await client.PostAsJsonAsync("/api/users", new { name = "Test Admin User" });
            createUserResp.EnsureSuccessStatusCode();
            var createdUser = await createUserResp.Content.ReadFromJsonAsync<JsonElement>();
            userId = createdUser.GetProperty("id").GetInt32();

            // Attach the User to the admin ApplicationUser
            var attachResp = await client.PutAsJsonAsync($"/api/auth/users/{loginId}/attach-user", new { userId });
            attachResp.EnsureSuccessStatusCode();
        }

        // Add user to season
        var addUserResp = await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        // Ignore conflict (already added) - 409 or 200 both fine
        if (!addUserResp.IsSuccessStatusCode && addUserResp.StatusCode != System.Net.HttpStatusCode.Conflict)
            addUserResp.EnsureSuccessStatusCode();

        // Create a completed match so we can add points
        var completedMatchResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new { homeTeamId = 3, awayTeamId = 4 });
        completedMatchResp.EnsureSuccessStatusCode();
        var completedMatch = await completedMatchResp.Content.ReadFromJsonAsync<JsonElement>();
        var completedMatchId = completedMatch.GetProperty("id").GetInt32();

        await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}", new
        {
            homeTeamId = 3,
            awayTeamId = 4,
            homeScore = 2,
            awayScore = 1,
            matchDate = DateTime.UtcNow.AddDays(-1).ToString("O"),
            completionType = 1
        });

        // Initialize users for the completed match
        await client.PostAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}/usermatches/initialize", null);

        // Get the UserMatch id for this user
        var umResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}/usermatches");
        if (!umResp.IsSuccessStatusCode) return userId;
        var ums = await umResp.Content.ReadFromJsonAsync<JsonElement>();
        if (ums.GetArrayLength() == 0) return userId;

        var userMatchId = ums[0].GetProperty("id").GetInt32();

        // Add a positive point (PointReason 9 = Positive Penalty) - enough for a 1€ bet
        var pointResp = await client.PostAsJsonAsync($"/api/usermatches/{userMatchId}/points", new { pointReasonId = 9, count = 4 });
        pointResp.EnsureSuccessStatusCode();

        return userId;
    }

    [Fact]
    public async Task Create_bet_returns_201_and_payload()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Create Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync($"/api/betting/matches/{matchId}/bet", new
        {
            betType = "TeamWin",
            teamId = 1,
            amount = 1.0
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("matchId").GetInt32().Should().Be(matchId);
        body.GetProperty("betType").GetString().Should().Be("TeamWin");
        body.GetProperty("teamId").GetInt32().Should().Be(1);
        body.GetProperty("status").GetString().Should().Be("Pending");
    }

    [Fact]
    public async Task Update_bet_returns_200_and_updated_payload()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Update Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var createResp = await client.PostAsJsonAsync($"/api/betting/matches/{matchId}/bet", new
        {
            betType = "TeamWin",
            teamId = 1,
            amount = 1.0
        });
        createResp.EnsureSuccessStatusCode();

        var updateResp = await client.PutAsJsonAsync($"/api/betting/matches/{matchId}/bet", new
        {
            betType = "TeamWin",
            teamId = 2,
            amount = 1.0
        });

        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("teamId").GetInt32().Should().Be(2);
        updated.GetProperty("updatedOn").ValueKind.Should().NotBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task Cancel_match_bet_returns_204()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Cancel Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var createResp = await client.PostAsJsonAsync($"/api/betting/matches/{matchId}/bet", new
        {
            betType = "TeamWin",
            teamId = 1,
            amount = 1.0
        });
        createResp.EnsureSuccessStatusCode();

        var cancelResp = await client.DeleteAsync($"/api/betting/matches/{matchId}/bet");
        cancelResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }

    [Fact]
    public async Task Get_betting_balance_returns_200()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.GetAsync("/api/betting/balance");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("availableBalance").GetDecimal().Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task Get_betting_history_returns_200()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.GetAsync("/api/betting/history");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

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
}
