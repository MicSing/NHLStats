using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using NHLStats.Application.DTOs;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Api.Tests;

public class MatchEventsTests : ApiTestBase
{
    public MatchEventsTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<int> CreateSeasonAsync(HttpClient client, string name = "Events Test Season")
    {
        var resp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name,
            startedOn = "2024-01-01T00:00:00",
            hostedTeamId = 1
        });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetInt32();
    }

    private async Task<JsonElement> CreateMatchAsync(HttpClient client, int seasonId, int homeTeamId = 1, int awayTeamId = 2)
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId,
            awayTeamId
        });
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<JsonElement>();
    }

    [Fact]
    public async Task Add_team_goal_and_opponent_goal_increments_scores_and_creates_events()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Events Test Season");

        var matchResp = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = matchResp.GetProperty("id").GetInt32();

        // 1. Add period 1 change
        var p1Resp = await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.PeriodChange,
            IsOpponent: false,
            EventSubtype: "P1"));
        p1Resp.StatusCode.Should().Be(HttpStatusCode.OK);

        // 2. Add team goal (our team - home)
        var goalResp = await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.Goal,
            IsOpponent: false));
        goalResp.StatusCode.Should().Be(HttpStatusCode.OK);

        // 3. Add opponent goal (away)
        var oppGoalResp = await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.Goal,
            IsOpponent: true));
        oppGoalResp.StatusCode.Should().Be(HttpStatusCode.OK);

        // 4. Check events list
        var eventsResp = await client.GetAsync($"/api/matches/{matchId}/events");
        eventsResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var events = await eventsResp.Content.ReadFromJsonAsync<List<MatchEventDto>>();
        events.Should().NotBeNull();
        events!.Count.Should().Be(3);
        events[0].OrderIndex.Should().Be(1);
        events[0].EventType.Should().Be(MatchEventType.PeriodChange);
        events[1].OrderIndex.Should().Be(2);
        events[1].EventType.Should().Be(MatchEventType.Goal);
        events[1].IsOpponent.Should().BeFalse();
        events[2].OrderIndex.Should().Be(3);
        events[2].EventType.Should().Be(MatchEventType.Goal);
        events[2].IsOpponent.Should().BeTrue();

        // 5. Verify match score updated
        var getMatchResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{matchId}");
        var match = await getMatchResp.Content.ReadFromJsonAsync<JsonElement>();
        var homeScore = match.GetProperty("homeScore").GetInt32();
        var awayScore = match.GetProperty("awayScore").GetInt32();
        homeScore.Should().Be(1);
        awayScore.Should().Be(1);
    }

    [Fact]
    public async Task Reorder_events_updates_order_indices()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Reorder Test Season");

        var matchResp = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = matchResp.GetProperty("id").GetInt32();

        var evt1Resp = await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.Goal, IsOpponent: false));
        var evt1 = await evt1Resp.Content.ReadFromJsonAsync<MatchEventDto>();

        var evt2Resp = await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.Penalty, IsOpponent: true));
        var evt2 = await evt2Resp.Content.ReadFromJsonAsync<MatchEventDto>();

        // Reorder: swap evt2 and evt1
        var reorderResp = await client.PutAsJsonAsync($"/api/matches/{matchId}/events/reorder", new ReorderMatchEventsDto(
            new List<int> { evt2!.Id, evt1!.Id }));
        reorderResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var eventsResp = await client.GetAsync($"/api/matches/{matchId}/events");
        var events = await eventsResp.Content.ReadFromJsonAsync<List<MatchEventDto>>();
        events.Should().NotBeNull();
        events![0].Id.Should().Be(evt2.Id);
        events[0].OrderIndex.Should().Be(1);
        events[1].Id.Should().Be(evt1.Id);
        events[1].OrderIndex.Should().Be(2);
    }

    [Fact]
    public async Task End_shootout_awards_winning_goal_and_sets_SO_completion()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Shootout Test Season");

        var matchResp = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = matchResp.GetProperty("id").GetInt32();

        // Add 2 SO goals for our team, 1 for opponent
        await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.ShootoutGoal, IsOpponent: false));
        await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.ShootoutGoal, IsOpponent: false));
        await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.ShootoutGoal, IsOpponent: true));

        // End shootout
        var endResp = await client.PostAsync($"/api/matches/{matchId}/events/end-shootout", null);
        endResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var endedMatch = await endResp.Content.ReadFromJsonAsync<MatchDto>();

        endedMatch.Should().NotBeNull();
        endedMatch!.CompletionType.Should().Be(CompletionType.Shootout);
        (endedMatch.HomeScore + endedMatch.AwayScore).Should().Be(1);
    }

    [Fact]
    public async Task Delete_shootout_match_end_event_reverts_score_to_tie_and_sets_in_progress()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Shootout Revert Season");

        var matchResp = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = matchResp.GetProperty("id").GetInt32();

        // 1. Add regulation goals: 2 for home (our team), 2 for away (opponent)
        await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.Goal, IsOpponent: false));
        await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.Goal, IsOpponent: false));
        await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.Goal, IsOpponent: true));
        await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.Goal, IsOpponent: true));

        // 2. Add SO goals: 2 for our team, 1 for opponent
        await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.ShootoutGoal, IsOpponent: false));
        await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.ShootoutGoal, IsOpponent: false));
        await client.PostAsJsonAsync($"/api/matches/{matchId}/events", new CreateTeamMatchEventDto(
            EventType: MatchEventType.ShootoutGoal, IsOpponent: true));

        // 3. End shootout -> score should become 3:2, completionType Shootout
        var endResp = await client.PostAsync($"/api/matches/{matchId}/events/end-shootout", null);
        endResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var endedMatch = await endResp.Content.ReadFromJsonAsync<MatchDto>();
        endedMatch!.CompletionType.Should().Be(CompletionType.Shootout);
        endedMatch.HomeScore.Should().Be(3);
        endedMatch.AwayScore.Should().Be(2);

        // 4. Retrieve MatchEnd SO event
        var eventsResp = await client.GetAsync($"/api/matches/{matchId}/events");
        var events = await eventsResp.Content.ReadFromJsonAsync<List<MatchEventDto>>();
        var matchEndEvent = events!.FirstOrDefault(e => e.EventType == MatchEventType.MatchEnd && e.EventSubtype == "SO");
        matchEndEvent.Should().NotBeNull();

        // 5. Delete MatchEnd SO event
        var delResp = await client.DeleteAsync($"/api/matches/{matchId}/events/{matchEndEvent!.Id}");
        delResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        // 6. Verify match state reverted to tie (2:2) and InProgress
        var matchCheckResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{matchId}");
        var matchAfterDelete = await matchCheckResp.Content.ReadFromJsonAsync<MatchDto>();
        matchAfterDelete!.HomeScore.Should().Be(2);
        matchAfterDelete.AwayScore.Should().Be(2);
        matchAfterDelete.CompletionType.Should().Be(CompletionType.InProgress);
    }
}

