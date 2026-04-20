using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class BettingBalanceService : IBettingBalanceService
{
    private readonly NhlStatsDbContext _db;

    public BettingBalanceService(NhlStatsDbContext db) => _db = db;

    public async Task<BettingBalanceDto> GetBalanceAsync(string loginId)
    {
        // Resolve userId from loginId (ApplicationUser → User)
        var appUser = await _db.Set<NHLStats.Domain.Identity.ApplicationUser>()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == loginId);
        var userId = appUser?.UserId;

        if (userId == null)
            return new BettingBalanceDto(0, 0, 0, 0, 0, 0);

        // Sum of positive point cash — client-side because SQLite can't SumAsync decimal
        var positivePoints = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch!.UserId == userId.Value && p.PointReason!.PointType == PointType.Positive)
            .Select(p => p.Amount)
            .ToListAsync();
        var totalPositiveCash = positivePoints.Sum();

        // Aggregated positive points (historical seasons) are always worth 0.25€ each
        var aggregatedPlusPoints = await _db.UserSeasonAggregatedData
            .Where(a => a.UserId == userId.Value)
            .Select(a => a.TotalPlus)
            .ToListAsync();
        totalPositiveCash += aggregatedPlusPoints.Sum() * 0.25m;

        // Won bet profits — already client-side
        var wonBets = await _db.Bets
            .Where(b => b.CreatedBy == loginId && b.Status == BetStatus.Won)
            .Select(b => new { b.Amount, b.Odds })
            .ToListAsync();
        var totalWonProfit = wonBets.Sum(b => b.Amount * b.Odds - b.Amount);

        // Pending stakes
        var pendingAmounts = await _db.Bets
            .Where(b => b.CreatedBy == loginId && b.Status == BetStatus.Pending)
            .Select(b => b.Amount)
            .ToListAsync();
        var totalPendingStake = pendingAmounts.Sum();

        // Lost stakes
        var lostAmounts = await _db.Bets
            .Where(b => b.CreatedBy == loginId && b.Status == BetStatus.Lost)
            .Select(b => b.Amount)
            .ToListAsync();
        var totalLostStake = lostAmounts.Sum();

        var availableBalance = totalPositiveCash + totalWonProfit - totalPendingStake - totalLostStake;

        // Max win cap: Σ(negative point cash) - Σ(user payouts)
        var negativePoints = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch!.UserId == userId.Value && p.PointReason!.PointType == PointType.Negative)
            .Select(p => p.Amount)
            .ToListAsync();
        var totalNegativeCash = negativePoints.Sum();

        var payoutAmounts = await _db.UserPayouts
            .Where(up => up.UserId == userId.Value)
            .Select(up => up.Amount)
            .ToListAsync();
        var totalPayouts = payoutAmounts.Sum();

        var maxWinCap = Math.Max(0m, totalNegativeCash - totalPayouts);

        return new BettingBalanceDto(
            Math.Max(0m, availableBalance),
            maxWinCap,
            totalPositiveCash,
            totalWonProfit,
            totalPendingStake,
            totalLostStake);
    }
}
