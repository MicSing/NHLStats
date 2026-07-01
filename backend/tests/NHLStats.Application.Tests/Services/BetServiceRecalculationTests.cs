using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

public class BetServiceRecalculationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly BetService _service;

    public BetServiceRecalculationTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();

        var calculator = new BettingCalculator(_db);
        var balanceService = new BettingBalanceService(calculator);
        var oddsService = new BettingOddsService(_db);
        _service = new BetService(_db, balanceService, oddsService);
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    private Match SeedMatch()
    {
        var home = new Team { Name = "Home", ShortName = "HOM" };
        var away = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(home, away);
        _db.SaveChanges();
        var season = new Season { Name = "S1", StartedOn = DateTime.UtcNow };
        _db.Seasons.Add(season);
        _db.SaveChanges();
        var match = new Match
        {
            SeasonId = season.Id,
            MatchNumber = 1,
            HomeTeamId = home.Id,
            AwayTeamId = away.Id,
            HomeScore = 3,
            AwayScore = 1,
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.Add(match);
        _db.SaveChanges();
        return match;
    }

    private Bet SeedWonBet(string createdBy, params (BetType Type, int MatchId, decimal Odds)[] legs)
    {
        var bet = new Bet
        {
            Id = Guid.NewGuid(),
            CreatedBy = createdBy,
            Stake = 10m,
            Status = BetStatus.Won,
            CreatedOn = DateTime.UtcNow,
            EvaluatedOn = DateTime.UtcNow,
            Legs = legs.Select(l => new BetLeg
            {
                MatchId = l.MatchId,
                BetType = l.Type,
                Odds = l.Odds,
                Occasions = 1,
                Status = BetLegStatus.Won,
                EvaluatedOn = DateTime.UtcNow
            }).ToList()
        };
        bet.TotalOdds = legs.Aggregate(1m, (acc, l) => Math.Floor(acc * l.Odds * 100m) / 100m);
        _db.Bets.Add(bet);
        _db.SaveChanges();
        return bet;
    }

    [Fact]
    public async Task SameMatchTwoPlusPointLegs_CollapsesToMaxOdds()
    {
        var match = SeedMatch();
        var bet = SeedWonBet("user1",
            (BetType.UserPlusPoint, match.Id, 1.50m),
            (BetType.UserMinusPoint, match.Id, 1.30m)); // different types, same match — not a violation

        var count = await _service.RecalculatePlusMinusOddsAsync();

        count.Should().Be(0, "one plus + one minus on the same match is allowed — not a same-type stack");
        var reloaded = await _db.Bets.AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        reloaded.TotalOdds.Should().Be(Math.Floor(1.50m * 1.30m * 100m) / 100m);
    }

    [Fact]
    public async Task SameMatchTwoPlusPointLegsSameType_CollapsesToMax()
    {
        var match = SeedMatch();
        var userA = new User { Name = "User A" };
        var userB = new User { Name = "User B" };
        _db.Users.AddRange(userA, userB);
        _db.SaveChanges();

        var teamWinLeg = (BetType.TeamWin, match.Id, 2.10m);
        var bet = SeedWonBet("user1", teamWinLeg,
            (BetType.UserPlusPoint, match.Id, 1.50m),
            (BetType.UserPlusPoint, match.Id, 1.30m));
        // Give the two plus-point legs distinct users so they're realistic distinct legs.
        var plusLegs = bet.Legs.Where(l => l.BetType == BetType.UserPlusPoint).ToList();
        plusLegs[0].UserId = userA.Id;
        plusLegs[1].UserId = userB.Id;
        await _db.SaveChangesAsync();

        var count = await _service.RecalculatePlusMinusOddsAsync();

        count.Should().Be(1);
        var reloaded = await _db.Bets.AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        // TeamWin leg (2.10) multiplies normally; the two plus-point legs collapse to max(1.50, 1.30) = 1.50.
        reloaded.TotalOdds.Should().Be(Math.Floor(2.10m * 1.50m * 100m) / 100m);
    }

    [Fact]
    public async Task MultipleViolatingMatches_CollapseIndependentlyThenMultiply()
    {
        var matchA = SeedMatch();
        var matchB = SeedMatch();
        var bet = SeedWonBet("user1",
            (BetType.UserPlusPoint, matchA.Id, 1.50m),
            (BetType.UserPlusPoint, matchA.Id, 1.30m),
            (BetType.UserMinusPoint, matchB.Id, 1.20m),
            (BetType.UserMinusPoint, matchB.Id, 1.60m));

        var count = await _service.RecalculatePlusMinusOddsAsync();

        count.Should().Be(1);
        var reloaded = await _db.Bets.AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        // Match A group collapses to max(1.50,1.30)=1.50; Match B group collapses to max(1.20,1.60)=1.60.
        reloaded.TotalOdds.Should().Be(Math.Floor(1.50m * 1.60m * 100m) / 100m);
    }

    [Fact]
    public async Task CrossMatchPlusPointLegs_NotTouched()
    {
        var matchA = SeedMatch();
        var matchB = SeedMatch();
        var bet = SeedWonBet("user1",
            (BetType.UserPlusPoint, matchA.Id, 1.50m),
            (BetType.UserPlusPoint, matchB.Id, 1.30m));

        var count = await _service.RecalculatePlusMinusOddsAsync();

        count.Should().Be(0, "these are on different matches — the per-match cap wasn't violated");
        var reloaded = await _db.Bets.AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        reloaded.TotalOdds.Should().Be(Math.Floor(1.50m * 1.30m * 100m) / 100m);
    }

    [Fact]
    public async Task PendingOrLostBets_AreNotRecalculated()
    {
        var match = SeedMatch();
        var bet = SeedWonBet("user1",
            (BetType.UserPlusPoint, match.Id, 1.50m),
            (BetType.UserPlusPoint, match.Id, 1.30m));
        bet.Status = BetStatus.Pending;
        await _db.SaveChangesAsync();

        var count = await _service.RecalculatePlusMinusOddsAsync();

        count.Should().Be(0, "only Won bets are recalculated");
    }

    [Fact]
    public async Task Recalculation_IsIdempotent()
    {
        var match = SeedMatch();
        SeedWonBet("user1",
            (BetType.UserPlusPoint, match.Id, 1.50m),
            (BetType.UserPlusPoint, match.Id, 1.30m));

        var firstRun = await _service.RecalculatePlusMinusOddsAsync();
        var secondRun = await _service.RecalculatePlusMinusOddsAsync();

        firstRun.Should().Be(1);
        secondRun.Should().Be(0, "re-running on an already-collapsed bet should be a no-op");
    }
}
