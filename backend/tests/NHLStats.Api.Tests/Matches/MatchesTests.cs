using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class MatchesTests : ApiTestBase
{
    public MatchesTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<int> CreateSeasonAsync(HttpClient client, string name = "Match Test Season")
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

    // ── GET /api/seasons/{seasonId}/matches ─────────────────────────────────

    [Fact]
    public async Task GetBySeason_returns_200_and_array()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "MatchGet Season");

        var resp = await client.GetAsync($"/api/seasons/{seasonId}/matches");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
    }

    // ── GET /api/matches/future ─────────────────────────────────────────────

    [Fact]
    public async Task GetFuture_returns_default_10_matches_when_more_are_available()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Future Limit Season");

        for (var i = 0; i < 12; i++)
        {
            var created = await CreateMatchAsync(client, seasonId, 1, 2);
            var matchId = created.GetProperty("id").GetInt32();

            var futureDate = DateTime.UtcNow.AddDays(i + 1).ToString("O");
            var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
            {
                homeTeamId = 1,
                awayTeamId = 2,
                homeScore = 0,
                awayScore = 0,
                matchDate = futureDate,
                completionType = 0
            });
            updateResp.EnsureSuccessStatusCode();
        }

        var resp = await client.GetAsync("/api/matches/future");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().Be(10);
    }

    [Fact]
    public async Task GetFuture_returns_all_available_when_less_than_requested()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Future Available Season");

        for (var i = 0; i < 3; i++)
        {
            var created = await CreateMatchAsync(client, seasonId, 1, 2);
            var matchId = created.GetProperty("id").GetInt32();

            var futureDate = DateTime.UtcNow.AddDays(i + 1).ToString("O");
            var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
            {
                homeTeamId = 1,
                awayTeamId = 2,
                homeScore = 0,
                awayScore = 0,
                matchDate = futureDate,
                completionType = 0
            });
            updateResp.EnsureSuccessStatusCode();
        }

        var resp = await client.GetAsync("/api/matches/future?count=10");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.ValueKind.Should().Be(JsonValueKind.Array);
        body.GetArrayLength().Should().BeGreaterThanOrEqualTo(3);
    }

    [Fact]
    public async Task GetFuture_lists_logged_in_user_bet_via_active_endpoint()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Future Bet Active Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var futureDate = DateTime.UtcNow.AddDays(1).ToString("O");
        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = futureDate,
            completionType = 0
        });
        updateResp.EnsureSuccessStatusCode();

        await SeedBettingBalanceAsync(client, seasonId);
        await SeedHostedTeamHistoryAsync(client, seasonId);

        var betResp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[]
            {
                new { matchId, betType = "TeamWin", teamId = 1 }
            }
        });
        betResp.EnsureSuccessStatusCode();

        var activeResp = await client.GetAsync("/api/betting/bets/active");
        activeResp.EnsureSuccessStatusCode();
        var active = await activeResp.Content.ReadFromJsonAsync<JsonElement>();
        var ticket = active.EnumerateArray()
            .First(b => b.GetProperty("legs").EnumerateArray()
                .Any(l => l.GetProperty("matchId").GetInt32() == matchId));
        ticket.GetProperty("legs")[0].GetProperty("betType").GetString().Should().Be("TeamWin");
        ticket.GetProperty("legs")[0].GetProperty("teamId").GetInt32().Should().Be(1);
    }

    // ── POST /api/seasons/{seasonId}/matches ────────────────────────────────

    [Fact]
    public async Task Create_match_returns_201_with_auto_match_number_and_null_date()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Create Season");

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("seasonId").GetInt32().Should().Be(seasonId);
        body.GetProperty("homeTeamId").GetInt32().Should().Be(1);
        body.GetProperty("awayTeamId").GetInt32().Should().Be(2);
        body.GetProperty("homeScore").GetInt32().Should().Be(0);
        body.GetProperty("awayScore").GetInt32().Should().Be(0);
        body.GetProperty("matchNumber").GetInt32().Should().Be(1);
        body.GetProperty("matchDate").ValueKind.Should().Be(JsonValueKind.Null);
        body.GetProperty("completionType").GetString().Should().Be("None");
    }

    [Fact]
    public async Task Create_match_auto_increments_match_number()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Number Season");

        var first = await CreateMatchAsync(client, seasonId, 1, 2);
        var second = await CreateMatchAsync(client, seasonId, 3, 4);

        first.GetProperty("matchNumber").GetInt32().Should().Be(1);
        second.GetProperty("matchNumber").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task Create_match_within_regular_season_is_not_playoff()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Regular Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);

        created.GetProperty("matchNumber").GetInt32().Should().Be(1);
        created.GetProperty("phase").GetString().Should().Be("RegularSeason");
        created.GetProperty("playoffRound").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task Create_match_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/seasons/1/matches", new
        {
            homeTeamId = 1,
            awayTeamId = 2
        });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── PUT /api/seasons/{seasonId}/matches/{id} ────────────────────────────

    [Fact]
    public async Task Update_match_sets_completion_type_and_date()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Update Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var inProgressResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 3,
            awayTeamId = 4,
            homeScore = 0,
            awayScore = 0,
            matchDate = (string?)null,
            completionType = 4  // InProgress
        });
        inProgressResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 3,
            awayTeamId = 4,
            homeScore = 5,
            awayScore = 1,
            matchDate = "2024-01-15T20:00:00",
            completionType = 2  // Overtime
        });
        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("homeScore").GetInt32().Should().Be(5);
        updated.GetProperty("homeTeamId").GetInt32().Should().Be(3);
        updated.GetProperty("completionType").GetString().Should().Be("Overtime");
        updated.GetProperty("matchDate").ValueKind.Should().NotBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task Update_match_with_none_completion_type_forces_null_date()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match None Completion Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = "2026-03-09T20:00:00",
            completionType = 0 // None / Not Played
        });

        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("completionType").GetString().Should().Be("None");
        updated.GetProperty("matchDate").ValueKind.Should().Be(JsonValueKind.Null);
    }

    [Fact]
    public async Task Update_match_can_set_phase_and_playoff_round_manually()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Manual Phase Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();
        created.GetProperty("phase").GetString().Should().Be("RegularSeason");
        created.GetProperty("playoffRound").ValueKind.Should().Be(JsonValueKind.Null);

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = (string?)null,
            completionType = 0,
            phase = "Playoff",
            playoffRound = 3
        });

        updateResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await updateResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("phase").GetString().Should().Be("Playoff");
        updated.GetProperty("playoffRound").GetInt32().Should().Be(3);
    }

    [Fact]
    public async Task Update_match_clears_playoff_round_when_phase_set_back_to_regular_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Manual Phase Revert Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var toPlayoffResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = (string?)null,
            completionType = 0,
            phase = "Playoff",
            playoffRound = 2
        });
        toPlayoffResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var toRegularResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = (string?)null,
            completionType = 0,
            phase = "RegularSeason",
            playoffRound = 2 // ignored: not a playoff match, so round is forced to null
        });

        toRegularResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await toRegularResp.Content.ReadFromJsonAsync<JsonElement>();
        updated.GetProperty("phase").GetString().Should().Be("RegularSeason");
        updated.GetProperty("playoffRound").ValueKind.Should().Be(JsonValueKind.Null);
    }

    // ── DELETE /api/seasons/{seasonId}/matches/{id} ─────────────────────────

    [Fact]
    public async Task Delete_match_returns_204()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Delete Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var deleteResp = await client.DeleteAsync($"/api/seasons/{seasonId}/matches/{matchId}");
        deleteResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var getResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{matchId}");
        getResp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Filter by season ─────────────────────────────────────────────────────

    [Fact]
    public async Task GetBySeason_only_returns_matches_for_that_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var season1Id = await CreateSeasonAsync(client, "Season A");
        var season2Id = await CreateSeasonAsync(client, "Season B");

        await CreateMatchAsync(client, season1Id, 1, 2);

        var resp = await client.GetAsync($"/api/seasons/{season2Id}/matches");
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(0);
    }

    // ── Batch create ─────────────────────────────────────────────────────────

    [Fact]
    public async Task BatchCreate_assigns_sequential_match_numbers()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Batch Season");

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/batch", new[]
        {
            new { homeTeamId = 1, awayTeamId = 2 },
            new { homeTeamId = 3, awayTeamId = 4 },
            new { homeTeamId = 5, awayTeamId = 6 },
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(3);
        body[0].GetProperty("matchNumber").GetInt32().Should().Be(1);
        body[1].GetProperty("matchNumber").GetInt32().Should().Be(2);
        body[2].GetProperty("matchNumber").GetInt32().Should().Be(3);
    }

    [Fact]
    public async Task BatchCreate_does_not_infer_playoff_phase_from_match_number()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Batch Playoff Boundary Season");

        var dtos = Enumerable.Range(0, 83)
            .Select(_ => new { homeTeamId = 1, awayTeamId = 2 })
            .ToArray();

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/batch", dtos);

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(83);
        body[81].GetProperty("matchNumber").GetInt32().Should().Be(82);
        body[81].GetProperty("phase").GetString().Should().Be("RegularSeason");
        // Phase is only ever Playoff when created via the dedicated playoff-series endpoint,
        // never inferred from match number alone.
        body[82].GetProperty("matchNumber").GetInt32().Should().Be(83);
        body[82].GetProperty("phase").GetString().Should().Be("RegularSeason");
        body[82].GetProperty("playoffRound").ValueKind.Should().Be(JsonValueKind.Null);
    }

    // ── POST /api/seasons/{seasonId}/matches/{id}/reset ─────────────────────

    [Fact]
    public async Task Reset_match_clears_score_completion_date_and_stats_but_keeps_roster()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Reset Season");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var userResp = await client.PostAsJsonAsync("/api/users", new { name = "Reset Test Player" });
        userResp.EnsureSuccessStatusCode();
        var userId = (await userResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
        (await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null)).EnsureSuccessStatusCode();

        var umResp = await client.PostAsJsonAsync(
            $"/api/seasons/{seasonId}/matches/{matchId}/usermatches", new { userId });
        umResp.EnsureSuccessStatusCode();
        var userMatchId = (await umResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var pointResp = await client.PostAsJsonAsync(
            $"/api/usermatches/{userMatchId}/points", new { pointReasonId = 9, count = 1 });
        pointResp.EnsureSuccessStatusCode();

        await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = (string?)null,
            completionType = 4 // InProgress
        });
        var finishResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 4,
            awayScore = 2,
            matchDate = "2024-02-01T20:00:00",
            completionType = 1 // RegularTime
        });
        finishResp.EnsureSuccessStatusCode();

        var resetResp = await client.PostAsync($"/api/seasons/{seasonId}/matches/{matchId}/reset", null);
        resetResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var reset = await resetResp.Content.ReadFromJsonAsync<JsonElement>();
        reset.GetProperty("homeScore").GetInt32().Should().Be(0);
        reset.GetProperty("awayScore").GetInt32().Should().Be(0);
        reset.GetProperty("completionType").GetString().Should().Be("None");
        reset.GetProperty("matchDate").ValueKind.Should().Be(JsonValueKind.Null);

        var pointsResp = await client.GetAsync($"/api/usermatches/{userMatchId}/points");
        pointsResp.EnsureSuccessStatusCode();
        (await pointsResp.Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength().Should().Be(0);

        // The player's roster entry for the match must survive the reset.
        var umsResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{matchId}/usermatches");
        umsResp.EnsureSuccessStatusCode();
        var ums = await umsResp.Content.ReadFromJsonAsync<JsonElement>();
        ums.EnumerateArray().Should().Contain(um => um.GetProperty("id").GetInt32() == userMatchId);
    }

    [Fact]
    public async Task Reset_match_reverts_pending_bet_ticket_to_pending()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Reset Bet Season");
        await SeedBettingBalanceAsync(client, seasonId);

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();
        await SeedHostedTeamHistoryAsync(client, seasonId);

        var betResp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[] { new { matchId, betType = "TeamWin", teamId = 1 } }
        });
        betResp.EnsureSuccessStatusCode();
        var betId = (await betResp.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString();

        // Status transitions are one-directional (None → InProgress → Completed), so step
        // through InProgress before completing the match.
        var inProgressResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 0,
            awayScore = 0,
            matchDate = (string?)null,
            completionType = 4 // InProgress
        });
        inProgressResp.EnsureSuccessStatusCode();

        // Team 1 (home) loses in regulation → the TeamWin(1) leg (and ticket) settles as Lost.
        var finishResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId = 1,
            awayTeamId = 2,
            homeScore = 1,
            awayScore = 3,
            matchDate = "2024-02-02T20:00:00",
            completionType = 1 // RegularTime
        });
        finishResp.EnsureSuccessStatusCode();

        var historyResp = await client.GetAsync("/api/betting/bets/history");
        historyResp.EnsureSuccessStatusCode();
        var history = await historyResp.Content.ReadFromJsonAsync<JsonElement>();
        history.EnumerateArray().First(b => b.GetProperty("id").GetString() == betId)
            .GetProperty("status").GetString().Should().Be("Lost");

        var resetResp = await client.PostAsync($"/api/seasons/{seasonId}/matches/{matchId}/reset", null);
        resetResp.StatusCode.Should().Be(HttpStatusCode.OK);

        var activeResp = await client.GetAsync("/api/betting/bets/active");
        activeResp.EnsureSuccessStatusCode();
        var active = await activeResp.Content.ReadFromJsonAsync<JsonElement>();
        active.EnumerateArray().Should().Contain(b => b.GetProperty("id").GetString() == betId);
        active.EnumerateArray().First(b => b.GetProperty("id").GetString() == betId)
            .GetProperty("status").GetString().Should().Be("Pending");
    }

    [Fact]
    public async Task Reset_match_wrong_season_returns_404()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Match Reset 404 Season A");
        var otherSeasonId = await CreateSeasonAsync(client, "Match Reset 404 Season B");

        var created = await CreateMatchAsync(client, seasonId, 1, 2);
        var matchId = created.GetProperty("id").GetInt32();

        var resp = await client.PostAsync($"/api/seasons/{otherSeasonId}/matches/{matchId}/reset", null);
        resp.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Reset_match_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsync("/api/seasons/1/matches/1/reset", null);
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task BatchCreate_rolls_back_entirely_on_invalid_team_id()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Batch Rollback Season");

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/batch", new[]
        {
            new { homeTeamId = 1, awayTeamId = 2 },
            new { homeTeamId = 99999, awayTeamId = 2 },  // invalid team
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        // Nothing should have been persisted
        var getResp = await client.GetAsync($"/api/seasons/{seasonId}/matches");
        var matches = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        matches.GetArrayLength().Should().Be(0);
    }

    // ── POST /api/seasons/{seasonId}/matches/playoff-series ─────────────────

    [Fact]
    public async Task CreatePlayoffSeries_creates_first_4_matches_in_2_2_1_1_1_pattern_when_starting_home()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Series Home Season"); // hostedTeamId = 1

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/playoff-series", new
        {
            opponentTeamId = 2,
            startsHome = true
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(4);

        var expectedHostedIsHome = new[] { true, true, false, false };
        for (var i = 0; i < 4; i++)
        {
            var m = body[i];
            m.GetProperty("matchNumber").GetInt32().Should().Be(i + 1);
            m.GetProperty("phase").GetString().Should().Be("Playoff");
            m.GetProperty("playoffRound").GetInt32().Should().Be(1);
            if (expectedHostedIsHome[i])
            {
                m.GetProperty("homeTeamId").GetInt32().Should().Be(1);
                m.GetProperty("awayTeamId").GetInt32().Should().Be(2);
            }
            else
            {
                m.GetProperty("homeTeamId").GetInt32().Should().Be(2);
                m.GetProperty("awayTeamId").GetInt32().Should().Be(1);
            }
        }
    }

    [Fact]
    public async Task CreatePlayoffSeries_inverts_pattern_when_starting_away()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Series Away Season"); // hostedTeamId = 1

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/playoff-series", new
        {
            opponentTeamId = 2,
            startsHome = false
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(4);

        var expectedHostedIsHome = new[] { false, false, true, true };
        for (var i = 0; i < 4; i++)
        {
            var m = body[i];
            if (expectedHostedIsHome[i])
            {
                m.GetProperty("homeTeamId").GetInt32().Should().Be(1);
                m.GetProperty("awayTeamId").GetInt32().Should().Be(2);
            }
            else
            {
                m.GetProperty("homeTeamId").GetInt32().Should().Be(2);
                m.GetProperty("awayTeamId").GetInt32().Should().Be(1);
            }
        }
    }

    [Fact]
    public async Task CreatePlayoffSeries_appends_after_existing_matches_with_sequential_numbers()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Series Sequential Season");
        await CreateMatchAsync(client, seasonId, 1, 2);

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/playoff-series", new
        {
            opponentTeamId = 2,
            startsHome = true
        });

        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(4);
        body[0].GetProperty("matchNumber").GetInt32().Should().Be(2);
        body[3].GetProperty("matchNumber").GetInt32().Should().Be(5);
    }

    [Fact]
    public async Task CreatePlayoffSeries_increments_round_for_each_new_series_in_the_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Series Round Season"); // hostedTeamId = 1

        var firstResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/playoff-series", new
        {
            opponentTeamId = 2,
            startsHome = true
        });
        firstResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var firstBody = await firstResp.Content.ReadFromJsonAsync<JsonElement>();
        foreach (var m in firstBody.EnumerateArray())
            m.GetProperty("playoffRound").GetInt32().Should().Be(1);

        var secondResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/playoff-series", new
        {
            opponentTeamId = 3,
            startsHome = true
        });
        secondResp.StatusCode.Should().Be(HttpStatusCode.OK);
        var secondBody = await secondResp.Content.ReadFromJsonAsync<JsonElement>();
        foreach (var m in secondBody.EnumerateArray())
            m.GetProperty("playoffRound").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task CreatePlayoffSeries_returns_400_for_invalid_opponent_team()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Series Invalid Opponent Season");

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/playoff-series", new
        {
            opponentTeamId = 99999,
            startsHome = true
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);

        var getResp = await client.GetAsync($"/api/seasons/{seasonId}/matches");
        var matches = await getResp.Content.ReadFromJsonAsync<JsonElement>();
        matches.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task CreatePlayoffSeries_returns_400_when_opponent_equals_hosted_team()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Series Same Team Season"); // hostedTeamId = 1

        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/playoff-series", new
        {
            opponentTeamId = 1,
            startsHome = true
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task CreatePlayoffSeries_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.PostAsJsonAsync("/api/seasons/1/matches/playoff-series", new
        {
            opponentTeamId = 2,
            startsHome = true
        });
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // ── Playoff series: games appended on demand ────────────────────────────

    private async Task<int> CreateSeasonWithLeagueAsync(HttpClient client, string name, string leagueType)
    {
        var resp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name,
            startedOn = "2024-01-01T00:00:00",
            hostedTeamId = 1,
            leagueType
        });
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetInt32();
    }

    private static async Task<JsonElement> CreateSeriesAsync(HttpClient client, int seasonId, int opponentTeamId = 2, bool startsHome = true)
    {
        var resp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches/playoff-series", new
        {
            opponentTeamId,
            startsHome
        });
        resp.EnsureSuccessStatusCode();
        return await resp.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static async Task<JsonElement[]> GetPlayoffRoundAsync(HttpClient client, int seasonId, int round)
    {
        var resp = await client.GetAsync($"/api/seasons/{seasonId}/matches");
        resp.EnsureSuccessStatusCode();
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        return body.EnumerateArray()
            .Where(m => m.GetProperty("phase").GetString() == "Playoff"
                        && m.GetProperty("playoffRound").ValueKind == JsonValueKind.Number
                        && m.GetProperty("playoffRound").GetInt32() == round)
            .OrderBy(m => m.GetProperty("matchNumber").GetInt32())
            .ToArray();
    }

    // Plays a playoff match to completion (None → InProgress → RegularTime), giving the win to the
    // hosted team (id 1) or to its opponent.
    private static async Task PlayPlayoffMatchAsync(HttpClient client, int seasonId, JsonElement match, bool hostedWins)
    {
        var id = match.GetProperty("id").GetInt32();
        var homeTeamId = match.GetProperty("homeTeamId").GetInt32();
        var awayTeamId = match.GetProperty("awayTeamId").GetInt32();
        var round = match.GetProperty("playoffRound").GetInt32();
        var hostedIsHome = homeTeamId == 1;
        var homeWins = hostedWins == hostedIsHome;

        var startResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{id}", new
        {
            homeTeamId, awayTeamId, homeScore = 0, awayScore = 0, matchDate = (DateTime?)null,
            completionType = "InProgress", phase = "Playoff", playoffRound = round
        });
        startResp.EnsureSuccessStatusCode();

        var endResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{id}", new
        {
            homeTeamId, awayTeamId,
            homeScore = homeWins ? 3 : 1,
            awayScore = homeWins ? 1 : 3,
            matchDate = DateTime.UtcNow.AddDays(-1).ToString("O"),
            completionType = "RegularTime", phase = "Playoff", playoffRound = round
        });
        endResp.EnsureSuccessStatusCode();
    }

    // Plays the round's games in order, following the given results, fetching the round again
    // after each game so that automatically appended games are picked up.
    private static async Task PlayRoundAsync(HttpClient client, int seasonId, int round, params bool[] hostedWinsPerGame)
    {
        for (var i = 0; i < hostedWinsPerGame.Length; i++)
        {
            var games = await GetPlayoffRoundAsync(client, seasonId, round);
            games.Length.Should().BeGreaterThan(i, $"game {i + 1} of round {round} should exist");
            await PlayPlayoffMatchAsync(client, seasonId, games[i], hostedWinsPerGame[i]);
        }
    }

    private static void AssertHostedIsHome(JsonElement match, bool expectedHostedIsHome, int opponentTeamId = 2)
    {
        match.GetProperty("homeTeamId").GetInt32().Should().Be(expectedHostedIsHome ? 1 : opponentTeamId);
        match.GetProperty("awayTeamId").GetInt32().Should().Be(expectedHostedIsHome ? opponentTeamId : 1);
    }

    [Fact]
    public async Task CreatePlayoffSeries_creates_a_single_match_for_IIHF_season()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonWithLeagueAsync(client, "IIHF Playoff Single Season", "IIHF");

        var body = await CreateSeriesAsync(client, seasonId);

        body.GetArrayLength().Should().Be(1);
        body[0].GetProperty("playoffRound").GetInt32().Should().Be(1);
        AssertHostedIsHome(body[0], true);
    }

    [Fact]
    public async Task Completing_game_4_at_2_2_appends_game_5_following_the_2_2_1_1_1_pattern()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Append Game 5 Season");
        await CreateSeriesAsync(client, seasonId, startsHome: true);

        await PlayRoundAsync(client, seasonId, 1, true, false, true, false);

        var games = await GetPlayoffRoundAsync(client, seasonId, 1);
        games.Length.Should().Be(5);
        games[4].GetProperty("matchNumber").GetInt32().Should().Be(5);
        games[4].GetProperty("completionType").GetString().Should().Be("None");
        AssertHostedIsHome(games[4], true);
    }

    [Fact]
    public async Task Series_at_3_3_gets_game_7_and_nothing_is_appended_after_game_7()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Append Game 7 Season");
        await CreateSeriesAsync(client, seasonId, startsHome: false);

        await PlayRoundAsync(client, seasonId, 1, true, false, true, false, true, false);

        var games = await GetPlayoffRoundAsync(client, seasonId, 1);
        games.Length.Should().Be(7);
        // Starting away inverts the 2-2-1-1-1 pattern: games 5 and 7 are away for the hosted team, game 6 at home.
        AssertHostedIsHome(games[4], false);
        AssertHostedIsHome(games[5], true);
        AssertHostedIsHome(games[6], false);

        await PlayPlayoffMatchAsync(client, seasonId, games[6], hostedWins: true);

        (await GetPlayoffRoundAsync(client, seasonId, 1)).Length.Should().Be(7);
    }

    [Fact]
    public async Task Sweep_does_not_append_any_game()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Sweep Season");
        await CreateSeriesAsync(client, seasonId);

        await PlayRoundAsync(client, seasonId, 1, true, true, true, true);

        (await GetPlayoffRoundAsync(client, seasonId, 1)).Length.Should().Be(4);
    }

    [Fact]
    public async Task Existing_7_game_series_is_not_extended()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Legacy 7 Game Season");
        for (var i = 0; i < 7; i++)
        {
            var created = await CreateMatchAsync(client, seasonId, 1, 2);
            var resp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{created.GetProperty("id").GetInt32()}", new
            {
                homeTeamId = 1, awayTeamId = 2, homeScore = 0, awayScore = 0, matchDate = (DateTime?)null,
                completionType = "None", phase = "Playoff", playoffRound = 1
            });
            resp.EnsureSuccessStatusCode();
        }

        await PlayRoundAsync(client, seasonId, 1, true, false, true, false);

        (await GetPlayoffRoundAsync(client, seasonId, 1)).Length.Should().Be(7);
    }

    // ── GET /api/seasons/{seasonId}/matches/playoff-status ──────────────────

    private static async Task<JsonElement> GetPlayoffStatusAsync(HttpClient client, int seasonId)
    {
        var resp = await client.GetAsync($"/api/seasons/{seasonId}/matches/playoff-status");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        return await resp.Content.ReadFromJsonAsync<JsonElement>();
    }

    [Fact]
    public async Task PlayoffStatus_without_playoff_matches_cannot_create_next_series()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Status Empty Season");

        var status = await GetPlayoffStatusAsync(client, seasonId);

        status.GetProperty("lastRound").ValueKind.Should().Be(JsonValueKind.Null);
        status.GetProperty("canCreateNextSeries").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task PlayoffStatus_for_ongoing_series_reports_score_and_cannot_create_next_series()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Status Ongoing Season");
        await CreateSeriesAsync(client, seasonId);
        await PlayRoundAsync(client, seasonId, 1, true, true, false);

        var status = await GetPlayoffStatusAsync(client, seasonId);

        status.GetProperty("lastRound").GetInt32().Should().Be(1);
        status.GetProperty("hostedWins").GetInt32().Should().Be(2);
        status.GetProperty("opponentWins").GetInt32().Should().Be(1);
        status.GetProperty("seriesDecided").GetBoolean().Should().BeFalse();
        status.GetProperty("canCreateNextSeries").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task PlayoffStatus_after_hosted_team_wins_round_1_allows_round_2()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Status Won Season");
        await CreateSeriesAsync(client, seasonId);
        await PlayRoundAsync(client, seasonId, 1, true, false, true, true, true);

        var status = await GetPlayoffStatusAsync(client, seasonId);

        status.GetProperty("seriesDecided").GetBoolean().Should().BeTrue();
        status.GetProperty("hostedTeamWon").GetBoolean().Should().BeTrue();
        status.GetProperty("canCreateNextSeries").GetBoolean().Should().BeTrue();
        status.GetProperty("nextRound").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task PlayoffStatus_after_hosted_team_loses_cannot_create_next_series()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Status Lost Season");
        await CreateSeriesAsync(client, seasonId);
        await PlayRoundAsync(client, seasonId, 1, false, false, false, false);

        var status = await GetPlayoffStatusAsync(client, seasonId);

        status.GetProperty("seriesDecided").GetBoolean().Should().BeTrue();
        status.GetProperty("hostedTeamWon").GetBoolean().Should().BeFalse();
        status.GetProperty("canCreateNextSeries").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task PlayoffStatus_after_winning_the_NHL_final_cannot_create_next_series()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Status NHL Final Season");
        for (var round = 1; round <= 4; round++)
        {
            await CreateSeriesAsync(client, seasonId, opponentTeamId: round + 1);
            await PlayRoundAsync(client, seasonId, round, true, true, true, true);
        }

        var status = await GetPlayoffStatusAsync(client, seasonId);

        status.GetProperty("lastRound").GetInt32().Should().Be(4);
        status.GetProperty("hostedTeamWon").GetBoolean().Should().BeTrue();
        status.GetProperty("canCreateNextSeries").GetBoolean().Should().BeFalse();
    }

    [Fact]
    public async Task PlayoffStatus_for_IIHF_allows_next_round_after_a_single_win_until_round_3()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonWithLeagueAsync(client, "Playoff Status IIHF Season", "IIHF");

        for (var round = 1; round <= 3; round++)
        {
            await CreateSeriesAsync(client, seasonId, opponentTeamId: round + 1);
            await PlayRoundAsync(client, seasonId, round, true);

            (await GetPlayoffRoundAsync(client, seasonId, round)).Length.Should().Be(1);
            var status = await GetPlayoffStatusAsync(client, seasonId);
            status.GetProperty("hostedTeamWon").GetBoolean().Should().BeTrue();
            status.GetProperty("canCreateNextSeries").GetBoolean().Should().Be(round < 3);
        }
    }

    // ── Odds calculation for generated playoff games ────────────────────────

    private static async Task<JsonElement> WaitForOddsStatusAsync(HttpClient client, int seasonId)
    {
        JsonElement status = default;
        for (var i = 0; i < 100; i++)
        {
            var resp = await client.GetAsync($"/api/admin/seasons/{seasonId}/odds-status");
            resp.StatusCode.Should().Be(HttpStatusCode.OK);
            status = await resp.Content.ReadFromJsonAsync<JsonElement>();
            if (!status.GetProperty("inProgress").GetBoolean()) return status;
            await Task.Delay(100);
        }
        throw new TimeoutException("Odds calculation did not finish in time");
    }

    [Fact]
    public async Task CreatePlayoffSeries_calculates_odds_for_every_created_game()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Odds Series Season");
        var created = await CreateSeriesAsync(client, seasonId);

        var status = await WaitForOddsStatusAsync(client, seasonId);

        status.GetProperty("completed").GetInt32().Should().Be(4);
        status.GetProperty("failed").GetInt32().Should().Be(0);
        status.GetProperty("pendingMatchIds").GetArrayLength().Should().Be(0);
        var createdIds = created.EnumerateArray().Select(m => m.GetProperty("id").GetInt32());
        status.GetProperty("completedMatchIds").EnumerateArray().Select(e => e.GetInt32())
            .Should().BeEquivalentTo(createdIds);
    }

    [Fact]
    public async Task Appended_game_gets_its_odds_calculated()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Odds Appended Season");
        await CreateSeriesAsync(client, seasonId);
        await PlayRoundAsync(client, seasonId, 1, true, false, true, false);

        var status = await WaitForOddsStatusAsync(client, seasonId);

        var game5Id = (await GetPlayoffRoundAsync(client, seasonId, 1))[4].GetProperty("id").GetInt32();
        status.GetProperty("completedMatchIds").EnumerateArray().Select(e => e.GetInt32())
            .Should().Contain(game5Id);
        status.GetProperty("failed").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task OddsStatus_unauthenticated_returns_401()
    {
        var client = Factory.CreateClient();
        var resp = await client.GetAsync("/api/admin/seasons/1/odds-status");
        resp.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // Plays a playoff match the way the match page does: period start, one goal, then a MatchEnd event.
    private static async Task PlayPlayoffMatchViaEventsAsync(HttpClient client, JsonElement match, bool hostedWins)
    {
        var id = match.GetProperty("id").GetInt32();
        foreach (var evt in new object[]
        {
            new { eventType = "PeriodChange", isOpponent = false, eventSubtype = "1" },
            new { eventType = "Goal", isOpponent = !hostedWins },
            new { eventType = "MatchEnd", isOpponent = false, eventSubtype = "REG" },
        })
        {
            var resp = await client.PostAsJsonAsync($"/api/matches/{id}/events", evt);
            resp.EnsureSuccessStatusCode();
        }
    }

    [Fact]
    public async Task Ending_game_4_at_2_2_via_match_events_appends_game_5_and_calculates_its_odds()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Playoff Append Via Events Season");
        await CreateSeriesAsync(client, seasonId);

        var results = new[] { true, false, false, true };
        for (var i = 0; i < results.Length; i++)
        {
            var games = await GetPlayoffRoundAsync(client, seasonId, 1);
            await PlayPlayoffMatchViaEventsAsync(client, games[i], results[i]);
        }

        var round = await GetPlayoffRoundAsync(client, seasonId, 1);
        round.Length.Should().Be(5);
        AssertHostedIsHome(round[4], true);

        var status = await WaitForOddsStatusAsync(client, seasonId);
        status.GetProperty("completedMatchIds").EnumerateArray().Select(e => e.GetInt32())
            .Should().Contain(round[4].GetProperty("id").GetInt32());
    }
}
