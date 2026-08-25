using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

public class RecalculateUpcomingTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly BettingOddsService _service;

    public RecalculateUpcomingTests()
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

    private (Team hosted, Team opp, Season season) SetupSeasonWithHistory()
    {
        var hosted = new Team { Name = "Hosted", ShortName = "HST" };
        var opp = new Team { Name = "Opp", ShortName = "OPP" };
        _db.Teams.AddRange(hosted, opp);
        _db.SaveChanges();

        var season = new Season { Name = "S1", HostedTeamId = hosted.Id, StartedOn = DateTime.UtcNow.AddDays(-10) };
        _db.Seasons.Add(season);
        _db.SaveChanges();

        // Add 1 completed match so team has match history for odds calculation
        var completedMatch = new Match
        {
            SeasonId = season.Id,
            MatchNumber = 1,
            HomeTeamId = hosted.Id,
            AwayTeamId = opp.Id,
            HomeScore = 3,
            AwayScore = 2,
            MatchDate = DateTime.UtcNow.AddDays(-5),
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.Add(completedMatch);
        _db.SaveChanges();

        return (hosted, opp, season);
    }

    [Fact]
    public async Task RecalculateUpcomingAsync_OnlyRecalculatesSpecifiedCountOfMatches()
    {
        // Arrange
        var (hosted, opp, season) = SetupSeasonWithHistory();

        // Create 10 upcoming matches
        var matchIds = new List<int>();
        for (int i = 1; i <= 10; i++)
        {
            var match = new Match
            {
                SeasonId = season.Id,
                MatchNumber = i + 1,
                HomeTeamId = hosted.Id,
                AwayTeamId = opp.Id,
                MatchDate = DateTime.UtcNow.AddDays(i),
                CompletionType = CompletionType.None
            };
            _db.Matches.Add(match);
            _db.SaveChanges();
            matchIds.Add(match.Id);
        }

        // Act - recalculate for only top 3
        await _service.RecalculateUpcomingAsync(3);

        // Assert - exactly the first 3 matches have odds computed in DB
        var distinctMatchIdsWithOdds = await _db.MatchOdds
            .Select(o => o.MatchId)
            .Distinct()
            .ToListAsync();

        distinctMatchIdsWithOdds.Should().HaveCount(3);
        distinctMatchIdsWithOdds.Should().Contain(new[] { matchIds[0], matchIds[1], matchIds[2] });
        distinctMatchIdsWithOdds.Should().NotContain(matchIds[3]);
    }

    [Fact]
    public async Task GetMatchOddsAsync_ComputesOddsOnDemandIfMissing()
    {
        // Arrange
        var (hosted, opp, season) = SetupSeasonWithHistory();

        var match = new Match
        {
            SeasonId = season.Id,
            MatchNumber = 2,
            HomeTeamId = hosted.Id,
            AwayTeamId = opp.Id,
            MatchDate = DateTime.UtcNow.AddDays(1),
            CompletionType = CompletionType.None
        };
        _db.Matches.Add(match);
        _db.SaveChanges();

        // DB currently has NO odds for this match
        (await _db.MatchOdds.AnyAsync(o => o.MatchId == match.Id)).Should().BeFalse();

        // Act - request odds for the match
        var odds = await _service.GetMatchOddsAsync(match.Id);

        // Assert - odds were computed and returned
        odds.Should().NotBeNull();
        odds!.TeamWin.Should().NotBeNull();

        // And are now persisted in the database
        var inDb = await _db.MatchOdds.Where(o => o.MatchId == match.Id).ToListAsync();
        inDb.Should().NotBeEmpty();
    }
}
