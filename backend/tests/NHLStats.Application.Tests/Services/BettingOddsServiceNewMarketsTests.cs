using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

public class BettingOddsServiceNewMarketsTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly BettingOddsService _service;

    public BettingOddsServiceNewMarketsTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();
        _service = new BettingOddsService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private (Team hosted, Team opponent) SeedTeams()
    {
        var hosted = new Team { Name = "Hosted", ShortName = "HST" };
        var opponent = new Team { Name = "Opp", ShortName = "OPP" };
        _db.Teams.AddRange(hosted, opponent);
        _db.SaveChanges();
        return (hosted, opponent);
    }

    private Season SeedSeason(int? hostedTeamId) =>
        SeedSeasonNamed(hostedTeamId, "S1");

    private Season SeedSeasonNamed(int? hostedTeamId, string name)
    {
        var season = new Season { Name = name, HostedTeamId = hostedTeamId, StartedOn = DateTime.UtcNow };
        _db.Seasons.Add(season);
        _db.SaveChanges();
        return season;
    }

    private Match AddCompletedMatch(int seasonId, int homeTeamId, int awayTeamId, int homeScore, int awayScore, DateTime date)
    {
        var m = new Match
        {
            SeasonId = seasonId,
            MatchNumber = _db.Matches.Count() + 1,
            HomeTeamId = homeTeamId,
            AwayTeamId = awayTeamId,
            HomeScore = homeScore,
            AwayScore = awayScore,
            MatchDate = date,
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.Add(m);
        _db.SaveChanges();
        return m;
    }

    private Match AddUpcomingMatch(int seasonId, int homeTeamId, int awayTeamId)
    {
        var m = new Match
        {
            SeasonId = seasonId,
            MatchNumber = _db.Matches.Count() + 1,
            HomeTeamId = homeTeamId,
            AwayTeamId = awayTeamId,
            HomeScore = 0,
            AwayScore = 0,
            MatchDate = DateTime.UtcNow.AddDays(1),
            CompletionType = CompletionType.None
        };
        _db.Matches.Add(m);
        _db.SaveChanges();
        return m;
    }

    private async Task Seed10CompletedMatchesAsync(int seasonId, int homeTeamId, int awayTeamId, int totalGoalsEach)
    {
        var now = DateTime.UtcNow;
        int home = totalGoalsEach / 2;
        int away = totalGoalsEach - home;
        for (int i = 0; i < 10; i++)
            AddCompletedMatch(seasonId, homeTeamId, awayTeamId, home, away, now.AddDays(-1 - i));
        await Task.CompletedTask;
    }

    // Varied totals (not a single deterministic score) so the resulting probability curve has a
    // realistic gradient across thresholds rather than a cliff from ~99% straight to ~1%.
    private void Seed10CompletedMatchesVaried(int seasonId, int homeTeamId, int awayTeamId, int[] totals)
    {
        var now = DateTime.UtcNow;
        for (int i = 0; i < totals.Length; i++)
        {
            int home = totals[i] / 2;
            int away = totals[i] - home;
            AddCompletedMatch(seasonId, homeTeamId, awayTeamId, home, away, now.AddDays(-1 - i));
        }
    }

    [Fact]
    public async Task MatchTotalGoals_NotComputed_WhenFewerThan10CompletedMatches()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hosted.Id);
        var now = DateTime.UtcNow;
        for (int i = 0; i < 9; i++)
            AddCompletedMatch(season.Id, hosted.Id, opp.Id, 3, 2, now.AddDays(-1 - i));
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var rows = await _db.MatchOdds.AsNoTracking()
            .Where(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.MatchTotalGoals)
            .ToListAsync();
        rows.Should().BeEmpty();
    }

    [Fact]
    public async Task MatchTotalGoals_ComputesFourNWindow_WhenEnoughData()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hosted.Id);
        // Varied totals give a realistic gradient: high rate at low N, tapering off at high N.
        Seed10CompletedMatchesVaried(season.Id, hosted.Id, opp.Id, [3, 4, 5, 6, 4, 5, 3, 7, 4, 5]);
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var rows = await _db.MatchOdds.AsNoTracking()
            .Where(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.MatchTotalGoals)
            .OrderBy(o => o.TargetId)
            .ToListAsync();

        rows.Should().HaveCount(4, "the window always exposes exactly 4 consecutive thresholds");
        var thresholds = rows.Select(r => r.TargetId!.Value).ToList();
        thresholds.Should().BeInAscendingOrder();
        for (int i = 1; i < thresholds.Count; i++)
            thresholds[i].Should().Be(thresholds[i - 1] + 1, "the window is 4 consecutive N values");
        thresholds[0].Should().BeGreaterThanOrEqualTo(3, "the floor threshold is 3+");

        // Probability must be strictly non-increasing as N grows.
        for (int i = 1; i < rows.Count; i++)
            rows[i].Probability.Should().BeLessThanOrEqualTo(rows[i - 1].Probability);
    }

    [Fact]
    public async Task MatchTotalGoals_WindowSlidesUp_WhenLowThresholdsAreNearCertain()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hosted.Id);
        // Every match scores a lot of goals — 3+ should be a near-certainty, forcing the window up.
        await Seed10CompletedMatchesAsync(season.Id, hosted.Id, opp.Id, 12);
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var rows = await _db.MatchOdds.AsNoTracking()
            .Where(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.MatchTotalGoals)
            .OrderBy(o => o.TargetId)
            .ToListAsync();

        if (rows.Count > 0)
            rows[0].TargetId.Should().BeGreaterThan(3, "3+ is unbettable (odds < 1.0) so the window should slide up");
    }

    [Fact]
    public async Task HostedShutoutWin_And_OpponentShutoutWin_AreComplementaryAtomicMarkets()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hosted.Id);
        var now = DateTime.UtcNow;
        // Hosted team shuts out the opponent in half the matches, loses without a shutout in the other half.
        for (int i = 0; i < 5; i++)
            AddCompletedMatch(season.Id, hosted.Id, opp.Id, 3, 0, now.AddDays(-1 - i));
        for (int i = 0; i < 5; i++)
            AddCompletedMatch(season.Id, hosted.Id, opp.Id, 1, 2, now.AddDays(-10 - i));
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var hostedRow = await _db.MatchOdds.AsNoTracking()
            .FirstOrDefaultAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.HostedShutoutWin);
        var opponentRow = await _db.MatchOdds.AsNoTracking()
            .FirstOrDefaultAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.OpponentShutoutWin);

        hostedRow.Should().NotBeNull();
        opponentRow.Should().NotBeNull();
        hostedRow!.Probability.Should().BeGreaterThan(0m);
        // Opponent never shut out the hosted team in this fixture — probability should be low (h2h/home-away buckets are 0).
        opponentRow!.Probability.Should().BeLessThan(hostedRow.Probability);
    }

    [Fact]
    public async Task ShutoutWin_UsesTeamSpecificRate_NotLeagueWideAnySideRate()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hosted.Id);
        var now = DateTime.UtcNow;
        // Hosted team gets shut out by the opponent far more often than it shuts the opponent out —
        // a realistic asymmetry (weaker team). If buckets were still "any team, league-wide" this
        // asymmetry would be invisible in the 65%+15% season/last10 weight.
        for (int i = 0; i < 8; i++)
            AddCompletedMatch(season.Id, hosted.Id, opp.Id, 0, 2, now.AddDays(-1 - i)); // opponent shuts hosted out
        for (int i = 0; i < 2; i++)
            AddCompletedMatch(season.Id, hosted.Id, opp.Id, 3, 0, now.AddDays(-20 - i)); // hosted shuts opponent out
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var hostedRow = await _db.MatchOdds.AsNoTracking()
            .FirstOrDefaultAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.HostedShutoutWin);
        var opponentRow = await _db.MatchOdds.AsNoTracking()
            .FirstOrDefaultAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.OpponentShutoutWin);

        hostedRow.Should().NotBeNull();
        opponentRow.Should().NotBeNull();
        // Hosted only shut out the opponent in 2/10 games; opponent shut out hosted in 8/10 games.
        // The team-specific rate must reflect that clearly, not converge toward a shared league-wide prior.
        opponentRow!.Probability.Should().BeGreaterThan(hostedRow!.Probability,
            "opponent shuts out the hosted team far more often in this fixture, and buckets are now team-specific");
        hostedRow.Probability.Should().BeApproximately(0.65m * 0.2m + 0.15m * 0.2m + 0.10m * 0.2m + 0.10m * 0.2m, 0.0001m);
        opponentRow.Probability.Should().BeApproximately(0.65m * 0.8m + 0.15m * 0.8m + 0.10m * 0.8m + 0.10m * 0.8m, 0.0001m);
    }

    [Fact]
    public async Task OpponentShutoutWin_UsesHostedTeamsOwnShutoutLossRate_NotOpponentsSparseHistory()
    {
        // This app only tracks the hosted team's full season — an "opponent" team only appears in
        // whatever handful of matches it played against the hosted team, so it has no independent
        // season/last10/home-away history of its own to draw a rate from. OpponentShutoutWin must
        // be computed from the hosted team's own shutout-LOSS rate instead, using the same buckets
        // as HostedShutoutWin's shutout-WIN rate.
        var (hosted, opp) = SeedTeams();
        var otherTeam = new Team { Name = "Other", ShortName = "OTH" };
        _db.Teams.Add(otherTeam);
        _db.SaveChanges();
        var season = SeedSeason(hosted.Id);
        var now = DateTime.UtcNow;

        // Hosted plays 10 season matches total, only 1 of them against `opp` (sparse H2H).
        // 3 shutout wins (hosted scores, opponent held to 0), 5 shutout losses (hosted held to 0).
        for (int i = 0; i < 3; i++)
            AddCompletedMatch(season.Id, hosted.Id, otherTeam.Id, 2, 0, now.AddDays(-1 - i));   // shutout win
        for (int i = 0; i < 5; i++)
            AddCompletedMatch(season.Id, hosted.Id, otherTeam.Id, 0, 2, now.AddDays(-10 - i));  // shutout loss
        for (int i = 0; i < 2; i++)
            AddCompletedMatch(season.Id, hosted.Id, otherTeam.Id, 1, 1, now.AddDays(-20 - i));  // no shutout
        AddCompletedMatch(season.Id, opp.Id, hosted.Id, 3, 1, now.AddDays(-30));                // the only H2H game, no shutout

        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);
        await _service.RecalculateForMatchAsync(upcoming.Id);

        var hostedRow = await _db.MatchOdds.AsNoTracking()
            .FirstOrDefaultAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.HostedShutoutWin);
        var opponentRow = await _db.MatchOdds.AsNoTracking()
            .FirstOrDefaultAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.OpponentShutoutWin);

        hostedRow.Should().NotBeNull();
        opponentRow.Should().NotBeNull();
        // Before the fix, opponentRow's season/last10/home-away buckets would come from `opp`'s own
        // near-empty match history (only the 1 H2H game), producing a near-zero or unavailable rate
        // despite hosted actually getting shut out in 5/10 games this season.
        opponentRow!.Probability.Should().BeGreaterThan(hostedRow!.Probability,
            "hosted was shut out in 5/10 games but only shut out the opponent in 3/10 — opponent-shutout should be the more likely market");
    }

    [Fact]
    public async Task ShutoutWin_NotComputed_WhenNoHostedTeam()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hostedTeamId: null);
        var now = DateTime.UtcNow;
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, 3, 0, now.AddDays(-1));
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var rows = await _db.MatchOdds.AsNoTracking()
            .Where(o => o.MatchId == upcoming.Id &&
                        (o.BetType == OddsBetType.HostedShutoutWin || o.BetType == OddsBetType.OpponentShutoutWin))
            .ToListAsync();
        rows.Should().BeEmpty();
    }
}
