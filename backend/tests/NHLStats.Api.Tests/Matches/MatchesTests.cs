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

    // ── POST /api/seasons/{seasonId}/matches ────────────────────────────────

    [Fact]
    public async Task Create_match_returns_201()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Create Season");

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 3,
            awayScore = 2,
            matchDate = "2024-01-10T20:00:00"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("seasonId").GetInt32().Should().Be(seasonId);
        body.GetProperty("homeTeamId").GetInt32().Should().Be(1);
        body.GetProperty("awayTeamId").GetInt32().Should().Be(2);
        body.GetProperty("homeScore").GetInt32().Should().Be(3);
        body.GetProperty("awayScore").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task Create_match_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/seasons/1/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = "2024-01-10T20:00:00"
        });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── PUT /api/seasons/{seasonId}/matches/{id} ────────────────────────────

    [Fact]
    public async Task Update_match_returns_200()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Update Season");

        var createResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = "2024-01-15T20:00:00"
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var matchId = created.GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 3,
            awayTeamId = 4,
            homeScore = 5,
            awayScore = 1,
            matchDate = "2024-01-15T20:00:00"
        });
        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("homeScore").GetInt32().Should().Be(5);
        updated.GetProperty("homeTeamId").GetInt32().Should().Be(3);
    }

    // ── DELETE /api/seasons/{seasonId}/matches/{id} ─────────────────────────

    [Fact]
    public async Task Delete_match_returns_204()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Delete Season");

        var createResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = "2024-01-20T20:00:00"
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
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

        await client.PostAsJsonAsync($"/api/seasons/{season1Id}/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 1,
            awayScore = 0,
            matchDate = "2024-02-01T20:00:00"
        });

        var resp = await client.GetAsync($"/api/seasons/{season2Id}/matches");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(0);
    }
}
