using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IMatchService
{
    Task<IEnumerable<FutureMatchDto>> GetFutureMatchesAsync(int count = 10, string? loginId = null);
    Task<IEnumerable<MatchDto>> GetBySeasonAsync(int seasonId);
    Task<MatchDto?> GetByIdAsync(int id);
    Task<MatchDto> CreateAsync(int seasonId, CreateMatchDto dto);
    Task<MatchDto?> UpdateAsync(int id, UpdateMatchDto dto);
    Task<bool> DeleteAsync(int id);

    /// <summary>
    /// Resets a match to not-played: clears score, completion type and date, wipes every
    /// player's points/goals/penalties for the match (keeping their roster entries), and
    /// reverts any betting tickets on this match back to Pending.
    /// </summary>
    Task<MatchDto?> ResetAsync(int id);
    Task<IEnumerable<MatchDto>> BatchCreateAsync(int seasonId, IEnumerable<BatchCreateMatchDto> dtos);
}
