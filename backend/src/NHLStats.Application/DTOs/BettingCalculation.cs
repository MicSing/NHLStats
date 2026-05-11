namespace NHLStats.Application.DTOs;

public record UserBettingData(
    int UserId,
    string? LoginId,
    IReadOnlyList<decimal> PositivePointAmounts,
    IReadOnlyList<decimal> NegativePointAmounts,
    int AggregatedPlusCount,
    int AggregatedMinusCount,
    IReadOnlyList<(decimal Amount, decimal Odds)> WonBets,
    IReadOnlyList<decimal> PendingStakes,
    IReadOnlyList<decimal> LostStakes,
    decimal TotalPayouts);

public record BettingBreakdown(
    decimal AvailableBalance,
    decimal MaxWinCap,
    decimal TotalPositiveCash,
    decimal TotalNegativeCash,
    decimal TotalWonProfit,
    decimal TotalPendingStake,
    decimal TotalLostStake,
    decimal Earnings);
