using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/team-stats")]
public class TeamStatsController : ControllerBase
{
    private readonly ITeamStatsService _teamStats;

    public TeamStatsController(ITeamStatsService teamStats)
    {
        _teamStats = teamStats;
    }

    /// <summary>GET /api/team-stats/hosted-teams</summary>
    /// <remarks>Returns distinct teams that have been the hosted team across all seasons.</remarks>
    [HttpGet("hosted-teams")]
    public async Task<IActionResult> GetHostedTeams()
    {
        var result = await _teamStats.GetHostedTeamOptionsAsync();
        return Ok(result);
    }

    /// <summary>GET /api/team-stats/opponents?hostedTeamId={id}</summary>
    /// <remarks>Returns distinct opponent teams played against by the given hosted team.</remarks>
    [HttpGet("opponents")]
    public async Task<IActionResult> GetOpponents([FromQuery] int hostedTeamId)
    {
        var result = await _teamStats.GetOpponentOptionsAsync(hostedTeamId);
        return Ok(result);
    }

    /// <summary>GET /api/team-stats/summary?hostedTeamId={id}&amp;opponentTeamId={id}</summary>
    /// <remarks>Returns aggregated stats for all matches between the hosted team and the opponent team.</remarks>
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int hostedTeamId, [FromQuery] int opponentTeamId)
    {
        var result = await _teamStats.GetTeamStatsAsync(hostedTeamId, opponentTeamId);
        return Ok(result);
    }

    /// <summary>GET /api/team-stats/matches?hostedTeamId={id}&amp;opponentTeamId={id}</summary>
    /// <remarks>Returns all played matches between the hosted team and the opponent team, newest first.</remarks>
    [HttpGet("matches")]
    public async Task<IActionResult> GetMatches([FromQuery] int hostedTeamId, [FromQuery] int opponentTeamId)
    {
        var result = await _teamStats.GetMatchesAsync(hostedTeamId, opponentTeamId);
        return Ok(result);
    }
}
