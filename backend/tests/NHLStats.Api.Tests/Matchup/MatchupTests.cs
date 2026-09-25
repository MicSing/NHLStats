using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class MatchupTests : ApiTestBase
{
    public MatchupTests(CustomWebApplicationFactory factory) : base(factory) { }

    private static async Task<int> CreateSeasonAsync(HttpClient client, string name)
    {
        var resp = await client.PostAsJsonAsync("/api/seasons", new { name, startedOn = "2024-01-01T00:00:00", hostedTeamId = 1 });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private static async Task<int> CreateMatchAsync(HttpClient client, int seasonId, int homeTeamId, int awayTeamId)
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new { homeTeamId, awayTeamId });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    [Fact]
    public async Task Get_returns_404_for_unknown_match()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/matches/999999/matchup");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Get_is_public_and_returns_previous_results_of_the_pair()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(admin, "Matchup Season");

        var finishedId = await CreateMatchAsync(admin, seasonId, 2, 1);
        await admin.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{finishedId}", new
        {
            homeTeamId = 2, awayTeamId = 1, homeScore = 0, awayScore = 0, matchDate = (string?)null, completionType = 4 // InProgress
        });
        var completeResp =await admin.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{finishedId}", new
        {
            homeTeamId = 2, awayTeamId = 1, homeScore = 1, awayScore = 4,
            matchDate = DateTime.UtcNow.AddDays(-1).ToString("O"), completionType = 1
        });
        completeResp.EnsureSuccessStatusCode();
        var upcomingId = await CreateMatchAsync(admin, seasonId, 1, 2);

        var resp = await Factory.CreateClient().GetAsync($"/api/matches/{upcomingId}/matchup");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("matchesPlayed").GetInt32().Should().Be(1);
        var last = body.GetProperty("lastMatches")[0];
        last.GetProperty("id").GetInt32().Should().Be(finishedId);
        last.GetProperty("homeScore").GetInt32().Should().Be(1);
        last.GetProperty("awayScore").GetInt32().Should().Be(4);
        body.GetProperty("topScorers").GetArrayLength().Should().Be(0);
    }
}
