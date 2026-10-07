using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

/// <summary>
/// Season-level achievements are dated to the season's last played match, so the
/// frontend can flag them as new when a season is completed.
/// </summary>
public class AchievementServiceSeasonDateTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly AchievementService _service;

    public AchievementServiceSeasonDateTests()
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
    public async Task SeasonAchievements_ShouldBeDatedToLastMatchOfSeason()
    {
        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(home, away);

        var season = new Season { Name = "Season 1", Status = SeasonStatus.Complete, StartedOn = new DateTime(2025, 1, 1) };
        _db.Seasons.Add(season);

        var user = new User { Name = "Player 1" };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var player = new RosterPlayer { FirstName = "John", Surname = "Doe", Position = "C", TeamId = home.Id };
        _db.RosterPlayers.Add(player);
        await _db.SaveChangesAsync();

        var firstDate = new DateTime(2025, 1, 1);
        var lastDate = new DateTime(2025, 3, 20);
        var dates = new[] { firstDate, new DateTime(2025, 2, 10), lastDate };

        for (int i = 0; i < dates.Length; i++)
        {
            var m = new Match
            {
                SeasonId = season.Id,
                HomeTeamId = home.Id,
                AwayTeamId = away.Id,
                MatchDate = dates[i],
                MatchNumber = i + 1,
                CompletionType = CompletionType.RegularTime
            };
            _db.Matches.Add(m);
            await _db.SaveChangesAsync();

            var um = new UserMatch { UserId = user.Id, MatchId = m.Id, SeasonId = season.Id };
            _db.UserMatches.Add(um);
            await _db.SaveChangesAsync();

            _db.UserMatchGoals.Add(new UserMatchGoal
            {
                UserMatchId = um.Id,
                RosterPlayerId = player.Id,
                Count = 40,
                GoalType = GoalType.Regular
            });
        }

        // An unplayed match later in the season must not move the date.
        _db.Matches.Add(new Match
        {
            SeasonId = season.Id,
            HomeTeamId = home.Id,
            AwayTeamId = away.Id,
            MatchDate = new DateTime(2025, 4, 1),
            MatchNumber = 4,
            CompletionType = CompletionType.None
        });
        await _db.SaveChangesAsync();

        var result = await _service.GetUserAchievementsAsync(user.Id);

        var massiveAttack = result.Achievements.First(a => a.Id == "massive_attack");
        massiveAttack.Earned.Should().BeTrue();
        massiveAttack.Occurrences.Single().OccurredOn.Should().Be(lastDate);

        var playerLover = result.Achievements.First(a => a.Id == "player_lover");
        playerLover.Occurrences.Single().OccurredOn.Should().Be(lastDate);

        var goldenStick = result.Achievements.First(a => a.Id == "golden_stick");
        goldenStick.Occurrences.Single().OccurredOn.Should().Be(lastDate);

        var ironMan = result.Achievements.First(a => a.Id == "iron_man");
        ironMan.Occurrences.Single().OccurredOn.Should().Be(lastDate);
    }
}
