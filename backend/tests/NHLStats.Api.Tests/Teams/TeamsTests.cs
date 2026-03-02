using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class TeamsTests : ApiTestBase
{
    public TeamsTests(CustomWebApplicationFactory factory) : base(factory) { }

    [Fact]
    public async Task GetAll_returns_200_with_32_teams()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/teams");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var teams = await resp.Content.ReadFromJsonAsync<JsonElement>();
        teams.ValueKind.Should().Be(JsonValueKind.Array);
        teams.GetArrayLength().Should().Be(32);
    }

    [Fact]
    public async Task GetById_known_team_returns_200()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/teams/1");

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var team = await resp.Content.ReadFromJsonAsync<JsonElement>();
        team.GetProperty("id").GetInt32().Should().Be(1);
        team.GetProperty("name").GetString().Should().NotBeNullOrEmpty();
        team.GetProperty("shortName").GetString().Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task GetById_unknown_returns_404()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/teams/99999");
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
