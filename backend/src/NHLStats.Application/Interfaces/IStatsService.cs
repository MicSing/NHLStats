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
    /// Returns all roster players sorted by goals scored descending for the season.
    /// </summary>
    Task<IEnumerable<TopRosterPlayerDto>> GetAllGoalScorersAsync(int seasonId);

    /// <summary>
    /// Returns all roster players sorted by goals scored descending, with per-user goal counts.
    /// </summary>
    Task<IEnumerable<RosterScorerByUserDto>> GetAllGoalScorersByUserAsync(int seasonId);

    /// <summary>
    /// Returns all roster players sorted by penalties taken descending for the season.
    /// </summary>
    Task<IEnumerable<TopRosterPlayerDto>> GetAllPenaltyPlayersAsync(int seasonId);

    /// <summary>
    /// Returns all roster players sorted by penalties taken descending, with per-user penalty counts.
    /// </summary>
    Task<IEnumerable<RosterPenalizedByUserDto>> GetAllPenaltyPlayersByUserAsync(int seasonId);

    /// <summary>
    /// Returns per-user aggregated plus/minus stats across all seasons.
    /// </summary>
    Task<IEnumerable<UserSeasonStatsDto>> GetAllSeasonsStatsAsync();

    /// <summary>
    /// Returns plus/minus per user per season, ordered chronologically.
    /// Used for trend charts.
    /// </summary>
    Task<IEnumerable<PeriodPlusMinusDto>> GetPlusMinusTrendAsync();

    /// <summary>
    /// Returns plus/minus per user per week for a season.
    /// When the season has few weeks, backfills from the previous season.
    /// </summary>
    Task<IEnumerable<PeriodPlusMinusDto>> GetWeeklyPlusMinusTrendAsync(int seasonId);

    /// <summary>
    /// Returns all-time earnings per user aggregated across every season,
    /// along with total collected, total expenses, and the remaining balance.
    /// </summary>
    Task<AllTimeEarningsDto> GetAllTimeEarningsAsync();

    /// <summary>
    /// Returns per-user total goals and penalties for a season.
    /// </summary>
    Task<IEnumerable<UserSeasonTotalsDto>> GetUserSeasonTotalsAsync(int seasonId);

    /// <summary>
    /// Returns a user's point-reason breakdown, optionally filtered by season.
    /// Groups UserMatchPoints by PointReason, returning count per reason and whether it's positive.
    /// If no seasonId provided, aggregates across all seasons.
    /// </summary>
    Task<UserPointReasonBreakdownDto?> GetUserPointReasonBreakdownAsync(int userId, int? seasonId = null);

    /// <summary>
    /// Returns all played matches where the given team appeared (home or away)
    /// within seasons whose HostedTeamId matches hostedTeamId, ordered newest first.
    /// </summary>
    Task<IEnumerable<HeadToHeadMatchDto>> GetHeadToHeadAsync(int teamId, int hostedTeamId);

    /// <summary>
    /// Returns per-match summary for a user, ordered by MatchDate ascending.
    /// Opponent is resolved from Season.HostedTeamId: if hosted team is home, opponent is away and vice-versa.
    /// Optionally filtered by seasonId.
    /// </summary>
    Task<IEnumerable<UserMatchSummaryDto>> GetUserMatchHistoryAsync(int userId, int? seasonId = null);
}
