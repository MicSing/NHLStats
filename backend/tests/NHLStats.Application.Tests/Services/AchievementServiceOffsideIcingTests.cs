using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class AchievementServiceOffsideIcingTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly AchievementService _service;

    public AchievementServiceOffsideIcingTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();

        _service = new AchievementService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task WhenUserHasNoOffsideOrIcing_AchievementsShouldBeUnearned()
    {
        var user = new User { Name = "Clean Skater" };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var result = await _service.GetUserAchievementsAsync(user.Id);

        var offside = result.Achievements.FirstOrDefault(a => a.Id == "offside_trap");
        offside.Should().NotBeNull();
        offside!.Earned.Should().BeFalse();
        offside.Level.Should().Be(0);
        offside.Count.Should().Be(0);
        offside.CurrentLevelAt.Should().Be(0);
        offside.NextLevelAt.Should().Be(1);
        offside.Occurrences.Should().BeEmpty();

        var icing = result.Achievements.FirstOrDefault(a => a.Id == "icing_machine");
        icing.Should().NotBeNull();
        icing!.Earned.Should().BeFalse();
        icing.Level.Should().Be(0);
        icing.Count.Should().Be(0);
        icing.CurrentLevelAt.Should().Be(0);
        icing.NextLevelAt.Should().Be(1);
        icing.Occurrences.Should().BeEmpty();
    }

    [Theory]
    [InlineData(1, 1, 1, 2)]   // Stone
    [InlineData(2, 2, 2, 3)]   // Bronze
    [InlineData(3, 3, 3, 4)]   // Silver
    [InlineData(4, 4, 4, 6)]   // Gold
    [InlineData(5, 4, 4, 6)]   // Still Gold
    [InlineData(6, 5, 6, 8)]   // Emerald
    [InlineData(7, 5, 6, 8)]   // Still Emerald
    [InlineData(8, 6, 8, 10)]  // Ruby
    [InlineData(9, 6, 8, 10)]  // Still Ruby
    [InlineData(10, 7, 10, null)] // Diamond
    [InlineData(12, 7, 10, null)] // Diamond max
    public async Task OffsideTrap_ShouldScaleAccordingToSeasonalRareThresholds(
        int tallyCount, int expectedLevel, int expectedCurrentAt, int? expectedNextAt)
    {
        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(home, away);

        var season = new Season { Name = "Season 1", Status = SeasonStatus.Active, StartedOn = new DateTime(2025, 1, 1) };
        _db.Seasons.Add(season);

        var user = new User { Name = "Player 1" };
        _db.Users.Add(user);

        var offsideReason = await _db.PointReasons.FirstOrDefaultAsync(r => r.PointType == PointType.Negative && r.Name == "Offside")
            ?? new PointReason { Name = "Offside", PointType = PointType.Negative, IsActive = true };
        if (offsideReason.Id == 0) _db.PointReasons.Add(offsideReason);

        await _db.SaveChangesAsync();

        for (int i = 0; i < tallyCount; i++)
        {
            var match = new Match
            {
                SeasonId = season.Id,
                HomeTeamId = home.Id,
                AwayTeamId = away.Id,
                MatchDate = new DateTime(2025, 1, 1).AddDays(i),
                MatchNumber = i + 1,
                CompletionType = CompletionType.RegularTime
            };
            _db.Matches.Add(match);
            await _db.SaveChangesAsync();

            var userMatch = new UserMatch
            {
                MatchId = match.Id,
                SeasonId = season.Id,
                UserId = user.Id
            };
            _db.UserMatches.Add(userMatch);
            await _db.SaveChangesAsync();

            _db.UserMatchPoints.Add(new UserMatchPoint
            {
                UserMatchId = userMatch.Id,
                PointReasonId = offsideReason.Id,
                Count = 1
            });
        }
        await _db.SaveChangesAsync();

        var result = await _service.GetUserAchievementsAsync(user.Id);
        var offside = result.Achievements.FirstOrDefault(a => a.Id == "offside_trap");

        offside.Should().NotBeNull();
        offside!.Earned.Should().BeTrue();
        offside.Level.Should().Be(expectedLevel);
        offside.Count.Should().Be(tallyCount);
        offside.CurrentLevelAt.Should().Be(expectedCurrentAt);
        offside.NextLevelAt.Should().Be(expectedNextAt);
        offside.Occurrences.Should().HaveCount(tallyCount);
    }

    [Fact]
    public async Task IcingMachine_ShouldAccumulateMultiplePointsInSameMatchCorrectly()
    {
        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(home, away);

        var season = new Season { Name = "Season 1", Status = SeasonStatus.Active, StartedOn = new DateTime(2025, 1, 1) };
        _db.Seasons.Add(season);

        var user = new User { Name = "Player 1" };
        _db.Users.Add(user);

        var icingReason = await _db.PointReasons.FirstOrDefaultAsync(r => r.PointType == PointType.Negative && r.Name == "Icing")
            ?? new PointReason { Name = "Icing", PointType = PointType.Negative, IsActive = true };
        if (icingReason.Id == 0) _db.PointReasons.Add(icingReason);

        await _db.SaveChangesAsync();

        // 1 match with 2 icing tallies (count = 2)
        var match = new Match
        {
            SeasonId = season.Id,
            HomeTeamId = home.Id,
            AwayTeamId = away.Id,
            MatchDate = new DateTime(2025, 1, 15),
            MatchNumber = 5,
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.Add(match);
        await _db.SaveChangesAsync();

        var userMatch = new UserMatch
        {
            MatchId = match.Id,
            SeasonId = season.Id,
            UserId = user.Id
        };
        _db.UserMatches.Add(userMatch);
        await _db.SaveChangesAsync();

        _db.UserMatchPoints.Add(new UserMatchPoint
        {
            UserMatchId = userMatch.Id,
            PointReasonId = icingReason.Id,
            Count = 2
        });
        await _db.SaveChangesAsync();

        var result = await _service.GetUserAchievementsAsync(user.Id);
        var icing = result.Achievements.FirstOrDefault(a => a.Id == "icing_machine");

        icing.Should().NotBeNull();
        icing!.Earned.Should().BeTrue();
        icing.Level.Should().Be(2); // Level 2 (Bronze) at 2 points
        icing.Count.Should().Be(2);
        icing.CurrentLevelAt.Should().Be(2);
        icing.NextLevelAt.Should().Be(3);
        icing.Occurrences.Should().HaveCount(1);
        icing.Occurrences.First().Value.Should().Be(2);
        icing.Occurrences.First().MatchNumber.Should().Be(5);
        icing.Occurrences.First().SeasonName.Should().Be("Season 1");
    }

    [Fact]
    public async Task NeutralOffsidesAndIcings_ShouldNotCountTowardsAchievements()
    {
        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(home, away);

        var season = new Season { Name = "Season 1", Status = SeasonStatus.Active, StartedOn = new DateTime(2025, 1, 1) };
        _db.Seasons.Add(season);

        var user = new User { Name = "Player 1" };
        _db.Users.Add(user);

        var neutralOffside = new PointReason { Name = "Offside", PointType = PointType.Neutral, IsActive = true };
        var neutralIcing = new PointReason { Name = "Icing", PointType = PointType.Neutral, IsActive = true };
        _db.PointReasons.AddRange(neutralOffside, neutralIcing);
        await _db.SaveChangesAsync();

        var match = new Match
        {
            SeasonId = season.Id,
            HomeTeamId = home.Id,
            AwayTeamId = away.Id,
            MatchDate = new DateTime(2025, 1, 20),
            MatchNumber = 1,
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.Add(match);
        await _db.SaveChangesAsync();

        var userMatch = new UserMatch
        {
            MatchId = match.Id,
            SeasonId = season.Id,
            UserId = user.Id
        };
        _db.UserMatches.Add(userMatch);
        await _db.SaveChangesAsync();

        _db.UserMatchPoints.AddRange(
            new UserMatchPoint { UserMatchId = userMatch.Id, PointReasonId = neutralOffside.Id, Count = 2 },
            new UserMatchPoint { UserMatchId = userMatch.Id, PointReasonId = neutralIcing.Id, Count = 2 }
        );
        await _db.SaveChangesAsync();

        var result = await _service.GetUserAchievementsAsync(user.Id);
        var offside = result.Achievements.First(a => a.Id == "offside_trap");
        var icing = result.Achievements.First(a => a.Id == "icing_machine");

        offside.Earned.Should().BeFalse();
        offside.Count.Should().Be(0);
        icing.Earned.Should().BeFalse();
        icing.Count.Should().Be(0);
    }
}
