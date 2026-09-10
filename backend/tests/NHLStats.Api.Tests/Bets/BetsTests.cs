using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;

namespace NHLStats.Api.Tests;

public class BetsTests : ApiTestBase
{
    public BetsTests(CustomWebApplicationFactory factory) : base(factory) { }

    private async Task<int> CreateSeasonAsync(HttpClient client, string name = "Bet Test Season")
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

    private async Task<int> CreateFutureMatchAsync(HttpClient client, int seasonId, int homeTeamId = 1, int awayTeamId = 2)
    {
        var createResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new
        {
            homeTeamId,
            awayTeamId
        });
        createResp.EnsureSuccessStatusCode();

        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var matchId = created.GetProperty("id").GetInt32();

        var updateResp = await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
        {
            homeTeamId,
            awayTeamId,
            homeScore = 0,
            awayScore = 0,
            matchDate = DateTime.UtcNow.AddDays(1).ToString("O"),
            completionType = 0
        });
        updateResp.EnsureSuccessStatusCode();

        return matchId;
    }

    /// <summary>
    /// Ensures the admin ApplicationUser has a linked User entity and seeds positive points for them.
    /// Returns the linked User id.
    /// </summary>
    private async Task<int> EnsureUserLinkedAndSeedPointsAsync(HttpClient client, int seasonId)
    {
        var meResp = await client.GetAsync("/api/auth/me");
        meResp.EnsureSuccessStatusCode();
        var me = await meResp.Content.ReadFromJsonAsync<JsonElement>();
        var loginId = me.GetProperty("id").GetString()!;

        int userId;
        if (me.TryGetProperty("userId", out var userIdProp) && userIdProp.ValueKind != JsonValueKind.Null)
        {
            userId = userIdProp.GetInt32();
        }
        else
        {
            var createUserResp = await client.PostAsJsonAsync("/api/users", new { name = "Test Admin User" });
            createUserResp.EnsureSuccessStatusCode();
            var createdUser = await createUserResp.Content.ReadFromJsonAsync<JsonElement>();
            userId = createdUser.GetProperty("id").GetInt32();

            var attachResp = await client.PutAsJsonAsync($"/api/auth/users/{loginId}/attach-user", new { userId });
            attachResp.EnsureSuccessStatusCode();
        }

        var addUserResp = await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        if (!addUserResp.IsSuccessStatusCode && addUserResp.StatusCode != HttpStatusCode.Conflict)
            addUserResp.EnsureSuccessStatusCode();

        var completedMatchResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new { homeTeamId = 3, awayTeamId = 4 });
        completedMatchResp.EnsureSuccessStatusCode();
        var completedMatch = await completedMatchResp.Content.ReadFromJsonAsync<JsonElement>();
        var completedMatchId = completedMatch.GetProperty("id").GetInt32();

        await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}", new
        {
            homeTeamId = 3,
            awayTeamId = 4,
            homeScore = 0,
            awayScore = 0,
            matchDate = (string?)null,
            completionType = 4 // InProgress
        });

        await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}", new
        {
            homeTeamId = 3,
            awayTeamId = 4,
            homeScore = 2,
            awayScore = 1,
            matchDate = DateTime.UtcNow.AddDays(-1).ToString("O"),
            completionType = 1
        });

        await client.PostAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}/usermatches/initialize", null);

        var umResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{completedMatchId}/usermatches");
        if (!umResp.IsSuccessStatusCode) return userId;
        var ums = await umResp.Content.ReadFromJsonAsync<JsonElement>();
        if (ums.GetArrayLength() == 0) return userId;

        var userMatchId = ums[0].GetProperty("id").GetInt32();

        var pointResp = await client.PostAsJsonAsync($"/api/usermatches/{userMatchId}/points", new { pointReasonId = 9, count = 8 });
        pointResp.EnsureSuccessStatusCode();

        return userId;
    }

    [Fact]
    public async Task Place_hosted_shutout_bet_returns_201()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Shutout Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[] { new { matchId, betType = "HostedShutoutWin" } }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("legs")[0].GetProperty("betType").GetString().Should().Be("HostedShutoutWin");
    }

    [Fact]
    public async Task Place_both_shutout_legs_on_same_match_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Shutout Exclusivity Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[]
            {
                new { matchId, betType = "HostedShutoutWin" },
                new { matchId, betType = "OpponentShutoutWin" }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Place_team_win_and_shutout_on_same_match_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "TeamWin And Shutout Conflict Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new object[]
            {
                new { matchId, betType = "TeamWin", teamId = 1 },
                new { matchId, betType = "HostedShutoutWin" }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    /// <summary>
    /// Seeds `countsPerMatch.Length` completed matches for the given user's point history,
    /// adding the given number of distinct point rows (cycling through `reasonIds`) to each —
    /// used to give BettingOddsService a real track record so a plus/minus-point market is
    /// actually bettable (a user with zero history has Probability == 0, which is always below
    /// BettingConstants.MinBettableProbability and gets rejected outright, or — depending on
    /// unrelated test/global state — the market simply isn't priced at all yet, defaulting to
    /// odds 1.0). `userId` must belong to a user with NO other point history in the shared test
    /// database (e.g. a dedicated user created just for this test, not the shared admin user
    /// other tests in this class also seed via EnsureUserLinkedAndSeedPointsAsync) —
    /// BettingOddsService's "last10"/"prev" windows for plus/minus points are not season-scoped,
    /// so a shared user's history would make the resulting probability depend on unrelated test
    /// execution order.
    /// </summary>
    private static readonly int[] PositiveReasonIds = { 9, 10 };  // seeded Positive "Penalty" / "Secondary Penalty"
    private static readonly int[] NegativeReasonIds = { 1, 2 };   // seeded Negative "Penalty" / "Secondary Penalty"

    private async Task SeedPointHistoryAsync(HttpClient client, int seasonId, int userId, int[] reasonIds, params int[] countsPerMatch)
    {
        foreach (var count in countsPerMatch)
        {
            var createResp = await client.PostAsJsonAsync($"/api/seasons/{seasonId}/matches", new { homeTeamId = 3, awayTeamId = 4 });
            createResp.EnsureSuccessStatusCode();
            var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
            var matchId = created.GetProperty("id").GetInt32();

            await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
            {
                homeTeamId = 3,
                awayTeamId = 4,
                homeScore = 0,
                awayScore = 0,
                matchDate = (string?)null,
                completionType = 4 // InProgress
            });

            await client.PutAsJsonAsync($"/api/seasons/{seasonId}/matches/{matchId}", new
            {
                homeTeamId = 3,
                awayTeamId = 4,
                homeScore = 2,
                awayScore = 1,
                matchDate = DateTime.UtcNow.AddDays(-1).ToString("O"),
                completionType = 1
            });

            await client.PostAsync($"/api/seasons/{seasonId}/matches/{matchId}/usermatches/initialize", null);

            var umResp = await client.GetAsync($"/api/seasons/{seasonId}/matches/{matchId}/usermatches");
            umResp.EnsureSuccessStatusCode();
            var ums = await umResp.Content.ReadFromJsonAsync<JsonElement>();
            var userMatchId = ums.EnumerateArray().First(u => u.GetProperty("userId").GetInt32() == userId).GetProperty("id").GetInt32();

            for (int i = 0; i < count; i++)
            {
                var pointResp = await client.PostAsJsonAsync($"/api/usermatches/{userMatchId}/points",
                    new { pointReasonId = reasonIds[i % reasonIds.Length], count = 1 });
                pointResp.EnsureSuccessStatusCode();
            }
        }
    }

    [Fact]
    public async Task Place_hosted_shutout_and_plus_point_occasions_one_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Shutout PlusPoint Correlation Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        var userId = await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new object[]
            {
                new { matchId, betType = "HostedShutoutWin" },
                new { matchId, betType = "UserPlusPoint", userId }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Place_plus_point_then_hosted_shutout_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "PlusPoint Then Shutout Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        var userId = await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new object[]
            {
                new { matchId, betType = "UserPlusPoint", userId },
                new { matchId, betType = "HostedShutoutWin" }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Place_opponent_shutout_and_minus_point_occasions_one_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Shutout MinusPoint Correlation Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        var userId = await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new object[]
            {
                new { matchId, betType = "OpponentShutoutWin" },
                new { matchId, betType = "UserMinusPoint", userId }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Place_hosted_shutout_and_plus_point_occasions_two_returns_201()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Shutout PlusPoint Occasions Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId); // gives the bettor (admin) enough balance

        // Use a dedicated target user (not the shared admin user other tests in this class also
        // seed via EnsureUserLinkedAndSeedPointsAsync) so this test's Occasions=2 probability
        // math is deterministic regardless of what other tests already ran in the shared DB —
        // see SeedPointHistoryAsync's doc comment.
        var createTargetResp = await client.PostAsJsonAsync("/api/users", new { name = "Occasions Target User" });
        createTargetResp.EnsureSuccessStatusCode();
        var target = await createTargetResp.Content.ReadFromJsonAsync<JsonElement>();
        var userId = target.GetProperty("id").GetInt32();
        await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);

        // Build enough Positive-point history for Occasions=2 to be a bettable, non-guaranteed price.
        await SeedPointHistoryAsync(client, seasonId, userId, PositiveReasonIds, 1, 1, 2, 2);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new object[]
            {
                new { matchId, betType = "HostedShutoutWin" },
                new { matchId, betType = "UserPlusPoint", userId, occasions = 2 }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("legs").GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task Place_hosted_shutout_and_minus_point_same_match_returns_201()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Shutout MinusPoint NonCorrelated Season");
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId); // gives the bettor (admin) enough balance

        // Dedicated target user with its own seeded Negative-point history — see
        // SeedPointHistoryAsync's doc comment for why a shared user isn't safe here. A user with
        // zero negative-point history would have Probability == 0 for UserMinusPoint, which is
        // always below MinBettableProbability once a MatchOdds row for it exists.
        var createTargetResp = await client.PostAsJsonAsync("/api/users", new { name = "Shutout MinusPoint Target User" });
        createTargetResp.EnsureSuccessStatusCode();
        var target = await createTargetResp.Content.ReadFromJsonAsync<JsonElement>();
        var userId = target.GetProperty("id").GetInt32();
        await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);
        // A rate too close to 0 leaves Probability below MinBettableProbability; too close to 1
        // pushes the computed odds below MinBettableOdds (a near-certain event isn't worth
        // offering odds on at all under the margin formula) — 2 of 5 matches lands comfortably
        // in between.
        await SeedPointHistoryAsync(client, seasonId, userId, NegativeReasonIds, 0, 0, 0, 1, 1);

        // Create the future match to bet on only AFTER the target's history is fully seeded:
        // each completed match above can trigger a background odds recalculation for whichever
        // upcoming matches are currently "next" globally, and that recalculation is a one-shot
        // snapshot cached in MatchOdds (nothing re-triggers it later just because more history
        // arrives) — creating the bet match first risked it being caught mid-seed with a
        // still-incomplete (e.g. zero) probability baked in permanently.
        var matchId = await CreateFutureMatchAsync(client, seasonId);

        // HostedShutoutWin only auto-guarantees UserPlusPoint (not UserMinusPoint) on the same
        // match, so this cross-pair must remain allowed.
        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new object[]
            {
                new { matchId, betType = "HostedShutoutWin" },
                new { matchId, betType = "UserMinusPoint", userId }
            }
        });
        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("legs").GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task Place_hosted_shutout_and_plus_point_different_matches_returns_201()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Shutout PlusPoint CrossMatch Season");
        // Seed the bettor's own history before creating the future matches — see the ordering
        // note in Place_hosted_shutout_and_minus_point_same_match_returns_201 for why creating
        // the bet matches first risks a background odds recalculation catching them mid-seed.
        var userId = await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);
        var match1 = await CreateFutureMatchAsync(client, seasonId);
        var match2 = await CreateFutureMatchAsync(client, seasonId, homeTeamId: 1, awayTeamId: 7);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new object[]
            {
                new { matchId = match1, betType = "HostedShutoutWin" },
                new { matchId = match2, betType = "UserPlusPoint", userId }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("legs").GetArrayLength().Should().Be(2);
    }

    [Fact]
    public async Task Place_two_plus_point_legs_on_same_match_returns_400()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "PlusPoint Cap Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var usersResp = await client.GetAsync($"/api/seasons/{seasonId}/users");
        usersResp.EnsureSuccessStatusCode();

        var createUser2Resp = await client.PostAsJsonAsync("/api/users", new { name = "Second Better Target" });
        createUser2Resp.EnsureSuccessStatusCode();
        var user2 = await createUser2Resp.Content.ReadFromJsonAsync<JsonElement>();
        var user2Id = user2.GetProperty("id").GetInt32();
        await client.PostAsync($"/api/seasons/{seasonId}/users/{user2Id}", null);

        var createUser3Resp = await client.PostAsJsonAsync("/api/users", new { name = "Third Better Target" });
        createUser3Resp.EnsureSuccessStatusCode();
        var user3 = await createUser3Resp.Content.ReadFromJsonAsync<JsonElement>();
        var user3Id = user3.GetProperty("id").GetInt32();
        await client.PostAsync($"/api/seasons/{seasonId}/users/{user3Id}", null);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[]
            {
                new { matchId, betType = "UserPlusPoint", userId = user2Id },
                new { matchId, betType = "UserPlusPoint", userId = user3Id }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Recalculate_correlated_odds_requires_admin_role_and_returns_200()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.PostAsync("/api/admin/bets/recalculate-correlated-odds", null);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("betsUpdated").GetInt32().Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task Recalculate_upcoming_odds_requires_admin_role_and_returns_200()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.PostAsync("/api/admin/odds/recalculate-upcoming", null);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("matchesUpdated").GetInt32().Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task Recalculate_historical_odds_requires_admin_role_and_returns_200()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.PostAsync("/api/admin/bets/recalculate-historical-odds", null);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("betsUpdated").GetInt32().Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task Place_single_leg_ticket_returns_201_with_short_id_and_one_leg()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Create Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[]
            {
                new { matchId, betType = "TeamWin", teamId = 1 }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("stake").GetDecimal().Should().Be(1.0m);
        body.GetProperty("status").GetString().Should().Be("Pending");
        body.GetProperty("shortId").GetString().Should().StartWith("B-");
        body.GetProperty("legs").GetArrayLength().Should().Be(1);
        body.GetProperty("legs")[0].GetProperty("matchId").GetInt32().Should().Be(matchId);
    }

    [Fact]
    public async Task Place_two_leg_combo_multiplies_odds()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Combo Season");
        // Both matches host team 1 (the season's hosted team) so TeamWin legs on team 1 validate.
        var match1 = await CreateFutureMatchAsync(client, seasonId);
        var match2 = await CreateFutureMatchAsync(client, seasonId, homeTeamId: 1, awayTeamId: 7);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var resp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[]
            {
                new { matchId = match1, betType = "TeamWin", teamId = 1 },
                new { matchId = match2, betType = "TeamWin", teamId = 1 }
            }
        });

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("legs").GetArrayLength().Should().Be(2);
        var totalOdds = body.GetProperty("totalOdds").GetDecimal();
        var leg0Odds = body.GetProperty("legs")[0].GetProperty("odds").GetDecimal();
        var leg1Odds = body.GetProperty("legs")[1].GetProperty("odds").GetDecimal();
        totalOdds.Should().BeApproximately(leg0Odds * leg1Odds, 0.0001m);
    }

    [Fact]
    public async Task Cancel_bet_returns_204_and_removes_ticket()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Bet Cancel Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var createResp = await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[] { new { matchId, betType = "TeamWin", teamId = 1 } }
        });
        createResp.EnsureSuccessStatusCode();
        var created = await createResp.Content.ReadFromJsonAsync<JsonElement>();
        var betId = created.GetProperty("id").GetString();

        var cancelResp = await client.DeleteAsync($"/api/betting/bets/{betId}");
        cancelResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        var activeResp = await client.GetAsync("/api/betting/bets/active");
        activeResp.EnsureSuccessStatusCode();
        var active = await activeResp.Content.ReadFromJsonAsync<JsonElement>();
        active.GetArrayLength().Should().Be(0);
    }

    [Fact]
    public async Task Active_endpoint_lists_only_pending_tickets()
    {
        var client = await CreateAuthenticatedClientAsync();
        var seasonId = await CreateSeasonAsync(client, "Active List Season");
        var matchId = await CreateFutureMatchAsync(client, seasonId);
        await EnsureUserLinkedAndSeedPointsAsync(client, seasonId);

        var beforeResp = await client.GetAsync("/api/betting/bets/active");
        beforeResp.EnsureSuccessStatusCode();
        var beforeCount = (await beforeResp.Content.ReadFromJsonAsync<JsonElement>()).GetArrayLength();

        await client.PostAsJsonAsync("/api/betting/bets", new
        {
            stake = 1.0,
            legs = new[] { new { matchId, betType = "TeamWin", teamId = 1 } }
        });

        var resp = await client.GetAsync("/api/betting/bets/active");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetArrayLength().Should().Be(beforeCount + 1);
        foreach (var ticket in body.EnumerateArray())
        {
            ticket.GetProperty("status").GetString().Should().Be("Pending");
        }
    }

    [Fact]
    public async Task Get_betting_balance_returns_200()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.GetAsync("/api/betting/balance");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
        var body = await resp.Content.ReadFromJsonAsync<JsonElement>();
        body.GetProperty("availableBalance").GetDecimal().Should().BeGreaterThanOrEqualTo(0);
    }

    [Fact]
    public async Task Get_betting_history_returns_200()
    {
        var client = await CreateAuthenticatedClientAsync();
        var resp = await client.GetAsync("/api/betting/bets/history");
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Get_betting_balance_includes_aggregated_positive_points()
    {
        var client = await CreateAuthenticatedClientAsync();

        var meResp = await client.GetAsync("/api/auth/me");
        meResp.EnsureSuccessStatusCode();
        var me = await meResp.Content.ReadFromJsonAsync<JsonElement>();

        int userId;
        if (me.TryGetProperty("userId", out var userIdProp) && userIdProp.ValueKind != JsonValueKind.Null)
        {
            userId = userIdProp.GetInt32();
        }
        else
        {
            var createUserResp = await client.PostAsJsonAsync("/api/users", new { name = "Agg Balance User" });
            createUserResp.EnsureSuccessStatusCode();
            var createdUser = await createUserResp.Content.ReadFromJsonAsync<JsonElement>();
            userId = createdUser.GetProperty("id").GetInt32();

            var loginId = me.GetProperty("id").GetString()!;
            var attachResp = await client.PutAsJsonAsync($"/api/auth/users/{loginId}/attach-user", new { userId });
            attachResp.EnsureSuccessStatusCode();
        }

        var before = await client.GetAsync("/api/betting/balance");
        before.EnsureSuccessStatusCode();
        var beforeBody = await before.Content.ReadFromJsonAsync<JsonElement>();
        var balanceBefore = beforeBody.GetProperty("availableBalance").GetDecimal();
        var positiveCashBefore = beforeBody.GetProperty("totalPositiveCash").GetDecimal();

        var seasonResp = await client.PostAsJsonAsync("/api/seasons", new
        {
            name = "Agg Balance Season",
            startedOn = "2020-01-01T00:00:00"
        });
        seasonResp.EnsureSuccessStatusCode();
        var season = await seasonResp.Content.ReadFromJsonAsync<JsonElement>();
        var seasonId = season.GetProperty("id").GetInt32();

        await client.PostAsync($"/api/seasons/{seasonId}/users/{userId}", null);

        var aggResp = await client.PostAsJsonAsync(
            $"/api/users/{userId}/seasons/{seasonId}/aggregated-data",
            new { totalPlus = 4, totalMinus = 0, matchesPlayed = 0 });
        aggResp.EnsureSuccessStatusCode();

        var after = await client.GetAsync("/api/betting/balance");
        after.EnsureSuccessStatusCode();
        var afterBody = await after.Content.ReadFromJsonAsync<JsonElement>();
        var balanceAfter = afterBody.GetProperty("availableBalance").GetDecimal();
        var positiveCashAfter = afterBody.GetProperty("totalPositiveCash").GetDecimal();

        positiveCashAfter.Should().Be(positiveCashBefore + 1.00m,
            "4 aggregated positive points × 0.25€ = 1.00€ added to totalPositiveCash");
        balanceAfter.Should().Be(balanceBefore + 1.00m,
            "available balance increases by the same 1.00€");
    }
}
