using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class MoneyConfigTests : ApiTestBase
{
    public MoneyConfigTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ── GET /api/moneyconfig/current ────────────────────────────────────────

    [Fact]
    public async Task GetCurrent_returns_200_with_a_valid_config()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/moneyconfig/current");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        // Just verify the response has the expected fields with valid values
        body.GetProperty("id").GetInt32().Should().BePositive();
        body.GetProperty("negativePointValue").GetDecimal().Should().NotBe(0);
        body.GetProperty("effectiveFrom").GetString().Should().NotBeNullOrEmpty();
    }

    // ── GET /api/moneyconfig/history ────────────────────────────────────────

    [Fact]
    public async Task GetHistory_returns_200_with_array_including_seed()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/moneyconfig/history");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().BeGreaterThanOrEqualTo(1);

        // The seeded config with -0.50 / +0.25 must appear somewhere in history
        var configs = Enumerable.Range(0, body.GetArrayLength()).Select(i => body[i]);
        configs.Should().Contain(c =>
            c.GetProperty("negativePointValue").GetDecimal() == -0.50m &&
            c.GetProperty("positivePointValue").GetDecimal() == 0.25m);
    }

    // ── POST /api/moneyconfig ───────────────────────────────────────────────

    [Fact]
    public async Task Create_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/moneyconfig", new
        {
            negativePointValue = -1.00,
            positivePointValue = 0.50,
            effectiveFrom = "2030-01-01T00:00:00"
        });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Create_with_future_date_returns_201()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.PostAsJsonAsync("/api/moneyconfig", new
        {
            negativePointValue = -1.00,
            positivePointValue = 0.50,
            effectiveFrom = "2035-01-01T00:00:00"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
    }

    [Fact]
    public async Task Create_with_date_not_after_latest_returns_422()
    {
        var client = await CreateAuthenticatedClientAsync();

        // Use a date far in the past — before the seed date of 2000-01-01
        var resp = await client.PostAsJsonAsync("/api/moneyconfig", new
        {
            negativePointValue = -0.10m,
            positivePointValue = 0.10m,
            effectiveFrom = "1999-01-01T00:00:00"
        });

        resp.StatusCode.Should().Be(HttpStatusCode.UnprocessableEntity);
    }
}
