using NHLStats.Application.DTOs;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Interfaces;

public interface ISeasonStatsService
{
    Task<IEnumerable<SeasonPointsStatsSummaryDto>> FetchSeasonPointsStatisticsAsync(MatchPhase? phase = null);
    Task<IEnumerable<SeasonGoalsStatsSummaryDto>> FetchSeasonGoalStatisicsAsync(MatchPhase? phase = null);
    Task<IEnumerable<SeasonPenaltiesStatsSummaryDto>> FetchSeasonPenaltyStatisticsAsync(MatchPhase? phase = null);
    Task<IEnumerable<UserSeasonTotalsDto>> GetUserSeasonTotalsAsync(int seasonId);
    Task<IEnumerable<UserPointsMetricsDto>> GetAllTimeStatsAsync(IEnumerable<SeasonPointsStatsSummaryDto> seasonsStats);
}
