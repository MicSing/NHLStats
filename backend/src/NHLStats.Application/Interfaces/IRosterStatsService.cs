using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IRosterStatsService
{
    Task<TopRosterPlayerDto?> GetTopGoalScorerAsync(int seasonId);
    Task<TopRosterPlayerDto?> GetTopPenaltyPlayerAsync(int seasonId);
    Task<IEnumerable<TopRosterPlayerDto>> GetAllGoalScorersAsync(int seasonId);
    Task<IEnumerable<RosterScorerBySeasonDto>> GetAllGoalScorersByUserAsync();
    Task<IEnumerable<TopRosterPlayerDto>> GetAllPenaltyPlayersAsync(int seasonId);
    Task<IEnumerable<RosterPenalizedBySeasonDto>> GetAllPenaltyPlayersByUserAsync();
    Task<IEnumerable<SeasonTopRosterPlayersDto>> GetTopRosterPlayersAsync();
    Task<IEnumerable<AllTimeRosterScorerDto>> GetAllTimeRosterScorerAsync(IEnumerable<RosterScorerBySeasonDto> rosterScorers);
    Task<IEnumerable<AllTimeRosterPenalizedDto>> GetAllTimePenaltyPlayersByUserAsync(IEnumerable<RosterPenalizedBySeasonDto> seasonData);
}
