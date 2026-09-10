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

    // BetLeg.OddsFormulaVersion values — see that property's doc comment. Bump
    // CurrentOddsFormulaVersion (and update BettingOddsService.ComputeOdds / LegacyOddsReconstructor
    // accordingly) the next time the odds formula or margin changes, so historical tickets can be
    // told apart from ones already priced under the new rules.
    public const decimal LegacyOddsFormulaVersion = 1.0m;
    public const decimal CurrentOddsFormulaVersion = 2.0m;

    public const int MinGoalThreshold = 3;
    public const int GoalWindowSize = 4;

    public static decimal GrossPayout(decimal amount, decimal odds) => amount * odds;
}
