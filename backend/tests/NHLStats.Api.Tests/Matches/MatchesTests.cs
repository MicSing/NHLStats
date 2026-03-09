using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class MatchesTests : ApiTestBase
{
    public MatchesTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<int> CreateSeasonAsync(HttpClient client, string name = "Match Test Season")
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

    private async Task<JsonElement> CreateMatchAsync(HttpClient client, int seasonId, int homeTeamId = 1, int awayTeamId = 2)
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId,
            awayTeamId
        });
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<JsonElement>();
    }

    // ── GET /api/seasons/{seasonId}/matches ─────────────────────────────────

    [Fact]
    public async Task GetBySeason_returns_200_and_array()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "MatchGet Season");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/matches");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
    }

    // ── GET /api/matches/future ─────────────────────────────────────────────

    [Fact]
    public async Task GetFuture_returns_default_10_matches_when_more_are_available()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Future Limit Season");

        for (var i = 0; i < 12; i++)
        {
            var created = await CreateMatchAsync(client, seasonId, 1, 2);
            var matchId = created.GetProperty("id").GetInt32();

            var futureDate = DateTime.UtcNow.AddDays(i + 1).ToString("O");
            var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
            {
                homeTeamId = 1,
                awayTeamId = 2,
                homeScore = 0,
                awayScore = 0,
                matchDate = futureDate,
                completionType = 0
            });
            updateResp.EnsureSuccessStatusCode();
        }

        var resp = await client.GetAsync("/api/matches/future");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(10);
    }

    [Fact]
    public async Task GetFuture_returns_all_available_when_less_than_requested()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Future Available Season");

        for (var i = 0; i < 3; i++)
        {
            var created = await CreateMatchAsync(client, seasonId, 1, 2);
            var matchId = created.GetProperty("id").GetInt32();

            var futureDate = DateTime.UtcNow.AddDays(i + 1).ToString("O");
            var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
            {
                homeTeamId = 1,
                awayTeamId = 2,
                homeScore = 0,
                awayScore = 0,
                matchDate = futureDate,
                completionType = 0
            });
            updateResp.EnsureSuccessStatusCode();
        }

        var resp = await client.GetAsync("/api/matches/future?count=10");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(3);
    }

    [Fact]
    public async Task GetFuture_includes_only_logged_in_user_bet_for_match()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Future Bet Payload Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var futureDate = DateTime.UtcNow.AddDays(1).ToString("O");
        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = futureDate,
            completionType = 0
        });
        updateResp.EnsureSuccessStatusCode();

        var betResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}/bet", new
        {
            betType = 1,
            teamId = 1
        });
        betResp.EnsureSuccessStatusCode();

        var resp = await client.GetAsync("/api/matches/future?count=10");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);

        var target = body.EnumerateArray().First(m => m.GetProperty("id").GetInt32() == matchId);
        target.GetProperty("bet").ValueKind.Should().Be(JsonValueKind.Object);
        target.GetProperty("bet").GetProperty("betType").GetString().Should().Be("TeamWin");
        target.GetProperty("bet").GetProperty("teamId").GetInt32().Should().Be(1);
    }

    // ── POST /api/seasons/{seasonId}/matches ────────────────────────────────

    [Fact]
    public async Task Create_match_returns_201_with_auto_match_number_and_null_date()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Create Season");

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("seasonId").GetInt32().Should().Be(seasonId);
        body.GetProperty("homeTeamId").GetInt32().Should().Be(1);
        body.GetProperty("awayTeamId").GetInt32().Should().Be(2);
        body.GetProperty("homeScore").GetInt32().Should().Be(0);
        body.GetProperty("awayScore").GetInt32().Should().Be(0);
        body.GetProperty("matchNumber").GetInt32().Should().Be(1);
        body.GetProperty("matchDate").ValueKind.Should().Be(JsonValueKind.Null);
        body.GetProperty("completionType").GetString().Should().Be("None");
    }

    [Fact]
    public async Task Create_match_auto_increments_match_number()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Number Season");

        var first = await CreateMatchAsync(client, seasonId, 1, 2);
        var second = await CreateMatchAsync(client, seasonId, 3, 4);

        first.GetProperty("matchNumber").GetInt32().Should().Be(1);
        second.GetProperty("matchNumber").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task Create_match_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/seasons/1/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2
        });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── PUT /api/seasons/{seasonId}/matches/{id} ────────────────────────────

    [Fact]
    public async Task Update_match_sets_completion_type_and_date()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Update Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 3,
            awayTeamId = 4,
            homeScore = 5,
            awayScore = 1,
            matchDate = "2024-01-15T20:00:00",
            completionType = 2  // Overtime
        });
        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("homeScore").GetInt32().Should().Be(5);
        updated.GetProperty("homeTeamId").GetInt32().Should().Be(3);
        updated.GetProperty("completionType").GetString().Should().Be("Overtime");
        updated.GetProperty("matchDate").ValueKind.Should().NotBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task Update_match_with_none_completion_type_forces_null_date()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match None Completion Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = "2026-03-09T20:00:00",
            completionType = 0 // None / Not Played
        });

        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("completionType").GetString().Should().Be("None");
        updated.GetProperty("matchDate").ValueKind.Should().Be(JsonValueKind.Null);
    }

    // ── DELETE /api/seasons/{seasonId}/matches/{id} ─────────────────────────

    [Fact]
    public async Task Delete_match_returns_204()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Delete Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var deleteResp = await client.DeleteAsync($"/api/seasons/{seasonId}/matches/{matchId}");
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{matchId}");
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Filter by season ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetBySeason_only_returns_matches_for_that_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var season1Id = await CreateSeasonAsync(client, "Season A");
        var season2Id = await CreateSeasonAsync(client, "Season B");

        await CreateMatchAsync(client, season1Id, 1, 2);

        var resp = await client.GetAsync($"/api/seasons/{season2Id}/matches");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(0);
    }

    // ── Batch create ─────────────────────────────────────────────────────────

    [Fact]
    public async Task BatchCreate_assigns_sequential_match_numbers()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Batch Season");

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/batch", new[]
        {
            new { homeTeamId = 1, awayTeamId = 2 },
            new { homeTeamId = 3, awayTeamId = 4 },
            new { homeTeamId = 5, awayTeamId = 6 },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(3);
        body[0].GetProperty("matchNumber").GetInt32().Should().Be(1);
        body[1].GetProperty("matchNumber").GetInt32().Should().Be(2);
        body[2].GetProperty("matchNumber").GetInt32().Should().Be(3);
    }

    [Fact]
    public async Task BatchCreate_rolls_back_entirely_on_invalid_team_id()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Batch Rollback Season");

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/batch", new[]
        {
            new { homeTeamId = 1, awayTeamId = 2 },
            new { homeTeamId = 99999, awayTeamId = 2 },  // invalid team
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Nothing should have been persisted
        var getResp = await client.GetAsync($"/api/seasons/{seasonId}/matches");
        var matches = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        matches.GetArrayLength().Should().Be(0);
    }
}
