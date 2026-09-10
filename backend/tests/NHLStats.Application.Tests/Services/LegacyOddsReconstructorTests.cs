using FluentAssertions;
using NHLStats.Application.Services;
using NHLStats.Domain.Entities;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class LegacyOddsReconstructorTests
{
    // Mirrors LegacyOddsReconstructor's own computation exactly (same operation order) rather
    // than a hand-typed literal, so the assertion can't drift from a `decimal` rounding quirk
    // on a repeating fraction (e.g. 1/0.35) that wasn't hand-verified against the real runtime.
    private static decimal ExpectedOdds(decimal legacyMargin, decimal legacyOdds)
    {
        var probability = legacyMargin / legacyOdds;
        var fairOdds = 1m / probability;
        var odds = 1m + (fairOdds - 1m) * BettingConstants.Margin;
        return Math.Floor(odds * 100m) / 100m;
    }

    [Fact]
    public void SingleOccasionUserBet_UsesLegacyAppMargin_080()
    {
        var result = LegacyOddsReconstructor.Reconstruct(BetType.UserPlusPoint, occasions: 1, isHostedTeamLeg: false, legacyOdds: 2.00m);

        result.Should().Be(ExpectedOdds(0.80m, 2.00m));
    }

    [Fact]
    public void MultiOccasionUserBet_UsesLegacyOccasionsMargin_070()
    {
        var result = LegacyOddsReconstructor.Reconstruct(BetType.UserPlusPoint, occasions: 3, isHostedTeamLeg: false, legacyOdds: 2.00m);

        result.Should().Be(ExpectedOdds(0.70m, 2.00m));
    }

    [Fact]
    public void HostedTeamWinLeg_UsesLegacyAppMargin_NotTeamMargin()
    {
        // Same stored odds as the opponent case below, but the hosted side originally priced
        // with the default (App) margin, not TeamMargin — must reconstruct differently.
        var result = LegacyOddsReconstructor.Reconstruct(BetType.TeamWin, occasions: 1, isHostedTeamLeg: true, legacyOdds: 2.00m);

        result.Should().Be(ExpectedOdds(0.80m, 2.00m));
    }

    [Fact]
    public void OpponentTeamWinLeg_UsesLegacyTeamMargin_075()
    {
        var result = LegacyOddsReconstructor.Reconstruct(BetType.TeamWin, occasions: 1, isHostedTeamLeg: false, legacyOdds: 2.00m);

        result.Should().Be(ExpectedOdds(0.75m, 2.00m));
        // Sanity check the two TeamWin branches genuinely diverge for the same stored odds.
        result.Should().NotBe(ExpectedOdds(0.80m, 2.00m));
    }

    [Fact]
    public void TeamDraw_UsesLegacyTeamMargin_075()
    {
        var result = LegacyOddsReconstructor.Reconstruct(BetType.TeamDraw, occasions: 1, isHostedTeamLeg: false, legacyOdds: 2.00m);

        result.Should().Be(ExpectedOdds(0.75m, 2.00m));
    }

    [Fact]
    public void TeamWinOrDraw_UsesLegacyTeamMargin_075_RegardlessOfHostedFlag()
    {
        var hosted = LegacyOddsReconstructor.Reconstruct(BetType.TeamWinOrDraw, occasions: 1, isHostedTeamLeg: true, legacyOdds: 2.00m);
        var opponent = LegacyOddsReconstructor.Reconstruct(BetType.TeamWinOrDraw, occasions: 1, isHostedTeamLeg: false, legacyOdds: 2.00m);

        hosted.Should().Be(ExpectedOdds(0.75m, 2.00m));
        opponent.Should().Be(ExpectedOdds(0.75m, 2.00m));
    }

    [Theory]
    [InlineData(BetType.MatchTotalGoals)]
    [InlineData(BetType.HostedShutoutWin)]
    [InlineData(BetType.OpponentShutoutWin)]
    public void OtherMarkets_FallBackToLegacyAppMargin_080(BetType betType)
    {
        var result = LegacyOddsReconstructor.Reconstruct(betType, occasions: 1, isHostedTeamLeg: false, legacyOdds: 2.00m);

        result.Should().Be(ExpectedOdds(0.80m, 2.00m));
    }

    [Fact]
    public void OddsBelowOne_ReturnsNull()
    {
        var result = LegacyOddsReconstructor.Reconstruct(BetType.UserGoal, occasions: 1, isHostedTeamLeg: false, legacyOdds: 0.99m);

        result.Should().BeNull();
    }
}
