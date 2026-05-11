using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class PointsManagementTests : ApiTestBase
{
    public PointsManagementTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private async Task<int> CreateSeasonAsync(HttpClient client, string name)
    {
        var resp = await client.PostAsJsonAsync("/api/seasons", new { name, startedOn = "2024-01-01T00:00:00" });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task<int> CreateUserAsync(HttpClient client, string name)
    {
        var resp = await client.PostAsJsonAsync("/api/users", new { name });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task<int> CreateUserMatchAsync(HttpClient client, int seasonId, int matchId, int userId)
    {
        var resp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task<int> CreateMatchAsync(HttpClient client, int seasonId)
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new { homeTeamId = 1, awayTeamId = 2 });
        resp.EnsureSuccessStatusCode();
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task AddPointAsync(HttpClient client, int userMatchId, int pointReasonId = 9, int count = 1)
    {
        var resp = await client.PostAsJsonAsync($"/api/usermatches/{userMatchId}/points",
            new { pointReasonId, count });
        resp.EnsureSuccessStatusCode();
    }

    // ─── GET /api/admin/points ─────────────────────────────────────────────────

    [Fact]
    public async Task GetPoints_requires_admin_auth()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/admin/points");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetPoints_userId_filter_returns_only_that_users_points()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "PM userId filter");
        var userAId = await CreateUserAsync(client, "PM User A");
        var userBId = await CreateUserAsync(client, "PM User B");

        await client.PostAsync($"/api/seasons/{seasonId}/users/{userAId}", null);
        await client.PostAsync($"/api/seasons/{seasonId}/users/{userBId}", null);

        var matchId = await CreateMatchAsync(client, seasonId);
        var umA = await CreateUserMatchAsync(client, seasonId, matchId, userAId);
        var umB = await CreateUserMatchAsync(client, seasonId, matchId, userBId);

        await AddPointAsync(client, umA);
        await AddPointAsync(client, umB);

        var resp = await client.GetAsync($"/api/admin/points?userId={userAId}&seasonId={seasonId}");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var items = body.GetProperty("items");
        items.GetArrayLength().Should().Be(1);
        items[0].GetProperty("userName").GetString().Should().Be("PM User A");
    }

    [Fact]
    public async Task GetPoints_seasonId_filter_excludes_other_seasons()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonA = await CreateSeasonAsync(client, "PM Season A");
        var seasonB = await CreateSeasonAsync(client, "PM Season B");
        var userId = await CreateUserAsync(client, "PM Season Filter User");

        await client.PostAsync($"/api/seasons/{seasonA}/users/{userId}", null);
        await client.PostAsync($"/api/seasons/{seasonB}/users/{userId}", null);

        var matchA = await CreateMatchAsync(client, seasonA);
        var matchB = await CreateMatchAsync(client, seasonB);
        var umA = await CreateUserMatchAsync(client, seasonA, matchA, userId);
        var umB = await CreateUserMatchAsync(client, seasonB, matchB, userId);

        await AddPointAsync(client, umA);
        await AddPointAsync(client, umB);

        var resp = await client.GetAsync($"/api/admin/points?seasonId={seasonA}");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        var items = body.GetProperty("items");
        items.EnumerateArray().Should().OnlyContain(i =>
            i.GetProperty("seasonName").GetString() == "PM Season A");
    }
}
