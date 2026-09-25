using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class MatchupServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly MatchupService _service;

    private Team _hosted = null!;
    private Team _opponent = null!;
    private Team _other = null!;
    private Season _season = null!;
    private PointReason _plusReason = null!;
    private PointReason _minusReason = null!;
    private RosterPlayer _player = null!;
    private int _matchNumber;

    public MatchupServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();

        _service = new MatchupService(_db);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private async Task SeedBaseAsync()
    {
        _hosted = new Team { Name = "Hosted", ShortName = "HST" };
        _opponent = new Team { Name = "Opponent", ShortName = "OPP" };
        _other = new Team { Name = "Other", ShortName = "OTH" };
        _db.Teams.AddRange(_hosted, _opponent, _other);
        await _db.SaveChangesAsync();

        _season = new Season { Name = "S1", StartedOn = new DateTime(2025, 1, 1), HostedTeamId = _hosted.Id };
        _db.Seasons.Add(_season);
        _plusReason = new PointReason { Name = "Plus", PointType = PointType.Positive };
        _minusReason = new PointReason { Name = "Minus", PointType = PointType.Negative };
        _db.PointReasons.AddRange(_plusReason, _minusReason);
        _player = new RosterPlayer { FirstName = "A", Surname = "B", TeamId = _hosted.Id };
        _db.RosterPlayers.Add(_player);
        await _db.SaveChangesAsync();
    }

    private async Task<Match> AddMatchAsync(Team home, Team away, int homeScore, int awayScore,
        CompletionType completion = CompletionType.RegularTime, DateTime? date = null, int? seasonId = null)
    {
        var match = new Match
        {
            SeasonId = seasonId ?? _season.Id,
            MatchNumber = ++_matchNumber,
            HomeTeamId = home.Id,
            AwayTeamId = away.Id,
            HomeScore = homeScore,
            AwayScore = awayScore,
            CompletionType = completion,
            MatchDate = date,
        };
        _db.Matches.Add(match);
        await _db.SaveChangesAsync();
        return match;
    }

    private async Task<User> AddUserAsync(string name)
    {
        var user = new User { Name = name };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    private async Task AddStatsAsync(Match match, User user, int goals = 0, int shootoutGoals = 0,
        int penalties = 0, int plus = 0, int minus = 0)
    {
        var um = new UserMatch { MatchId = match.Id, SeasonId = match.SeasonId, UserId = user.Id };
        if (goals > 0) um.Goals.Add(new UserMatchGoal { RosterPlayerId = _player.Id, Count = goals, GoalType = GoalType.Regular });
        if (shootoutGoals > 0) um.Goals.Add(new UserMatchGoal { RosterPlayerId = _player.Id, Count = shootoutGoals, GoalType = GoalType.Shootout });
        if (penalties > 0) um.Penalties.Add(new UserMatchPenalty { RosterPlayerId = _player.Id, Count = penalties });
        if (plus > 0) um.Points.Add(new UserMatchPoint { PointReasonId = _plusReason.Id, Count = plus });
        if (minus > 0) um.Points.Add(new UserMatchPoint { PointReasonId = _minusReason.Id, Count = minus });
        _db.UserMatches.Add(um);
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetForMatchAsync_returns_null_for_unknown_match()
    {
        var result = await _service.GetForMatchAsync(999);
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetForMatchAsync_returns_empty_summary_when_teams_have_not_played()
    {
        await SeedBaseAsync();
        await AddMatchAsync(_hosted, _other, 3, 1);
        var upcoming = await AddMatchAsync(_hosted, _opponent, 0, 0, CompletionType.None);

        var result = await _service.GetForMatchAsync(upcoming.Id);

        result.Should().NotBeNull();
        result!.MatchesPlayed.Should().Be(0);
        result.HomeTeamName.Should().Be("Hosted");
        result.AwayTeamName.Should().Be("Opponent");
        result.LastMatches.Should().BeEmpty();
        result.TopScorers.Should().BeEmpty();
        result.MostPenalized.Should().BeEmpty();
        result.MostPlusPoints.Should().BeEmpty();
        result.MostMinusPoints.Should().BeEmpty();
    }

    [Fact]
    public async Task GetForMatchAsync_includes_only_finished_matches_of_the_pair_in_same_season()
    {
        await SeedBaseAsync();
        var otherSeason = new Season { Name = "S0", StartedOn = new DateTime(2024, 1, 1) };
        _db.Seasons.Add(otherSeason);
        await _db.SaveChangesAsync();

        var first = await AddMatchAsync(_hosted, _opponent, 2, 1, date: new DateTime(2025, 2, 1));
        var second = await AddMatchAsync(_opponent, _hosted, 4, 3, CompletionType.Overtime, new DateTime(2025, 3, 1));
        await AddMatchAsync(_hosted, _opponent, 1, 0, CompletionType.InProgress);
        await AddMatchAsync(_hosted, _opponent, 0, 0, CompletionType.None);
        await AddMatchAsync(_hosted, _other, 5, 0);
        await AddMatchAsync(_hosted, _opponent, 9, 0, seasonId: otherSeason.Id);
        var upcoming = await AddMatchAsync(_hosted, _opponent, 0, 0, CompletionType.None);

        var result = await _service.GetForMatchAsync(upcoming.Id);

        result!.MatchesPlayed.Should().Be(2);
        result.LastMatches.Select(m => m.Id).Should().Equal(second.Id, first.Id);
        var latest = result.LastMatches.First();
        latest.HomeTeamName.Should().Be("Opponent");
        latest.HomeScore.Should().Be(4);
        latest.AwayScore.Should().Be(3);
        latest.CompletionType.Should().Be(CompletionType.Overtime);
    }

    [Fact]
    public async Task GetForMatchAsync_limits_last_matches()
    {
        await SeedBaseAsync();
        for (var i = 0; i < 7; i++) await AddMatchAsync(_hosted, _opponent, i, 0);
        var upcoming = await AddMatchAsync(_hosted, _opponent, 0, 0, CompletionType.None);

        var result = await _service.GetForMatchAsync(upcoming.Id, 5);

        result!.MatchesPlayed.Should().Be(7);
        result.LastMatches.Should().HaveCount(5);
        result.LastMatches.First().HomeScore.Should().Be(6);
    }

    [Fact]
    public async Task GetForMatchAsync_returns_leaders_across_head_to_head_matches()
    {
        await SeedBaseAsync();
        var alice = await AddUserAsync("Alice");
        var bob = await AddUserAsync("Bob");
        var carl = await AddUserAsync("Carl");

        var m1 = await AddMatchAsync(_hosted, _opponent, 3, 2);
        var m2 = await AddMatchAsync(_opponent, _hosted, 1, 2, CompletionType.Shootout);
        var otherTeamMatch = await AddMatchAsync(_hosted, _other, 9, 0);
        var upcoming = await AddMatchAsync(_hosted, _opponent, 0, 0, CompletionType.None);

        await AddStatsAsync(m1, alice, goals: 2, penalties: 1, plus: 3, minus: 1);
        await AddStatsAsync(m1, bob, goals: 1, penalties: 3, plus: 1, minus: 2);
        await AddStatsAsync(m2, alice, penalties: 1, minus: 1);
        // Shootout goals do not count; Bob stays behind Alice on goals.
        await AddStatsAsync(m2, bob, goals: 0, shootoutGoals: 5, plus: 2);
        await AddStatsAsync(m2, carl);
        // Stats from a match against another team are ignored.
        await AddStatsAsync(otherTeamMatch, carl, goals: 10, penalties: 10, plus: 10, minus: 10);

        var result = await _service.GetForMatchAsync(upcoming.Id);

        result!.TopScorers.Select(u => u.UserName).Should().Equal("Alice");
        result.MostPenalized.Select(u => u.UserName).Should().Equal("Bob");
        result.MostPlusPoints.Select(u => u.UserName).Should().Equal("Alice", "Bob");
        result.MostMinusPoints.Select(u => u.UserName).Should().Equal("Alice", "Bob");
    }
}
