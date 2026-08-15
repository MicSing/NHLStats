using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class RosterPlayerServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly RosterPlayerService _service;
    private readonly RosterStatsService _statsService;

    public RosterPlayerServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;

        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();

        _service = new RosterPlayerService(_db);
        _statsService = new RosterStatsService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task CreateAsync_WhenPlayerDoesNotExist_CreatesRosterPlayerAndSeasonMapping()
    {
        // Arrange
        var team = new Team { Name = "Edmonton Oilers", ShortName = "EDM" };
        var season = new Season { Name = "2025/2026", StartedOn = DateTime.UtcNow };
        _db.Teams.Add(team);
        _db.Seasons.Add(season);
        await _db.SaveChangesAsync();

        var dto = new CreateRosterPlayerDto("Connor", "McDavid", "C", team.Id);

        // Act
        var result = await _service.CreateAsync(season.Id, dto);

        // Assert
        result.Should().NotBeNull();
        result.FirstName.Should().Be("Connor");
        result.Surname.Should().Be("McDavid");
        result.SeasonId.Should().Be(season.Id);

        var allPlayers = await _db.RosterPlayers.ToListAsync();
        allPlayers.Should().HaveCount(1);

        var seasonPlayers = await _db.SeasonRosterPlayers.ToListAsync();
        seasonPlayers.Should().HaveCount(1);
        seasonPlayers[0].RosterPlayerId.Should().Be(allPlayers[0].Id);
        seasonPlayers[0].SeasonId.Should().Be(season.Id);
    }

    [Fact]
    public async Task CreateAsync_WhenPlayerAlreadyExistsInAnotherSeason_ReusesPlayerIdAndCreatesNewSeasonMapping()
    {
        // Arrange
        var team = new Team { Name = "Edmonton Oilers", ShortName = "EDM" };
        var season1 = new Season { Name = "2024/2025", StartedOn = DateTime.UtcNow.AddYears(-1) };
        var season2 = new Season { Name = "2025/2026", StartedOn = DateTime.UtcNow };
        _db.Teams.Add(team);
        _db.Seasons.AddRange(season1, season2);
        await _db.SaveChangesAsync();

        var dto1 = new CreateRosterPlayerDto("Connor", "McDavid", "C", team.Id);
        var result1 = await _service.CreateAsync(season1.Id, dto1);

        var dto2 = new CreateRosterPlayerDto("Connor", "McDavid", "C", team.Id);

        // Act
        var result2 = await _service.CreateAsync(season2.Id, dto2);

        // Assert
        result2.Id.Should().Be(result1.Id); // Same global RosterPlayer ID!
        result2.SeasonId.Should().Be(season2.Id);

        var allPlayers = await _db.RosterPlayers.ToListAsync();
        allPlayers.Should().HaveCount(1, "Should not create duplicate RosterPlayer");

        var seasonPlayers = await _db.SeasonRosterPlayers.ToListAsync();
        seasonPlayers.Should().HaveCount(2);
        seasonPlayers.Select(sp => sp.SeasonId).Should().BeEquivalentTo(new[] { season1.Id, season2.Id });
        seasonPlayers.Select(sp => sp.RosterPlayerId).Should().AllBeEquivalentTo(result1.Id);
    }

    [Fact]
    public async Task CopyFromSeasonAsync_ReusesExistingPlayerIdsWithoutDuplicates()
    {
        // Arrange
        var team = new Team { Name = "Edmonton Oilers", ShortName = "EDM" };
        var season1 = new Season { Name = "2024/2025", StartedOn = DateTime.UtcNow.AddYears(-1) };
        var season2 = new Season { Name = "2025/2026", StartedOn = DateTime.UtcNow };
        _db.Teams.Add(team);
        _db.Seasons.AddRange(season1, season2);
        await _db.SaveChangesAsync();

        await _service.CreateAsync(season1.Id, new CreateRosterPlayerDto("Connor", "McDavid", "C", team.Id));
        await _service.CreateAsync(season1.Id, new CreateRosterPlayerDto("Leon", "Draisaitl", "C", team.Id));

        // Act
        var (copied, error) = await _service.CopyFromSeasonAsync(season2.Id, season1.Id);

        // Assert
        error.Should().BeNull();
        copied.Should().HaveCount(2);

        var allPlayers = await _db.RosterPlayers.ToListAsync();
        allPlayers.Should().HaveCount(2, "No duplicate players should be created on copy");

        var season2Players = await _service.GetBySeasonAsync(season2.Id);
        season2Players.Should().HaveCount(2);
        season2Players.Select(p => p.FirstName).Should().BeEquivalentTo(new[] { "Connor", "Leon" });
    }

    [Fact]
    public async Task AllTimeStats_CombinesGoalsAcrossMultipleSeasonsForSamePlayer()
    {
        // Arrange
        var team = new Team { Name = "Edmonton Oilers", ShortName = "EDM" };
        var season1 = new Season { Name = "2024/2025", StartedOn = DateTime.UtcNow.AddYears(-1) };
        var season2 = new Season { Name = "2025/2026", StartedOn = DateTime.UtcNow };
        var user = new User { Name = "Bettor1" };
        _db.Teams.Add(team);
        _db.Seasons.AddRange(season1, season2);
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var player1 = await _service.CreateAsync(season1.Id, new CreateRosterPlayerDto("Connor", "McDavid", "C", team.Id));
        var player2 = await _service.CreateAsync(season2.Id, new CreateRosterPlayerDto("Connor", "McDavid", "C", team.Id));

        player1.Id.Should().Be(player2.Id);

        var match1 = new Match { SeasonId = season1.Id, MatchNumber = 1, HomeTeamId = team.Id, AwayTeamId = team.Id, MatchDate = DateTime.UtcNow };
        var match2 = new Match { SeasonId = season2.Id, MatchNumber = 1, HomeTeamId = team.Id, AwayTeamId = team.Id, MatchDate = DateTime.UtcNow };
        _db.Matches.AddRange(match1, match2);
        await _db.SaveChangesAsync();

        var um1 = new UserMatch { MatchId = match1.Id, SeasonId = season1.Id, UserId = user.Id };
        var um2 = new UserMatch { MatchId = match2.Id, SeasonId = season2.Id, UserId = user.Id };
        _db.UserMatches.AddRange(um1, um2);
        await _db.SaveChangesAsync();

        _db.UserMatchGoals.AddRange(
            new UserMatchGoal { UserMatchId = um1.Id, RosterPlayerId = player1.Id, Count = 3, GoalType = GoalType.Regular },
            new UserMatchGoal { UserMatchId = um2.Id, RosterPlayerId = player2.Id, Count = 2, GoalType = GoalType.Regular }
        );
        await _db.SaveChangesAsync();

        // Act
        var seasonScorers = await _statsService.GetAllGoalScorersByUserAsync();
        var allTimeScorers = await _statsService.GetAllTimeRosterScorerAsync(seasonScorers);

        // Assert
        allTimeScorers.Should().HaveCount(1, "Player should be listed only ONCE in All-Time scorers");
        var mcdavid = allTimeScorers.First();
        mcdavid.FirstName.Should().Be("Connor");
        mcdavid.Surname.Should().Be("McDavid");
        mcdavid.TotalCount.Should().Be(5, "Should aggregate 3 goals from Season 1 + 2 goals from Season 2");
    }
}
