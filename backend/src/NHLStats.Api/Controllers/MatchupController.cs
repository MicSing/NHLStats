using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/matches/{matchId:int}/matchup")]
public class MatchupController : ControllerBase
{
    private readonly IMatchupService _service;

    public MatchupController(IMatchupService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get(int matchId)
    {
        var result = await _service.GetForMatchAsync(matchId);
        return result == null ? NotFound() : Ok(result);
    }
}
