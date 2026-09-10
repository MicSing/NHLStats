using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

/// <summary>
/// Computes and inverts odds for a specific BetLeg.OddsFormulaVersion, so historical tickets can
/// be (re)priced under any formula version the admin picks — not just always "the current one".
///
/// Two versions exist today:
///  - 1.0 (legacy): offeredOdds = margin / probability, with per-bet-type margins
///    0.80/0.75/0.70 — the only formula/margin combination that was ever actually live before
///    this file existed. Pinned here as historical fact, independent of whatever
///    BettingConstants.Margin is set to today or in the future.
///  - 2.0 (current): offeredOdds = 1 + (1/probability - 1) * margin, with a single
///    BettingConstants.Margin for every bet type. This is also what BettingOddsService.ComputeOdds
///    uses for all new/upcoming odds — see that method.
///
/// A BetLeg placed since BetLeg.Probability was introduced always has its true base probability
/// on hand, so repricing it to any version is an exact forward computation via Compute(). Only
/// legs from before that (BetLeg.Probability == null) need Invert() first, to recover an implied
/// probability from their currently-stored Odds — a one-time backfill, after which Compute()
/// alone is enough for that leg from then on.
/// </summary>
public static class OddsFormula
{
    private const decimal LegacyAppMargin = 0.80m;
    private const decimal LegacyTeamMargin = 0.75m;
    private const decimal LegacyOccasionsMargin = 0.70m;

    /// <summary>The margin the given formula version applies for this leg shape.</summary>
    /// <param name="isHostedTeamLeg">
    /// Only meaningful for BetType.TeamWin under version 1.0: the original odds computation
    /// priced the hosted team's TeamWin leg with the default (App) margin and the opponent's
    /// with TeamMargin — an asymmetry that predates this file and must be preserved.
    /// </param>
    public static decimal MarginFor(decimal version, BetType betType, int occasions, bool isHostedTeamLeg)
    {
        if (version != BettingConstants.LegacyOddsFormulaVersion) return BettingConstants.Margin;

        return betType switch
        {
            BetType.TeamWin => isHostedTeamLeg ? LegacyAppMargin : LegacyTeamMargin,
            BetType.TeamWinOrDraw => LegacyTeamMargin,
            BetType.TeamDraw => LegacyTeamMargin,
            BetType.UserGoal or BetType.UserPenalty or BetType.UserPlusPoint or BetType.UserMinusPoint =>
                occasions > 1 ? LegacyOccasionsMargin : LegacyAppMargin,
            // MatchTotalGoals, HostedShutoutWin, OpponentShutoutWin
            _ => LegacyAppMargin
        };
    }

    /// <summary>Computes the odds for a probability under the given formula version and margin.</summary>
    public static decimal Compute(decimal version, decimal probability, decimal margin)
    {
        probability = Math.Clamp(probability, 0.01m, 0.99m);
        var odds = version == BettingConstants.LegacyOddsFormulaVersion
            ? margin / probability
            : 1m + (1m / probability - 1m) * margin;
        return Math.Floor(odds * 100m) / 100m;
    }

    /// <summary>
    /// Recovers the implied probability from odds locked in under the given formula
    /// version/margin. Returns null if the odds can't be inverted safely (e.g. below 1.0, or the
    /// implied probability would fall outside (0, 1)).
    /// </summary>
    public static decimal? Invert(decimal version, decimal margin, decimal odds)
    {
        if (odds < 1m) return null;

        decimal probability;
        if (version == BettingConstants.LegacyOddsFormulaVersion)
        {
            probability = margin / odds;
        }
        else
        {
            var denominator = odds - 1m + margin;
            if (denominator <= 0m) return null;
            probability = margin / denominator;
        }

        return probability is > 0m and < 1m ? probability : null;
    }
}
