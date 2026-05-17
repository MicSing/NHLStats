using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IStatsService
{
    Task<DashboardDataDto> GetDashboardDataAsync();
    Task<SeasonTotalsDto> GetSeasonTotalsAsync();
}
