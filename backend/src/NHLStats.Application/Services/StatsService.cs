using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class StatsService : IStatsService
{
    private readonly NhlStatsDbContext _db;
    private readonly ISeasonStatsService _seasonStats;
    private readonly IRosterStatsService _rosterStats;
    private readonly IEarningsService _earnings;
    private readonly IMatchStatsService _matchStats;

    public StatsService(
        NhlStatsDbContext db,
        ISeasonStatsService seasonStats,
        IRosterStatsService rosterStats,
        IEarningsService earnings,
        IMatchStatsService matchStats)
    {
        _db = db;
        _seasonStats = seasonStats;
        _rosterStats = rosterStats;
        _earnings = earnings;
        _matchStats = matchStats;
    }

    public async Task<DashboardDataDto> GetDashboardDataAsync()
    {
        var seasonStats = await _seasonStats.FetchSeasonPointsStatisticsAsync();
        var earningsBySeason = await _earnings.GetEarningsBySeasonAsync();
        var rosterScorers = await _rosterStats.GetAllGoalScorersByUserAsync();
        var rosterPenalized = await _rosterStats.GetAllPenaltyPlayersByUserAsync();
        var trendData = await _matchStats.GetWeeklyPlusMinusTrendAsync();

        var allTimeStats = await _seasonStats.GetAllTimeStatsAsync(seasonStats);
        var allTimeEarnings = await _earnings.GetAllTimeEarningsAsync(earningsBySeason);
        var allTimePlusMinusTrend = await _matchStats.GetAllTimePlusMinusTrendAsync();
        var allTimeRosterScorers = await _rosterStats.GetAllTimeRosterScorerAsync(rosterScorers);
        var allTimeRosterPenalized = await _rosterStats.GetAllTimePenaltyPlayersByUserAsync(rosterPenalized);

        var latestSeason = await _db.Seasons.AsNoTracking()
            .OrderByDescending(s => s.StartedOn)
            .FirstOrDefaultAsync();

        IEnumerable<WeeklyBettingBalancePeriodDto> bettingBalanceTrend = Enumerable.Empty<WeeklyBettingBalancePeriodDto>();
        IEnumerable<WeeklyBetDeltaPeriodDto> betDeltaTrend = Enumerable.Empty<WeeklyBetDeltaPeriodDto>();
        if (latestSeason != null)
            (bettingBalanceTrend, betDeltaTrend) = await GetWeeklyBettingTrendsAsync(latestSeason.Id);

        var (allTimeBettingBalanceTrend, allTimeBetDeltaTrend) = await GetAllTimeBettingTrendsAsync();

        return new DashboardDataDto(
            seasonStats,
            earningsBySeason,
            trendData,
            rosterScorers,
            rosterPenalized,

            allTimeStats,
            allTimeEarnings,
            allTimePlusMinusTrend,
            allTimeRosterScorers,
            allTimeRosterPenalized,

            bettingBalanceTrend,
            allTimeBettingBalanceTrend,
            betDeltaTrend,
            allTimeBetDeltaTrend);
    }

    public async Task<SeasonTotalsDto> GetSeasonTotalsAsync()
    {
        var pointStats = await _seasonStats.FetchSeasonPointsStatisticsAsync();
        var goalStats = await _seasonStats.FetchSeasonGoalStatisicsAsync();
        var penaltyStats = await _seasonStats.FetchSeasonPenaltyStatisticsAsync();

        var matchesBySeason = await _db.Matches
            .AsNoTracking()
            .Select(m => new { m.Id, m.SeasonId })
            .ToListAsync();

        var seasonIds = pointStats.Select(ps => ps.SeasonId)
            .Union(goalStats.Select(gs => gs.SeasonId))
            .Union(penaltyStats.Select(ps => ps.SeasonId))
            .Union(matchesBySeason.Select(m => m.SeasonId))
            .Distinct();

        var seasons = await _db.Seasons
            .AsNoTracking()
            .Include(s => s.SeasonUsers)
            .Where(s => seasonIds.Contains(s.Id))
            .ToListAsync();

        var earningsBySeasonAndUser = new Dictionary<int, Dictionary<int, BettingBreakdown>>();
        foreach (var season in seasons)
        {
            var matchIds = matchesBySeason
                .Where(m => m.SeasonId == season.Id)
                .Select(m => m.Id)
                .ToList();
            earningsBySeasonAndUser[season.Id] = await _earnings.ComputeEarningsForMatchesAsync(matchIds);
        }

        var seasonalUserData = seasons
            .Select(s =>
            {
                var seasonPointStats = pointStats.FirstOrDefault(ps => ps.SeasonId == s.Id);
                var seasonGoalStats = goalStats.FirstOrDefault(gs => gs.SeasonId == s.Id);
                var seasonPenaltyStats = penaltyStats.FirstOrDefault(ps => ps.SeasonId == s.Id);
                earningsBySeasonAndUser.TryGetValue(s.Id, out var seasonEarnings);

                var userData = s.SeasonUsers.Select(su =>
                {
                    var pointsStat = seasonPointStats?.UserStats.FirstOrDefault(us => us.UserId == su.UserId);
                    var goalStat = seasonGoalStats?.UserStats.FirstOrDefault(us => us.UserId == su.UserId);
                    var penaltyStat = seasonPenaltyStats?.UserStats.FirstOrDefault(us => us.UserId == su.UserId);
                    BettingBreakdown? fin = null;
                    seasonEarnings?.TryGetValue(su.UserId, out fin);

                    return new SeasonUserDataDto(
                        su.UserId,
                        pointsStat?.TotalPlus ?? 0,
                        pointsStat?.TotalMinus ?? 0,
                        goalStat?.TotalGoals ?? 0,
                        penaltyStat?.TotalPenalties ?? 0,
                        fin?.Earnings ?? 0m,
                        fin?.AvailableBalance ?? 0m);
                }).ToList();

                return new SeasonalUserDataDto(s.Id, userData);
            })
            .ToList();

        var topRosterPlayers = await _rosterStats.GetTopRosterPlayersAsync();

        return new SeasonTotalsDto(
            seasonalUserData,
            topRosterPlayers);
    }

    // ─── Betting balance / delta trends (private — only used by GetDashboardDataAsync) ──

    private async Task<(IEnumerable<WeeklyBettingBalancePeriodDto> Balance, IEnumerable<WeeklyBetDeltaPeriodDto> Delta)>
        GetWeeklyBettingTrendsAsync(int seasonId)
    {
        var matchDates = await _db.Matches
            .AsNoTracking()
            .Where(m => m.SeasonId == seasonId && m.MatchDate != null)
            .Select(m => m.MatchDate!.Value.Date)
            .Distinct()
            .OrderBy(d => d)
            .ToListAsync();

        var currentWeeks = await _matchStats.BuildWeeklyPeriodsAsync(seasonId);

        if (matchDates.Count == 0 || currentWeeks.Count == 0)
            return (Enumerable.Empty<WeeklyBettingBalancePeriodDto>(), Enumerable.Empty<WeeklyBetDeltaPeriodDto>());

        var matchDatesLookup = await _db.Matches
            .AsNoTracking()
            .Where(m => m.SeasonId == seasonId && m.MatchDate != null)
            .ToDictionaryAsync(m => m.Id, m => m.MatchDate!.Value.Date);

        var positivePointRows = await _db.UserMatchPoints
            .AsNoTracking()
            .Where(p => p.UserMatch != null
                     && p.UserMatch!.SeasonId == seasonId
                     && p.PointReason != null
                     && p.PointReason!.PointType == PointType.Positive)
            .Select(p => new { p.UserMatch!.UserId, p.Amount, p.UserMatch.MatchId })
            .ToListAsync();

        var positiveAmountsByDate = positivePointRows
            .Where(p => matchDatesLookup.ContainsKey(p.MatchId))
            .Select(p => new { p.UserId, p.Amount, Date = matchDatesLookup[p.MatchId] })
            .ToList();

        var aggregatedPlusByUser = (await _db.UserSeasonAggregatedData
            .AsNoTracking()
            .Where(a => a.SeasonId == seasonId)
            .ToListAsync())
            .ToDictionary(a => a.UserId, a => a.TotalPlus);

        var allBets = await _db.Bets
            .AsNoTracking()
            .Where(b => (b.Status == BetStatus.Won || b.Status == BetStatus.Lost) && b.EvaluatedOn.HasValue)
            .Select(b => new { b.CreatedBy, b.Stake, b.TotalOdds, b.Status, b.EvaluatedOn })
            .ToListAsync();

        var creatorIds = allBets.Select(b => b.CreatedBy).Distinct().ToList();
        var creatorToUserId = await _db.Set<NHLStats.Domain.Identity.ApplicationUser>()
            .AsNoTracking()
            .Where(u => creatorIds.Contains(u.Id) && u.UserId.HasValue)
            .ToDictionaryAsync(u => u.Id, u => u.UserId!.Value);

        var betsResolved = allBets
            .Where(b => creatorToUserId.ContainsKey(b.CreatedBy))
            .Select(b => new
            {
                UserId = creatorToUserId[b.CreatedBy],
                WonProfit = b.Status == BetStatus.Won ? BettingConstants.GrossPayout(b.Stake, b.TotalOdds) - b.Stake : 0m,
                LostStake = b.Status == BetStatus.Lost ? b.Stake : 0m,
                EvaluatedDate = b.EvaluatedOn!.Value.Date
            })
            .ToList();

        var userMap = new Dictionary<int, string>();
        foreach (var week in currentWeeks)
            foreach (var u in week.Users)
                if (!userMap.ContainsKey(u.UserId))
                    userMap[u.UserId] = u.UserName;

        var missingAggUsers = aggregatedPlusByUser.Keys.Except(userMap.Keys).ToList();
        if (missingAggUsers.Count > 0)
        {
            var aggUserNames = await _db.Users.AsNoTracking()
                .Where(u => missingAggUsers.Contains(u.Id))
                .ToDictionaryAsync(u => u.Id, u => u.Name ?? $"User {u.Id}");
            foreach (var kv in aggUserNames)
                userMap[kv.Key] = kv.Value;
        }

        var userIds = userMap.Keys.ToList();
        var positiveCash = userIds.ToDictionary(id => id, _ => 0m);

        foreach (var (userId, aggPlus) in aggregatedPlusByUser)
            if (positiveCash.ContainsKey(userId))
                positiveCash[userId] += aggPlus * BettingConstants.AggregatedPositiveValue;

        var balancePeriods = new List<WeeklyBettingBalancePeriodDto>();
        var deltaPeriods = new List<WeeklyBetDeltaPeriodDto>();
        DateTime? previousWeekDate = null;

        for (int i = 0; i < currentWeeks.Count; i++)
        {
            var weekDate = i < matchDates.Count ? matchDates[i] : matchDates.Last();

            foreach (var pt in positiveAmountsByDate.Where(p => p.Date == weekDate))
            {
                if (!positiveCash.ContainsKey(pt.UserId))
                    positiveCash[pt.UserId] = 0m;
                positiveCash[pt.UserId] += pt.Amount;
            }

            var betsUpToWeek = betsResolved
                .Where(b => b.EvaluatedDate <= weekDate)
                .GroupBy(b => b.UserId)
                .ToDictionary(
                    g => g.Key,
                    g => (WonProfit: g.Sum(b => b.WonProfit), LostStake: g.Sum(b => b.LostStake)));

            var balanceUsers = userIds.Select(uid =>
            {
                betsUpToWeek.TryGetValue(uid, out var bet);
                var cash = positiveCash.TryGetValue(uid, out var pc) ? pc : 0m;
                return new UserWeeklyBettingBalanceDto(uid, userMap[uid], cash + bet.WonProfit - bet.LostStake);
            }).ToList();
            balancePeriods.Add(new WeeklyBettingBalancePeriodDto(currentWeeks[i].Label, balanceUsers));

            var rangeStart = previousWeekDate.HasValue ? previousWeekDate.Value.AddDays(1) : DateTime.MinValue.Date;
            var betsInRange = betsResolved
                .Where(b => b.EvaluatedDate >= rangeStart && b.EvaluatedDate <= weekDate)
                .GroupBy(b => b.UserId)
                .ToDictionary(
                    g => g.Key,
                    g => (WonProfit: g.Sum(b => b.WonProfit), LostStake: g.Sum(b => b.LostStake)));

            var deltaUsers = userIds.Select(uid =>
            {
                betsInRange.TryGetValue(uid, out var bet);
                return new UserWeeklyBetDeltaDto(uid, userMap[uid], bet.WonProfit - bet.LostStake);
            }).ToList();
            deltaPeriods.Add(new WeeklyBetDeltaPeriodDto(currentWeeks[i].Label, deltaUsers));

            previousWeekDate = weekDate;
        }

        return (balancePeriods, deltaPeriods);
    }

    private async Task<(IEnumerable<WeeklyBettingBalancePeriodDto> Balance, IEnumerable<WeeklyBetDeltaPeriodDto> Delta)>
        GetAllTimeBettingTrendsAsync()
    {
        var allSeasons = await _db.Seasons
            .AsNoTracking()
            .Include(s => s.SeasonUsers)
            .OrderBy(s => s.StartedOn)
            .ToListAsync();

        if (allSeasons.Count == 0)
            return (Enumerable.Empty<WeeklyBettingBalancePeriodDto>(), Enumerable.Empty<WeeklyBetDeltaPeriodDto>());

        var seasonEndDates = (await _db.Matches
            .AsNoTracking()
            .Where(m => m.MatchDate != null)
            .GroupBy(m => m.SeasonId)
            .Select(g => new { SeasonId = g.Key, MaxDate = g.Max(m => m.MatchDate!.Value) })
            .ToListAsync())
            .ToDictionary(x => x.SeasonId, x => x.MaxDate.Date);

        var positivePointsBySeason = (await _db.UserMatchPoints
            .AsNoTracking()
            .Where(p => p.UserMatch != null
                     && p.PointReason != null
                     && p.PointReason!.PointType == PointType.Positive)
            .Select(p => new { p.UserMatch!.UserId, p.Amount, p.UserMatch.SeasonId })
            .ToListAsync())
            .GroupBy(p => p.SeasonId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var aggDataBySeason = (await _db.UserSeasonAggregatedData
            .AsNoTracking()
            .ToListAsync())
            .GroupBy(a => a.SeasonId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var allBets = await _db.Bets
            .AsNoTracking()
            .Where(b => (b.Status == BetStatus.Won || b.Status == BetStatus.Lost) && b.EvaluatedOn.HasValue)
            .Select(b => new { b.CreatedBy, b.Stake, b.TotalOdds, b.Status, b.EvaluatedOn })
            .ToListAsync();

        var creatorIds = allBets.Select(b => b.CreatedBy).Distinct().ToList();
        var creatorToUserId = await _db.Set<NHLStats.Domain.Identity.ApplicationUser>()
            .AsNoTracking()
            .Where(u => creatorIds.Contains(u.Id) && u.UserId.HasValue)
            .ToDictionaryAsync(u => u.Id, u => u.UserId!.Value);

        var betsResolved = allBets
            .Where(b => creatorToUserId.ContainsKey(b.CreatedBy))
            .Select(b => new
            {
                UserId = creatorToUserId[b.CreatedBy],
                WonProfit = b.Status == BetStatus.Won ? BettingConstants.GrossPayout(b.Stake, b.TotalOdds) - b.Stake : 0m,
                LostStake = b.Status == BetStatus.Lost ? b.Stake : 0m,
                EvaluatedDate = b.EvaluatedOn!.Value.Date
            })
            .ToList();

        var userNames = await _db.Users.AsNoTracking()
            .ToDictionaryAsync(u => u.Id, u => u.Name ?? $"User {u.Id}");

        var allUserIds = allSeasons
            .SelectMany(s => s.SeasonUsers)
            .Select(su => su.UserId)
            .Distinct()
            .ToHashSet();

        var positiveCash = allUserIds.ToDictionary(id => id, _ => 0m);
        var balancePeriods = new List<WeeklyBettingBalancePeriodDto>();
        var deltaPeriods = new List<WeeklyBetDeltaPeriodDto>();
        DateTime? previousSeasonEnd = null;

        foreach (var season in allSeasons)
        {
            var endDate = seasonEndDates.TryGetValue(season.Id, out var ed) ? ed : season.StartedOn.Date;

            if (aggDataBySeason.TryGetValue(season.Id, out var aggList))
                foreach (var agg in aggList)
                {
                    positiveCash.TryAdd(agg.UserId, 0m);
                    positiveCash[agg.UserId] += agg.TotalPlus * BettingConstants.AggregatedPositiveValue;
                }

            if (positivePointsBySeason.TryGetValue(season.Id, out var pointsList))
                foreach (var pt in pointsList)
                {
                    positiveCash.TryAdd(pt.UserId, 0m);
                    positiveCash[pt.UserId] += pt.Amount;
                }

            var betsUpToSeason = betsResolved
                .Where(b => b.EvaluatedDate <= endDate)
                .GroupBy(b => b.UserId)
                .ToDictionary(
                    g => g.Key,
                    g => (WonProfit: g.Sum(b => b.WonProfit), LostStake: g.Sum(b => b.LostStake)));

            var currentUserIds = allUserIds.ToList();

            var balanceUsers = currentUserIds.Select(uid =>
            {
                betsUpToSeason.TryGetValue(uid, out var bet);
                var cash = positiveCash.TryGetValue(uid, out var pc) ? pc : 0m;
                var name = userNames.TryGetValue(uid, out var n) ? n : $"User {uid}";
                return new UserWeeklyBettingBalanceDto(uid, name, cash + bet.WonProfit - bet.LostStake);
            }).ToList();
            balancePeriods.Add(new WeeklyBettingBalancePeriodDto(season.Name, balanceUsers));

            var rangeStart = previousSeasonEnd.HasValue ? previousSeasonEnd.Value.AddDays(1) : DateTime.MinValue.Date;
            var betsInRange = betsResolved
                .Where(b => b.EvaluatedDate >= rangeStart && b.EvaluatedDate <= endDate)
                .GroupBy(b => b.UserId)
                .ToDictionary(
                    g => g.Key,
                    g => (WonProfit: g.Sum(b => b.WonProfit), LostStake: g.Sum(b => b.LostStake)));

            var deltaUsers = currentUserIds.Select(uid =>
            {
                betsInRange.TryGetValue(uid, out var bet);
                var name = userNames.TryGetValue(uid, out var n) ? n : $"User {uid}";
                return new UserWeeklyBetDeltaDto(uid, name, bet.WonProfit - bet.LostStake);
            }).ToList();
            deltaPeriods.Add(new WeeklyBetDeltaPeriodDto(season.Name, deltaUsers));

            previousSeasonEnd = endDate;
        }

        return (balancePeriods, deltaPeriods);
    }
}
