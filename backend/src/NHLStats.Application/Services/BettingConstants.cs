namespace NHLStats.Application.Services;

public static class BettingConstants
{
    public const decimal AggregatedPositiveValue = 0.25m;
    public const decimal AggregatedNegativeValue = 0.50m;
    public const decimal MinBettableProbability = 0.02m;
    public const int MinGoalThreshold = 3;
    public const int GoalWindowSize = 4;

    public static decimal GrossPayout(decimal amount, decimal odds) => amount * odds;
}
