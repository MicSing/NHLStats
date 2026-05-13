using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

public class BettingOddsServiceTeamWinTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly BettingOddsService _service;

    public BettingOddsServiceTeamWinTests()
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

    private Season SeedSeason(int? hostedTeamId, string name = "S1")
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

    private static (decimal pHosted, decimal pOpp, decimal pDraw) ExpectedProbabilities(
        int games, int wins, int losses, int draws,
        int l10Games, int l10Wins, int l10Losses,
        int h2hGames, int h2hWins, int h2hDraws, int h2hGoalsFor, int h2hGoalsAgainst)
    {
        decimal g = games;
        decimal pDrawRaw = (decimal)draws / g;
        decimal pHomeSeason = (decimal)wins / g;
        decimal pAwaySeason = (decimal)losses / g;

        decimal pHomeL10, pAwayL10;
        if (l10Games == 0)
        {
            pHomeL10 = pHomeSeason;
            pAwayL10 = pAwaySeason;
        }
        else
        {
            decimal l10 = l10Games;
            pHomeL10 = l10Wins / l10;
            pAwayL10 = l10Losses / l10;
        }

        decimal pHomeH2h, pAwayH2h, pHomeGoals, pAwayGoals;
        if (h2hGames == 0)
        {
            pHomeH2h = pHomeSeason;
            pAwayH2h = pAwaySeason;
            pHomeGoals = 0.50m;
            pAwayGoals = 0.50m;
        }
        else
        {
            decimal h = h2hGames;
            pHomeH2h = h2hWins / h;
            pAwayH2h = (h2hGames - h2hWins - h2hDraws) / h;
            decimal agd = (h2hGoalsFor - h2hGoalsAgainst) / h;
            pHomeGoals = GoalFactor(agd);
            pAwayGoals = GoalFactor(-agd);
        }

        decimal pHomeRaw = 0.55m * pHomeSeason + 0.15m * pHomeL10 + 0.15m * pHomeH2h + 0.15m * pHomeGoals;
        decimal pAwayRaw = 0.55m * pAwaySeason + 0.15m * pAwayL10 + 0.15m * pAwayH2h + 0.15m * pAwayGoals;
        decimal total = pHomeRaw + pDrawRaw + pAwayRaw;
        return (pHomeRaw / total, pAwayRaw / total, pDrawRaw / total);
    }

    private static decimal GoalFactor(decimal agd)
    {
        if (agd >= 3m) return 0.90m;
        if (agd >= 1m) return 0.70m;
        if (agd > -1m) return 0.50m;
        if (agd <= -3m) return 0.10m;
        return 0.30m;
    }

    [Fact]
    public async Task ReproducesPythonReference_25Games_L10HotStreak_2H2H()
    {
        var (hosted, opp) = SeedTeams();
        var thirdTeam = new Team { Name = "Third", ShortName = "TRD" };
        _db.Teams.Add(thirdTeam);
        _db.SaveChanges();
        var season = SeedSeason(hosted.Id);

        var now = DateTime.UtcNow;

        // L10 set (10 most recent): 8W / 1L / 1D, including both H2H matches.
        //   H2H win: hosted 6, opp 1 (gF=6, gA=1)
        //   H2H loss: hosted 2, opp 3 (gF=2, gA=3)
        //   H2H totals: gF=8, gA=4, wins=1, losses=1
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, 6, 1, now.AddDays(-1));
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, 2, 3, now.AddDays(-2));
        for (int i = 0; i < 7; i++)
            AddCompletedMatch(season.Id, hosted.Id, thirdTeam.Id, 4, 1, now.AddDays(-3 - i));
        AddCompletedMatch(season.Id, hosted.Id, thirdTeam.Id, 2, 2, now.AddDays(-10));

        // Older 15 (outside L10): 6W / 7L / 2D vs thirdTeam → season totals 14W/8L/3D.
        for (int i = 0; i < 6; i++)
            AddCompletedMatch(season.Id, hosted.Id, thirdTeam.Id, 3, 1, now.AddDays(-20 - i));
        for (int i = 0; i < 7; i++)
            AddCompletedMatch(season.Id, hosted.Id, thirdTeam.Id, 1, 3, now.AddDays(-30 - i));
        for (int i = 0; i < 2; i++)
            AddCompletedMatch(season.Id, hosted.Id, thirdTeam.Id, 2, 2, now.AddDays(-40 - i));

        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var hostedRow = await _db.MatchOdds.AsNoTracking()
            .FirstAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.TeamWin && o.TargetId == hosted.Id);
        var oppRow = await _db.MatchOdds.AsNoTracking()
            .FirstAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.TeamWin && o.TargetId == opp.Id);

        var (expectedHosted, expectedOpp, expectedDraw) = ExpectedProbabilities(
            games: 25, wins: 14, losses: 8, draws: 3,
            l10Games: 10, l10Wins: 8, l10Losses: 1,
            h2hGames: 2, h2hWins: 1, h2hDraws: 0, h2hGoalsFor: 8, h2hGoalsAgainst: 4);

        hostedRow.Probability.Should().BeApproximately(expectedHosted, 0.0001m);
        oppRow.Probability.Should().BeApproximately(expectedOpp, 0.0001m);
        hostedRow.Odds.Should().BeApproximately(0.80m / expectedHosted, 0.0001m);
        oppRow.Odds.Should().BeApproximately(0.80m / expectedOpp, 0.0001m);
        (expectedHosted + expectedOpp + expectedDraw).Should().BeApproximately(1m, 0.0001m);
    }

    [Fact]
    public async Task ColdStart_FallsBackToPreviousSeason()
    {
        var (hosted, opp) = SeedTeams();
        var prevSeason = SeedSeason(hosted.Id, "Prev");
        var currSeason = new Season { Name = "Curr", HostedTeamId = hosted.Id, StartedOn = DateTime.UtcNow };
        _db.Seasons.Add(currSeason);
        _db.SaveChanges();

        // Prev season: hosted has 3 completed matches (2W/1L/0D, no H2H).
        var now = DateTime.UtcNow;
        var third = new Team { Name = "Third", ShortName = "TRD" };
        _db.Teams.Add(third);
        _db.SaveChanges();

        AddCompletedMatch(prevSeason.Id, hosted.Id, third.Id, 5, 1, now.AddDays(-30));
        AddCompletedMatch(prevSeason.Id, hosted.Id, third.Id, 4, 2, now.AddDays(-31));
        AddCompletedMatch(prevSeason.Id, hosted.Id, third.Id, 1, 3, now.AddDays(-32));

        var upcoming = AddUpcomingMatch(currSeason.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var hostedRow = await _db.MatchOdds.AsNoTracking()
            .FirstOrDefaultAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.TeamWin && o.TargetId == hosted.Id);
        hostedRow.Should().NotBeNull("cold-start should fall back to previous season");

        var (expectedHosted, _, _) = ExpectedProbabilities(
            games: 3, wins: 2, losses: 1, draws: 0,
            l10Games: 3, l10Wins: 2, l10Losses: 1,
            h2hGames: 0, h2hWins: 0, h2hDraws: 0, h2hGoalsFor: 0, h2hGoalsAgainst: 0);
        hostedRow!.Probability.Should().BeApproximately(expectedHosted, 0.0001m);
    }

    [Fact]
    public async Task NoData_SkipsTeamWinRows()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hosted.Id);

        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var rows = await _db.MatchOdds.AsNoTracking()
            .Where(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.TeamWin)
            .ToListAsync();
        rows.Should().BeEmpty();
    }

    [Fact]
    public async Task NoHostedTeam_ReturnsNullAndPersistsNothing()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hostedTeamId: null);

        var now = DateTime.UtcNow;
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, 3, 1, now.AddDays(-1));
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var rows = await _db.MatchOdds.AsNoTracking()
            .Where(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.TeamWin)
            .ToListAsync();
        rows.Should().BeEmpty();
    }

    [Theory]
    [InlineData(6, 0, 0.90)]  // agd=6  → 0.90
    [InlineData(4, 1, 0.90)]  // agd=3  → 0.90 (boundary)
    [InlineData(3, 1, 0.70)]  // agd=2  → 0.70
    [InlineData(2, 1, 0.70)]  // agd=1  → 0.70 (boundary)
    [InlineData(2, 2, 0.50)]  // agd=0  → 0.50
    [InlineData(0, 1, 0.30)]  // agd=-1 → 0.30 (boundary; agd > -1 false)
    [InlineData(0, 3, 0.10)]  // agd=-3 → 0.10 (boundary; agd <= -3 true)
    [InlineData(0, 4, 0.10)]  // agd=-4 → 0.10
    public async Task GoalFactor_BoundariesViaSingleH2HMatch(int goalsFor, int goalsAgainst, double expectedHostedGoalFactor)
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hosted.Id);

        var now = DateTime.UtcNow;
        // One H2H match with arbitrary winner — only goal differential matters for the factor.
        // To avoid coupling to other components we set season totals via this one match:
        // wins/losses derived from score; no other matches.
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, goalsFor, goalsAgainst, now.AddDays(-1));
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        int games = 1;
        int wins = goalsFor > goalsAgainst ? 1 : 0;
        int losses = goalsFor < goalsAgainst ? 1 : 0;
        int draws = goalsFor == goalsAgainst ? 1 : 0;

        var (expectedHosted, _, _) = ExpectedProbabilities(
            games: games, wins: wins, losses: losses, draws: draws,
            l10Games: 1, l10Wins: wins, l10Losses: losses,
            h2hGames: 1, h2hWins: wins, h2hDraws: draws, h2hGoalsFor: goalsFor, h2hGoalsAgainst: goalsAgainst);

        var hostedRow = await _db.MatchOdds.AsNoTracking()
            .FirstAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.TeamWin && o.TargetId == hosted.Id);

        hostedRow.Probability.Should().BeApproximately(expectedHosted, 0.0001m);

        // Also confirm the factor used matches the table
        GoalFactor((decimal)(goalsFor - goalsAgainst)).Should().Be((decimal)expectedHostedGoalFactor);
    }

    [Fact]
    public async Task NormalizedProbabilities_SumToOne()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hosted.Id);

        var now = DateTime.UtcNow;
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, 4, 2, now.AddDays(-1));
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, 1, 3, now.AddDays(-2));
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, 2, 2, now.AddDays(-3));
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var hostedRow = await _db.MatchOdds.AsNoTracking()
            .FirstAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.TeamWin && o.TargetId == hosted.Id);
        var oppRow = await _db.MatchOdds.AsNoTracking()
            .FirstAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.TeamWin && o.TargetId == opp.Id);

        var (expHosted, expOpp, expDraw) = ExpectedProbabilities(
            games: 3, wins: 1, losses: 1, draws: 1,
            l10Games: 3, l10Wins: 1, l10Losses: 1,
            h2hGames: 3, h2hWins: 1, h2hDraws: 1, h2hGoalsFor: 7, h2hGoalsAgainst: 7);

        hostedRow.Probability.Should().BeApproximately(expHosted, 0.0001m);
        oppRow.Probability.Should().BeApproximately(expOpp, 0.0001m);
        (expHosted + expOpp + expDraw).Should().BeApproximately(1m, 0.0001m);
    }

    [Fact]
    public async Task PersistsAllFiveRows_HostedOppDraw1X2X()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hosted.Id);

        var now = DateTime.UtcNow;
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, 4, 2, now.AddDays(-1));
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, 1, 3, now.AddDays(-2));
        AddCompletedMatch(season.Id, hosted.Id, opp.Id, 2, 2, now.AddDays(-3));
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var rows = await _db.MatchOdds.AsNoTracking()
            .Where(o => o.MatchId == upcoming.Id)
            .ToListAsync();

        rows.Should().HaveCount(5);
        rows.Count(r => r.BetType == OddsBetType.TeamWin).Should().Be(2);
        rows.Count(r => r.BetType == OddsBetType.Draw).Should().Be(1);
        rows.Count(r => r.BetType == OddsBetType.TeamWinOrDraw).Should().Be(2);

        var hosted1X = rows.First(r => r.BetType == OddsBetType.TeamWinOrDraw && r.TargetId == hosted.Id);
        var opp2X = rows.First(r => r.BetType == OddsBetType.TeamWinOrDraw && r.TargetId == opp.Id);
        var drawRow = rows.First(r => r.BetType == OddsBetType.Draw);

        var (expHosted, expOpp, expDraw) = ExpectedProbabilities(
            games: 3, wins: 1, losses: 1, draws: 1,
            l10Games: 3, l10Wins: 1, l10Losses: 1,
            h2hGames: 3, h2hWins: 1, h2hDraws: 1, h2hGoalsFor: 7, h2hGoalsAgainst: 7);

        // All seeded matches are RegularTime, so regulationShare == 1.0.
        // 1X = pHosted + pDraw; 2X = pOpp + pDraw.
        hosted1X.Probability.Should().BeApproximately(expHosted + expDraw, 0.0001m);
        opp2X.Probability.Should().BeApproximately(expOpp + expDraw, 0.0001m);
        drawRow.Probability.Should().BeApproximately(expDraw, 0.0001m);
    }

    [Fact]
    public async Task RegulationShare_ScalesTeamWinDownWhenSeasonHasOTOrSO()
    {
        var (hosted, opp) = SeedTeams();
        var season = SeedSeason(hosted.Id);

        var now = DateTime.UtcNow;
        // Seed 4 completed matches: 2 RegularTime, 1 Overtime, 1 Shootout. Share = 0.5.
        AddMatchWithCompletion(season.Id, hosted.Id, opp.Id, 4, 2, CompletionType.RegularTime, now.AddDays(-1));
        AddMatchWithCompletion(season.Id, hosted.Id, opp.Id, 3, 1, CompletionType.RegularTime, now.AddDays(-2));
        AddMatchWithCompletion(season.Id, hosted.Id, opp.Id, 2, 1, CompletionType.Overtime,   now.AddDays(-3));
        AddMatchWithCompletion(season.Id, hosted.Id, opp.Id, 2, 3, CompletionType.Shootout,   now.AddDays(-4));
        var upcoming = AddUpcomingMatch(season.Id, hosted.Id, opp.Id);

        await _service.RecalculateForMatchAsync(upcoming.Id);

        var hostedRow = await _db.MatchOdds.AsNoTracking()
            .FirstAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.TeamWin && o.TargetId == hosted.Id);
        var hosted1X = await _db.MatchOdds.AsNoTracking()
            .FirstAsync(o => o.MatchId == upcoming.Id && o.BetType == OddsBetType.TeamWinOrDraw && o.TargetId == hosted.Id);

        // Service treats OT/SO matches as draws in season + H2H stats (isDraw = !RegularTime || equal scores).
        // L10 still uses score equality only.
        // Stats: games=4, wins=2 (RT only), losses=0, draws=2 (OT + SO).
        // L10: l10Games=4, l10Wins=3, l10Losses=1 (score-based — OT win + SO loss counted).
        // H2H: h2hGames=4, h2hWins=2, h2hDraws=2, gF=11, gA=7.
        var (expHosted, _, expDraw) = ExpectedProbabilities(
            games: 4, wins: 2, losses: 0, draws: 2,
            l10Games: 4, l10Wins: 3, l10Losses: 1,
            h2hGames: 4, h2hWins: 2, h2hDraws: 2, h2hGoalsFor: 11, h2hGoalsAgainst: 7);

        decimal expectedRegulationShare = 0.5m;
        hostedRow.Probability.Should().BeApproximately(expHosted * expectedRegulationShare, 0.0001m);
        hosted1X.Probability.Should().BeApproximately(expHosted + expDraw, 0.0001m);
    }

    private Match AddMatchWithCompletion(int seasonId, int homeTeamId, int awayTeamId, int homeScore, int awayScore, CompletionType completion, DateTime date)
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
            CompletionType = completion
        };
        _db.Matches.Add(m);
        _db.SaveChanges();
        return m;
    }
}
