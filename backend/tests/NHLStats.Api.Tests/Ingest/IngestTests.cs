using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;

namespace NHLStats.Api.Tests;

public class IngestTests : ApiTestBase
{
    public IngestTests(CustomWebApplicationFactory factory) : base(factory) { }

    // ── helpers ──────────────────────────────────────────────────────────────

    private async Task<(int id, string key)> CreateApiKeyAsync(HttpClient admin, string name = "Collector PC")
    {
        var resp = await admin.PostAsJsonAsync("/api/admin/api-keys", new { name });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return (body.GetProperty("apiKey").GetProperty("id").GetInt32(), body.GetProperty("key").GetString()!);
    }

    private HttpClient CreateKeyClient(string key)
    {
        var client = Factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Api-Key", key);
        return client;
    }

    private record Setup(int SeasonId, int MatchId, int UserId, int RosterPlayerId);

    private async Task<Setup> CreateMatchSetupAsync(HttpClient admin, string seasonName)
    {
        var seasonResp = await admin.PostAsJsonAsync("/api/seasons", new { name = seasonName, startedOn = "2024-01-01T00:00:00", hostedTeamId = 1 });
        seasonResp.EnsureSuccessStatusCode();
        var seasonId = (await seasonResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var userResp = await admin.PostAsJsonAsync("/api/users", new { name = $"{seasonName} Player" });
        userResp.EnsureSuccessStatusCode();
        var userId = (await userResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        (await admin.PostAsJsonAsync($"/api/seasons/{seasonId}/users/{userId}", new { position = "C" })).EnsureSuccessStatusCode();

        var rosterResp = await admin.PostAsJsonAsync($"/api/seasons/{seasonId}/roster", new { firstName = "Nathan", surname = "MacKinnon", position = "C", teamId = 1 });
        rosterResp.EnsureSuccessStatusCode();
        var rosterPlayerId = (await rosterResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var matchResp = await admin.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new { homeTeamId = 1, awayTeamId = 2 });
        matchResp.EnsureSuccessStatusCode();
        var matchId = (await matchResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        (await admin.PostAsync($"/api/seasons/{seasonId}/matches/{matchId}/usermatches/initialize", null)).EnsureSuccessStatusCode();

        return new Setup(seasonId, matchId, userId, rosterPlayerId);
    }

    private static async Task<JsonElement> SubmitAsync(HttpClient keyClient, int matchId, params object[] events)
    {
        var resp = await keyClient.PostAsJsonAsync($"/api/ingest/matches/{matchId}/events", new { events });
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await resp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("results");
    }

    private async Task<JsonElement> GetMatchAsync(HttpClient admin, Setup s) =>
        await (await admin.GetAsync($"/api/seasons/{s.SeasonId}/matches/{s.MatchId}")).Content.ReadFromJsonAsync<JsonElement>();

    // ── authentication ───────────────────────────────────────────────────────

    [Fact]
    public async Task Ingest_without_key_returns_401()
    {
        var resp = await Factory.CreateClient().GetAsync("/api/ingest/whoami");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Ingest_with_wrong_key_returns_401()
    {
        var resp = await CreateKeyClient("nhls_not-a-real-key").GetAsync("/api/ingest/whoami");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Valid_key_is_accepted_and_revoked_key_is_rejected()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var (id, key) = await CreateApiKeyAsync(admin, "Revoke me");
        key.Should().StartWith("nhls_");

        var keyClient = CreateKeyClient(key);
        var ok = await keyClient.GetAsync("/api/ingest/whoami");
        ok.StatusCode.Should().Be(HttpStatusCode.OK);
        (await ok.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("name").GetString().Should().Be("Revoke me");

        (await admin.DeleteAsync($"/api/admin/api-keys/{id}")).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await keyClient.GetAsync("/api/ingest/whoami")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Api_key_cannot_call_admin_endpoints()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var (_, key) = await CreateApiKeyAsync(admin);
        var resp = await CreateKeyClient(key).GetAsync("/api/admin/api-keys");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Admin_jwt_cannot_call_ingest_endpoints()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var resp = await admin.GetAsync("/api/ingest/whoami");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Key_list_never_exposes_plaintext_or_hash()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var (_, key) = await CreateApiKeyAsync(admin, "Listed");
        var raw = await (await admin.GetAsync("/api/admin/api-keys")).Content.ReadAsStringAsync();
        raw.Should().Contain("Listed");
        raw.Should().NotContain(key);
        raw.Should().NotContain("keyHash");
    }

    // ── context ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Context_returns_users_with_positions_and_hosted_roster()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var s = await CreateMatchSetupAsync(admin, "Context Season");
        var (_, key) = await CreateApiKeyAsync(admin);
        var keyClient = CreateKeyClient(key);

        var resp = await keyClient.GetAsync($"/api/ingest/matches/{s.MatchId}/context");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var ctx = await resp.Content.ReadFromJsonAsync<JsonElement>();
        ctx.GetProperty("hostedIsHome").GetBoolean().Should().BeTrue();
        var user = ctx.GetProperty("users").EnumerateArray().Single(u => u.GetProperty("userId").GetInt32() == s.UserId);
        user.GetProperty("position").GetString().Should().Be("C");
        ctx.GetProperty("roster").EnumerateArray().Should().Contain(r => r.GetProperty("rosterPlayerId").GetInt32() == s.RosterPlayerId);

        var open = await (await keyClient.GetAsync("/api/ingest/matches")).Content.ReadFromJsonAsync<JsonElement>();
        open.EnumerateArray().Should().Contain(m => m.GetProperty("id").GetInt32() == s.MatchId);

        (await keyClient.GetAsync("/api/ingest/matches/999999/context")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── submitting proposals ─────────────────────────────────────────────────

    [Fact]
    public async Task Proposal_does_not_change_score_or_events_until_confirmed()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var s = await CreateMatchSetupAsync(admin, "Proposal Season");
        var (_, key) = await CreateApiKeyAsync(admin);

        var results = await SubmitAsync(CreateKeyClient(key), s.MatchId,
            new { clientEventId = "evt-1", eventType = "Goal", isOpponent = true, period = 1, gameClock = "12:34", confidence = "High" });
        results[0].GetProperty("proposalId").GetInt32().Should().BePositive();
        results[0].GetProperty("duplicate").GetBoolean().Should().BeFalse();

        var match = await GetMatchAsync(admin, s);
        match.GetProperty("awayScore").GetInt32().Should().Be(0);
        var events = await (await admin.GetAsync($"/api/matches/{s.MatchId}/events")).Content.ReadFromJsonAsync<JsonElement>();
        events.GetArrayLength().Should().Be(0);

        var proposals = await (await admin.GetAsync($"/api/matches/{s.MatchId}/proposals?status=Proposed")).Content.ReadFromJsonAsync<JsonElement>();
        proposals.GetArrayLength().Should().Be(1);
        proposals[0].GetProperty("gameClock").GetString().Should().Be("12:34");
        proposals[0].GetProperty("apiKeyName").GetString().Should().Be("Collector PC");
    }

    [Fact]
    public async Task Resubmitting_same_client_event_id_is_idempotent()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var s = await CreateMatchSetupAsync(admin, "Idempotent Season");
        var (_, key) = await CreateApiKeyAsync(admin);
        var keyClient = CreateKeyClient(key);

        var first = await SubmitAsync(keyClient, s.MatchId, new { clientEventId = "dup-1", eventType = "Penalty", isOpponent = true });
        var second = await SubmitAsync(keyClient, s.MatchId,
            new { clientEventId = "dup-1", eventType = "Penalty", isOpponent = true },
            new { clientEventId = "dup-2", eventType = "Penalty", isOpponent = true },
            new { clientEventId = "dup-2", eventType = "Penalty", isOpponent = true });

        second[0].GetProperty("duplicate").GetBoolean().Should().BeTrue();
        second[0].GetProperty("proposalId").GetInt32().Should().Be(first[0].GetProperty("proposalId").GetInt32());
        second[1].GetProperty("duplicate").GetBoolean().Should().BeFalse();
        second[2].GetProperty("duplicate").GetBoolean().Should().BeTrue();

        var proposals = await (await admin.GetAsync($"/api/matches/{s.MatchId}/proposals")).Content.ReadFromJsonAsync<JsonElement>();
        proposals.GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task Invalid_events_are_reported_per_event_without_failing_the_batch()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var s = await CreateMatchSetupAsync(admin, "Validation Season");
        var (_, key) = await CreateApiKeyAsync(admin);

        var results = await SubmitAsync(CreateKeyClient(key), s.MatchId,
            new { clientEventId = "", eventType = "Goal" },
            new { clientEventId = "bad-user", eventType = "Goal", userId = 999999, rosterPlayerId = s.RosterPlayerId },
            new { clientEventId = "bad-player", eventType = "Goal", userId = s.UserId, rosterPlayerId = 999999 },
            new { clientEventId = "point", eventType = "Point" },
            new { clientEventId = "good", eventType = "PeriodChange", eventSubtype = "P1" });

        results[0].GetProperty("error").GetString().Should().NotBeNullOrEmpty();
        results[1].GetProperty("error").GetString().Should().Contain("User");
        results[2].GetProperty("error").GetString().Should().Contain("RosterPlayer");
        results[3].GetProperty("error").GetString().Should().NotBeNullOrEmpty();
        results[4].GetProperty("error").ValueKind.Should().Be(JsonValueKind.Null);
        results[4].GetProperty("proposalId").GetInt32().Should().BePositive();
    }

    [Fact]
    public async Task Submitting_to_unknown_match_returns_404()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var (_, key) = await CreateApiKeyAsync(admin);
        var resp = await CreateKeyClient(key).PostAsJsonAsync("/api/ingest/matches/999999/events",
            new { events = new[] { new { clientEventId = "x", eventType = "Goal" } } });
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── review ───────────────────────────────────────────────────────────────

    [Fact]
    public async Task Confirming_player_goal_creates_goal_event_and_bumps_hosted_score()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var s = await CreateMatchSetupAsync(admin, "Confirm Goal Season");
        var (_, key) = await CreateApiKeyAsync(admin);

        var results = await SubmitAsync(CreateKeyClient(key), s.MatchId,
            new { clientEventId = "g1", eventType = "Goal", userId = s.UserId, rosterPlayerId = s.RosterPlayerId, confidence = "Medium" });
        var proposalId = results[0].GetProperty("proposalId").GetInt32();

        var confirm = await admin.PostAsJsonAsync($"/api/matches/{s.MatchId}/proposals/{proposalId}/confirm", new { });
        confirm.StatusCode.Should().Be(HttpStatusCode.OK);
        var confirmed = await confirm.Content.ReadFromJsonAsync<JsonElement>();
        confirmed.GetProperty("status").GetString().Should().Be("Confirmed");
        var matchEventId = confirmed.GetProperty("matchEventId").GetInt32();

        var events = await (await admin.GetAsync($"/api/matches/{s.MatchId}/events")).Content.ReadFromJsonAsync<JsonElement>();
        var evt = events.EnumerateArray().Single(e => e.GetProperty("id").GetInt32() == matchEventId);
        evt.GetProperty("eventType").GetString().Should().Be("Goal");
        evt.GetProperty("rosterPlayerId").GetInt32().Should().Be(s.RosterPlayerId);

        (await GetMatchAsync(admin, s)).GetProperty("homeScore").GetInt32().Should().Be(1);

        // A second confirm is refused.
        (await admin.PostAsJsonAsync($"/api/matches/{s.MatchId}/proposals/{proposalId}/confirm", new { }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Confirming_with_clear_user_records_unattributed_team_goal()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var s = await CreateMatchSetupAsync(admin, "Clear User Season");
        var (_, key) = await CreateApiKeyAsync(admin);

        var results = await SubmitAsync(CreateKeyClient(key), s.MatchId,
            new { clientEventId = "cpu-goal", eventType = "Goal", userId = s.UserId, rosterPlayerId = s.RosterPlayerId });
        var proposalId = results[0].GetProperty("proposalId").GetInt32();

        var confirm = await admin.PostAsJsonAsync($"/api/matches/{s.MatchId}/proposals/{proposalId}/confirm", new { clearUser = true });
        confirm.StatusCode.Should().Be(HttpStatusCode.OK);

        var events = await (await admin.GetAsync($"/api/matches/{s.MatchId}/events")).Content.ReadFromJsonAsync<JsonElement>();
        events.GetArrayLength().Should().Be(1);
        events[0].GetProperty("userMatchGoalId").ValueKind.Should().Be(JsonValueKind.Null);
        (await GetMatchAsync(admin, s)).GetProperty("homeScore").GetInt32().Should().Be(1);
    }

    [Fact]
    public async Task Confirming_player_penalty_creates_penalty_for_user()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var s = await CreateMatchSetupAsync(admin, "Confirm Penalty Season");
        var (_, key) = await CreateApiKeyAsync(admin);

        var results = await SubmitAsync(CreateKeyClient(key), s.MatchId,
            new { clientEventId = "p1", eventType = "Penalty", userId = s.UserId, rosterPlayerId = s.RosterPlayerId });
        var proposalId = results[0].GetProperty("proposalId").GetInt32();

        (await admin.PostAsJsonAsync($"/api/matches/{s.MatchId}/proposals/{proposalId}/confirm", new { }))
            .StatusCode.Should().Be(HttpStatusCode.OK);

        var events = await (await admin.GetAsync($"/api/matches/{s.MatchId}/events")).Content.ReadFromJsonAsync<JsonElement>();
        events.GetArrayLength().Should().Be(1);
        events[0].GetProperty("eventType").GetString().Should().Be("Penalty");
        events[0].GetProperty("userMatchPenaltyId").ValueKind.Should().Be(JsonValueKind.Number);
    }

    [Fact]
    public async Task Rejecting_creates_nothing_and_shows_status_to_the_client()
    {
        var admin = await CreateAuthenticatedClientAsync();
        var s = await CreateMatchSetupAsync(admin, "Reject Season");
        var (_, key) = await CreateApiKeyAsync(admin);
        var keyClient = CreateKeyClient(key);

        var results = await SubmitAsync(keyClient, s.MatchId, new { clientEventId = "r1", eventType = "Goal", isOpponent = true });
        var proposalId = results[0].GetProperty("proposalId").GetInt32();

        (await admin.PostAsync($"/api/matches/{s.MatchId}/proposals/{proposalId}/reject", null)).StatusCode.Should().Be(HttpStatusCode.OK);

        (await GetMatchAsync(admin, s)).GetProperty("awayScore").GetInt32().Should().Be(0);
        var events = await (await admin.GetAsync($"/api/matches/{s.MatchId}/events")).Content.ReadFromJsonAsync<JsonElement>();
        events.GetArrayLength().Should().Be(0);

        var mine = await (await keyClient.GetAsync($"/api/ingest/matches/{s.MatchId}/events")).Content.ReadFromJsonAsync<JsonElement>();
        mine[0].GetProperty("status").GetString().Should().Be("Rejected");

        (await admin.PostAsJsonAsync($"/api/matches/{s.MatchId}/proposals/{proposalId}/confirm", new { }))
            .StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Proposal_review_requires_admin()
    {
        var resp = await Factory.CreateClient().GetAsync("/api/matches/1/proposals");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
