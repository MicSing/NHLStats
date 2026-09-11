namespace NHLStats.Application.Services;

/// <summary>
/// Typed view over BetLeg.OddsFormulaVersion's three known decimal values, used wherever code
/// actually branches on "which formula version is this" (OddsFormula's dispatch, and the
/// recalculate-historical-odds endpoint's validation). BetLeg.OddsFormulaVersion itself, and the
/// API/frontend wire format, stay decimal — this enum never touches the DB or JSON, it just
/// replaces ad-hoc decimal equality chains with an exhaustive, compiler-checked switch.
/// </summary>
public enum OddsFormulaTier
{
    /// <summary>1.0 — the original multiplicative formula, per-bet-type margins 0.80/0.75/0.70.</summary>
    Legacy,

    /// <summary>2.0 — additive formula, uniform HistoricalMargin (0.6), for repricing old tickets gently.</summary>
    Historical,

    /// <summary>2.1 — additive formula, uniform Margin (0.35), what new bets and live/upcoming odds use.</summary>
    Current
}

public static class OddsFormulaTiers
{
    /// <summary>The canonical BetLeg.OddsFormulaVersion decimal value for this tier.</summary>
    public static decimal ToDecimal(this OddsFormulaTier tier) => tier switch
    {
        OddsFormulaTier.Legacy => BettingConstants.LegacyOddsFormulaVersion,
        OddsFormulaTier.Historical => BettingConstants.HistoricalOddsFormulaVersion,
        OddsFormulaTier.Current => BettingConstants.CurrentOddsFormulaVersion,
        _ => throw new ArgumentOutOfRangeException(nameof(tier))
    };

    /// <summary>Resolves a stored/posted decimal version to its tier. False if the value is unknown.</summary>
    public static bool TryFromDecimal(decimal value, out OddsFormulaTier tier)
    {
        if (value == BettingConstants.LegacyOddsFormulaVersion) { tier = OddsFormulaTier.Legacy; return true; }
        if (value == BettingConstants.HistoricalOddsFormulaVersion) { tier = OddsFormulaTier.Historical; return true; }
        if (value == BettingConstants.CurrentOddsFormulaVersion) { tier = OddsFormulaTier.Current; return true; }
        tier = default;
        return false;
    }
}
