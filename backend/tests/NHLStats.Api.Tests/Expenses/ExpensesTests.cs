using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class ExpensesTests : ApiTestBase
{
    public ExpensesTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ── GET /api/expenses ───────────────────────────────────────────────────

    [Fact]
    public async Task GetAll_returns_200_and_array()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/expenses");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
    }

    // ── POST /api/expenses ──────────────────────────────────────────────────

    [Fact]
    public async Task Create_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/expenses", new
        {
            description = "Pizza",
            amount = 20.00,
            date = "2024-01-01T00:00:00"
        });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_returns_201_with_expense()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/expenses", new
        {
            description = "Drinks",
            amount = 35.50,
            date = "2024-01-10T00:00:00"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("description").GetString().Should().Be("Drinks");
        body.GetProperty("amount").GetDecimal().Should().Be(35.50m);
        body.GetProperty("id").GetInt32().Should().BePositive();
    }

    // ── GET /api/expenses/{id} ──────────────────────────────────────────────

    [Fact]
    public async Task GetById_returns_200()
    {
        var client = await CreateAuthenticatedClientAsync();
        var createResp = await client.PostAsJsonAsync("/api/expenses", new
        {
            description = "Food",
            amount = 15.00,
            date = "2024-01-20T00:00:00"
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var resp = await client.GetAsync($"/api/expenses/{id}");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("id").GetInt32().Should().Be(id);
    }

    [Fact]
    public async Task GetById_unknown_returns_404()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/expenses/99999");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── PUT /api/expenses/{id} ──────────────────────────────────────────────

    [Fact]
    public async Task Update_returns_200_with_updated_expense()
    {
        var client = await CreateAuthenticatedClientAsync();
        var createResp = await client.PostAsJsonAsync("/api/expenses", new
        {
            description = "Before",
            amount = 10.00,
            date = "2024-01-25T00:00:00"
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/expenses/{id}", new
        {
            description = "After",
            amount = 99.99,
            date = "2024-01-26T00:00:00"
        });
        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("description").GetString().Should().Be("After");
        updated.GetProperty("amount").GetDecimal().Should().Be(99.99m);
    }

    // ── DELETE /api/expenses/{id} ───────────────────────────────────────────

    [Fact]
    public async Task Delete_returns_204()
    {
        var client = await CreateAuthenticatedClientAsync();
        var createResp = await client.PostAsJsonAsync("/api/expenses", new
        {
            description = "ToDelete",
            amount = 5.00,
            date = "2024-01-30T00:00:00"
        });
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var id = created.GetProperty("id").GetInt32();

        var deleteResp = await client.DeleteAsync($"/api/expenses/{id}");
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await client.GetAsync($"/api/expenses/{id}");
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Delete_unknown_returns_404()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.DeleteAsync("/api/expenses/99999");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
