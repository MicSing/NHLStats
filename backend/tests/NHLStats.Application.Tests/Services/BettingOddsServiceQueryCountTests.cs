using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

/// <summary>
/// Odds recalculation runs after every finished match for several upcoming matches, and the
/// database is billed by use — so the number of queries must not grow with the number of players.
/// </summary>
public class BettingOddsServiceQueryCountTests
{
    private static async Task<int> CountRecalculationQueriesAsync(int userCount, int upcomingMatches)
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

        var hosted = new Team { Name = "Hosted", ShortName = "HST" };
        var opp = new Team { Name = "Opp", ShortName = "OPP" };
        db.Teams.AddRange(hosted, opp);
        var plus = new PointReason { Name = "Plus", PointType = PointType.Positive };
        var minus = new PointReason { Name = "Minus", PointType = PointType.Negative };
        db.PointReasons.AddRange(plus, minus);
        db.SaveChanges();
        var player = new RosterPlayer { TeamId = hosted.Id, FirstName = "R", Surname = "P" };
        db.RosterPlayers.Add(player);

        var previous = new Season { Name = "S0", HostedTeamId = hosted.Id, StartedOn = DateTime.UtcNow.AddYears(-1), Status = SeasonStatus.Complete };
        var season = new Season { Name = "S1", HostedTeamId = hosted.Id, StartedOn = DateTime.UtcNow.AddDays(-30) };
        db.Seasons.AddRange(previous, season);
        db.SaveChanges();

        var users = Enumerable.Range(1, userCount).Select(i => new User { Name = $"U{i}" }).ToList();
        db.Users.AddRange(users);
        db.SaveChanges();
        foreach (var s in new[] { previous, season })
            db.SeasonUsers.AddRange(users.Select(u => new SeasonUser { SeasonId = s.Id, UserId = u.Id }));

        foreach (var s in new[] { previous, season })
        {
            for (int m = 1; m <= 12; m++)
            {
                var match = new Match
                {
                    SeasonId = s.Id, MatchNumber = m, HomeTeamId = hosted.Id, AwayTeamId = opp.Id,
                    HomeScore = m % 3, AwayScore = 1, CompletionType = CompletionType.RegularTime,
                    MatchDate = s.StartedOn.AddDays(m),
                };
                db.Matches.Add(match);
                db.SaveChanges();
                foreach (var u in users)
                {
                    var um = new UserMatch { UserId = u.Id, MatchId = match.Id, SeasonId = s.Id };
                    db.UserMatches.Add(um);
                    db.SaveChanges();
                    if ((m + u.Id) % 2 == 0)
                        db.UserMatchGoals.Add(new UserMatchGoal { UserMatchId = um.Id, RosterPlayerId = player.Id, Count = 1, GoalType = GoalType.Regular });
                    if ((m + u.Id) % 3 == 0)
                        db.UserMatchPenalties.Add(new UserMatchPenalty { UserMatchId = um.Id, RosterPlayerId = player.Id, Count = 1 });
                    db.UserMatchPoints.Add(new UserMatchPoint { UserMatchId = um.Id, PointReasonId = (m % 2 == 0 ? plus : minus).Id, Count = 1 });
                    db.SaveChanges();
                }
            }
        }

        for (int i = 0; i < upcomingMatches; i++)
            db.Matches.Add(new Match
            {
                SeasonId = season.Id, MatchNumber = 100 + i, HomeTeamId = hosted.Id, AwayTeamId = opp.Id,
                CompletionType = CompletionType.None, MatchDate = DateTime.UtcNow.AddDays(1 + i),
            });
        db.SaveChanges();
        db.ChangeTracker.Clear();

        var service = new BettingOddsService(db);
        // Warm the previous-season distribution cache so only steady-state reads are counted.
        await service.RecalculateUpcomingAsync(upcomingMatches);
        db.ChangeTracker.Clear();

        counter.Reset();
        await service.RecalculateUpcomingAsync(upcomingMatches);
        return counter.Count;
    }

    [Fact]
    public async Task Recalculation_query_count_does_not_grow_with_the_number_of_players()
    {
        var withTwo = await CountRecalculationQueriesAsync(userCount: 2, upcomingMatches: 1);
        var withSix = await CountRecalculationQueriesAsync(userCount: 6, upcomingMatches: 1);

        withSix.Should().Be(withTwo);
    }

    [Fact]
    public async Task Each_extra_upcoming_match_costs_the_same_queries_regardless_of_player_count()
    {
        // Player history is loaded once per batch, so an extra match in the batch only adds its
        // own team/league reads and the odds upsert — never per-player reads.
        var extraWithTwo = await CountRecalculationQueriesAsync(2, 3) - await CountRecalculationQueriesAsync(2, 1);
        var extraWithSix = await CountRecalculationQueriesAsync(6, 3) - await CountRecalculationQueriesAsync(6, 1);

        extraWithSix.Should().Be(extraWithTwo);
    }
}
