using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/seasons/{seasonId:int}/roster")]
public class RosterController : ControllerBase
{
    private readonly IRosterPlayerService _service;

    public RosterController(IRosterPlayerService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetBySeason(int seasonId) =>
        Ok(await _service.GetBySeasonAsync(seasonId));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int seasonId, int id)
    {
        var player = await _service.GetByIdAsync(id);
        if (player == null || player.SeasonId != seasonId) return NotFound();
        return Ok(player);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create(int seasonId, CreateRosterPlayerDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _service.CreateAsync(seasonId, dto);
        return CreatedAtAction(nameof(GetById), new { seasonId, id = created.Id }, created);
    }

    [Authorize]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int seasonId, int id, UpdateRosterPlayerDto dto)
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
        var player = await _service.GetByIdAsync(id);
        if (player == null || player.SeasonId != seasonId) return NotFound();
        await _service.DeleteAsync(id);
        return NoContent();
    }

    /// <summary>
    /// Import roster players from CSV content.
    /// Format: FirstName,Surname,Position,TeamShortName (one row per player, optional header)
    /// </summary>
    [Authorize]
    [HttpPost("import")]
    public async Task<IActionResult> ImportCsv(int seasonId, [FromBody] CsvImportRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.CsvContent))
            return BadRequest("CsvContent is required.");

        var result = await _service.ImportFromCsvAsync(seasonId, request.CsvContent);
        return Ok(result);
    }

    /// <summary>
    /// Copy all roster players from sourceSeasonId into this season.
    /// </summary>
    [Authorize]
    [HttpPost("copy/{sourceSeasonId:int}")]
    public async Task<IActionResult> CopyFromSeason(int seasonId, int sourceSeasonId)
    {
        var (players, error) = await _service.CopyFromSeasonAsync(seasonId, sourceSeasonId);
        if (error != null) return BadRequest(new { error });
        return Ok(players);
    }
}

public record CsvImportRequestDto(string CsvContent);
