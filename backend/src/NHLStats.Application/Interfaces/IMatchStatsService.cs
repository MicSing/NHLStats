using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IMatchStatsService
{
    Task<IEnumerable<WeekGroupDto>> GetMatchesGroupedByWeekAsync(int seasonId);
    Task<UserPointReasonBreakdownDto?> GetUserPointReasonBreakdownAsync(int userId, int? seasonId = null);
    Task<IEnumerable<HeadToHeadMatchDto>> GetHeadToHeadAsync(int teamId, int hostedTeamId);
    Task<IEnumerable<SeasonMatchHistoryDto>> GetUserMatchHistoryAsync(int userId, int? seasonId = null);
    Task<IEnumerable<PeriodPlusMinusDto>> GetAllTimePlusMinusTrendAsync();
    Task<IEnumerable<PeriodPlusMinusDto>> GetWeeklyPlusMinusTrendAsync(int desiredWeeks = 6);
    Task<List<PeriodPlusMinusDto>> BuildWeeklyPeriodsAsync(int seasonId);
}
