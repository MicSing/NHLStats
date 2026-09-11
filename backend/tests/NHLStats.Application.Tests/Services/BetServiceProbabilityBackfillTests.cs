using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Tests.Services;

public class BetServiceProbabilityBackfillTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly BetService _service;

    public BetServiceProbabilityBackfillTests()
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
                // OddsFormulaVersion defaults to 1.0 (legacy) and Probability to null — exactly
                // what a leg placed before BetLeg.Probability existed looks like in the DB.
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
    public async Task SingleOccasionUserLeg_BackfillsProbability_FromLegacyAppMargin()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null));

        var count = await _service.BackfillLegacyProbabilitiesAsync();

        count.Should().Be(1);
        var reloaded = await _db.BetLegs.AsNoTracking().FirstAsync(l => l.MatchId == match.Id);
        reloaded.Probability.Should().Be(0.80m / 2.00m); // AppMargin / odds
        reloaded.Odds.Should().Be(2.00m, "backfill only fills in Probability, it never touches Odds");
    }

    [Fact]
    public async Task MultiOccasionLeg_BackfillsProbability_FromLegacyOccasionsMargin()
    {
        var (_, _, match) = SeedMatch();
        SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 3, null));

        await _service.BackfillLegacyProbabilitiesAsync();

        var reloaded = await _db.BetLegs.AsNoTracking().FirstAsync(l => l.MatchId == match.Id);
        reloaded.Probability.Should().Be(0.70m / 2.00m); // OccasionsMargin / odds
    }

    [Fact]
    public async Task TeamWinLeg_HostedVsOpponent_BackfillsFromDifferentLegacyMargin()
    {
        var (home, away, match) = SeedMatch();
        var season = await _db.Seasons.FirstAsync(s => s.Id == match.SeasonId);
        season.HostedTeamId = home.Id;
        await _db.SaveChangesAsync();

        var hostedBet = SeedBet(BetStatus.Won, (BetType.TeamWin, match.Id, 2.00m, 1, home.Id));
        var opponentBet = SeedBet(BetStatus.Won, (BetType.TeamWin, match.Id, 2.00m, 1, away.Id));

        var count = await _service.BackfillLegacyProbabilitiesAsync();

        count.Should().Be(2);
        var hostedLeg = await _db.BetLegs.AsNoTracking().FirstAsync(l => l.BetId == hostedBet.Id);
        var opponentLeg = await _db.BetLegs.AsNoTracking().FirstAsync(l => l.BetId == opponentBet.Id);
        hostedLeg.Probability.Should().Be(0.80m / 2.00m, "the hosted team's TeamWin leg was originally priced with the default (App) margin");
        opponentLeg.Probability.Should().Be(0.75m / 2.00m, "the opponent's TeamWin leg was originally priced with TeamMargin");
    }

    [Fact]
    public async Task LegAlreadyHavingProbability_IsNotTouched()
    {
        var (_, _, match) = SeedMatch();
        var bet = SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null));
        var leg = bet.Legs.Single();
        leg.Probability = 0.55m;
        await _db.SaveChangesAsync();

        var count = await _service.BackfillLegacyProbabilitiesAsync();

        count.Should().Be(0);
        var reloaded = await _db.BetLegs.AsNoTracking().FirstAsync(l => l.Id == leg.Id);
        reloaded.Probability.Should().Be(0.55m);
    }

    [Fact]
    public async Task CoversEveryBetStatus_NotJustWonOrLost()
    {
        var (_, _, match) = SeedMatch();
        SeedBet(BetStatus.Pending, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null));
        SeedBet(BetStatus.Cancelled, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null));

        var count = await _service.BackfillLegacyProbabilitiesAsync();

        count.Should().Be(2, "backfill fills in Probability for every leg, regardless of whether the ticket has been evaluated yet");
    }

    [Fact]
    public async Task Backfill_IsIdempotent()
    {
        var (_, _, match) = SeedMatch();
        SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 2.00m, 1, null));

        var firstRun = await _service.BackfillLegacyProbabilitiesAsync();
        var secondRun = await _service.BackfillLegacyProbabilitiesAsync();

        firstRun.Should().Be(1);
        secondRun.Should().Be(0, "every leg already has Probability after the first run");
    }

    [Fact]
    public async Task OddsBelowOne_LeavesProbabilityNull()
    {
        // Not a realistic case for a real placed bet (MinBettableOdds guards that at placement
        // time), but BackfillLegacyProbabilitiesAsync must not crash or invent a value for it.
        var (_, _, match) = SeedMatch();
        SeedBet(BetStatus.Won, (BetType.UserPlusPoint, match.Id, 0.50m, 1, null));

        var count = await _service.BackfillLegacyProbabilitiesAsync();

        count.Should().Be(0);
        var reloaded = await _db.BetLegs.AsNoTracking().FirstAsync(l => l.MatchId == match.Id);
        reloaded.Probability.Should().BeNull();
    }
}
