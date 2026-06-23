using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IUserMatchService
{
    // ── UserMatch CRUD ────────────────────────────────────────────────────────
    Task<IEnumerable<UserMatchDto>> GetByMatchAsync(int matchId);
    Task<IEnumerable<UserMatchDto>> GetBySeasonAsync(int seasonId);
    Task<UserMatchDto?> GetByIdAsync(int id);

    /// <summary>Creates a UserMatch linked to a specific match. User must be in SeasonUser.</summary>
    Task<(UserMatchDto? result, string? error)> CreateForMatchAsync(int seasonId, int matchId, CreateUserMatchDto dto);

    Task<bool> DeleteAsync(int id);

    /// <summary>Creates a UserMatch for every SeasonUser not already represented in the match.</summary>
    Task<(int created, string? error)> InitializeUsersForMatchAsync(int seasonId, int matchId);

    /// <summary>Creates missing UserMatches for every SeasonUser across all unplayed matches in the season.</summary>
    Task<(int created, string? error)> InitializeUsersForAllUnplayedMatchesAsync(int seasonId);

    // ── Aggregated data ────────────────────────────────────────────────────────────────
    Task<(AggregatedSeasonDataDto? result, string? error)> CreateAggregatedDataAsync(int userId, int seasonId, CreateAggregatedSeasonDataDto dto);
    Task<IEnumerable<AggregatedSeasonDataDto>> GetAggregatedDataAsync(int userId, int seasonId);
    Task<IEnumerable<AggregatedSeasonDataDto>> GetAggregatedDataBySeasonAsync(int seasonId);
    Task<(AggregatedSeasonDataDto? result, string? error)> UpdateAggregatedDataAsync(int userId, int seasonId, UpdateAggregatedSeasonDataDto dto);
    Task<bool> DeleteAggregatedDataAsync(int userId, int seasonId);

    // ── Points ────────────────────────────────────────────────────────────────
    Task ApplyMatchEndAutoPointsAsync(int matchId, int homeScore, int awayScore, int? hostedTeamId, int homeTeamId);
    Task<IEnumerable<UserMatchPointDto>> GetPointsAsync(int userMatchId);
    Task<(UserMatchPointDto? result, string? error)> AddPointAsync(int userMatchId, CreateUserMatchPointDto dto);
    Task<(UserMatchPointDto? result, string? error)> UpdatePointAsync(int userMatchId, int pointId, UpdateUserMatchPointDto dto);
    Task<bool> DeletePointAsync(int userMatchId, int pointId);

    // ── Goals ─────────────────────────────────────────────────────────────────
    Task<IEnumerable<UserMatchGoalDto>> GetGoalsAsync(int userMatchId);
    Task<(UserMatchGoalDto? result, string? error)> AddGoalAsync(int userMatchId, CreateUserMatchGoalDto dto);
    Task<(UserMatchGoalDto? result, string? error)> UpdateGoalAsync(int userMatchId, int goalId, UpdateUserMatchGoalDto dto);
    Task<bool> DeleteGoalAsync(int userMatchId, int goalId);

    // ── Penalties ─────────────────────────────────────────────────────────────
    Task<IEnumerable<UserMatchPenaltyDto>> GetPenaltiesAsync(int userMatchId);
    Task<(UserMatchPenaltyDto? result, string? error)> AddPenaltyAsync(int userMatchId, CreateUserMatchPenaltyDto dto);
    Task<(UserMatchPenaltyDto? result, string? error)> UpdatePenaltyAsync(int userMatchId, int penaltyId, UpdateUserMatchPenaltyDto dto);
    Task<bool> DeletePenaltyAsync(int userMatchId, int penaltyId);
}
