using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

/// <summary>
/// Achievement holders evaluate every user; the season-wide data they all share must be read
/// once, not once per user.
/// </summary>
public class AchievementServiceQueryCountTests
{
    private static async Task<(int Queries, Dictionary<string, List<int>> Holders, Dictionary<int, string> PerUser)> RunAsync(int userCount)
    {
        using var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();
        var counter = new QueryCounter();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(connection)
            .AddInterceptors(counter)
            .Options;
        using var db = new NhlStatsDbContext(options);
        db.Database.EnsureCreated();

        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        db.Teams.AddRange(home, away);
        var season = new Season { Name = "S1", Status = SeasonStatus.Complete, StartedOn = new DateTime(2025, 1, 1) };
        db.Seasons.Add(season);
        var minus = new PointReason { Name = "Offside", PointType = PointType.Negative };
        var plus = new PointReason { Name = "Hit", PointType = PointType.Positive };
        db.PointReasons.AddRange(minus, plus);
        var users = Enumerable.Range(1, userCount).Select(i => new User { Name = $"U{i}" }).ToList();
        db.Users.AddRange(users);
        db.SaveChanges();
        var player = new RosterPlayer { TeamId = home.Id, FirstName = "R", Surname = "P" };
        db.RosterPlayers.Add(player);
        db.SeasonUsers.AddRange(users.Select(u => new SeasonUser { SeasonId = season.Id, UserId = u.Id }));
        db.SaveChanges();

        for (int m = 1; m <= 4; m++)
        {
            var match = new Match
            {
                SeasonId = season.Id, MatchNumber = m, HomeTeamId = home.Id, AwayTeamId = away.Id,
                HomeScore = 3, AwayScore = m % 2, MatchDate = new DateTime(2025, 1, 1 + m * 3),
                CompletionType = CompletionType.RegularTime,
            };
            db.Matches.Add(match);
            db.SaveChanges();
            foreach (var u in users)
            {
                var um = new UserMatch { UserId = u.Id, MatchId = match.Id, SeasonId = season.Id };
                db.UserMatches.Add(um);
                db.SaveChanges();
                if ((u.Id + m) % 2 == 0)
                    db.UserMatchGoals.Add(new UserMatchGoal { UserMatchId = um.Id, RosterPlayerId = player.Id, Count = u.Id % 3 + 1 });
                if ((u.Id + m) % 3 == 0)
                    db.UserMatchPenalties.Add(new UserMatchPenalty { UserMatchId = um.Id, RosterPlayerId = player.Id, Count = 1 });
                db.UserMatchPoints.Add(new UserMatchPoint { UserMatchId = um.Id, PointReasonId = ((u.Id + m) % 2 == 0 ? plus : minus).Id, Count = 1 });
                db.SaveChanges();
            }
        }
        db.ChangeTracker.Clear();

        var service = new AchievementService(db);
        counter.Reset();
        var holders = await service.GetAchievementHoldersAsync();
        var queries = counter.Count;

        var perUser = new Dictionary<int, string>();
        foreach (var u in users)
        {
            var result = await service.GetUserAchievementsAsync(u.Id);
            perUser[u.Id] = string.Join(",", result.Achievements.Where(a => a.Earned).Select(a => a.Id).OrderBy(id => id));
        }

        return (queries, holders.Achievements.ToDictionary(a => a.Id, a => a.HolderUserIds.ToList()), perUser);
    }

    [Fact]
    public async Task Holders_read_shared_data_once_not_per_user()
    {
        var two = await RunAsync(2);
        var six = await RunAsync(6);

        // Only the handful of user-specific reads may repeat per user.
        var perExtraUser = (six.Queries - two.Queries) / 4.0;
        perExtraUser.Should().BeLessThanOrEqualTo(6);
    }

    [Fact]
    public async Task Holders_match_evaluating_each_user_on_their_own()
    {
        var run = await RunAsync(5);

        foreach (var (userId, earned) in run.PerUser)
        {
            var fromHolders = string.Join(",", run.Holders.Where(h => h.Value.Contains(userId)).Select(h => h.Key).OrderBy(id => id));
            fromHolders.Should().Be(earned);
        }
    }
}
