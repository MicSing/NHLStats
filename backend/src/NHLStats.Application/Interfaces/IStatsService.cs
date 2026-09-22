using NHLStats.Application.DTOs;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Interfaces;

public interface IStatsService
{
    Task<DashboardDataDto> GetDashboardDataAsync();
    Task<SeasonTotalsDto> GetSeasonTotalsAsync(MatchPhase? phase = null);
}
