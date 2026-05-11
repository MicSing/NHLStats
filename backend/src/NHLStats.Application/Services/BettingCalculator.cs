using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class BettingCalculator : IBettingCalculator
{
    private readonly NhlStatsDbContext _db;

    public BettingCalculator(NhlStatsDbContext db) => _db = db;

    public BettingBreakdown Compute(UserBettingData d)
    {
        var posCash = d.PositivePointAmounts.Sum()
                    + d.AggregatedPlusCount * BettingConstants.AggregatedPositiveValue;
        var negCash = d.NegativePointAmounts.Sum()
                    + d.AggregatedMinusCount * BettingConstants.AggregatedNegativeValue;
        var wonProfit = d.WonBets.Sum(b => b.Amount * b.Odds - b.Amount);
        var pending = d.PendingStakes.Sum();
        var lost = d.LostStakes.Sum();
        var balance = Math.Max(0m, posCash + wonProfit - pending - lost);
        var maxWinCap = Math.Max(0m, negCash - d.TotalPayouts);
        return new BettingBreakdown(balance, maxWinCap, posCash, negCash, wonProfit, pending, lost, negCash - balance);
    }

    public async Task<UserBettingData?> LoadForLoginAsync(string loginId)
    {
        var appUser = await _db.Set<NHLStats.Domain.Identity.ApplicationUser>()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == loginId);
        if (appUser?.UserId is not int userId) return null;

        var positivePoints = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch!.UserId == userId && p.PointReason!.PointType == PointType.Positive)
            .Select(p => p.Amount)
            .ToListAsync();

        var negativePoints = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch!.UserId == userId && p.PointReason!.PointType == PointType.Negative)
            .Select(p => p.Amount)
            .ToListAsync();

        var aggregatedData = await _db.UserSeasonAggregatedData
            .Where(a => a.UserId == userId)
            .Select(a => new { a.TotalPlus, a.TotalMinus })
            .ToListAsync();

        var bets = await _db.Bets
            .Where(b => b.CreatedBy == loginId)
            .Select(b => new { b.Amount, b.Odds, b.Status })
            .ToListAsync();

        var payouts = await _db.UserPayouts
            .Where(up => up.UserId == userId)
            .Select(up => up.Amount)
            .ToListAsync();

        return new UserBettingData(
            userId,
            loginId,
            positivePoints,
            negativePoints,
            aggregatedData.Sum(a => a.TotalPlus),
            aggregatedData.Sum(a => a.TotalMinus),
            bets.Where(b => b.Status == BetStatus.Won).Select(b => (b.Amount, b.Odds)).ToList(),
            bets.Where(b => b.Status == BetStatus.Pending).Select(b => b.Amount).ToList(),
            bets.Where(b => b.Status == BetStatus.Lost).Select(b => b.Amount).ToList(),
            payouts.Sum());
    }

    public async Task<IReadOnlyDictionary<int, UserBettingData>> LoadForUsersAsync(
        IReadOnlyCollection<int> matchIds,
        bool allTimeBets,
        IReadOnlyDictionary<int, int>? aggregatedPlusByUser = null,
        IReadOnlyDictionary<int, int>? aggregatedMinusByUser = null)
    {
        var matchIdList = matchIds.ToList();

        var points = await _db.UserMatchPoints
            .AsNoTracking()
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch != null && matchIdList.Contains(p.UserMatch.MatchId))
            .Select(p => new { p.UserMatch!.UserId, p.Amount, IsNegative = p.PointReason!.PointType == PointType.Negative })
            .ToListAsync();

        var betQuery = allTimeBets
            ? _db.Bets.AsNoTracking().Select(b => new { b.CreatedBy, b.Amount, b.Odds, b.Status })
            : _db.Bets.AsNoTracking()
                .Where(b => matchIdList.Contains(b.MatchId))
                .Select(b => new { b.CreatedBy, b.Amount, b.Odds, b.Status });
        var betRows = await betQuery.ToListAsync();

        var creatorIds = betRows.Select(b => b.CreatedBy).Distinct().ToList();
        var creatorToUserId = await _db.Set<NHLStats.Domain.Identity.ApplicationUser>()
            .AsNoTracking()
            .Where(u => creatorIds.Contains(u.Id) && u.UserId.HasValue)
            .ToDictionaryAsync(u => u.Id, u => u.UserId!.Value);

        var betsByUser = betRows
            .Where(b => creatorToUserId.ContainsKey(b.CreatedBy))
            .GroupBy(b => creatorToUserId[b.CreatedBy])
            .ToDictionary(g => g.Key, g => g.ToList());

        var posByUser = points.Where(p => !p.IsNegative)
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.Amount).ToList());

        var negByUser = points.Where(p => p.IsNegative)
            .GroupBy(p => p.UserId)
            .ToDictionary(g => g.Key, g => g.Select(p => p.Amount).ToList());

        var allUserIds = points.Select(p => p.UserId)
            .Union(betsByUser.Keys)
            .Union(aggregatedPlusByUser?.Keys ?? Enumerable.Empty<int>())
            .Union(aggregatedMinusByUser?.Keys ?? Enumerable.Empty<int>())
            .Distinct();

        return allUserIds.ToDictionary(
            userId => userId,
            userId =>
            {
                var posAmounts = (IReadOnlyList<decimal>)(posByUser.TryGetValue(userId, out var pos) ? pos : []);
                var negAmounts = (IReadOnlyList<decimal>)(negByUser.TryGetValue(userId, out var neg) ? neg : []);
                var userBets = betsByUser.TryGetValue(userId, out var bets) ? bets : [];

                var aggPlus = aggregatedPlusByUser?.TryGetValue(userId, out var ap) == true ? ap : 0;
                var aggMinus = aggregatedMinusByUser?.TryGetValue(userId, out var am) == true ? am : 0;

                return new UserBettingData(
                    userId,
                    null,
                    posAmounts,
                    negAmounts,
                    aggPlus,
                    aggMinus,
                    userBets.Where(b => b.Status == BetStatus.Won).Select(b => (b.Amount, b.Odds)).ToList(),
                    userBets.Where(b => b.Status == BetStatus.Pending).Select(b => b.Amount).ToList(),
                    userBets.Where(b => b.Status == BetStatus.Lost).Select(b => b.Amount).ToList(),
                    0m);
            });
    }
}
