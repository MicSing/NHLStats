using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

internal static class StatsCalculationHelpers
{
    internal static (int plus, int minus) GetTotalsFromPoints(IEnumerable<UserMatchPoint> points)
    {
        var plus = points
            .Where(p => p.PointReason != null && p.PointReason.PointType == PointType.Positive)
            .Sum(p => p.Count);
        var minus = points
            .Where(p => p.PointReason != null && p.PointReason.PointType == PointType.Negative)
            .Sum(p => p.Count);
        return (plus, minus);
    }
}
