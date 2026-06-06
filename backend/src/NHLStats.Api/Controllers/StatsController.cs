using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

// ─── Season-scoped stats endpoints ───────────────────────────────────────────
// All routes under /api/seasons/{seasonId}/stats

[ApiController]
[Route("api/seasons/{seasonId:int}/stats")]
public class SeasonStatsController : ControllerBase
{
    private readonly ISeasonStatsService _seasonStats;
    private readonly IRosterStatsService _rosterStats;
    private readonly IEarningsService _earnings;
    private readonly IMatchStatsService _matchStats;

    public SeasonStatsController(
        ISeasonStatsService seasonStats,
        IRosterStatsService rosterStats,
        IEarningsService earnings,
        IMatchStatsService matchStats)
    {
        _seasonStats = seasonStats;
        _rosterStats = rosterStats;
        _earnings = earnings;
        _matchStats = matchStats;
    }

    /// <summary>GET /api/seasons/{seasonId}/stats</summary>
    /// <remarks>Returns per-user point totals and earnings for the season.</remarks>
    [HttpGet]
    public async Task<IActionResult> GetSeasonStats(int seasonId)
    {
        var result = await _earnings.GetSeasonStatsAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/weekly</summary>
    /// <remarks>Returns all matches in the season grouped by sequential week number.</remarks>
    [HttpGet("weekly")]
    public async Task<IActionResult> GetWeekly(int seasonId)
    {
        var result = await _matchStats.GetMatchesGroupedByWeekAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/top-scorers</summary>
    /// <remarks>Returns the roster player with the most goals in the season.</remarks>
    [HttpGet("top-scorers")]
    public async Task<IActionResult> GetTopScorers(int seasonId)
    {
        var result = await _rosterStats.GetTopGoalScorerAsync(seasonId);
        if (result == null) return NoContent();
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/top-penalized</summary>
    /// <remarks>Returns the roster player with the most penalties in the season.</remarks>
    [HttpGet("top-penalized")]
    public async Task<IActionResult> GetTopPenalized(int seasonId)
    {
        var result = await _rosterStats.GetTopPenaltyPlayerAsync(seasonId);
        if (result == null) return NoContent();
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/roster-scorers</summary>
    /// <remarks>Returns all roster players sorted by goals scored descending for the season.</remarks>
    [HttpGet("roster-scorers")]
    public async Task<IActionResult> GetRosterScorers(int seasonId)
    {
        var result = await _rosterStats.GetAllGoalScorersAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/roster-penalized</summary>
    /// <remarks>Returns all roster players sorted by penalties taken descending for the season.</remarks>
    [HttpGet("roster-penalized")]
    public async Task<IActionResult> GetRosterPenalized(int seasonId)
    {
        var result = await _rosterStats.GetAllPenaltyPlayersAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/user-totals</summary>
    /// <remarks>Returns per-user total goals and penalties for a season.</remarks>
    [HttpGet("user-totals")]
    public async Task<IActionResult> GetUserTotals(int seasonId)
    {
        var result = await _seasonStats.GetUserSeasonTotalsAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/plus-minus-trend-weekly</summary>
    /// <remarks>Returns per-user plus/minus per week. Backfills from previous season when current season has few weeks.</remarks>
    [HttpGet("plus-minus-trend-weekly")]
    public async Task<IActionResult> GetWeeklyPlusMinusTrend(int seasonId)
    {
        var result = await _matchStats.GetWeeklyPlusMinusTrendAsync(seasonId);
        return Ok(result);
    }
}

// ─── Global stats endpoint ────────────────────────────────────────────────────

[ApiController]
[Route("api/stats")]
public class StatsController : ControllerBase
{
    private readonly IStatsService _stats;
    private readonly IEarningsService _earnings;
    private readonly IMatchStatsService _matchStats;
    private readonly IAchievementService _achievements;

    public StatsController(
        IStatsService stats,
        IEarningsService earnings,
        IMatchStatsService matchStats,
        IAchievementService achievements)
    {
        _stats = stats;
        _earnings = earnings;
        _matchStats = matchStats;
        _achievements = achievements;
    }

    /// <summary>GET /api/stats/earnings-by-season</summary>
    /// <remarks>
    /// Returns per-user earnings broken down by season for stacked chart display.
    /// </remarks>
    [HttpGet("earnings-by-season")]
    public async Task<IActionResult> GetEarningsBySeason()
    {
        var result = await _earnings.GetEarningsBySeasonAsync();
        return Ok(result);
    }

    /// <summary>GET /api/stats/users/{userId}/point-reasons</summary>
    /// <remarks>
    /// Returns a user's point-reason breakdown (points grouped by reason).
    /// Optionally filtered by season via query parameter.
    /// If no seasonId provided, aggregates across all seasons.
    /// </remarks>
    [HttpGet("users/{userId:int}/point-reasons")]
    public async Task<IActionResult> GetUserPointReasonBreakdown(int userId, [FromQuery] int? seasonId = null)
    {
        var result = await _matchStats.GetUserPointReasonBreakdownAsync(userId, seasonId);
        if (result == null) return NotFound();
        return Ok(result);
    }

    /// <summary>GET /api/stats/head-to-head/{teamId}?hostedTeamId={hostedTeamId}</summary>
    /// <remarks>
    /// Returns all played matches (MatchDate != null) where the given team appeared
    /// within seasons whose HostedTeamId matches the required hostedTeamId query param.
    /// Results are ordered newest first and include per-user +/− totals.
    /// </remarks>
    [HttpGet("head-to-head/{teamId:int}")]
    public async Task<IActionResult> GetHeadToHead(int teamId, [FromQuery] int hostedTeamId)
    {
        var result = await _matchStats.GetHeadToHeadAsync(teamId, hostedTeamId);
        return Ok(result);
    }

    /// <summary>GET /api/stats/users/{userId}/match-history</summary>
    /// <remarks>
    /// Returns per-match summary for a user ordered by MatchDate ascending.
    /// Opponent is resolved via Season.HostedTeamId.
    /// Optionally filtered by seasonId query parameter.
    /// </remarks>
    [HttpGet("users/{userId:int}/match-history")]
    public async Task<IActionResult> GetUserMatchHistory(int userId, [FromQuery] int? seasonId = null)
    {
        var result = await _matchStats.GetUserMatchHistoryAsync(userId, seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/stats/dashboard</summary>
    /// <remarks>
    /// Returns consolidated dashboard data including season stats, earnings, trends, and roster statistics.
    /// </remarks>
    [HttpGet("dashboard")]
    public async Task<IActionResult> GetDashboardData()
    {
        var result = await _stats.GetDashboardDataAsync();
        return Ok(result);
    }

    /// <summary>
    /// GET /api/stats/season
    /// Returns total season stats including total goals, penalties, matches, earnings and top roster players for a season.
    /// </summary>
    [HttpGet("season")]
    public async Task<IActionResult> GetSeasonTotals()
    {
        var result = await _stats.GetSeasonTotalsAsync();
        return Ok(result);
    }

    /// <summary>GET /api/stats/users/{userId}/achievements</summary>
    /// <remarks>Returns all 27 achievements for a user with full occurrence context.</remarks>
    [HttpGet("users/{userId:int}/achievements")]
    public async Task<IActionResult> GetUserAchievements(int userId)
        => Ok(await _achievements.GetUserAchievementsAsync(userId));

    [HttpGet("financial-stats")]
    public async Task<IActionResult> GetFinancialStats()
    {
        var result = await _earnings.GetFinancialStatsAsync();
        return Ok(result);
    }

    /// <summary>GET /api/stats/earnings</summary>
    /// <remarks>Returns all-time earnings summary: per-user totals, total collected, total expenses, and balance.</remarks>
    [HttpGet("earnings")]
    public async Task<IActionResult> GetEarningsSummary()
    {
        var result = await _earnings.GetEarningsSummaryAsync();
        return Ok(result);
    }
}
