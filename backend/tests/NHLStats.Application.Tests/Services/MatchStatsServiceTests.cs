using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class MatchStatsServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly MatchStatsService _service;

    public MatchStatsServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();

        _service = new MatchStatsService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task GetAllTimePlusMinusTrendAsync_ShouldCombineAggregatedDataAndUserMatches()
    {
        // Arrange
        var user = new User { Name = "TestUser" };
        _db.Users.Add(user);

        var homeTeam = new Team { Name = "Home", ShortName = "HOM" };
        var awayTeam = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(homeTeam, awayTeam);

        var season = new Season { Name = "Season 1", StartedOn = new DateTime(2025, 1, 1) };
        _db.Seasons.Add(season);
        await _db.SaveChangesAsync();

        var seasonUser = new SeasonUser { SeasonId = season.Id, UserId = user.Id };
        _db.SeasonUsers.Add(seasonUser);

        // Aggregated data: 1 plus, 4 minuses, 5 matches played
        var aggData = new UserSeasonAggregatedData
        {
            SeasonId = season.Id,
            UserId = user.Id,
            TotalPlus = 1,
            TotalMinus = 4,
            MatchesPlayed = 5,
            CreatedAt = DateTime.UtcNow
        };
        _db.UserSeasonAggregatedData.Add(aggData);

        // Point reasons
        var plusReason = new PointReason { Name = "Plus Reason", PointType = PointType.Positive, IsActive = true };
        var minusReason = new PointReason { Name = "Minus Reason", PointType = PointType.Negative, IsActive = true };
        _db.PointReasons.AddRange(plusReason, minusReason);

        // Match 1
        var match1 = new Match
        {
            SeasonId = season.Id,
            MatchNumber = 1,
            MatchDate = new DateTime(2025, 1, 2),
            HomeTeamId = homeTeam.Id,
            AwayTeamId = awayTeam.Id,
            HomeScore = 2,
            AwayScore = 1,
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.Add(match1);
        await _db.SaveChangesAsync();

        // UserMatch with 2 plus and 9 minuses
        var userMatch = new UserMatch
        {
            SeasonId = season.Id,
            UserId = user.Id,
            MatchId = match1.Id,
            Points = new List<UserMatchPoint>
            {
                new() { PointReasonId = plusReason.Id, Count = 2, Amount = 2m },
                new() { PointReasonId = minusReason.Id, Count = 9, Amount = 9m }
            }
        };
        _db.UserMatches.Add(userMatch);
        await _db.SaveChangesAsync();

        // Act
        var result = (await _service.GetAllTimePlusMinusTrendAsync()).ToList();

        // Assert
        result.Should().HaveCount(1);
        var seasonResult = result.Single();
        seasonResult.Label.Should().Be("Season 1");

        var userResult = seasonResult.Users.Should().ContainSingle(u => u.UserId == user.Id).Subject;
        // TotalPlus = 1 (agg) + 2 (matches) = 3
        userResult.TotalPlus.Should().Be(3);
        // TotalMinus = 4 (agg) + 9 (matches) = 13
        userResult.TotalMinus.Should().Be(13);
        // MatchesPlayed = 5 (agg) + 1 (matches) = 6
        userResult.MatchesPlayed.Should().Be(6);
    }
}
