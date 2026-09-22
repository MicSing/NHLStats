using FluentAssertions;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Domain.Tests;

public class PlayerPositionsTests
{
    [Theory]
    [InlineData(null, null)]
    [InlineData("", null)]
    [InlineData("   ", null)]
    [InlineData("C", "C")]
    [InlineData("d", "D")]
    [InlineData("RW,C", "C, RW")]
    [InlineData("RW, C", "C, RW")]
    [InlineData("  rw ,   c  ", "C, RW")]
    [InlineData("C, C, RW", "C, RW")]
    [InlineData("G, D, RW, LW, C", "C, LW, RW, D, G")]
    public void Normalize_ReordersAndDeduplicates(string? raw, string? expected)
    {
        PlayerPositions.Normalize(raw).Should().Be(expected);
    }

    [Theory]
    [InlineData("F")]
    [InlineData("C;RW")]
    [InlineData("Center")]
    public void Normalize_ThrowsFormatException_ForUnknownTokens(string raw)
    {
        var act = () => PlayerPositions.Normalize(raw);
        act.Should().Throw<FormatException>();
    }

    [Fact]
    public void ContainsAny_MatchesWhenAnyTokenIsInCandidateSet()
    {
        var forwards = new HashSet<PlayerPosition> { PlayerPosition.C, PlayerPosition.LW, PlayerPosition.RW };

        PlayerPositions.ContainsAny("D, C", forwards).Should().BeTrue();
        PlayerPositions.ContainsAny("D, G", forwards).Should().BeFalse();
        PlayerPositions.ContainsAny(null, forwards).Should().BeFalse();
    }

    [Fact]
    public void Contains_MatchesExactPositionWithinMultiPositionValue()
    {
        PlayerPositions.Contains("C, D", PlayerPosition.D).Should().BeTrue();
        PlayerPositions.Contains("C, RW", PlayerPosition.D).Should().BeFalse();
    }
}
