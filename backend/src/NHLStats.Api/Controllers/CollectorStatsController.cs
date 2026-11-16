using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

/// <summary>Statistics recorded through the Collector (goals, assists, canadian points, fights). No money involved.</summary>
[ApiController]
[Route("api/seasons/{seasonId:int}/collector-stats")]
public class CollectorStatsController : ControllerBase
{
    private readonly IMatchEventProposalService _service;

    public CollectorStatsController(IMatchEventProposalService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> Get(int seasonId) => Ok(await _service.GetSeasonStatsAsync(seasonId));
}
