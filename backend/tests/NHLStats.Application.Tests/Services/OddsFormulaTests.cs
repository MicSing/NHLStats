using FluentAssertions;
using NHLStats.Application.Services;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class OddsFormulaTests
{
    private const OddsFormulaTier V1 = OddsFormulaTier.Legacy;
    // V2 = OddsFormulaTier.Historical. Used both as the "historical" version for MarginFor tests,
    // and as a stand-in "any non-legacy version" for Compute/Invert tests — those two only
    // dispatch on legacy-vs-not, so the specific non-legacy value doesn't matter there (margin is
    // always passed in explicitly).
    private const OddsFormulaTier V2 = OddsFormulaTier.Historical;

    // ── MarginFor ───────────────────────────────────────────────────────────

    [Fact]
    public void MarginFor_V1_SingleOccasionUserBet_IsLegacyAppMargin()
    {
        OddsFormula.MarginFor(V1, BetType.UserPlusPoint, occasions: 1, isHostedTeamLeg: false).Should().Be(0.80m);
    }

    [Fact]
    public void MarginFor_V1_MultiOccasionUserBet_IsLegacyOccasionsMargin()
    {
        OddsFormula.MarginFor(V1, BetType.UserPlusPoint, occasions: 3, isHostedTeamLeg: false).Should().Be(0.70m);
    }

    [Fact]
    public void MarginFor_V1_HostedTeamWin_IsLegacyAppMargin_NotTeamMargin()
    {
        OddsFormula.MarginFor(V1, BetType.TeamWin, occasions: 1, isHostedTeamLeg: true).Should().Be(0.80m);
    }

    [Fact]
    public void MarginFor_V1_OpponentTeamWin_IsLegacyTeamMargin()
    {
        OddsFormula.MarginFor(V1, BetType.TeamWin, occasions: 1, isHostedTeamLeg: false).Should().Be(0.75m);
    }

    [Theory]
    [InlineData(BetType.TeamWinOrDraw)]
    [InlineData(BetType.TeamDraw)]
    public void MarginFor_V1_DrawMarkets_AreLegacyTeamMargin(BetType betType)
    {
        OddsFormula.MarginFor(V1, betType, occasions: 1, isHostedTeamLeg: false).Should().Be(0.75m);
    }

    [Theory]
    [InlineData(BetType.MatchTotalGoals)]
    [InlineData(BetType.HostedShutoutWin)]
    [InlineData(BetType.OpponentShutoutWin)]
    public void MarginFor_V1_OtherMarkets_FallBackToLegacyAppMargin(BetType betType)
    {
        OddsFormula.MarginFor(V1, betType, occasions: 1, isHostedTeamLeg: false).Should().Be(0.80m);
    }

    [Theory]
    [InlineData(BetType.TeamWin, true)]
    [InlineData(BetType.TeamWin, false)]
    [InlineData(BetType.UserPlusPoint, false)]
    [InlineData(BetType.TeamDraw, false)]
    public void MarginFor_Historical_IsAlwaysTheUniformHistoricalMargin(BetType betType, bool isHostedTeamLeg)
    {
        // V2 (2.0) is the historical tier — a single margin for every bet type, no
        // hosted/opponent split (unlike legacy), and deliberately distinct from the live Margin.
        OddsFormula.MarginFor(V2, betType, occasions: 1, isHostedTeamLeg).Should().Be(BettingConstants.HistoricalMargin);
        BettingConstants.HistoricalMargin.Should().NotBe(BettingConstants.Margin, "the two tiers must actually differ for this test to mean anything");
    }

    [Theory]
    [InlineData(BetType.TeamWin, true)]
    [InlineData(BetType.TeamWin, false)]
    [InlineData(BetType.UserPlusPoint, false)]
    [InlineData(BetType.TeamDraw, false)]
    public void MarginFor_Current_IsAlwaysTheUniformLiveMargin(BetType betType, bool isHostedTeamLeg)
    {
        OddsFormula.MarginFor(OddsFormulaTier.Current, betType, occasions: 1, isHostedTeamLeg)
            .Should().Be(BettingConstants.Margin);
    }

    // ── Compute ─────────────────────────────────────────────────────────────

    [Fact]
    public void Compute_V1_IsMultiplicative()
    {
        // odds = margin / probability
        OddsFormula.Compute(V1, probability: 0.40m, margin: 0.80m).Should().Be(2.00m);
    }

    [Fact]
    public void Compute_V2_IsAdditiveOnProfit()
    {
        // fairOdds = 1/0.40 = 2.5; odds = 1 + (2.5-1)*0.35 = 1.525 -> floor to 1.52
        OddsFormula.Compute(V2, probability: 0.40m, margin: 0.35m).Should().Be(1.52m);
    }

    [Fact]
    public void Compute_ClampsExtremeProbabilities()
    {
        OddsFormula.Compute(V1, probability: 5.00m, margin: 0.80m)
            .Should().Be(OddsFormula.Compute(V1, probability: 0.99m, margin: 0.80m));
        OddsFormula.Compute(V1, probability: -1.00m, margin: 0.80m)
            .Should().Be(OddsFormula.Compute(V1, probability: 0.01m, margin: 0.80m));
    }

    // ── Invert ──────────────────────────────────────────────────────────────

    [Fact]
    public void Invert_V1_RecoversProbability()
    {
        // 2.00 = 0.80 / probability -> probability = 0.40
        OddsFormula.Invert(V1, margin: 0.80m, odds: 2.00m).Should().Be(0.40m);
    }

    [Fact]
    public void Invert_V2_RecoversProbability()
    {
        var odds = OddsFormula.Compute(V2, probability: 0.40m, margin: 0.35m); // 1.52
        var recovered = OddsFormula.Invert(V2, margin: 0.35m, odds: odds);

        // Re-pricing the recovered probability must land back on the same odds (round-trip).
        recovered.Should().NotBeNull();
        OddsFormula.Compute(V2, recovered!.Value, margin: 0.35m).Should().Be(odds);
    }

    [Fact]
    public void Invert_OddsBelowOne_ReturnsNull()
    {
        OddsFormula.Invert(V1, margin: 0.80m, odds: 0.99m).Should().BeNull();
    }

    [Fact]
    public void Invert_V2_JustAboveOddsFloor_StillRecoversAProbability()
    {
        // denominator = odds - 1 + margin = 0.01 + 0.35 = 0.36 > 0, giving a valid (if extreme,
        // near-certain) implied probability.
        var probability = OddsFormula.Invert(V2, margin: 0.35m, odds: 1.01m);
        probability.Should().NotBeNull();
        probability!.Value.Should().BeApproximately(0.35m / 0.36m, 0.0001m);
    }

    [Fact]
    public void Invert_V2_AtOddsFloor_ImpliesProbabilityOne_ReturnsNull()
    {
        // At odds == 1.0 the algebra solves to probability == 1.0 exactly, which is outside the
        // open (0, 1) range Invert requires (matching Compute's own < 1.0 clamp) — no real,
        // bettable probability is "certain", so this is correctly rejected, not returned as 1.0.
        OddsFormula.Invert(V2, margin: 0.35m, odds: 1.0m).Should().BeNull();
    }

    [Fact]
    public void Invert_V2_NonPositiveMargin_ReturnsNull()
    {
        // A non-positive margin can push the denominator (odds - 1 + margin) to zero or below,
        // making the implied probability undefined — defensive guard, not a realistic config
        // (BettingConstants.Margin is always > 0), but Invert must not divide by zero or return
        // a bogus probability if it's ever misused.
        OddsFormula.Invert(V2, margin: 0m, odds: 1.0m).Should().BeNull();
    }

    [Fact]
    public void RoundTrip_V1ThenV2_ProducesTheSameOddsAsDirectComputation()
    {
        // This mirrors what RecalculateHistoricalTicketOddsAsync does for a legacy leg with no
        // stored Probability: invert its v1 odds, then compute v2 odds from the recovered value.
        var legacyOdds = 2.00m; // priced with v1, AppMargin 0.80 (implies probability 0.40)
        var probability = OddsFormula.Invert(V1, margin: 0.80m, odds: legacyOdds);

        probability.Should().NotBeNull();
        var repriced = OddsFormula.Compute(V2, probability!.Value, BettingConstants.Margin);
        repriced.Should().Be(OddsFormula.Compute(V2, 0.40m, BettingConstants.Margin));
    }
}
