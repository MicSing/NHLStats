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

    /// <param name="probability">
    /// Null reproduces a leg that predates BetLeg.Probability (or one BackfillLegacyProbabilitiesAsync
    /// hasn't reached yet); a value reproduces one placed since, or already backfilled.
    /// </param>
    private Bet SeedBet(BetStatus status, params (BetType Type, int MatchId, decimal Odds, int Occasions, int? TeamId, decimal? Probability)[] legs)
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
                Probability = l.Probability,
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
    public async Task WonBet_LegWithStoredProbability_RepricesToCurrentVersionByDefault()
    {
        var (_, _, match) = SeedMatch();
        // Odds is deliberately stale/arbitrary — with Probability on record, it must be ignored.
        var bet = SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 999.99m, 1, null, 0.40m));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(1);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        var expected = OddsFormula.Compute(OddsFormulaTier.Current, 0.40m, BettingConstants.Margin);
        var repricedLeg = reloaded.Legs.Single();
        repricedLeg.Odds.Should().Be(expected);
        reloaded.TotalOdds.Should().Be(expected);
        repricedLeg.OddsFormulaVersion.Should().Be(BettingConstants.CurrentOddsFormulaVersion);
        repricedLeg.Probability.Should().Be(0.40m, "the stored probability is untouched by repricing");
    }

    [Fact]
    public async Task LegWithoutStoredProbability_IsLeftUntouched()
    {
        // This is the state every pre-existing leg is in until BackfillLegacyProbabilitiesAsync
        // runs (or PlaceBetAsync stamped it going forward) — RecalculateHistoricalTicketOddsAsync
        // must never guess at a probability itself.
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null, null));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(0);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        var untouchedLeg = reloaded.Legs.Single();
        untouchedLeg.Odds.Should().Be(2.00m);
        untouchedLeg.OddsFormulaVersion.Should().Be(BettingConstants.LegacyOddsFormulaVersion, "nothing repriced it, so it's still on whatever version it started on");
    }

    [Fact]
    public async Task BackfillThenRecalculate_RepricesALegThatStartedWithNoProbability()
    {
        // The intended real-world flow: BackfillLegacyProbabilitiesAsync runs once on startup,
        // then the admin action can reprice to any formula version using what it filled in.
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null, null));

        await _service.BackfillLegacyProbabilitiesAsync();
        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(1);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        var expected = OddsFormula.Compute(OddsFormulaTier.Current, 0.80m / 2.00m, BettingConstants.Margin);
        reloaded.Legs.Single().Odds.Should().Be(expected);
    }

    [Fact]
    public async Task LegAlreadyOnTargetVersion_IsSkipped()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 1.35m, 1, null, 0.40m));
        var leg = bet.Legs.Single();
        leg.OddsFormulaVersion = BettingConstants.CurrentOddsFormulaVersion;
        await _db.SaveChangesAsync();

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(0);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        reloaded.Legs.Single().Odds.Should().Be(1.35m, "a leg already priced under the target formula must be left alone");
    }

    [Fact]
    public async Task LostBet_IsAlsoRecalculated()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Lost, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null, 0.40m));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(1);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        reloaded.Legs.Single().Odds.Should().Be(OddsFormula.Compute(OddsFormulaTier.Current, 0.40m, BettingConstants.Margin));
    }

    [Fact]
    public async Task PendingBet_IsNotTouched()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Pending, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null, 0.40m));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(0);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        reloaded.Legs.Single().Odds.Should().Be(2.00m, "pending tickets keep the odds they were locked at");
    }

    [Fact]
    public async Task CancelledBet_IsNotTouched()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Cancelled, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null, 0.40m));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(0);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        reloaded.Legs.Single().Odds.Should().Be(2.00m);
    }

    [Fact]
    public async Task RecalculateToLegacyVersion_HostedVsOpponent_UsesDifferentTargetMargin()
    {
        // Exercises picking a target formula version other than "current" — two v2 legs (with
        // their true probability already stored) reprice back to v1, where the hosted/opponent
        // TeamWin asymmetry applies (it doesn't under v2 — every bet type shares one margin there).
        var (home, away, match) = SeedMatch();
        var season = await _db.Seasons.FirstAsync(s => s.Id == match.SeasonId);
        season.HostedTeamId = home.Id;
        await _db.SaveChangesAsync();

        var hostedBet = SeedBet(BetStatus.Won, (BetType.TeamWin, match.Id, 1.52m, 1, home.Id, 0.40m));
        var opponentBet = SeedBet(BetStatus.Won, (BetType.TeamWin, match.Id, 1.52m, 1, away.Id, 0.40m));
        foreach (var bet in new[] { hostedBet, opponentBet })
        {
            bet.Legs.Single().OddsFormulaVersion = BettingConstants.CurrentOddsFormulaVersion;
        }
        await _db.SaveChangesAsync();

        var count = await _service.RecalculateHistoricalTicketOddsAsync(BettingConstants.LegacyOddsFormulaVersion);

        count.Should().Be(2);
        var reloadedHosted = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == hostedBet.Id);
        var reloadedOpponent = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == opponentBet.Id);
        reloadedHosted.Legs.Single().Odds.Should().Be(OddsFormula.Compute(OddsFormulaTier.Legacy, 0.40m, 0.80m), "the hosted team's TeamWin leg reprices with the default (App) margin under v1");
        reloadedOpponent.Legs.Single().Odds.Should().Be(OddsFormula.Compute(OddsFormulaTier.Legacy, 0.40m, 0.75m), "the opponent's TeamWin leg reprices with TeamMargin under v1");
        reloadedHosted.Legs.Single().OddsFormulaVersion.Should().Be(BettingConstants.LegacyOddsFormulaVersion);
    }

    [Fact]
    public async Task RecalculateToHistoricalVersion_UsesHistoricalMargin_NotLiveMargin()
    {
        // The whole point of the historical (2.0) tier: repricing an old ticket to it uses
        // BettingConstants.HistoricalMargin, not the live BettingConstants.Margin — a gentler
        // reconciliation for tickets placed before the margin change, distinct from what new
        // bets and the "current" (2.1) tier use.
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null, 0.40m));

        var count = await _service.RecalculateHistoricalTicketOddsAsync(BettingConstants.HistoricalOddsFormulaVersion);

        count.Should().Be(1);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        var repricedLeg = reloaded.Legs.Single();
        var expected = OddsFormula.Compute(OddsFormulaTier.Historical, 0.40m, BettingConstants.HistoricalMargin);
        repricedLeg.Odds.Should().Be(expected);
        repricedLeg.Odds.Should().NotBe(OddsFormula.Compute(OddsFormulaTier.Current, 0.40m, BettingConstants.Margin),
            "historical and current repricing must actually diverge for this test to mean anything");
        repricedLeg.OddsFormulaVersion.Should().Be(BettingConstants.HistoricalOddsFormulaVersion);
    }

    [Fact]
    public async Task MultiLegBet_TotalOddsRecomputedFromRepricedLegs()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won,
            (BetType.UserPlusPoint, match.Id, 2.00m, 1, null, 0.40m),
            (BetType.UserGoal, match.Id, 2.00m, 1, null, 0.40m));

        var count = await _service.RecalculateHistoricalTicketOddsAsync();

        count.Should().Be(1);
        var reloaded = await _db.Bets.Include(b => b.Legs).AsNoTracking().FirstAsync(b => b.Id == bet.Id);
        var perLeg = OddsFormula.Compute(OddsFormulaTier.Current, 0.40m, BettingConstants.Margin);
        reloaded.TotalOdds.Should().Be(Math.Floor(perLeg * perLeg * 100m) / 100m);
    }

    [Fact]
    public async Task Recalculation_IsIdempotent()
    {
        var (_, _, match) = SeedMatch();
        SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null, 0.40m));

        var firstRun = await _service.RecalculateHistoricalTicketOddsAsync();
        var secondRun = await _service.RecalculateHistoricalTicketOddsAsync();

        firstRun.Should().Be(1);
        secondRun.Should().Be(0, "the leg is now on CurrentOddsFormulaVersion and must not be repriced again");
    }
}
