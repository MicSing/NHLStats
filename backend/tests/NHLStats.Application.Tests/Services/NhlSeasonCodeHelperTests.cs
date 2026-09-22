using FluentAssertions;
using NHLStats.Application.Services;
using Xunit;

namespace NHLStats.Application.Tests.Services;

public class NhlSeasonCodeHelperTests
{
    [Theory]
    [InlineData(26, "20252026")]
    [InlineData(25, "20242025")]
    [InlineData(24, "20232024")]
    [InlineData(6, "20052006")]
    public void GetSeasonCode_MapsNhlYearToRealSeasonCode(int nhlYear, string expectedSeasonCode)
    {
        NhlSeasonCodeHelper.GetSeasonCode(nhlYear).Should().Be(expectedSeasonCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100)]
    [InlineData(-1)]
    public void GetSeasonCode_WithOutOfRangeYear_Throws(int nhlYear)
    {
        var act = () => NhlSeasonCodeHelper.GetSeasonCode(nhlYear);
        act.Should().Throw<ArgumentOutOfRangeException>();
    }
}
