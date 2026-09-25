using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Application.Services;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using NHLStats.Domain.Identity;
using Xunit;
using Match = NHLStats.Domain.Entities.Match;

namespace NHLStats.Application.Tests.Services;

public class StatsServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly NhlStatsDbContext _db;
    private readonly Mock<ISeasonStatsService> _seasonStatsMock = new();
    private readonly Mock<IRosterStatsService> _rosterStatsMock = new();
    private readonly Mock<IEarningsService> _earningsMock = new();
    private readonly MatchStatsService _matchStatsService;
    private readonly StatsService _service;

    public StatsServiceTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();
        var options = new DbContextOptionsBuilder<NhlStatsDbContext>()
            .UseSqlite(_connection)
            .Options;
        _db = new NhlStatsDbContext(options);
        _db.Database.EnsureCreated();

        _matchStatsService = new MatchStatsService(_db);
        _service = new StatsService(
            _db,
            _seasonStatsMock.Object,
            _rosterStatsMock.Object,
            _earningsMock.Object,
            _matchStatsService);

        _seasonStatsMock.Setup(x => x.FetchSeasonPointsStatisticsAsync())
            .ReturnsAsync(Enumerable.Empty<SeasonPointsStatsSummaryDto>());
        _seasonStatsMock.Setup(x => x.GetAllTimeStatsAsync(It.IsAny<IEnumerable<SeasonPointsStatsSummaryDto>>()))
            .ReturnsAsync(Enumerable.Empty<UserPointsMetricsDto>());
        _earningsMock.Setup(x => x.GetEarningsBySeasonAsync())
            .ReturnsAsync(Enumerable.Empty<SeasonalUserEarningsDto>());
        _earningsMock.Setup(x => x.GetAllTimeEarningsAsync(It.IsAny<IEnumerable<SeasonalUserEarningsDto>>()))
            .ReturnsAsync(new AllTimeEarningsDto(Enumerable.Empty<UserEarningsDto>(), 0, 0, 0));
        _rosterStatsMock.Setup(x => x.GetAllGoalScorersByUserAsync())
            .ReturnsAsync(Enumerable.Empty<RosterScorerBySeasonDto>());
        _rosterStatsMock.Setup(x => x.GetAllPenaltyPlayersByUserAsync())
            .ReturnsAsync(Enumerable.Empty<RosterPenalizedBySeasonDto>());
        _rosterStatsMock.Setup(x => x.GetAllTimeRosterScorerAsync(It.IsAny<IEnumerable<RosterScorerBySeasonDto>>()))
            .ReturnsAsync(Enumerable.Empty<AllTimeRosterScorerDto>());
        _rosterStatsMock.Setup(x => x.GetAllTimePenaltyPlayersByUserAsync(It.IsAny<IEnumerable<RosterPenalizedBySeasonDto>>()))
            .ReturnsAsync(Enumerable.Empty<AllTimeRosterPenalizedDto>());
    }

    public void Dispose()
    {
        _db.Dispose();
        _connection.Dispose();
    }

    [Fact]
    public async Task GetDashboardDataAsync_WhenBetEvaluatedInWeek2_TiesDeltaToMatchInWeek1()
    {
        // Arrange
        var user = new User { Id = 1, Name = "Alice" };
        _db.Users.Add(user);

        var appUser = new ApplicationUser
        {
            Id = "alice-identity-id",
            UserName = "alice@example.com",
            Email = "alice@example.com",
            UserId = user.Id
        };
        _db.Set<ApplicationUser>().Add(appUser);

        var homeTeam = new Team { Name = "Home", ShortName = "HOM" };
        var awayTeam = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(homeTeam, awayTeam);

        var season = new Season
        {
            Id = 1,
            Name = "Season 1",
            StartedOn = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };
        _db.Seasons.Add(season);
        await _db.SaveChangesAsync();

        _db.SeasonUsers.Add(new SeasonUser { SeasonId = season.Id, UserId = user.Id });

        var match1Date = new DateTime(2026, 1, 2, 18, 0, 0, DateTimeKind.Utc);
        var match2Date = new DateTime(2026, 1, 9, 18, 0, 0, DateTimeKind.Utc);

        var match1 = new Match
        {
            SeasonId = season.Id,
            MatchNumber = 1,
            HomeTeamId = homeTeam.Id,
            AwayTeamId = awayTeam.Id,
            HomeScore = 3,
            AwayScore = 1,
            MatchDate = match1Date,
            CompletionType = CompletionType.RegularTime
        };
        var match2 = new Match
        {
            SeasonId = season.Id,
            MatchNumber = 2,
            HomeTeamId = homeTeam.Id,
            AwayTeamId = awayTeam.Id,
            HomeScore = 2,
            AwayScore = 2,
            MatchDate = match2Date,
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.AddRange(match1, match2);
        await _db.SaveChangesAsync();

        _db.UserMatches.AddRange(
            new UserMatch { MatchId = match1.Id, UserId = user.Id, SeasonId = season.Id },
            new UserMatch { MatchId = match2.Id, UserId = user.Id, SeasonId = season.Id }
        );

        // Bet on Match 1 (Stake: 2€, Odds: 3.0, Profit: 4€)
        // Note: EvaluatedOn is set to 2026-01-10 (during Week 2, e.g. after reevaluation or late entry)
        var bet = new Bet
        {
            Id = Guid.NewGuid(),
            CreatedBy = appUser.Id,
            Stake = 2m,
            TotalOdds = 3m,
            Status = BetStatus.Won,
            CreatedOn = match1Date,
            EvaluatedOn = new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc),
            Legs = new List<BetLeg>
            {
                new()
                {
                    MatchId = match1.Id,
                    BetType = BetType.TeamWin,
                    TeamId = homeTeam.Id,
                    Odds = 3m,
                    Status = BetLegStatus.Won,
                    EvaluatedOn = new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc)
                }
            }
        };
        _db.Bets.Add(bet);
        await _db.SaveChangesAsync();

        // Act
        var result = await _service.GetDashboardDataAsync();

        // Assert
        var deltaList = result.BetDeltaTrend.ToList();
        deltaList.Should().HaveCount(2);

        // Week 1 (Match 1): Delta must be +4€
        var week1Delta = deltaList[0].Users.FirstOrDefault(u => u.UserId == user.Id);
        week1Delta.Should().NotBeNull();
        week1Delta!.Delta.Should().Be(4.00m, "bet was placed on Match 1, so its profit belongs to Week 1");

        // Week 2 (Match 2): Delta must be 0€ because no bet was placed for Match 2
        var week2Delta = deltaList[1].Users.FirstOrDefault(u => u.UserId == user.Id);
        week2Delta.Should().NotBeNull();
        week2Delta!.Delta.Should().Be(0.00m, "even though bet was reevaluated in Week 2, delta in Week 2 must remain 0");

        // Balance check: Week 1 has 4€, Week 2 retains cumulative balance of 4€
        var balanceList = result.BettingBalanceTrend.ToList();
        balanceList.Should().HaveCount(2);
        balanceList[0].Users.First(u => u.UserId == user.Id).Balance.Should().Be(4.00m);
        balanceList[1].Users.First(u => u.UserId == user.Id).Balance.Should().Be(4.00m);

        // All-time season trend: Season 1 has +4€ delta and +4€ balance
        var allTimeDelta = result.AllTimeBetDeltaTrend.ToList();
        allTimeDelta.Should().HaveCount(1);
        allTimeDelta[0].Users.First(u => u.UserId == user.Id).Delta.Should().Be(4.00m);
    }

    [Fact]
    public async Task GetDashboardDataAsync_WhenSeason1BetReevaluatedDuringSeason2_KeepsDeltaInSeason1()
    {
        // Arrange
        var user = new User { Id = 1, Name = "Bob" };
        _db.Users.Add(user);

        var appUser = new ApplicationUser
        {
            Id = "bob-identity-id",
            UserName = "bob@example.com",
            Email = "bob@example.com",
            UserId = user.Id
        };
        _db.Set<ApplicationUser>().Add(appUser);

        var homeTeam = new Team { Name = "Home", ShortName = "HOM" };
        var awayTeam = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(homeTeam, awayTeam);

        var season1 = new Season
        {
            Id = 1,
            Name = "Season 1",
            StartedOn = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };
        var season2 = new Season
        {
            Id = 2,
            Name = "Season 2",
            StartedOn = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };
        _db.Seasons.AddRange(season1, season2);
        await _db.SaveChangesAsync();

        _db.SeasonUsers.AddRange(
            new SeasonUser { SeasonId = season1.Id, UserId = user.Id },
            new SeasonUser { SeasonId = season2.Id, UserId = user.Id }
        );

        var matchSeason1 = new Match
        {
            SeasonId = season1.Id,
            MatchNumber = 1,
            HomeTeamId = homeTeam.Id,
            AwayTeamId = awayTeam.Id,
            HomeScore = 2,
            AwayScore = 1,
            MatchDate = new DateTime(2025, 2, 1, 18, 0, 0, DateTimeKind.Utc),
            CompletionType = CompletionType.RegularTime
        };
        var matchSeason2 = new Match
        {
            SeasonId = season2.Id,
            MatchNumber = 1,
            HomeTeamId = homeTeam.Id,
            AwayTeamId = awayTeam.Id,
            HomeScore = 1,
            AwayScore = 0,
            MatchDate = new DateTime(2026, 2, 1, 18, 0, 0, DateTimeKind.Utc),
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.AddRange(matchSeason1, matchSeason2);
        await _db.SaveChangesAsync();

        _db.UserMatches.AddRange(
            new UserMatch { MatchId = matchSeason1.Id, UserId = user.Id, SeasonId = season1.Id },
            new UserMatch { MatchId = matchSeason2.Id, UserId = user.Id, SeasonId = season2.Id }
        );

        // Bet on Match in Season 1 (Stake: 5€, Odds: 2.0, Profit: 5€)
        // EvaluatedOn is in 2026 (during Season 2)
        var bet = new Bet
        {
            Id = Guid.NewGuid(),
            CreatedBy = appUser.Id,
            Stake = 5m,
            TotalOdds = 2m,
            Status = BetStatus.Won,
            CreatedOn = matchSeason1.MatchDate!.Value,
            EvaluatedOn = new DateTime(2026, 2, 5, 12, 0, 0, DateTimeKind.Utc),
            Legs = new List<BetLeg>
            {
                new()
                {
                    MatchId = matchSeason1.Id,
                    BetType = BetType.TeamWin,
                    TeamId = homeTeam.Id,
                    Odds = 2m,
                    Status = BetLegStatus.Won,
                    EvaluatedOn = new DateTime(2026, 2, 5, 12, 0, 0, DateTimeKind.Utc)
                }
            }
        };
        _db.Bets.Add(bet);
        await _db.SaveChangesAsync();

        // Act
        var result = await _service.GetDashboardDataAsync();

        // Assert
        var allTimeDelta = result.AllTimeBetDeltaTrend.ToList();
        allTimeDelta.Should().HaveCount(2);

        // Season 1: delta should be 5€
        allTimeDelta[0].Label.Should().Be("Season 1");
        allTimeDelta[0].Users.First(u => u.UserId == user.Id).Delta.Should().Be(5.00m);

        // Season 2: delta should be 0€ (no bet was placed for Season 2)
        allTimeDelta[1].Label.Should().Be("Season 2");
        allTimeDelta[1].Users.First(u => u.UserId == user.Id).Delta.Should().Be(0.00m);

        // Cumulative Balance:
        var allTimeBalance = result.AllTimeBettingBalanceTrend.ToList();
        allTimeBalance.Should().HaveCount(2);
        allTimeBalance[0].Users.First(u => u.UserId == user.Id).Balance.Should().Be(5.00m);
        allTimeBalance[1].Users.First(u => u.UserId == user.Id).Balance.Should().Be(5.00m);
    }

    [Fact]
    public async Task GetDashboardDataAsync_BalanceTrend_ExposesBetsPositiveAndNegativeComponents()
    {
        // Arrange
        var user = new User { Id = 1, Name = "Carol" };
        _db.Users.Add(user);

        var appUser = new ApplicationUser
        {
            Id = "carol-identity-id",
            UserName = "carol@example.com",
            Email = "carol@example.com",
            UserId = user.Id
        };
        _db.Set<ApplicationUser>().Add(appUser);

        var homeTeam = new Team { Name = "Home", ShortName = "HOM" };
        var awayTeam = new Team { Name = "Away", ShortName = "AWY" };
        _db.Teams.AddRange(homeTeam, awayTeam);

        var positiveReason = new PointReason { Id = 900, Name = "Test plus", PointType = PointType.Positive };
        var negativeReason = new PointReason { Id = 901, Name = "Test minus", PointType = PointType.Negative };
        _db.PointReasons.AddRange(positiveReason, negativeReason);

        var season = new Season
        {
            Id = 1,
            Name = "Season 1",
            StartedOn = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        };
        _db.Seasons.Add(season);
        await _db.SaveChangesAsync();

        _db.SeasonUsers.Add(new SeasonUser { SeasonId = season.Id, UserId = user.Id });

        // Aggregated history: 4 plus (4 * 0.25 = 1€), 2 minus (2 * 0.50 = 1€)
        _db.UserSeasonAggregatedData.Add(new UserSeasonAggregatedData
        {
            UserId = user.Id,
            SeasonId = season.Id,
            TotalPlus = 4,
            TotalMinus = 2
        });

        var match1 = new Match
        {
            SeasonId = season.Id,
            MatchNumber = 1,
            HomeTeamId = homeTeam.Id,
            AwayTeamId = awayTeam.Id,
            HomeScore = 3,
            AwayScore = 1,
            MatchDate = new DateTime(2026, 1, 2, 18, 0, 0, DateTimeKind.Utc),
            CompletionType = CompletionType.RegularTime
        };
        var match2 = new Match
        {
            SeasonId = season.Id,
            MatchNumber = 2,
            HomeTeamId = homeTeam.Id,
            AwayTeamId = awayTeam.Id,
            HomeScore = 2,
            AwayScore = 2,
            MatchDate = new DateTime(2026, 1, 9, 18, 0, 0, DateTimeKind.Utc),
            CompletionType = CompletionType.RegularTime
        };
        _db.Matches.AddRange(match1, match2);
        await _db.SaveChangesAsync();

        var userMatch1 = new UserMatch { MatchId = match1.Id, UserId = user.Id, SeasonId = season.Id };
        var userMatch2 = new UserMatch { MatchId = match2.Id, UserId = user.Id, SeasonId = season.Id };
        _db.UserMatches.AddRange(userMatch1, userMatch2);
        await _db.SaveChangesAsync();

        _db.UserMatchPoints.AddRange(
            new UserMatchPoint { UserMatchId = userMatch1.Id, PointReasonId = positiveReason.Id, Count = 1, Amount = 2m },
            new UserMatchPoint { UserMatchId = userMatch2.Id, PointReasonId = negativeReason.Id, Count = 1, Amount = 1.5m }
        );

        // Lost bet on Match 2 (stake 3€)
        _db.Bets.Add(new Bet
        {
            Id = Guid.NewGuid(),
            CreatedBy = appUser.Id,
            Stake = 3m,
            TotalOdds = 2m,
            Status = BetStatus.Lost,
            CreatedOn = match2.MatchDate!.Value,
            Legs = new List<BetLeg>
            {
                new()
                {
                    MatchId = match2.Id,
                    BetType = BetType.TeamWin,
                    TeamId = homeTeam.Id,
                    Odds = 2m,
                    Status = BetLegStatus.Lost
                }
            }
        });

        // Payouts the user paid in (only surfaced on the all-time trend)
        _db.UserPayouts.AddRange(
            new UserPayout { UserId = user.Id, SeasonId = season.Id, Amount = 1.25m, PaidOn = match1.MatchDate!.Value },
            new UserPayout { UserId = user.Id, SeasonId = season.Id, Amount = 0.75m, PaidOn = match2.MatchDate!.Value }
        );
        await _db.SaveChangesAsync();

        // Act
        var result = await _service.GetDashboardDataAsync();

        // Assert — weekly (per season)
        var weekly = result.BettingTrendsBySeason.First(s => s.SeasonId == season.Id).BettingBalanceTrend.ToList();
        weekly.Should().HaveCount(2);

        var week1 = weekly[0].Users.First(u => u.UserId == user.Id);
        week1.PositivePoints.Should().Be(3.00m);   // 1€ aggregated + 2€
        week1.NegativePoints.Should().Be(-1.00m);  // 1€ aggregated
        week1.Bets.Should().Be(0.00m);
        week1.Balance.Should().Be(3.00m);

        var week2 = weekly[1].Users.First(u => u.UserId == user.Id);
        week2.PositivePoints.Should().Be(3.00m);
        week2.NegativePoints.Should().Be(-2.50m);
        week2.Bets.Should().Be(-3.00m);
        week2.Balance.Should().Be(0.00m, "balance stays bets + positive points");
        weekly.SelectMany(w => w.Users).Should().OnlyContain(u => u.Payouts == 0m, "payouts are all-time only");

        // Assert — all-time (per season)
        var allTime = result.AllTimeBettingBalanceTrend.ToList();
        allTime.Should().HaveCount(1);
        var season1 = allTime[0].Users.First(u => u.UserId == user.Id);
        season1.PositivePoints.Should().Be(3.00m);
        season1.NegativePoints.Should().Be(-2.50m);
        season1.Bets.Should().Be(-3.00m);
        season1.Payouts.Should().Be(2.00m);
        season1.Balance.Should().Be(0.00m);
    }
}
