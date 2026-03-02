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
