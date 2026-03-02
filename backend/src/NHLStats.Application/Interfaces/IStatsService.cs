using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IStatsService
{
    /// <summary>
    /// Returns per-user aggregated stats (TotalPlus, TotalMinus, Earnings) for a season.
    /// Earnings are calculated using the MoneyConfig rate that was active at each match date.
    /// </summary>
    Task<IEnumerable<UserSeasonStatsDto>> GetSeasonStatsAsync(int seasonId);

    /// <summary>
    /// Returns all matches in a season grouped by sequential week number.
    /// Matches on the same calendar date share the same week number.
    /// Week numbers are assigned in ascending date order starting at 1.
    /// </summary>
    Task<IEnumerable<WeekGroupDto>> GetMatchesGroupedByWeekAsync(int seasonId);

    /// <summary>
    /// Returns the roster player with the most goals across all matches in a season.
    /// </summary>
    Task<TopRosterPlayerDto?> GetTopGoalScorerAsync(int seasonId);

    /// <summary>
    /// Returns the roster player with the most penalties across all matches in a season.
    /// </summary>
    Task<TopRosterPlayerDto?> GetTopPenaltyPlayerAsync(int seasonId);

    /// <summary>
    /// Returns all-time earnings per user aggregated across every season,
    /// along with total collected, total expenses, and the remaining balance.
    /// </summary>
    Task<AllTimeEarningsDto> GetAllTimeEarningsAsync();
}
