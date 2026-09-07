using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class AchievementServiceGuardianAngelTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly AchievementService _service;

    public AchievementServiceGuardianAngelTests()
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
    public async Task GuardianAngel_ShouldAwardPlayerWithMostCleanWeeks_WhenAtLeast4MatchesPlayedPerWeek()
    {
        // Arrange: 1 completed season, 2 teams, 2 users, 1 negative point reason
        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(home, away);

        var season = new Season
        {
            Name = "Season 1",
            Status = SeasonStatus.Complete,
            StartedOn = new DateTime(2025, 1, 1)
        };
        _db.Seasons.Add(season);

        var user1 = new User { Name = "Player 1" };
        var user2 = new User { Name = "Player 2" };
        _db.Users.AddRange(user1, user2);

        var minusReason = new PointReason { Name = "Minus point", PointType = PointType.Negative };
        _db.PointReasons.Add(minusReason);

        await _db.SaveChangesAsync();

        // Helper to create match and user participation
        int matchNum = 1;
        Match CreateMatch(DateTime date)
        {
            var m = new Match
            {
                SeasonId = season.Id,
                HomeTeamId = home.Id,
                AwayTeamId = away.Id,
                MatchDate = date,
                MatchNumber = matchNum++,
                CompletionType = CompletionType.RegularTime
            };
            _db.Matches.Add(m);
            return m;
        }

        // Week 1: 2025-01-01 -> 4 matches. Both play all 4. Neither gets minus.
        // -> Clean week for User 1 & User 2.
        var w1Date = new DateTime(2025, 1, 1);
        for (int i = 0; i < 4; i++)
        {
            var m = CreateMatch(w1Date);
            await _db.SaveChangesAsync();
            _db.UserMatches.Add(new UserMatch { UserId = user1.Id, MatchId = m.Id, SeasonId = season.Id });
            _db.UserMatches.Add(new UserMatch { UserId = user2.Id, MatchId = m.Id, SeasonId = season.Id });
        }

        // Week 2: 2025-01-08 -> 4 matches. Both play all 4. User 2 gets a minus, User 1 has 0 minuses.
        // -> Clean week for User 1 only.
        var w2Date = new DateTime(2025, 1, 8);
        for (int i = 0; i < 4; i++)
        {
            var m = CreateMatch(w2Date);
            await _db.SaveChangesAsync();
            var um1 = new UserMatch { UserId = user1.Id, MatchId = m.Id, SeasonId = season.Id };
            var um2 = new UserMatch { UserId = user2.Id, MatchId = m.Id, SeasonId = season.Id };
            _db.UserMatches.AddRange(um1, um2);
            await _db.SaveChangesAsync();

            if (i == 0)
            {
                _db.UserMatchPoints.Add(new UserMatchPoint
                {
                    UserMatchId = um2.Id,
                    PointReasonId = minusReason.Id,
                    Count = 1
                });
            }
        }

        // Week 3: 2025-01-15 -> 3 matches only (under 4 threshold). Neither gets minus.
        // -> Not a clean week for anyone because matches < 4.
        var w3Date = new DateTime(2025, 1, 15);
        for (int i = 0; i < 3; i++)
        {
            var m = CreateMatch(w3Date);
            await _db.SaveChangesAsync();
            _db.UserMatches.Add(new UserMatch { UserId = user1.Id, MatchId = m.Id, SeasonId = season.Id });
            _db.UserMatches.Add(new UserMatch { UserId = user2.Id, MatchId = m.Id, SeasonId = season.Id });
        }

        await _db.SaveChangesAsync();

        // Act & Assert
        // User 1 has 2 clean weeks (Week 1, Week 2). Max is 2.
        var u1Achievements = await _service.GetUserAchievementsAsync(user1.Id);
        var u1GuardianAngel = u1Achievements.Achievements.FirstOrDefault(a => a.Id == "guardian_angel");
        u1GuardianAngel.Should().NotBeNull();
        u1GuardianAngel!.Earned.Should().BeTrue();
        u1GuardianAngel.Count.Should().Be(1);
        u1GuardianAngel.Occurrences.Should().HaveCount(1);
        u1GuardianAngel.Occurrences.First().Value.Should().Be(2);

        // User 2 has 1 clean week (Week 1 only). Did not reach max of 2.
        var u2Achievements = await _service.GetUserAchievementsAsync(user2.Id);
        var u2GuardianAngel = u2Achievements.Achievements.FirstOrDefault(a => a.Id == "guardian_angel");
        u2GuardianAngel.Should().NotBeNull();
        u2GuardianAngel!.Earned.Should().BeFalse();
        u2GuardianAngel.Count.Should().Be(0);
        u2GuardianAngel.Occurrences.Should().BeEmpty();
    }

    [Fact]
    public async Task GuardianAngel_TiesAwardAchievementToBothPlayers()
    {
        // Arrange
        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(home, away);

        var season = new Season
        {
            Name = "Season 1",
            Status = SeasonStatus.Complete,
            StartedOn = new DateTime(2025, 1, 1)
        };
        _db.Seasons.Add(season);

        var user1 = new User { Name = "Player 1" };
        var user2 = new User { Name = "Player 2" };
        _db.Users.AddRange(user1, user2);

        await _db.SaveChangesAsync();

        // Week 1: 4 matches, both play with 0 minuses -> 1 clean week each
        var w1Date = new DateTime(2025, 1, 1);
        for (int i = 0; i < 4; i++)
        {
            var m = new Match
            {
                SeasonId = season.Id,
                HomeTeamId = home.Id,
                AwayTeamId = away.Id,
                MatchDate = w1Date,
                MatchNumber = i + 1,
                CompletionType = CompletionType.RegularTime
            };
            _db.Matches.Add(m);
            await _db.SaveChangesAsync();
            _db.UserMatches.Add(new UserMatch { UserId = user1.Id, MatchId = m.Id, SeasonId = season.Id });
            _db.UserMatches.Add(new UserMatch { UserId = user2.Id, MatchId = m.Id, SeasonId = season.Id });
        }
        await _db.SaveChangesAsync();

        var u1Ach = await _service.GetUserAchievementsAsync(user1.Id);
        var u2Ach = await _service.GetUserAchievementsAsync(user2.Id);

        var u1Ga = u1Ach.Achievements.First(a => a.Id == "guardian_angel");
        var u2Ga = u2Ach.Achievements.First(a => a.Id == "guardian_angel");

        u1Ga.Earned.Should().BeTrue();
        u1Ga.Occurrences.First().Value.Should().Be(1);

        u2Ga.Earned.Should().BeTrue();
        u2Ga.Occurrences.First().Value.Should().Be(1);
    }
}
