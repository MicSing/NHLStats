using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

// ─── Season-scoped stats endpoints ───────────────────────────────────────────
// All routes under /api/seasons/{seasonId}/stats

[ApiController]
[Route("api/seasons/{seasonId:int}/stats")]
public class SeasonStatsController : ControllerBase
{
    private readonly IStatsService _stats;

    public SeasonStatsController(IStatsService stats) => _stats = stats;

    /// <summary>GET /api/seasons/{seasonId}/stats</summary>
    /// <remarks>Returns per-user TotalPlus, TotalMinus and calculated Earnings for the season.</remarks>
    [HttpGet]
    public async Task<IActionResult> GetSeasonStats(int seasonId)
    {
        var result = await _stats.GetSeasonStatsAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/weekly</summary>
    /// <remarks>Returns all matches in the season grouped by sequential week number.</remarks>
    [HttpGet("weekly")]
    public async Task<IActionResult> GetWeekly(int seasonId)
    {
        var result = await _stats.GetMatchesGroupedByWeekAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/top-scorers</summary>
    /// <remarks>Returns the roster player with the most goals in the season.</remarks>
    [HttpGet("top-scorers")]
    public async Task<IActionResult> GetTopScorers(int seasonId)
    {
        var result = await _stats.GetTopGoalScorerAsync(seasonId);
        if (result == null) return NoContent();
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/top-penalized</summary>
    /// <remarks>Returns the roster player with the most penalties in the season.</remarks>
    [HttpGet("top-penalized")]
    public async Task<IActionResult> GetTopPenalized(int seasonId)
    {
        var result = await _stats.GetTopPenaltyPlayerAsync(seasonId);
        if (result == null) return NoContent();
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/roster-scorers</summary>
    /// <remarks>Returns all roster players sorted by goals scored descending for the season.</remarks>
    [HttpGet("roster-scorers")]
    public async Task<IActionResult> GetRosterScorers(int seasonId)
    {
        var result = await _stats.GetAllGoalScorersAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/roster-scorers-by-user</summary>
    /// <remarks>Returns all roster players sorted by goals scored descending, with per-user goal counts.</remarks>
    [HttpGet("roster-scorers-by-user")]
    public async Task<IActionResult> GetRosterScorersByUser(int seasonId)
    {
        var result = await _stats.GetAllGoalScorersByUserAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/roster-penalized</summary>
    /// <remarks>Returns all roster players sorted by penalties taken descending for the season.</remarks>
    [HttpGet("roster-penalized")]
    public async Task<IActionResult> GetRosterPenalized(int seasonId)
    {
        var result = await _stats.GetAllPenaltyPlayersAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/roster-penalized-by-user</summary>
    /// <remarks>Returns all roster players sorted by penalties taken descending, with per-user penalty counts.</remarks>
    [HttpGet("roster-penalized-by-user")]
    public async Task<IActionResult> GetRosterPenalizedByUser(int seasonId)
    {
        var result = await _stats.GetAllPenaltyPlayersByUserAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/user-totals</summary>
    /// <remarks>Returns per-user total goals and penalties for a season.</remarks>
    [HttpGet("user-totals")]
    public async Task<IActionResult> GetUserTotals(int seasonId)
    {
        var result = await _stats.GetUserSeasonTotalsAsync(seasonId);
        return Ok(result);
    }

    /// <summary>GET /api/seasons/{seasonId}/stats/plus-minus-trend-weekly</summary>
    /// <remarks>Returns per-user plus/minus per week. Backfills from previous season when current season has few weeks.</remarks>
    [HttpGet("plus-minus-trend-weekly")]
    public async Task<IActionResult> GetWeeklyPlusMinusTrend(int seasonId)
    {
        var result = await _stats.GetWeeklyPlusMinusTrendAsync(seasonId);
        return Ok(result);
    }
}

// ─── Global stats endpoint ────────────────────────────────────────────────────

[ApiController]
[Route("api/stats")]
public class StatsController : ControllerBase
{
    private readonly IStatsService _stats;

    public StatsController(IStatsService stats) => _stats = stats;

    /// <summary>GET /api/stats/plus-minus</summary>
    /// <remarks>Returns per-user aggregated TotalPlus, TotalMinus and Earnings across all seasons.</remarks>
    [HttpGet("plus-minus")]
    public async Task<IActionResult> GetAllSeasonsPlusMinus()
    {
        var result = await _stats.GetAllSeasonsStatsAsync();
        return Ok(result);
    }

    /// <summary>GET /api/stats/plus-minus-trend</summary>
    /// <remarks>Returns plus/minus net per user per season for trend charting.</remarks>
    [HttpGet("plus-minus-trend")]
    public async Task<IActionResult> GetPlusMinusTrend()
    {
        var result = await _stats.GetPlusMinusTrendAsync();
        return Ok(result);
    }

    /// <summary>GET /api/stats/earnings</summary>
    /// <remarks>
    /// Returns all-time earnings per user across every season, plus total collected,
    /// total expenses, and the remaining balance.
    /// </remarks>
    [HttpGet("earnings")]
    public async Task<IActionResult> GetEarnings()
    {
        var result = await _stats.GetAllTimeEarningsAsync();
        return Ok(result);
    }

    /// <summary>GET /api/stats/earnings-by-season</summary>
    /// <remarks>
    /// Returns per-user earnings broken down by season for stacked chart display.
    /// </remarks>
    [HttpGet("earnings-by-season")]
    public async Task<IActionResult> GetEarningsBySeason()
    {
        var result = await _stats.GetEarningsBySeasonAsync();
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
        var result = await _stats.GetUserPointReasonBreakdownAsync(userId, seasonId);
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
        var result = await _stats.GetHeadToHeadAsync(teamId, hostedTeamId);
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
        var result = await _stats.GetUserMatchHistoryAsync(userId, seasonId);
        return Ok(result);
    }
}
