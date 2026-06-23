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
            startedOn = "2024-01-01T00:00:00",
            hostedTeamId = 1
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
            var createUserResp = await client.PostAsJsonAsync("/api/users", new { name = "Test Admin User" });
            createUserResp.EnsureSuccessStatusCode();
            var createdUser = await createUserResp.Content.ReadFromJsonAsync<JsonElement>();
            userId = createdUser.GetProperty("id").GetInt32();

            var attachResp = await client.PutAsJsonAsync($"/api/auth/users/{loginId}/attach-user", new { userId });
            attachResp.EnsureSuccessStatusCode();
        }

        var addUserResp = await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        if (!addUserResp.IsSuccessStatusCode && addUserResp.StatusCode != HttpStatusCode.Conflict)
            addUserResp.EnsureSuccessStatusCode();

        var completedMatchResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new { homeTeamId = 3, awayTeamId = 4 });
        completedMatchResp.EnsureSuccessStatusCode();
        var completedMatch = await completedMatchResp.Content.ReadFromJsonAsync<JsonElement>();
        var completedMatchId = completedMatch.GetProperty("id").GetInt32();

        await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}", new
        {
            homeTeamId = 3,
            awayTeamId = 4,
            homeScore = 0,
            awayScore = 0,
            matchDate = (string?)null,
            completionType = 4 // InProgress
        });

        await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}", new
        {
            homeTeamId = 3,
            awayTeamId = 4,
            homeScore = 2,
            awayScore = 1,
            matchDate = DateTime.UtcNow.AddDays(-1).ToString("O"),
            completionType = 1
        });

        await client.PostAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}/usermatches/initialize", null);

        var umResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}/usermatches");
        if (!umResp.IsSuccessStatusCode) return userId;
        var ums = await umResp.Content.ReadFromJsonAsync<JsonElement>();
        if (ums.GetArrayLength() == 0) return userId;

        var userMatchId = ums[0].GetProperty("id").GetInt32();

        var pointResp = await client.PostAsJsonAsync($"/api/usermatches/{userMatchId}/points", new { pointReasonId = 9, count = 8 });
        pointResp.EnsureSuccessStatusCode();

        return userId;
    }

    [Fact]
    public async Task Place_single_leg_ticket_returns_201_with_short_id_and_one_leg()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Create Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[]
            {
                new { matchId, betType = "TeamWin", teamId = 1 }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("stake").GetDecimal().Should().Be(1.0m);
        body.GetProperty("status").GetString().Should().Be("Pending");
        body.GetProperty("shortId").GetString().Should().StartWith("B-");
        body.GetProperty("legs").GetArrayLength().Should().Be(1);
        body.GetProperty("legs")[0].GetProperty("matchId").GetInt32().Should().Be(matchId);
    }

    [Fact]
    public async Task Place_two_leg_combo_multiplies_odds()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Combo Season");
        // Both matches host team 1 (the season's hosted team) so TeamWin legs on team 1 validate.
        var match1 = await CreateFutureMatchAsync(client, seasonId);
        var match2 = await CreateFutureMatchAsync(client, seasonId, homeTeamId: 1, awayTeamId: 7);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[]
            {
                new { matchId = match1, betType = "TeamWin", teamId = 1 },
                new { matchId = match2, betType = "TeamWin", teamId = 1 }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("legs").GetArrayLength().Should().Be(2);
        var totalOdds = body.GetProperty("totalOdds").GetDecimal();
        var leg0Odds = body.GetProperty("legs")[0].GetProperty("odds").GetDecimal();
        var leg1Odds = body.GetProperty("legs")[1].GetProperty("odds").GetDecimal();
        totalOdds.Should().BeApproximately(leg0Odds * leg1Odds, 0.0001m);
    }

    [Fact]
    public async Task Cancel_bet_returns_204_and_removes_ticket()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Cancel Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var createResp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[] { new { matchId, betType = "TeamWin", teamId = 1 } }
        });
        createResp.EnsureSuccessStatusCode();
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var betId = created.GetProperty("id").GetString();

        var cancelResp = await client.DeleteAsync($"/api/betting/bets/{betId}");
        cancelResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var activeResp = await client.GetAsync("/api/betting/bets/active");
        activeResp.EnsureSuccessStatusCode();
        var active = await activeResp.Content.ReadFromJsonAsync<JsonElement>();
        active.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task Active_endpoint_lists_only_pending_tickets()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Active List Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var beforeResp = await client.GetAsync("/api/betting/bets/active");
        beforeResp.EnsureSuccessStatusCode();
        var beforeCount = (await beforeResp.Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength();

        await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[] { new { matchId, betType = "TeamWin", teamId = 1 } }
        });

        var resp = await client.GetAsync("/api/betting/bets/active");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(beforeCount + 1);
        foreach (var ticket in body.EnumerateArray())
        {
            ticket.GetProperty("status").GetString().Should().Be("Pending");
        }
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
        var resp = await client.GetAsync("/api/betting/bets/history");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Get_betting_balance_includes_aggregated_positive_points()
    {
        var client = await CreateAuthenticatedClientAsync();

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

        var before = await client.GetAsync("/api/betting/balance");
        before.EnsureSuccessStatusCode();
        var beforeBody = await before.Content.ReadFromJsonAsync<JsonElement>();
        var balanceBefore = beforeBody.GetProperty("availableBalance").GetDecimal();
        var positiveCashBefore = beforeBody.GetProperty("totalPositiveCash").GetDecimal();

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
