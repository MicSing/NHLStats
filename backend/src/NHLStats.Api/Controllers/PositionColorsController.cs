using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

/// <summary>Ring colour per user position, used by the Collector to tell users apart on screen.</summary>
[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/position-colors")]
public class PositionColorsController : ControllerBase
{
    private readonly IPositionColorService _service;

    public PositionColorsController(IPositionColorService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpPut]
    public async Task<IActionResult> Update(UpdatePositionColorsDto dto)
    {
        var (colors, error) = await _service.UpdateAsync(dto);
        return error != null ? BadRequest(new { error }) : Ok(colors);
    }

    /// <summary>Each user's colour in a match and where it comes from (match, season or position).</summary>
    [HttpGet("/api/matches/{matchId:int}/colors")]
    public async Task<IActionResult> GetMatchColors(int matchId)
    {
        var colors = await _service.GetMatchColorsAsync(matchId);
        return colors == null ? NotFound() : Ok(colors);
    }

    /// <summary>Sets a user's colour for this match only; null goes back to the season colour.</summary>
    [HttpPut("/api/matches/{matchId:int}/users/{userId:int}/color")]
    public async Task<IActionResult> SetMatchColor(int matchId, int userId, UpdateColorDto dto)
    {
        var (colors, error) = await _service.SetMatchColorAsync(matchId, userId, dto.Color);
        if (error != null) return BadRequest(new { error });
        return colors == null ? NotFound() : Ok(colors);
    }
}
