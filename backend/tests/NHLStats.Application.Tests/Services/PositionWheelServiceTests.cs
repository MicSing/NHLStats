using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class PositionWheelServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly PositionWheelService _service;

    private readonly Team _home;
    private readonly Team _away;
    private readonly PointReason _plusReason;
    private readonly PointReason _minusReason;
    private readonly RosterPlayer _rosterPlayer;
    private readonly Season _previous;
    private readonly Season _current;
    private int _matchNumber;

    public PositionWheelServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();
        _service = new PositionWheelService(_db);

        _home = new Team { Name = "Home", ShortName = "HOM" };
        _away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(_home, _away);
        _plusReason = new PointReason { Name = "Wheel plus", PointType = PointType.Positive };
        _minusReason = new PointReason { Name = "Wheel minus", PointType = PointType.Negative };
        _db.PointReasons.AddRange(_plusReason, _minusReason);
        _db.SaveChanges();

        _rosterPlayer = new RosterPlayer { FirstName = "Test", Surname = "Player", TeamId = _home.Id };
        _db.RosterPlayers.Add(_rosterPlayer);

        _previous = AddSeason("Previous", new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        _current = AddSeason("Current", new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc));
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private Season AddSeason(string name, DateTime startedOn, int? parentSeasonId = null)
    {
        var season = new Season { Name = name, StartedOn = startedOn, ParentSeasonId = parentSeasonId };
        _db.Seasons.Add(season);
        _db.SaveChanges();
        return season;
    }

    private User AddUser(string name, SeasonUserPosition? position = null, bool activeInSeason = true, Season? season = null)
    {
        var user = new User { Name = name };
        _db.Users.Add(user);
        _db.SaveChanges();
        _db.SeasonUsers.Add(new SeasonUser
        {
            SeasonId = (season ?? _current).Id,
            UserId = user.Id,
            Position = position,
            IsActive = activeInSeason,
        });
        _db.SaveChanges();
        return user;
    }

    private void AddStats(User user, Season season, int plus = 0, int minus = 0, int penalties = 0, int goals = 0)
    {
        var match = new Match
        {
            SeasonId = season.Id,
            MatchNumber = ++_matchNumber,
            HomeTeamId = _home.Id,
            AwayTeamId = _away.Id,
            CompletionType = CompletionType.RegularTime,
        };
        _db.Matches.Add(match);
        _db.SaveChanges();

        var userMatch = new UserMatch { MatchId = match.Id, UserId = user.Id, SeasonId = season.Id };
        _db.UserMatches.Add(userMatch);
        _db.SaveChanges();

        if (plus > 0)
            _db.UserMatchPoints.Add(new UserMatchPoint { UserMatchId = userMatch.Id, PointReasonId = _plusReason.Id, Count = plus });
        if (minus > 0)
            _db.UserMatchPoints.Add(new UserMatchPoint { UserMatchId = userMatch.Id, PointReasonId = _minusReason.Id, Count = minus });
        if (penalties > 0)
            _db.UserMatchPenalties.Add(new UserMatchPenalty { UserMatchId = userMatch.Id, RosterPlayerId = _rosterPlayer.Id, Count = penalties });
        if (goals > 0)
            _db.UserMatchGoals.Add(new UserMatchGoal { UserMatchId = userMatch.Id, RosterPlayerId = _rosterPlayer.Id, Count = goals, GoalType = GoalType.Regular });
        _db.SaveChanges();
    }

    [Fact]
    public async Task GetState_UnknownSeason_ReturnsNull()
    {
        (await _service.GetStateAsync(9999)).Should().BeNull();
    }

    [Fact]
    public async Task GetState_OrdersByMostMinusThenFewestPlusThenMostPenaltiesThenFewestGoals()
    {
        var a = AddUser("A");
        var b = AddUser("B");
        var c = AddUser("C");
        var d = AddUser("D");
        var e = AddUser("E");
        AddStats(a, _previous, minus: 5, plus: 10);
        AddStats(b, _previous, minus: 8, plus: 10);              // most minus → first
        AddStats(c, _previous, minus: 5, plus: 3);               // same minus as A, fewer plus
        AddStats(d, _previous, minus: 5, plus: 10, penalties: 4, goals: 2);
        AddStats(e, _previous, minus: 5, plus: 10, penalties: 4, goals: 1);

        var state = await _service.GetStateAsync(_current.Id);

        state!.PreviousSeasonId.Should().Be(_previous.Id);
        state.PreviousSeasonName.Should().Be("Previous");
        state.Order.Select(x => x.Name).Should().Equal("B", "C", "E", "D", "A");
        state.CurrentSpinnerUserId.Should().Be(b.Id);
        var eEntry = state.Order.Single(x => x.UserId == e.Id);
        eEntry.Should().BeEquivalentTo(new { MinusPoints = 5, PlusPoints = 10, Penalties = 4, Goals = 1, HasPreviousStats = true });
    }

    [Fact]
    public async Task GetState_PlayersWithoutPreviousStats_SpinLastAlphabetically()
    {
        var zed = AddUser("Zed");
        var amy = AddUser("Amy");
        var vet = AddUser("Veteran");
        AddStats(vet, _previous, plus: 50);

        var state = await _service.GetStateAsync(_current.Id);

        state!.Order.Select(x => x.Name).Should().Equal("Veteran", "Amy", "Zed");
        state.Order.Single(x => x.UserId == amy.Id).HasPreviousStats.Should().BeFalse();
        state.Order.Single(x => x.UserId == zed.Id).HasPreviousStats.Should().BeFalse();
    }

    [Fact]
    public async Task GetState_UsesLatestEarlierMainSeasonIncludingItsPlayoffs()
    {
        var older = AddSeason("Older", new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var playoffs = AddSeason("Previous Playoffs", new DateTime(2025, 6, 1, 0, 0, 0, DateTimeKind.Utc), _previous.Id);
        var later = AddSeason("Later", new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        var a = AddUser("A");
        var b = AddUser("B");
        AddStats(a, older, minus: 100);
        AddStats(b, later, minus: 100);
        AddStats(a, _previous, minus: 1);
        AddStats(b, _previous, minus: 1);
        AddStats(b, playoffs, minus: 2);

        var state = await _service.GetStateAsync(_current.Id);

        state!.PreviousSeasonId.Should().Be(_previous.Id);
        state.Order.Select(x => x.Name).Should().Equal("B", "A");
        state.Order[0].MinusPoints.Should().Be(3);
        state.Order[1].MinusPoints.Should().Be(1);
    }

    [Fact]
    public async Task GetState_ForPlayoffSeason_SkipsItsOwnParent()
    {
        var currentPlayoffs = AddSeason("Current Playoffs", new DateTime(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc), _current.Id);
        AddUser("A", season: currentPlayoffs);

        var state = await _service.GetStateAsync(currentPlayoffs.Id);

        state!.PreviousSeasonId.Should().Be(_previous.Id);
    }

    [Fact]
    public async Task GetState_IncludesLegacyAggregatedTotals()
    {
        var a = AddUser("A");
        var b = AddUser("B");
        AddStats(a, _previous, minus: 3);
        _db.UserSeasonAggregatedData.Add(new UserSeasonAggregatedData
        {
            UserId = b.Id, SeasonId = _previous.Id, TotalMinus = 10, TotalPlus = 2, CreatedAt = DateTime.UtcNow,
        });
        await _db.SaveChangesAsync();

        var state = await _service.GetStateAsync(_current.Id);

        state!.Order.Select(x => x.Name).Should().Equal("B", "A");
        state.Order[0].Should().BeEquivalentTo(new { MinusPoints = 10, PlusPoints = 2, HasPreviousStats = true });
    }

    [Fact]
    public async Task GetState_NoPreviousSeason_OrdersAlphabetically()
    {
        var first = AddSeason("First", new DateTime(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc));
        AddUser("Bob", season: first);
        AddUser("Al", season: first);

        var state = await _service.GetStateAsync(first.Id);

        state!.PreviousSeasonId.Should().BeNull();
        state.Order.Select(x => x.Name).Should().Equal("Al", "Bob");
    }

    [Fact]
    public async Task GetState_ExcludesSeasonInactiveUsers_AndSkipsUsersWithPosition()
    {
        var a = AddUser("A", position: SeasonUserPosition.C);
        var b = AddUser("B");
        AddUser("Inactive", activeInSeason: false);
        AddStats(a, _previous, minus: 10);
        AddStats(b, _previous, minus: 1);

        var state = await _service.GetStateAsync(_current.Id);

        state!.Order.Select(x => x.Name).Should().Equal("A", "B");
        state.CurrentSpinnerUserId.Should().Be(b.Id);
        state.AvailablePositions.Should().BeEquivalentTo(
            [SeasonUserPosition.LW, SeasonUserPosition.RW, SeasonUserPosition.LD, SeasonUserPosition.RD]);
    }

    [Fact]
    public async Task GetState_AllPositionsTaken_RefillsWheel()
    {
        AddUser("A", SeasonUserPosition.LW);
        AddUser("B", SeasonUserPosition.C);
        AddUser("C", SeasonUserPosition.RW);
        AddUser("D", SeasonUserPosition.LD);
        AddUser("E", SeasonUserPosition.RD);
        AddUser("F", SeasonUserPosition.C);
        AddUser("G");

        var state = await _service.GetStateAsync(_current.Id);

        state!.AvailablePositions.Should().BeEquivalentTo(
            [SeasonUserPosition.LW, SeasonUserPosition.RW, SeasonUserPosition.LD, SeasonUserPosition.RD]);
    }

    [Fact]
    public async Task GetState_EveryoneHasPosition_NoSpinner()
    {
        AddUser("A", SeasonUserPosition.LW);

        var state = await _service.GetStateAsync(_current.Id);

        state!.CurrentSpinnerUserId.Should().BeNull();
    }

    [Fact]
    public async Task Spin_AssignsAvailablePositionToCurrentSpinner_AndAdvances()
    {
        var a = AddUser("A", SeasonUserPosition.LW);
        var b = AddUser("B");
        var c = AddUser("C");
        AddStats(b, _previous, minus: 5);
        AddStats(c, _previous, minus: 1);

        var result = await _service.SpinAsync(_current.Id);

        result!.UserId.Should().Be(b.Id);
        result.Position.Should().NotBe(SeasonUserPosition.LW);
        var saved = await _db.SeasonUsers.AsNoTracking().SingleAsync(su => su.SeasonId == _current.Id && su.UserId == b.Id);
        saved.Position.Should().Be(result.Position);
        result.State.CurrentSpinnerUserId.Should().Be(c.Id);
        result.State.AvailablePositions.Should().NotContain([SeasonUserPosition.LW, result.Position]);
        result.State.Order.Single(x => x.UserId == a.Id).Position.Should().Be(SeasonUserPosition.LW);
    }

    [Fact]
    public async Task Spin_EveryPlayerGetsUniquePosition()
    {
        for (var i = 0; i < 5; i++) AddUser($"P{i}");

        for (var i = 0; i < 5; i++) await _service.SpinAsync(_current.Id);

        var positions = await _db.SeasonUsers.Where(su => su.SeasonId == _current.Id).Select(su => su.Position).ToListAsync();
        positions.Should().OnlyHaveUniqueItems().And.NotContainNulls();
    }

    [Fact]
    public async Task Spin_NobodyLeft_Throws()
    {
        AddUser("A", SeasonUserPosition.LW);

        var act = () => _service.SpinAsync(_current.Id);

        await act.Should().ThrowAsync<InvalidOperationException>();
    }

    [Fact]
    public async Task Spin_UnknownSeason_ReturnsNull()
    {
        (await _service.SpinAsync(9999)).Should().BeNull();
    }

    [Fact]
    public async Task Reset_ClearsAllPositionsInSeason()
    {
        AddUser("A", SeasonUserPosition.LW);
        AddUser("B", SeasonUserPosition.C, activeInSeason: false);
        var other = AddUser("Other", SeasonUserPosition.RW, season: _previous);

        var state = await _service.ResetAsync(_current.Id);

        state!.AvailablePositions.Should().HaveCount(5);
        (await _db.SeasonUsers.AsNoTracking().Where(su => su.SeasonId == _current.Id).AllAsync(su => su.Position == null))
            .Should().BeTrue();
        (await _db.SeasonUsers.AsNoTracking().SingleAsync(su => su.UserId == other.Id)).Position
            .Should().Be(SeasonUserPosition.RW);
    }
}
