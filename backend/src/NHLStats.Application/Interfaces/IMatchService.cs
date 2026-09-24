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

    /// <summary>
    /// Creates a playoff series for the season's hosted team against an opponent, following the
    /// standard 2-2-1-1-1 home/away pattern: the first 4 games for NHL (games 5-7 are appended
    /// automatically while the series is undecided) or a single game for IIHF. Odds for the new
    /// games are calculated in the background.
    /// </summary>
    Task<IEnumerable<MatchDto>> CreatePlayoffSeriesAsync(int seasonId, CreatePlayoffSeriesDto dto);

    /// <summary>
    /// Summarises the hosted team's latest playoff round and whether a next series can be created.
    /// </summary>
    Task<PlayoffStatusDto> GetPlayoffStatusAsync(int seasonId);

    /// <summary>
    /// Follow-up work once a match has finished (however it was finished): appends the next game
    /// of an undecided playoff series and recalculates upcoming odds, including the new game's.
    /// </summary>
    Task HandleMatchCompletedAsync(int matchId);
}
