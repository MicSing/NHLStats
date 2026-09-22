using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class AchievementServiceGodModeTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly AchievementService _service;

    public AchievementServiceGodModeTests()
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
    public async Task GodMode_UsesSeasonSpecificPosition_NotStaleGlobalPosition()
    {
        // Arrange: a player whose season-specific position is a forward (LW) but whose
        // shared RosterPlayer.Position record is stale from another season (e.g. "D").
        var team = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(team, away);

        var season = new Season
        {
            Name = "Season 1",
            Status = SeasonStatus.Complete,
            StartedOn = new DateTime(2025, 1, 1)
        };
        _db.Seasons.Add(season);

        var user = new User { Name = "Player 1" };
        _db.Users.Add(user);

        // Global position is stale ("D"), but the season roster entry (the one actually
        // shown/edited in the UI) correctly says this player is a forward ("LW") this season.
        var player = new RosterPlayer { FirstName = "John", Surname = "Doe", Position = "D", TeamId = team.Id };
        _db.RosterPlayers.Add(player);
        await _db.SaveChangesAsync();

        _db.SeasonRosterPlayers.Add(new SeasonRosterPlayer
        {
            SeasonId = season.Id,
            RosterPlayerId = player.Id,
            TeamId = team.Id,
            Position = "LW",
            IsActive = true
        });
        await _db.SaveChangesAsync();

        // 10 forward goals in a single match day (one "week").
        var match = new Match
        {
            SeasonId = season.Id,
            HomeTeamId = team.Id,
            AwayTeamId = away.Id,
            MatchDate = new DateTime(2025, 1, 1),
            MatchNumber = 1,
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.Add(match);
        await _db.SaveChangesAsync();

        var userMatch = new UserMatch { UserId = user.Id, MatchId = match.Id, SeasonId = season.Id };
        _db.UserMatches.Add(userMatch);
        await _db.SaveChangesAsync();

        _db.UserMatchGoals.Add(new UserMatchGoal
        {
            UserMatchId = userMatch.Id,
            RosterPlayerId = player.Id,
            Count = 10,
            GoalType = GoalType.Regular
        });
        await _db.SaveChangesAsync();

        // Act
        var achievements = await _service.GetUserAchievementsAsync(user.Id);
        var godMode = achievements.Achievements.First(a => a.Id == "god_mode");

        // Assert: should count the goals using the season-specific forward position,
        // not the stale global "D" position.
        godMode.Earned.Should().BeTrue();
        godMode.Count.Should().Be(1);
        godMode.Occurrences.First().Value.Should().Be(10);
    }
}
