using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface ISeasonStatsService
{
    Task<IEnumerable<SeasonPointsStatsSummaryDto>> FetchSeasonPointsStatisticsAsync();
    Task<IEnumerable<SeasonGoalsStatsSummaryDto>> FetchSeasonGoalStatisicsAsync();
    Task<IEnumerable<SeasonPenaltiesStatsSummaryDto>> FetchSeasonPenaltyStatisticsAsync();
    Task<IEnumerable<UserSeasonTotalsDto>> GetUserSeasonTotalsAsync(int seasonId);
    Task<IEnumerable<UserPointsMetricsDto>> GetAllTimeStatsAsync(IEnumerable<SeasonPointsStatsSummaryDto> seasonsStats);
}
