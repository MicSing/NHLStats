using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class EarningsService : IEarningsService
{
    private readonly NhlStatsDbContext _db;
    private readonly IBettingCalculator _calculator;

    public EarningsService(NhlStatsDbContext db, IBettingCalculator calculator)
    {
        _db = db;
        _calculator = calculator;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static MoneyConfig? GetEffectiveConfig(IReadOnlyList<MoneyConfig> configs, DateTime date)
    {
        if (configs.Count == 0) return null;

        var active = configs
            .Where(m => m.EffectiveFrom <= date)
            .OrderByDescending(m => m.EffectiveFrom)
            .FirstOrDefault();

        return active ?? configs.OrderBy(m => m.EffectiveFrom).First();
    }

    private static decimal RawEarnings(MoneyConfig config, int totalPlus, int totalMinus) =>
        totalMinus * config.NegativePointValue - totalPlus * config.PositivePointValue;

    // ─── Public API ───────────────────────────────────────────────────────────

    public async Task<Dictionary<int, BettingBreakdown>> ComputeEarningsForMatchesAsync(
        List<int> matchIds,
        IReadOnlyDictionary<int, int>? aggregatedPlusCountByUser = null,
        IReadOnlyDictionary<int, int>? aggregatedMinusCountByUser = null,
        bool allTimeBets = false)
    {
        var dataByUser = await _calculator.LoadForUsersAsync(
            matchIds, allTimeBets, aggregatedPlusCountByUser, aggregatedMinusCountByUser);
        return dataByUser.ToDictionary(kv => kv.Key, kv => _calculator.Compute(kv.Value));
    }

    public async Task<IEnumerable<SeasonStatsUserDto>> GetSeasonStatsAsync(int seasonId)
    {
        var userMatches = await _db.UserMatches
            .AsNoTracking()
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .Where(um => um.SeasonId == seasonId)
            .ToListAsync();

        if (userMatches.Count == 0)
            return Enumerable.Empty<SeasonStatsUserDto>();

        var matchIds = userMatches
            .Select(um => um.MatchId)
            .Distinct()
            .ToList();

        var earningsByUser = await ComputeEarningsForMatchesAsync(matchIds);

        return userMatches
            .GroupBy(um => um.UserId)
            .Select(g =>
            {
                var totalPlus = 0;
                var totalMinus = 0;
                foreach (var um in g)
                {
                    var totals = StatsCalculationHelpers.GetTotalsFromPoints(um.Points);
                    totalPlus += totals.plus;
                    totalMinus += totals.minus;
                }
                earningsByUser.TryGetValue(g.Key, out var fin);
                return new SeasonStatsUserDto(g.Key, totalPlus, totalMinus, fin?.Earnings ?? 0m, fin?.AvailableBalance ?? 0m);
            })
            .OrderBy(s => s.UserId)
            .ToList();
    }

    public async Task<IEnumerable<SeasonalUserEarningsDto>> GetEarningsBySeasonAsync()
    {
        var matchesBySeason = await _db.Matches
            .AsNoTracking()
            .Select(m => new { m.Id, m.SeasonId })
            .ToListAsync();

        var aggregatedBySeason = await _db.UserSeasonAggregatedData
            .AsNoTracking()
            .GroupBy(a => a.SeasonId)
            .ToDictionaryAsync(g => g.Key, g => g.ToList());

        var seasonIds = matchesBySeason.Select(m => m.SeasonId)
            .Union(aggregatedBySeason.Keys)
            .Distinct()
            .ToList();

        if (seasonIds.Count == 0)
            return Enumerable.Empty<SeasonalUserEarningsDto>();

        var result = new List<SeasonalUserEarningsDto>();

        foreach (var seasonId in seasonIds)
        {
            var matchIds = matchesBySeason
                .Where(m => m.SeasonId == seasonId)
                .Select(m => m.Id)
                .ToList();

            IReadOnlyDictionary<int, int>? aggPlus = null;
            IReadOnlyDictionary<int, int>? aggMinus = null;
            if (aggregatedBySeason.TryGetValue(seasonId, out var aggEntries))
            {
                aggPlus = aggEntries.ToDictionary(a => a.UserId, a => a.TotalPlus);
                aggMinus = aggEntries.ToDictionary(a => a.UserId, a => a.TotalMinus);
            }

            var earningsByUser = await ComputeEarningsForMatchesAsync(matchIds, aggPlus, aggMinus);
            result.Add(new SeasonalUserEarningsDto(
                seasonId,
                earningsByUser
                    .Select(kv => new UserEarningsDto(kv.Key, kv.Value.Earnings))
                    .OrderByDescending(u => u.Earnings)
                    .ToList()));
        }

        return result.OrderBy(s => s.SeasonId).ToList();
    }

    public async Task<AllTimeEarningsDto> GetAllTimeEarningsAsync(IEnumerable<SeasonalUserEarningsDto> earningsBySeason)
    {
        var totalCollectedList = await _db.UserPayouts
            .AsNoTracking()
            .Select(up => up.Amount)
            .ToListAsync();
        var totalExpensesList = await _db.Expenses
            .AsNoTracking()
            .Select(pe => pe.Amount)
            .ToListAsync();
        var totalCollected = totalCollectedList.Sum();
        var totalExpenses = totalExpensesList.Sum();

        var userEarnings = earningsBySeason
            .SelectMany(s => s.UserEarnings)
            .GroupBy(ue => ue.UserId)
            .Select(g => new UserEarningsDto(g.Key, g.Sum(ue => ue.Earnings)))
            .OrderByDescending(u => u.Earnings)
            .ToList();
        var totalEarnings = userEarnings.Sum(ue => ue.Earnings);
        var canBeCollected = totalEarnings - totalCollected;

        return new AllTimeEarningsDto(userEarnings, totalCollected, canBeCollected, totalExpenses);
    }

    public async Task<EarningsSummaryDto> GetEarningsSummaryAsync()
    {
        var userMatches = await _db.UserMatches
            .AsNoTracking()
            .Include(um => um.Points).ThenInclude(p => p.PointReason)
            .ToListAsync();

        var allMatchIds = userMatches
            .Select(um => um.MatchId)
            .Distinct()
            .ToList();

        var earningsByUser = await ComputeEarningsForMatchesAsync(allMatchIds, allTimeBets: true);

        var plusMinusByUser = userMatches
            .GroupBy(um => um.UserId)
            .ToDictionary(g => g.Key, g =>
            {
                var plus = 0; var minus = 0;
                foreach (var um in g) { var t = StatsCalculationHelpers.GetTotalsFromPoints(um.Points); plus += t.plus; minus += t.minus; }
                return (plus, minus);
            });

        var totalCollected = (await _db.UserPayouts.AsNoTracking().Select(up => up.Amount).ToListAsync()).Sum();
        var totalExpenses = (await _db.Expenses.AsNoTracking().Select(e => e.Amount).ToListAsync()).Sum();

        var allUserIds = plusMinusByUser.Keys.Union(earningsByUser.Keys).Distinct();
        var userEarnings = allUserIds
            .Select(uid =>
            {
                plusMinusByUser.TryGetValue(uid, out var pm);
                earningsByUser.TryGetValue(uid, out var fin);
                return new EarningsSummaryUserDto(uid, fin?.Earnings ?? 0m, pm.plus, pm.minus);
            })
            .OrderByDescending(u => u.Earnings)
            .ToList();

        return new EarningsSummaryDto(userEarnings, totalCollected, totalExpenses, totalCollected - totalExpenses);
    }

    public async Task<FinancialStatsDto> GetFinancialStatsAsync()
    {
        var allPayouts = await _db.UserPayouts
            .AsNoTracking()
            .ToListAsync();
        var collectedByUser = allPayouts
            .GroupBy(up => up.UserId)
            .ToDictionary(g => g.Key, g => g.Sum(x => x.Amount));

        var totalExpensesList = await _db.Expenses
            .AsNoTracking()
            .Select(x => new ExpenseDto(x.Id, x.Description, x.Amount, x.Date))
            .ToListAsync();

        var totalCollected = collectedByUser.Values.Sum();
        var totalExpenses = totalExpensesList.Sum(x => x.Amount);

        var aggregatedData = await _db.UserSeasonAggregatedData
            .AsNoTracking()
            .GroupBy(a => a.UserId)
            .ToDictionaryAsync(x => x.Key, x => new
            {
                plus = x.Sum(y => y.TotalPlus),
                minus = x.Sum(y => y.TotalMinus)
            });

        var userMatchPoints = await _db.UserMatchPoints
            .AsNoTracking()
            .Where(ump => ump.UserMatch != null)
            .Select(x => new
            {
                x.UserMatch!.UserId,
                plus = x.PointReason != null && x.PointReason.PointType == PointType.Positive ? x.Count : 0,
                minus = x.PointReason != null && x.PointReason.PointType == PointType.Negative ? x.Count : 0
            }).ToListAsync();
        var userMatchPointsByUser = userMatchPoints
            .GroupBy(x => x.UserId)
            .ToDictionary(g => g.Key, g => new
            {
                plus = g.Sum(x => x.plus),
                minus = g.Sum(x => x.minus)
            });

        var allMatchIds = await _db.UserMatches
            .AsNoTracking()
            .Select(um => um.MatchId)
            .Distinct()
            .ToListAsync();

        var aggregatedPlusCounts  = aggregatedData.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.plus);
        var aggregatedMinusCounts = aggregatedData.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.minus);
        var earningsByUser = await ComputeEarningsForMatchesAsync(allMatchIds, aggregatedPlusCounts, aggregatedMinusCounts, allTimeBets: true);

        var users = await _db.Users
            .AsNoTracking()
            .ToDictionaryAsync(u => u.Id, u => u.Name);

        var financesByUser = users.Select(u =>
            {
                var matchPoints = userMatchPointsByUser.TryGetValue(u.Key, out var mp) ? mp : new { plus = 0, minus = 0 };
                var aggregated = aggregatedData.TryGetValue(u.Key, out var a) ? a : new { plus = 0, minus = 0 };
                var collected = collectedByUser.TryGetValue(u.Key, out var amount) ? amount : 0m;

                var totalPluses = aggregated.plus + matchPoints.plus;
                var totalMinuses = aggregated.minus + matchPoints.minus;

                earningsByUser.TryGetValue(u.Key, out var fin);
                var earnings = fin?.Earnings ?? 0m;
                var bettingBalance = fin?.AvailableBalance ?? 0m;
                var canBeCollected = earnings - collected;

                return new UserFinancialStatsDto(
                    u.Key,
                    totalPluses,
                    totalMinuses,
                    collected,
                    earnings,
                    canBeCollected,
                    bettingBalance,
                    fin?.TotalPendingStake ?? 0m,
                    fin?.TotalWonProfit ?? 0m,
                    fin?.TotalLostStake ?? 0m,
                    fin?.TotalNegativeCash ?? 0m);
            })
            .OrderByDescending(x => x.CanBeCollected)
            .ThenBy(x => x.UserId)
            .ToList();

        var totalEarnings = financesByUser.Sum(x => x.TotalEarnings);
        var canBeCollected = financesByUser.Sum(x => x.CanBeCollected);

        return new FinancialStatsDto(
            totalCollected,
            totalExpenses,
            canBeCollected,
            totalEarnings,
            totalExpensesList,
            financesByUser);
    }
}
