using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Tests;

public class SeasonEventBroadcastTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly CustomWebApplicationFactory _factory;

    public SeasonEventBroadcastTests(CustomWebApplicationFactory factory) => _factory = factory;

    private sealed class RecordingBroadcaster : ISeasonEventBroadcaster
    {
        public ConcurrentBag<SeasonEventNotificationDto> Events { get; } = new();
        public Task BroadcastEventAsync(SeasonEventNotificationDto evt, CancellationToken ct = default)
        {
            Events.Add(evt);
            return Task.CompletedTask;
        }
    }

    private WebApplicationFactory<Program> CreateFactoryWith(RecordingBroadcaster recorder) =>
        _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                var descriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(ISeasonEventBroadcaster));
                if (descriptor != null) services.Remove(descriptor);
                services.AddSingleton<ISeasonEventBroadcaster>(recorder);
            });
        });

    private async Task<HttpClient> AuthClient(WebApplicationFactory<Program> factory)
    {
        var client = factory.CreateClient();
        var loginResp = await client.PostAsJsonAsync("/api/auth/login", new
        {
            email = "testadmin@nhlstats.test",
            password = "TestP@ssw0rd!"
        });
        loginResp.EnsureSuccessStatusCode();
        var body = await loginResp.Content.ReadFromJsonAsync<JsonElement>();
        var token = body.GetProperty("token").GetString()!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<(int seasonId, int matchId, int userMatchId, int rosterPlayerId)> SeedAsync(HttpClient client, string name)
    {
        var seasonResp = await client.PostAsJsonAsync("/api/seasons", new { name, startedOn = "2024-01-01T00:00:00" });
        seasonResp.EnsureSuccessStatusCode();
        var seasonId = (await seasonResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var userResp = await client.PostAsJsonAsync("/api/users", new { name = $"Player {name}" });
        userResp.EnsureSuccessStatusCode();
        var userId = (await userResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var assignResp = await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        assignResp.EnsureSuccessStatusCode();

        var matchResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches",
            new { homeTeamId = 1, awayTeamId = 2 });
        matchResp.EnsureSuccessStatusCode();
        var matchId = (await matchResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches",
            new { userId });
        umResp.EnsureSuccessStatusCode();
        var umId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var rosterResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/roster",
            new { firstName = "Test", surname = "Player", position = "C", teamId = 1 });
        rosterResp.EnsureSuccessStatusCode();
        var rosterId = (await rosterResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        return (seasonId, matchId, umId, rosterId);
    }

    [Fact]
    public async Task AddPoint_broadcasts_event_with_point_type_subtype()
    {
        var recorder = new RecordingBroadcaster();
        using var factory = CreateFactoryWith(recorder);
        var client = await AuthClient(factory);
        var (seasonId, matchId, umId, _) = await SeedAsync(client, "Broadcast Point");

        var resp = await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/points",
            new { pointReasonId = 1, count = 2 });
        resp.StatusCode.Should().Be(HttpStatusCode.Created);

        recorder.Events.Should().HaveCount(1);
        var evt = recorder.Events.Single();
        evt.SeasonId.Should().Be(seasonId);
        evt.MatchId.Should().Be(matchId);
        evt.UserMatchId.Should().Be(umId);
        evt.EventType.Should().Be("Point");
        evt.EventSubType.Should().BeOneOf("Positive", "Negative", "Neutral");
        evt.Count.Should().Be(2);
        evt.ActorUserId.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task AddGoal_broadcasts_event_with_goal_type_subtype()
    {
        var recorder = new RecordingBroadcaster();
        using var factory = CreateFactoryWith(recorder);
        var client = await AuthClient(factory);
        var (seasonId, matchId, umId, rosterId) = await SeedAsync(client, "Broadcast Goal");

        var resp = await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/goals",
            new { rosterPlayerId = rosterId, count = 1, goalType = "Regular" });
        resp.StatusCode.Should().Be(HttpStatusCode.Created);

        recorder.Events.Should().HaveCount(1);
        var evt = recorder.Events.Single();
        evt.EventType.Should().Be("Goal");
        evt.EventSubType.Should().Be("Regular");
        evt.SeasonId.Should().Be(seasonId);
        evt.MatchId.Should().Be(matchId);
        evt.PlayerName.Should().Contain("Test");
    }

    [Fact]
    public async Task AddPenalty_broadcasts_event()
    {
        var recorder = new RecordingBroadcaster();
        using var factory = CreateFactoryWith(recorder);
        var client = await AuthClient(factory);
        var (_, _, umId, rosterId) = await SeedAsync(client, "Broadcast Penalty");

        var resp = await client.PostAsJsonAsync(
            $"/api/usermatches/{umId}/penalties",
            new { rosterPlayerId = rosterId, count = 1 });
        resp.StatusCode.Should().Be(HttpStatusCode.Created);

        recorder.Events.Should().HaveCount(1);
        var evt = recorder.Events.Single();
        evt.EventType.Should().Be("Penalty");
        evt.EventSubType.Should().Be("Standard");
    }

    [Fact]
    public async Task AddPoint_does_not_broadcast_on_invalid_user_match()
    {
        var recorder = new RecordingBroadcaster();
        using var factory = CreateFactoryWith(recorder);
        var client = await AuthClient(factory);

        var resp = await client.PostAsJsonAsync(
            "/api/usermatches/99999/points",
            new { pointReasonId = 1, count = 1 });
        resp.IsSuccessStatusCode.Should().BeFalse();
        recorder.Events.Should().BeEmpty();
    }
}
