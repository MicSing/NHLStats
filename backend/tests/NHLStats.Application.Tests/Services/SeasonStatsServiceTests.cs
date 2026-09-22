using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class SeasonStatsServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly SeasonStatsService _service;

    private readonly User _user;
    private readonly Season _season;
    private readonly Match _regularMatch;
    private readonly Match _playoffMatch;

    public SeasonStatsServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();
        _service = new SeasonStatsService(_db);

        _user = new User { Id = 1, Name = "Alice" };
        _db.Users.Add(_user);

        var homeTeam = new Team { Name = "Home", ShortName = "HOM" };
        var awayTeam = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(homeTeam, awayTeam);

        _season = new Season { Id = 1, Name = "Season 1", StartedOn = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc) };
        _db.Seasons.Add(_season);

        var positiveReason = new PointReason { Id = 1, Name = "Goal", PointType = PointType.Positive };
        _db.PointReasons.Add(positiveReason);
        _db.SaveChanges();

        _regularMatch = new Match
        {
            SeasonId = _season.Id,
            MatchNumber = 1,
            HomeTeamId = homeTeam.Id,
            AwayTeamId = awayTeam.Id,
            HomeScore = 3,
            AwayScore = 1,
            CompletionType = CompletionType.RegularTime,
            Phase = MatchPhase.RegularSeason,
        };
        _playoffMatch = new Match
        {
            SeasonId = _season.Id,
            MatchNumber = 2,
            HomeTeamId = homeTeam.Id,
            AwayTeamId = awayTeam.Id,
            HomeScore = 4,
            AwayScore = 2,
            CompletionType = CompletionType.RegularTime,
            Phase = MatchPhase.Playoff,
            PlayoffRound = 1,
        };
        _db.Matches.AddRange(_regularMatch, _playoffMatch);
        _db.SaveChanges();

        var regularUserMatch = new UserMatch { MatchId = _regularMatch.Id, UserId = _user.Id, SeasonId = _season.Id };
        var playoffUserMatch = new UserMatch { MatchId = _playoffMatch.Id, UserId = _user.Id, SeasonId = _season.Id };
        _db.UserMatches.AddRange(regularUserMatch, playoffUserMatch);
        _db.SaveChanges();

        _db.UserMatchPoints.Add(new UserMatchPoint { UserMatchId = regularUserMatch.Id, PointReasonId = positiveReason.Id, Count = 2, Amount = 0 });
        _db.UserMatchPoints.Add(new UserMatchPoint { UserMatchId = playoffUserMatch.Id, PointReasonId = positiveReason.Id, Count = 3, Amount = 0 });
        _db.UserMatchGoals.Add(new UserMatchGoal { UserMatchId = playoffUserMatch.Id, RosterPlayerId = 1, Count = 1 });
        _db.UserMatchPenalties.Add(new UserMatchPenalty { UserMatchId = playoffUserMatch.Id, RosterPlayerId = 1, Count = 1 });

        // Legacy pre-tracking totals for the same season/user — predates phase tracking entirely.
        _db.UserSeasonAggregatedData.Add(new UserSeasonAggregatedData
        {
            UserId = _user.Id,
            SeasonId = _season.Id,
            TotalPlus = 10,
            TotalMinus = 1,
            MatchesPlayed = 5,
            CreatedAt = DateTime.UtcNow,
        });
        _db.SaveChanges();
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task FetchSeasonPointsStatisticsAsync_NoPhase_MergesLegacyAndAllMatchPhases()
    {
        var result = await _service.FetchSeasonPointsStatisticsAsync();

        var userStat = result.Single(s => s.SeasonId == _season.Id).UserStats.Single(u => u.UserId == _user.Id);
        userStat.TotalPlus.Should().Be(10 + 2 + 3, "legacy plus + regular-season plus + playoff plus");
        userStat.TotalMinus.Should().Be(1, "only the legacy aggregated total contributes minus points here");
    }

    [Fact]
    public async Task FetchSeasonPointsStatisticsAsync_RegularSeasonPhase_ExcludesPlayoffMatchesButKeepsLegacy()
    {
        var result = await _service.FetchSeasonPointsStatisticsAsync(MatchPhase.RegularSeason);

        var userStat = result.Single(s => s.SeasonId == _season.Id).UserStats.Single(u => u.UserId == _user.Id);
        userStat.TotalPlus.Should().Be(10 + 2, "legacy plus + regular-season match plus only");
        userStat.TotalMinus.Should().Be(1);
    }

    [Fact]
    public async Task FetchSeasonPointsStatisticsAsync_PlayoffPhase_ExcludesRegularSeasonAndLegacyData()
    {
        var result = await _service.FetchSeasonPointsStatisticsAsync(MatchPhase.Playoff);

        var summary = result.SingleOrDefault(s => s.SeasonId == _season.Id);
        summary.Should().NotBeNull();
        var userStat = summary!.UserStats.Single(u => u.UserId == _user.Id);
        userStat.TotalPlus.Should().Be(3, "only the playoff match's points count, legacy data never counts as playoff");
        userStat.TotalMinus.Should().Be(0);
    }

    [Fact]
    public async Task FetchSeasonGoalStatisicsAsync_FiltersByPhase()
    {
        var all = await _service.FetchSeasonGoalStatisicsAsync();
        var regular = await _service.FetchSeasonGoalStatisicsAsync(MatchPhase.RegularSeason);
        var playoff = await _service.FetchSeasonGoalStatisicsAsync(MatchPhase.Playoff);

        all.Single(s => s.SeasonId == _season.Id).UserStats.Single(u => u.UserId == _user.Id).TotalGoals.Should().Be(1);
        regular.Should().BeEmpty("the goal was scored in the playoff match only");
        playoff.Single(s => s.SeasonId == _season.Id).UserStats.Single(u => u.UserId == _user.Id).TotalGoals.Should().Be(1);
    }

    [Fact]
    public async Task FetchSeasonPenaltyStatisticsAsync_FiltersByPhase()
    {
        var all = await _service.FetchSeasonPenaltyStatisticsAsync();
        var regular = await _service.FetchSeasonPenaltyStatisticsAsync(MatchPhase.RegularSeason);
        var playoff = await _service.FetchSeasonPenaltyStatisticsAsync(MatchPhase.Playoff);

        all.Single(s => s.SeasonId == _season.Id).UserStats.Single(u => u.UserId == _user.Id).TotalPenalties.Should().Be(1);
        regular.Should().BeEmpty("the penalty was taken in the playoff match only");
        playoff.Single(s => s.SeasonId == _season.Id).UserStats.Single(u => u.UserId == _user.Id).TotalPenalties.Should().Be(1);
    }
}
