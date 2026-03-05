using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class SeasonUsersTests : ApiTestBase
{
    public SeasonUsersTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ── GET /api/seasons/{id}/users ─────────────────────────────────────────

    [Fact]
    public async Task GetSeasonUsers_ReturnsAssignedUsers()
    {
        var client = await CreateAuthenticatedClientAsync();

        // Create a season
        var seasonResp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = "Users Test Season",
            startedOn = "2024-07-01T00:00:00"
        });
        seasonResp.EnsureSuccessStatusCode();
        var season = await seasonResp.Content.ReadFromJsonAsync<JsonElement>();
        var seasonId = season.GetProperty("id").GetInt32();

        // Create 2 users
        var user1Resp = await client.PostAsJsonAsync("/api/users", new { name = "PlayerAlpha" });
        var user1 = await user1Resp.Content.ReadFromJsonAsync<JsonElement>();
        var userId1 = user1.GetProperty("id").GetInt32();

        var user2Resp = await client.PostAsJsonAsync("/api/users", new { name = "PlayerBeta" });
        var user2 = await user2Resp.Content.ReadFromJsonAsync<JsonElement>();
        var userId2 = user2.GetProperty("id").GetInt32();

        // Assign both users to the season
        await client.PostAsync($"/api/seasons/{seasonId}/users/{userId1}", null);
        await client.PostAsync($"/api/seasons/{seasonId}/users/{userId2}", null);

        // GET /api/seasons/{id}/users (no auth required)
        var anonClient = Factory.CreateClient();
        var resp = await anonClient.GetAsync($"/api/seasons/{seasonId}/users");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(2);

        var ids = Enumerable.Range(0, body.GetArrayLength())
            .Select(i => body[i].GetProperty("id").GetInt32())
            .ToHashSet();
        ids.Should().Contain(userId1);
        ids.Should().Contain(userId2);
    }

    [Fact]
    public async Task GetSeasonUsers_EmptySeason_ReturnsEmptyArray()
    {
        var client = await CreateAuthenticatedClientAsync();

        var seasonResp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = "Empty Users Season",
            startedOn = "2024-08-01T00:00:00"
        });
        seasonResp.EnsureSuccessStatusCode();
        var season = await seasonResp.Content.ReadFromJsonAsync<JsonElement>();
        var seasonId = season.GetProperty("id").GetInt32();

        var anonClient = Factory.CreateClient();
        var resp = await anonClient.GetAsync($"/api/seasons/{seasonId}/users");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task GetSeasonUsers_NonExistentSeason_Returns404()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/seasons/999999/users");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
