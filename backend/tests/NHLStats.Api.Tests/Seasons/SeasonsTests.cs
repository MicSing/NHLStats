using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class SeasonsTests : ApiTestBase
{
    public SeasonsTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ── GET /api/seasons ────────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_returns_200_and_array()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/seasons");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
    }

    // ── POST /api/seasons ───────────────────────────────────────────────────

    [Fact]
    public async Task Create_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = "Season 1",
            startedOn = "2024-01-01"
        });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_returns_201_with_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = "Season 2024",
            startedOn = "2024-01-15T00:00:00"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("name").GetString().Should().Be("Season 2024");
        body.GetProperty("id").GetInt32().Should().BePositive();
    }

    // ── PUT /api/seasons/{id} ───────────────────────────────────────────────

    [Fact]
    public async Task Update_returns_200_with_updated_season()
    {
        var client = await CreateAuthenticatedClientAsync();

        var createResp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = "Old Name",
            startedOn = "2024-02-01T00:00:00"
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{id}", new
        {
            name = "New Name",
            startedOn = "2024-02-01T00:00:00",
            status = "Active"
        });
        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("name").GetString().Should().Be("New Name");
        updated.GetProperty("status").GetString().Should().Be("Active");
    }

    // ── DELETE /api/seasons/{id} ────────────────────────────────────────────

    [Fact]
    public async Task Delete_returns_204()
    {
        var client = await CreateAuthenticatedClientAsync();

        var createResp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = "To Delete",
            startedOn = "2024-03-01T00:00:00"
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var deleteResp = await client.DeleteAsync($"/api/seasons/{id}");
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await client.GetAsync($"/api/seasons/{id}");
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── User assignment ─────────────────────────────────────────────────────

    [Fact]
    public async Task AssignUser_returns_200_with_season_detail_including_user()
    {
        var client = await CreateAuthenticatedClientAsync();

        // Create a season
        var seasonResp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = "Season With Users",
            startedOn = "2024-04-01T00:00:00"
        });
        var season = await seasonResp.Content.ReadFromJsonAsync<JsonElement>();
        var seasonId = season.GetProperty("id").GetInt32();

        // Create a user
        var userResp = await client.PostAsJsonAsync("/api/users", new { name = "SeasonPlayer" });
        var user = await userResp.Content.ReadFromJsonAsync<JsonElement>();
        var userId = user.GetProperty("id").GetInt32();

        // Assign
        var assignResp = await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        assignResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var detail = await assignResp.Content.ReadFromJsonAsync<JsonElement>();
        var users = detail.GetProperty("users");
        users.GetArrayLength().Should().Be(1);
        users[0].GetProperty("id").GetInt32().Should().Be(userId);
    }

    [Fact]
    public async Task AssignUser_idempotent_does_not_duplicate()
    {
        var client = await CreateAuthenticatedClientAsync();

        var seasonResp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = "Idempotent Season",
            startedOn = "2024-05-01T00:00:00"
        });
        var season = await seasonResp.Content.ReadFromJsonAsync<JsonElement>();
        var seasonId = season.GetProperty("id").GetInt32();

        var userResp = await client.PostAsJsonAsync("/api/users", new { name = "IdempotentUser" });
        var user = await userResp.Content.ReadFromJsonAsync<JsonElement>();
        var userId = user.GetProperty("id").GetInt32();

        await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        var second = await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        second.StatusCode.Should().Be(HttpStatusCode.OK);

        var detail = await second.Content.ReadFromJsonAsync<JsonElement>();
        detail.GetProperty("users").GetArrayLength().Should().Be(1);
    }

    [Fact]
    public async Task RemoveUser_returns_204_and_user_no_longer_in_season()
    {
        var client = await CreateAuthenticatedClientAsync();

        var seasonResp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = "Remove User Season",
            startedOn = "2024-06-01T00:00:00"
        });
        var season = await seasonResp.Content.ReadFromJsonAsync<JsonElement>();
        var seasonId = season.GetProperty("id").GetInt32();

        var userResp = await client.PostAsJsonAsync("/api/users", new { name = "RemovableUser" });
        var user = await userResp.Content.ReadFromJsonAsync<JsonElement>();
        var userId = user.GetProperty("id").GetInt32();

        await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);

        var removeResp = await client.DeleteAsync($"/api/seasons/{seasonId}/users/{userId}");
        removeResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var detail = await client.GetAsync($"/api/seasons/{seasonId}");
        var body = await detail.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("users").GetArrayLength().Should().Be(0);
    }
}
