using System.Net;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;

namespace NHLStats.Api.Tests.TeamStats;

public class TeamStatsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public TeamStatsTests(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetHostedTeams_IsPubliclyAccessible()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/team-stats/hosted-teams");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetOpponents_IsPubliclyAccessible()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/team-stats/opponents?hostedTeamId=1");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetSummary_IsPubliclyAccessible()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/team-stats/summary?hostedTeamId=1&opponentTeamId=2");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task GetMatches_IsPubliclyAccessible()
    {
        var client = _factory.CreateClient();
        var resp = await client.GetAsync("/api/team-stats/matches?hostedTeamId=1&opponentTeamId=2");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
