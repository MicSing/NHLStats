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
    private readonly IRealSeasonMatchImportService _importService;

    public MatchesController(IMatchService service, IRealSeasonMatchImportService importService)
    {
        _service = service;
        _importService = importService;
    }

    [HttpGet("/api/matches/future")]
    public async Task<IActionResult> GetFuture([FromQuery] int count = 10)
    {
        var loginId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(JwtRegisteredClaimNames.Sub);
        return Ok(await _service.GetFutureMatchesAsync(count, loginId));
    }

    [HttpGet]
    public async Task<IActionResult> GetBySeason(int seasonId) =>
        Ok(await _service.GetBySeasonAsync(seasonId));

    [Authorize(Roles = "Admin")]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int seasonId, int id)
    {
        var match = await _service.GetByIdAsync(id);
        if (match == null || match.SeasonId != seasonId) return NotFound();
        return Ok(match);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Create(int seasonId, CreateMatchDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _service.CreateAsync(seasonId, dto);
        return CreatedAtAction(nameof(GetById), new { seasonId, id = created.Id }, created);
    }

    [Authorize(Roles = "Admin")]
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

    /// <summary>
    /// Import the real, planned games for this season's NHL year from the NHL's public
    /// schedule (only meaningful for a season whose NhlYear is set).
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("import-real-season")]
    public async Task<IActionResult> ImportRealSeason(int seasonId)
    {
        var (result, error) = await _importService.ImportAsync(seasonId);
        if (error != null) return BadRequest(new { error });
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("playoff-series")]
    public async Task<IActionResult> CreatePlayoffSeries(int seasonId, CreatePlayoffSeriesDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        try
        {
            var created = await _service.CreatePlayoffSeriesAsync(seasonId, dto);
            return Ok(created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("playoff-status")]
    public async Task<IActionResult> GetPlayoffStatus(int seasonId) =>
        Ok(await _service.GetPlayoffStatusAsync(seasonId));

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int seasonId, int id, UpdateMatchDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        try
        {
            var updated = await _service.UpdateAsync(id, dto);
            if (updated == null || updated.SeasonId != seasonId) return NotFound();
            return Ok(updated);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [Authorize(Roles = "Admin")]
    [HttpPost("{id:int}/reset")]
    public async Task<IActionResult> Reset(int seasonId, int id)
    {
        var existing = await _service.GetByIdAsync(id);
        if (existing == null || existing.SeasonId != seasonId) return NotFound();
        var reset = await _service.ResetAsync(id);
        return Ok(reset);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int seasonId, int id)
    {
        var match = await _service.GetByIdAsync(id);
        if (match == null || match.SeasonId != seasonId) return NotFound();
        await _service.DeleteAsync(id);
        return NoContent();
    }
}
