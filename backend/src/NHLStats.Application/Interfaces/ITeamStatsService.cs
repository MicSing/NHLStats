using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface ITeamStatsService
{
    Task<IEnumerable<TeamOptionDto>> GetHostedTeamOptionsAsync();
    Task<IEnumerable<TeamOptionDto>> GetOpponentOptionsAsync(int hostedTeamId);
    Task<TeamStatsSummaryDto> GetTeamStatsAsync(int hostedTeamId, int opponentTeamId);
    Task<IEnumerable<TeamStatsMatchDto>> GetMatchesAsync(int hostedTeamId, int opponentTeamId);
}
