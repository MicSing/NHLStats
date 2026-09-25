namespace NHLStats.Application.Services;

public static class BettingConstants
{
    public const decimal AggregatedPositiveValue = 0.25m;
    public const decimal AggregatedNegativeValue = 0.50m;
    public const decimal MinBettableProbability = 0.02m;
    public const decimal MinBettableOdds = 1.08m;

    // The margin every new bet/live odds computation is priced with — see
    // BettingOddsService.ComputeOdds. Kept here (rather than duplicated as private consts on
    // BettingOddsService) so OddsFormula can reprice historical tickets against the same live value.
    public const decimal Margin = 0.35m;

    // Version 2.2 shaves a per-match pseudo-random amount in [0, MaxMatchMarginReduction] off
    // Margin (see OddsFormula.MatchMargin), so two matches against the same opponent — which
    // otherwise feed identical stats into the model — don't end up with identical odds.
    public const decimal MaxMatchMarginReduction = 0.05m;

    // The margin used specifically when repricing historical tickets to HistoricalOddsFormulaVersion
    // (see OddsFormula.MarginFor) — deliberately more generous than the live Margin, so
    // retroactively repricing old settled tickets doesn't cut as deep as the live margin would.
    public const decimal HistoricalMargin = 0.6m;

    // BetLeg.OddsFormulaVersion values — see that property's doc comment.
    //  1.0 = the original multiplicative formula, per-bet-type margins 0.80/0.75/0.70.
    //  2.0 = additive formula, uniform HistoricalMargin — for repricing old tickets more gently.
    //  2.1 = additive formula, uniform Margin.
    //  2.2 = additive formula, Margin minus a per-match random reduction in
    //        [0, MaxMatchMarginReduction] — what new bets and live/upcoming odds use.
    // Bump CurrentOddsFormulaVersion (and add a branch to OddsFormula.MarginFor, and to
    // Compute/Invert only if the formula *shape* itself changes, not just the margin) the next
    // time the live formula or margin changes, so historical tickets can be told apart from ones
    // already priced under the new rules.
    public const decimal LegacyOddsFormulaVersion = 1.0m;
    public const decimal HistoricalOddsFormulaVersion = 2.0m;
    public const decimal UniformOddsFormulaVersion = 2.1m;
    public const decimal CurrentOddsFormulaVersion = 2.2m;

    public const int MinGoalThreshold = 3;
    public const int GoalWindowSize = 4;

    public static decimal GrossPayout(decimal amount, decimal odds) => amount * odds;
}
