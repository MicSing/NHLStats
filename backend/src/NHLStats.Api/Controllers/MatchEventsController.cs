using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/matches/{matchId:int}/events")]
public class MatchEventsController : ControllerBase
{
    private readonly IMatchEventService _service;

    public MatchEventsController(IMatchEventService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll(int matchId) =>
        Ok(await _service.GetEventsByMatchAsync(matchId));

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Add(int matchId, CreateTeamMatchEventDto dto)
    {
        var (result, error) = await _service.AddEventAsync(matchId, dto);
        if (error != null) return BadRequest(new { error });
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("reorder")]
    public async Task<IActionResult> Reorder(int matchId, ReorderMatchEventsDto dto)
    {
        var (success, error) = await _service.ReorderEventsAsync(matchId, dto.EventIds);
        if (!success) return BadRequest(new { error });
        return Ok(new { success = true });
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{eventId:int}")]
    public async Task<IActionResult> Delete(int matchId, int eventId)
    {
        var deleted = await _service.DeleteEventAsync(matchId, eventId);
        if (!deleted) return NotFound();
        return NoContent();
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("end-shootout")]
    public async Task<IActionResult> EndShootout(int matchId)
    {
        var (match, error) = await _service.EndShootoutAsync(matchId);
        if (error != null) return BadRequest(new { error });
        return Ok(match);
    }
}
