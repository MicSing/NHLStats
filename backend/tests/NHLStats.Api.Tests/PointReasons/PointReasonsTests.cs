using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class PointReasonsTests : ApiTestBase
{
    public PointReasonsTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ── GET /api/pointreasons ───────────────────────────────────────────────

    [Fact]
    public async Task GetAll_returns_200_with_seeded_reasons()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/pointreasons");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().BeGreaterThanOrEqualTo(8);
    }

    [Fact]
    public async Task GetAll_activeOnly_filters_inactive()
    {
        var client = await CreateAuthenticatedClientAsync();

        // Create a reason then deactivate it
        var createResp = await client.PostAsJsonAsync("/api/pointreasons", new
        {
            name = "InactiveReason",
            isPositive = false
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        await client.PutAsJsonAsync($"/api/pointreasons/{id}", new
        {
            name = "InactiveReason",
            isPositive = false,
            isActive = false
        });

        var allResp = await client.GetAsync("/api/pointreasons");
        var activeResp = await client.GetAsync("/api/pointreasons?activeOnly=true");

        var all = await allResp.Content.ReadFromJsonAsync<JsonElement>();
        var active = await activeResp.Content.ReadFromJsonAsync<JsonElement>();
        active.GetArrayLength().Should().BeLessThan(all.GetArrayLength());
    }

    // ── POST /api/pointreasons ──────────────────────────────────────────────

    [Fact]
    public async Task Create_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/pointreasons", new { name = "Test", isPositive = false });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_returns_201_with_reason()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/pointreasons", new
        {
            name = "My Custom Reason",
            isPositive = true
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("name").GetString().Should().Be("My Custom Reason");
        body.GetProperty("isPositive").GetBoolean().Should().BeTrue();
        body.GetProperty("isActive").GetBoolean().Should().BeTrue();
    }

    // ── PUT /api/pointreasons/{id} ──────────────────────────────────────────

    [Fact]
    public async Task Update_returns_200_with_updated_reason()
    {
        var client = await CreateAuthenticatedClientAsync();
        var createResp = await client.PostAsJsonAsync("/api/pointreasons", new
        {
            name = "Before Update",
            isPositive = false
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/pointreasons/{id}", new
        {
            name = "After Update",
            isPositive = true,
            isActive = true
        });
        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("name").GetString().Should().Be("After Update");
        updated.GetProperty("isPositive").GetBoolean().Should().BeTrue();
    }

    // ── DELETE /api/pointreasons/{id} ───────────────────────────────────────

    [Fact]
    public async Task Delete_reason_not_in_use_returns_204_and_is_removed()
    {
        var client = await CreateAuthenticatedClientAsync();
        var createResp = await client.PostAsJsonAsync("/api/pointreasons", new
        {
            name = "DeleteMe",
            isPositive = false
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var deleteResp = await client.DeleteAsync($"/api/pointreasons/{id}");
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await client.GetAsync($"/api/pointreasons/{id}");
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_unknown_returns_404()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.DeleteAsync("/api/pointreasons/99999");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
