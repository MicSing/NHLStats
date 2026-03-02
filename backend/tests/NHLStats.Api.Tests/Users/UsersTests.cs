using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class UsersTests : ApiTestBase
{
    public UsersTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ── GET /api/users ──────────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_returns_200_and_array()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/users");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
    }

    // ── GET /api/users/{id} ─────────────────────────────────────────────────

    [Fact]
    public async Task GetById_unknown_returns_404()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/users/99999");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── POST /api/users ─────────────────────────────────────────────────────

    [Fact]
    public async Task Create_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/users", new { name = "Alice" });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_returns_201_with_user()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/users", new { name = "Bob" });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("name").GetString().Should().Be("Bob");
        body.GetProperty("isActive").GetBoolean().Should().BeTrue();
        body.GetProperty("id").GetInt32().Should().BePositive();
    }

    // ── PUT /api/users/{id} ─────────────────────────────────────────────────

    [Fact]
    public async Task Update_returns_200_with_updated_user()
    {
        var client = await CreateAuthenticatedClientAsync();

        // Create a user first
        var createResp = await client.PostAsJsonAsync("/api/users", new { name = "UpdateMe" });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        // Update
        var updateResp = await client.PutAsJsonAsync($"/api/users/{id}", new { name = "Updated", isActive = false });
        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("name").GetString().Should().Be("Updated");
        updated.GetProperty("isActive").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Update_unknown_returns_404()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.PutAsJsonAsync("/api/users/99999", new { name = "X", isActive = true });
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── DELETE /api/users/{id} ──────────────────────────────────────────────

    [Fact]
    public async Task Deactivate_returns_204_and_user_becomes_inactive()
    {
        var client = await CreateAuthenticatedClientAsync();

        var createResp = await client.PostAsJsonAsync("/api/users", new { name = "ToDeactivate" });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var deleteResp = await client.DeleteAsync($"/api/users/{id}");
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await client.GetAsync($"/api/users/{id}");
        getResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var user = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        user.GetProperty("isActive").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task Deactivate_unknown_returns_404()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.DeleteAsync("/api/users/99999");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
