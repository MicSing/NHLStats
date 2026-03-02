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
}

// ─── Global stats endpoint ────────────────────────────────────────────────────

[ApiController]
[Route("api/stats")]
public class StatsController : ControllerBase
{
    private readonly IStatsService _stats;

    public StatsController(IStatsService stats) => _stats = stats;

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
}
