using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IEarningsService
{
    Task<IEnumerable<SeasonStatsUserDto>> GetSeasonStatsAsync(int seasonId);
    Task<IEnumerable<SeasonalUserEarningsDto>> GetEarningsBySeasonAsync();
    Task<AllTimeEarningsDto> GetAllTimeEarningsAsync(IEnumerable<SeasonalUserEarningsDto> earningsBySeason);
    Task<EarningsSummaryDto> GetEarningsSummaryAsync();
    Task<FinancialStatsDto> GetFinancialStatsAsync();
    Task<Dictionary<int, BettingBreakdown>> ComputeEarningsForMatchesAsync(
        List<int> matchIds,
        IReadOnlyDictionary<int, int>? aggregatedPlusCountByUser = null,
        IReadOnlyDictionary<int, int>? aggregatedMinusCountByUser = null,
        bool allTimeBets = false);
}
