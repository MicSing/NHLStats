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

    [Fact]
    public async Task Create_bet_returns_201_and_payload()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Create Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}/bet", new
        {
            betType = 1, // TeamWin
            teamId = 1
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("matchId").GetInt32().Should().Be(matchId);
        body.GetProperty("betType").GetString().Should().Be("TeamWin");
        body.GetProperty("teamId").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task Update_bet_returns_200_and_updated_payload()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Update Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);

        var createResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}/bet", new
        {
            betType = 1,
            teamId = 1
        });
        createResp.EnsureSuccessStatusCode();

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}/bet", new
        {
            betType = 1,
            teamId = 2,
            evaluatedOn = "2026-03-09T12:00:00Z"
        });

        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("teamId").GetInt32().Should().Be(2);
        updated.GetProperty("evaluatedOn").ValueKind.Should().NotBe(JsonValueKind.Null);
        updated.GetProperty("updatedOn").ValueKind.Should().NotBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task Delete_bet_by_id_returns_204()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Delete By Id Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);

        var createResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}/bet", new
        {
            betType = 1,
            teamId = 1
        });
        createResp.EnsureSuccessStatusCode();

        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetGuid();

        var deleteResp = await client.DeleteAsync($"/api/bets/{id}");
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{matchId}/bet");
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Cancel_match_bet_returns_204()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Cancel Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);

        var createResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}/bet", new
        {
            betType = 1,
            teamId = 1
        });
        createResp.EnsureSuccessStatusCode();

        var cancelResp = await client.DeleteAsync($"/api/seasons/{seasonId}/matches/{matchId}/bet");
        cancelResp.StatusCode.Should().Be(HttpStatusCode.NoContent);
    }
}
