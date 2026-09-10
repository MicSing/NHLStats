using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

public class BetServiceHistoricalOddsRecalculationTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly BetService _service;

    public BetServiceHistoricalOddsRecalculationTests()
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

    private (Team Home, Team Away, Match Match) SeedMatch()
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
        return (home, away, match);
    }

    // Mirrors LegacyOddsReconstructor's own computation exactly (same operation order) rather
    // than a hand-typed literal, so assertions can't drift from a `decimal` rounding quirk on a
    // repeating fraction (e.g. 1/0.35) that wasn't hand-verified against the real runtime.
    private static decimal ExpectedOdds(decimal legacyMargin, decimal legacyOdds)
    {
        var probability = legacyMargin / legacyOdds;
        var fairOdds = 1m / probability;
        var odds = 1m + (fairOdds - 1m) * BettingConstants.Margin;
        return Math.Floor(odds * 100m) / 100m;
    }

    private Bet SeedBet(BetStatus status, params (BetType Type, int MatchId, decimal Odds, int Occasions, int? TeamId)[] legs)
    {
        var bet = new Bet
        {
            Id = Guid.NewGuid(),
            CreatedBy = "user1",
            Stake = 10m,
            Status = status,
            CreatedOn = DateTime.UtcNow,
            EvaluatedOn = status == BetStatus.Pending ? null : DateTime.UtcNow,
            Legs = legs.Select(l => new BetLeg
            {
                MatchId = l.MatchId,
                BetType = l.Type,
                Odds = l.Odds,
                Occasions = l.Occasions,
                TeamId = l.TeamId,
                Status = status == BetStatus.Won ? BetLegStatus.Won
                    : status == BetStatus.Lost ? BetLegStatus.Lost
                    : status == BetStatus.Cancelled ? BetLegStatus.Cancelled
                    : BetLegStatus.Pending,
                EvaluatedOn = status == BetStatus.Pending ? null : DateTime.UtcNow
            }).ToList()
        };
        bet.TotalOdds = legs.Aggregate(1m, (acc, l) => Math.Floor(acc * l.Odds * 100m) / 100m);
        _db.Bets.Add(bet);
        _db.SaveChanges();
        return bet;
    }

    [Fact]
    public async Task WonBet_SingleOccasionUserLeg_RepricedFromLegacyAppMargin()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(1);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        var expected = ExpectedOdds(0.80m, 2.00m);
        reloaded.Legs.Single().Odds.Should().Be(expected);
        reloaded.TotalOdds.Should().Be(expected);
        reloaded.Legs.Single().OddsFormulaVersion.Should().Be(BettingConstants.CurrentOddsFormulaVersion);
    }

    [Fact]
    public async Task Recalculation_IsIdempotent()
    {
        var (_, _, match) = SeedMatch();
        SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null));

        var firstRun = await _service.RecalculateHistoricalTicketOddsAsync();
        var secondRun = await _service.RecalculateHistoricalTicketOddsAsync();

        firstRun.Should().Be(1);
        secondRun.Should().Be(0, "the leg is now on CurrentOddsFormulaVersion and must not be repriced again");
    }

    [Fact]
    public async Task LegAlreadyOnCurrentVersion_IsNotTouched()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 1.35m, 1, null));
        var leg = bet.Legs.Single();
        leg.OddsFormulaVersion = BettingConstants.CurrentOddsFormulaVersion;
        await _db.SaveChangesAsync();

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(0);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        reloaded.Legs.Single().Odds.Should().Be(1.35m, "a leg already priced under the current formula must be left alone");
    }

    [Fact]
    public async Task LostBet_IsAlsoRecalculated()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Lost, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(1);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        reloaded.Legs.Single().Odds.Should().Be(ExpectedOdds(0.80m, 2.00m));
    }

    [Fact]
    public async Task PendingBet_IsNotTouched()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Pending, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(0);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        reloaded.Legs.Single().Odds.Should().Be(2.00m, "pending tickets keep the odds they were locked at");
    }

    [Fact]
    public async Task CancelledBet_IsNotTouched()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Cancelled, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(0);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        reloaded.Legs.Single().Odds.Should().Be(2.00m);
    }

    [Fact]
    public async Task TeamWinLeg_HostedVsOpponent_UsesDifferentLegacyMargin()
    {
        var (home, away, match) = SeedMatch();
        // The hosted team can only be set once the team ids exist.
        var season = await _db.Seasons.FirstAsync(s => s.Id == match.SeasonId);
        season.HostedTeamId = home.Id;
        await _db.SaveChangesAsync();

        var hostedBet = SeedBet(BetStatus.Won, (BetType.TeamWin, match.Id, 2.00m, 1, home.Id));
        var opponentBet = SeedBet(BetStatus.Won, (BetType.TeamWin, match.Id, 2.00m, 1, away.Id));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(2);
        var reloadedHosted = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == hostedBet.Id);
        var reloadedOpponent = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == opponentBet.Id);
        reloadedHosted.Legs.Single().Odds.Should().Be(ExpectedOdds(0.80m, 2.00m), "the hosted team's TeamWin leg was originally priced with the default (App) margin");
        reloadedOpponent.Legs.Single().Odds.Should().Be(ExpectedOdds(0.75m, 2.00m), "the opponent's TeamWin leg was originally priced with TeamMargin");
    }

    [Fact]
    public async Task MultiOccasionLeg_UsesLegacyOccasionsMargin_AndTotalOddsFollows()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 3, null));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(1);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        var expected = ExpectedOdds(0.70m, 2.00m);
        reloaded.Legs.Single().Odds.Should().Be(expected);
        reloaded.TotalOdds.Should().Be(expected);
    }

    [Fact]
    public async Task MultiLegBet_TotalOddsRecomputedFromRepricedLegs()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won,
            (BetType.UserPlusPoint, match.Id, 2.00m, 1, null),
            (BetType.UserGoal, match.Id, 2.00m, 1, null));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(1);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        var perLeg = ExpectedOdds(0.80m, 2.00m);
        reloaded.TotalOdds.Should().Be(Math.Floor(perLeg * perLeg * 100m) / 100m);
    }
}
