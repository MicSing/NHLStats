namespace NHLStats.Application.Services;

public static class BettingConstants
{
    public const decimal AggregatedPositiveValue = 0.25m;
    public const decimal AggregatedNegativeValue = 0.50m;
    public const decimal MinBettableProbability = 0.02m;
    public const decimal MinBettableOdds = 1.08m;

    // The one margin every bet type is currently priced with — see BettingOddsService.ComputeOdds.
    // Kept here (rather than duplicated as private consts on BettingOddsService) so
    // LegacyOddsReconstructor can reprice historical tickets against the same live value.
    public const decimal Margin = 0.35m;

    public const int MinGoalThreshold = 3;
    public const int GoalWindowSize = 4;

    public static decimal GrossPayout(decimal amount, decimal odds) => amount * odds;
}
