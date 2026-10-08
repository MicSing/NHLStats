using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class PositionWheelTests : ApiTestBase
{
    public PositionWheelTests(CustomWebApplicationFactory factory) : base(factory) { }

    private static async Task<int> CreateSeasonWithUsersAsync(HttpClient client, params string[] names)
    {
        var seasonResp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = $"Wheel Season {Guid.NewGuid():N}",
            startedOn = "2030-07-01T00:00:00"
        });
        seasonResp.EnsureSuccessStatusCode();
        var seasonId = (await seasonResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        foreach (var name in names)
        {
            var userResp = await client.PostAsJsonAsync("/api/users", new { name });
            userResp.EnsureSuccessStatusCode();
            var userId = (await userResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
            (await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null)).EnsureSuccessStatusCode();
        }

        return seasonId;
    }

    [Fact]
    public async Task GetWheel_WithoutAuth_ReturnsUnauthorized()
    {
        var resp = await Factory.CreateClient().GetAsync("/api/seasons/1/position-wheel");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetWheel_UnknownSeason_ReturnsNotFound()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.GetAsync("/api/seasons/99999/position-wheel");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SpinUntilDone_ThenConflict_ThenReset()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonWithUsersAsync(client, "WheelA", "WheelB");

        var stateResp = await client.GetAsync($"/api/seasons/{seasonId}/position-wheel");
        stateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var state = await stateResp.Content.ReadFromJsonAsync<JsonElement>();
        state.GetProperty("order").GetArrayLength().Should().Be(2);
        state.GetProperty("availablePositions").GetArrayLength().Should().Be(5);
        var firstSpinner = state.GetProperty("currentSpinnerUserId").GetInt32();

        var spin1 = await client.PostAsync($"/api/seasons/{seasonId}/position-wheel/spin", null);
        spin1.StatusCode.Should().Be(HttpStatusCode.OK);
        var result1 = await spin1.Content.ReadFromJsonAsync<JsonElement>();
        result1.GetProperty("userId").GetInt32().Should().Be(firstSpinner);
        result1.GetProperty("state").GetProperty("availablePositions").GetArrayLength().Should().Be(4);

        (await client.PostAsync($"/api/seasons/{seasonId}/position-wheel/spin", null))
            .StatusCode.Should().Be(HttpStatusCode.OK);
        (await client.PostAsync($"/api/seasons/{seasonId}/position-wheel/spin", null))
            .StatusCode.Should().Be(HttpStatusCode.Conflict);

        var reset = await client.PostAsync($"/api/seasons/{seasonId}/position-wheel/reset", null);
        reset.StatusCode.Should().Be(HttpStatusCode.OK);
        var resetState = await reset.Content.ReadFromJsonAsync<JsonElement>();
        resetState.GetProperty("availablePositions").GetArrayLength().Should().Be(5);
        resetState.GetProperty("currentSpinnerUserId").GetInt32().Should().Be(firstSpinner);
    }
}
