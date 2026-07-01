using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

public class TeamStatsServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly TeamStatsService _service;

    public TeamStatsServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();

        _service = new TeamStatsService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private Team AddTeam(string name, string shortName)
    {
        var team = new Team { Name = name, ShortName = shortName };
        _db.Teams.Add(team);
        _db.SaveChanges();
        return team;
    }

    private Season AddSeason(string name, int? hostedTeamId)
    {
        var season = new Season { Name = name, StartedOn = DateTime.UtcNow, HostedTeamId = hostedTeamId };
        _db.Seasons.Add(season);
        _db.SaveChanges();
        return season;
    }

    private Match AddMatch(int seasonId, int homeTeamId, int awayTeamId, DateTime? matchDate = null)
    {
        var nextMatchNumber = _db.Matches.Where(m => m.SeasonId == seasonId).Select(m => (int?)m.MatchNumber).Max() ?? 0;
        var match = new Match
        {
            SeasonId = seasonId,
            MatchNumber = nextMatchNumber + 1,
            HomeTeamId = homeTeamId,
            AwayTeamId = awayTeamId,
            HomeScore = 3,
            AwayScore = 2,
            MatchDate = matchDate ?? DateTime.UtcNow,
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.Add(match);
        _db.SaveChanges();
        return match;
    }

    private User AddUser(string name)
    {
        var user = new User { Name = name };
        _db.Users.Add(user);
        _db.SaveChanges();
        return user;
    }

    private RosterPlayer AddRosterPlayer(int teamId, int seasonId, string firstName, string surname)
    {
        var player = new RosterPlayer { TeamId = teamId, SeasonId = seasonId, FirstName = firstName, Surname = surname };
        _db.RosterPlayers.Add(player);
        _db.SaveChanges();
        return player;
    }

    private UserMatch AddUserMatch(int userId, int matchId, int seasonId)
    {
        var um = new UserMatch { UserId = userId, MatchId = matchId, SeasonId = seasonId };
        _db.UserMatches.Add(um);
        _db.SaveChanges();
        return um;
    }

    [Fact]
    public async Task GetHostedTeamOptionsAsync_ReturnsDistinctTeamsOrderedByName()
    {
        var teamA = AddTeam("Zebra Team", "ZEB");
        var teamB = AddTeam("Alpha Team", "ALP");
        AddSeason("S1", teamA.Id);
        AddSeason("S2", teamB.Id);
        AddSeason("S3", teamA.Id);

        var result = (await _service.GetHostedTeamOptionsAsync()).ToList();

        result.Should().HaveCount(2);
        result[0].Name.Should().Be("Alpha Team");
        result[1].Name.Should().Be("Zebra Team");
    }

    [Fact]
    public async Task GetHostedTeamOptionsAsync_WhenNoSeasonHasHostedTeam_ReturnsEmpty()
    {
        AddSeason("S1", null);

        var result = await _service.GetHostedTeamOptionsAsync();

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task GetOpponentOptionsAsync_ResolvesOpponentRegardlessOfHomeAwaySide()
    {
        var hosted = AddTeam("Hosted", "HST");
        var oppA = AddTeam("Opponent A", "OPA");
        var oppB = AddTeam("Opponent B", "OPB");
        var season = AddSeason("S1", hosted.Id);
        AddMatch(season.Id, hosted.Id, oppA.Id);
        AddMatch(season.Id, oppB.Id, hosted.Id);

        var result = (await _service.GetOpponentOptionsAsync(hosted.Id)).ToList();

        result.Should().HaveCount(2);
        result.Select(t => t.Name).Should().Contain(new[] { "Opponent A", "Opponent B" });
    }

    [Fact]
    public async Task GetTeamStatsAsync_WhenNoMatches_ReturnsZeroedSummary()
    {
        var hosted = AddTeam("Hosted", "HST");
        var opponent = AddTeam("Opponent", "OPP");

        var result = await _service.GetTeamStatsAsync(hosted.Id, opponent.Id);

        result.MatchesPlayed.Should().Be(0);
        result.TopScoringUser.Should().BeNull();
        result.TopScoringPlayer.Should().BeNull();
        result.TopPenalizedUser.Should().BeNull();
        result.TopPenalizedPlayer.Should().BeNull();
        result.TopPlusUser.Should().BeNull();
        result.TopMinusUser.Should().BeNull();
        result.TotalPlusPoints.Should().Be(0);
        result.TotalMinusPoints.Should().Be(0);
        result.AvgPlusPerMatch.Should().Be(0);
        result.AvgMinusPerMatch.Should().Be(0);
        result.AvgGoalsPerMatch.Should().Be(0);
        result.AvgPenaltiesPerMatch.Should().Be(0);
    }

    [Fact]
    public async Task GetTeamStatsAsync_AggregatesGoalsPenaltiesAndPointsAcrossMultipleSeasons()
    {
        var hosted = AddTeam("Hosted", "HST");
        var opponent = AddTeam("Opponent", "OPP");
        var otherOpponent = AddTeam("Other", "OTH");

        var season1 = AddSeason("S1", hosted.Id);
        var season2 = AddSeason("S2", hosted.Id);

        var match1 = AddMatch(season1.Id, hosted.Id, opponent.Id);
        var match2 = AddMatch(season2.Id, opponent.Id, hosted.Id);
        var unrelatedMatch = AddMatch(season1.Id, hosted.Id, otherOpponent.Id);

        var userA = AddUser("Alice");
        var userB = AddUser("Bob");

        var playerHosted1 = AddRosterPlayer(hosted.Id, season1.Id, "John", "Scorer");
        var playerHosted2 = AddRosterPlayer(hosted.Id, season1.Id, "Sam", "Bencher");

        var positiveReason = new PointReason { Name = "Goal", PointType = PointType.Positive };
        var negativeReason = new PointReason { Name = "Own Goal", PointType = PointType.Negative };
        _db.PointReasons.AddRange(positiveReason, negativeReason);
        _db.SaveChanges();

        var um1 = AddUserMatch(userA.Id, match1.Id, season1.Id);
        var um2 = AddUserMatch(userB.Id, match2.Id, season2.Id);
        var umUnrelated = AddUserMatch(userA.Id, unrelatedMatch.Id, season1.Id);

        _db.UserMatchGoals.AddRange(
            new UserMatchGoal { UserMatchId = um1.Id, RosterPlayerId = playerHosted1.Id, Count = 3, GoalType = GoalType.Regular },
            new UserMatchGoal { UserMatchId = um2.Id, RosterPlayerId = playerHosted2.Id, Count = 1, GoalType = GoalType.Regular },
            new UserMatchGoal { UserMatchId = umUnrelated.Id, RosterPlayerId = playerHosted1.Id, Count = 10, GoalType = GoalType.Regular });

        _db.UserMatchPenalties.AddRange(
            new UserMatchPenalty { UserMatchId = um1.Id, RosterPlayerId = playerHosted2.Id, Count = 2 },
            new UserMatchPenalty { UserMatchId = um2.Id, RosterPlayerId = playerHosted2.Id, Count = 1 });

        _db.UserMatchPoints.AddRange(
            new UserMatchPoint { UserMatchId = um1.Id, PointReasonId = positiveReason.Id, Count = 5, Amount = 5m },
            new UserMatchPoint { UserMatchId = um2.Id, PointReasonId = negativeReason.Id, Count = 2, Amount = -2m });

        _db.SaveChanges();

        var result = await _service.GetTeamStatsAsync(hosted.Id, opponent.Id);

        result.MatchesPlayed.Should().Be(2);
        result.TopScoringUser!.Name.Should().Be("Alice");
        result.TopScoringUser.Count.Should().Be(3);
        result.TopScoringUser.PairedContributors.Should().ContainSingle(c => c.Name == "John Scorer" && c.Count == 3);
        result.TopScoringPlayer!.Name.Should().Be("John Scorer");
        result.TopScoringPlayer.Count.Should().Be(3);
        result.TopScoringPlayer.PairedContributors.Should().ContainSingle(c => c.Name == "Alice" && c.Count == 3);
        result.TopPenalizedUser!.Name.Should().Be("Alice");
        result.TopPenalizedUser.Count.Should().Be(2);
        result.TopPenalizedUser.PairedContributors.Should().ContainSingle(c => c.Name == "Sam Bencher" && c.Count == 2);
        result.TopPenalizedPlayer!.Name.Should().Be("Sam Bencher");
        result.TopPenalizedPlayer.Count.Should().Be(3);
        result.TopPlusUser!.Name.Should().Be("Alice");
        result.TopPlusUser.Count.Should().Be(5);
        result.TopMinusUser!.Name.Should().Be("Bob");
        result.TopMinusUser.Count.Should().Be(2);
        result.TotalPlusPoints.Should().Be(5);
        result.TotalMinusPoints.Should().Be(2);
        result.AvgPlusPerMatch.Should().Be(2.5);
        result.AvgMinusPerMatch.Should().Be(1);
        result.AvgGoalsPerMatch.Should().Be(2);
        result.AvgPenaltiesPerMatch.Should().Be(1.5);
    }

    [Fact]
    public async Task GetTeamStatsAsync_TopScoringPlayerListsAllContributingUsers()
    {
        var hosted = AddTeam("Hosted", "HST");
        var opponent = AddTeam("Opponent", "OPP");
        var season = AddSeason("S1", hosted.Id);
        var match = AddMatch(season.Id, hosted.Id, opponent.Id);

        var userA = AddUser("Alice");
        var userB = AddUser("Bob");
        var player = AddRosterPlayer(hosted.Id, season.Id, "Star", "Player");

        var umA = AddUserMatch(userA.Id, match.Id, season.Id);
        var umB = AddUserMatch(userB.Id, match.Id, season.Id);

        _db.UserMatchGoals.AddRange(
            new UserMatchGoal { UserMatchId = umA.Id, RosterPlayerId = player.Id, Count = 2, GoalType = GoalType.Regular },
            new UserMatchGoal { UserMatchId = umB.Id, RosterPlayerId = player.Id, Count = 3, GoalType = GoalType.Regular });
        _db.SaveChanges();

        var result = await _service.GetTeamStatsAsync(hosted.Id, opponent.Id);

        result.TopScoringPlayer!.Name.Should().Be("Star Player");
        result.TopScoringPlayer.Count.Should().Be(5);
        result.TopScoringPlayer.PairedContributors.Should().HaveCount(2);
        result.TopScoringPlayer.PairedContributors.Should().ContainSingle(c => c.Name == "Bob" && c.Count == 3);
        result.TopScoringPlayer.PairedContributors.Should().ContainSingle(c => c.Name == "Alice" && c.Count == 2);
    }

    [Fact]
    public async Task GetMatchesAsync_ReturnsMatchesNewestFirstWithCorrectHomeAwayFlag()
    {
        var hosted = AddTeam("Hosted", "HST");
        var opponent = AddTeam("Opponent", "OPP");
        var season = AddSeason("S1", hosted.Id);

        var older = AddMatch(season.Id, hosted.Id, opponent.Id, DateTime.UtcNow.AddDays(-5));
        var newer = AddMatch(season.Id, opponent.Id, hosted.Id, DateTime.UtcNow);

        var result = (await _service.GetMatchesAsync(hosted.Id, opponent.Id)).ToList();

        result.Should().HaveCount(2);
        result[0].MatchId.Should().Be(newer.Id);
        result[0].IsHome.Should().BeFalse();
        result[1].MatchId.Should().Be(older.Id);
        result[1].IsHome.Should().BeTrue();
    }
}
