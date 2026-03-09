using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/seasons/{seasonId:int}/matches")]
public class MatchesController : ControllerBase
{
    private readonly IMatchService _service;

    public MatchesController(IMatchService service) => _service = service;

    [HttpGet("/api/matches/future")]
    public async Task<IActionResult> GetFuture([FromQuery] int count = 10)
    {
        var loginId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Ok(await _service.GetFutureMatchesAsync(count, loginId));
    }

    [HttpGet]
    public async Task<IActionResult> GetBySeason(int seasonId) =>
        Ok(await _service.GetBySeasonAsync(seasonId));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int seasonId, int id)
    {
        var match = await _service.GetByIdAsync(id);
        if (match == null || match.SeasonId != seasonId) return NotFound();
        return Ok(match);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create(int seasonId, CreateMatchDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _service.CreateAsync(seasonId, dto);
        return CreatedAtAction(nameof(GetById), new { seasonId, id = created.Id }, created);
    }

    [Authorize]
    [HttpPost("batch")]
    public async Task<IActionResult> BatchCreate(int seasonId, BatchCreateMatchDto[] dtos)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        try
        {
            var created = await _service.BatchCreateAsync(seasonId, dtos);
            return Ok(created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [Authorize]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int seasonId, int id, UpdateMatchDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var updated = await _service.UpdateAsync(id, dto);
        if (updated == null || updated.SeasonId != seasonId) return NotFound();
        return Ok(updated);
    }

    [Authorize]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int seasonId, int id)
    {
        var match = await _service.GetByIdAsync(id);
        if (match == null || match.SeasonId != seasonId) return NotFound();
        await _service.DeleteAsync(id);
        return NoContent();
    }
}
