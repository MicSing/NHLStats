using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

/// <summary>
/// Handles UserMatch creation, retrieval, deletion and bulk initialization.
/// Routes live under two prefixes:
///   api/seasons/{seasonId}/matches/{matchId}/usermatches  — match-scoped
///   api/seasons/{seasonId}/usermatches                    — aggregated (MatchId = null)
///   api/usermatches/{id}                                  — individual resource
/// </summary>
[ApiController]
public class UserMatchesController : ControllerBase
{
    private readonly IUserMatchService _service;

    public UserMatchesController(IUserMatchService service) => _service = service;

    // ── GET api/seasons/{seasonId}/matches/{matchId}/usermatches ─────────────

    [HttpGet("api/seasons/{seasonId:int}/matches/{matchId:int}/usermatches")]
    public async Task<IActionResult> GetByMatch(int seasonId, int matchId) =>
        Ok(await _service.GetByMatchAsync(matchId));

    // ── POST api/seasons/{seasonId}/matches/{matchId}/usermatches ────────────

    [Authorize]
    [HttpPost("api/seasons/{seasonId:int}/matches/{matchId:int}/usermatches")]
    public async Task<IActionResult> CreateForMatch(
        int seasonId, int matchId, CreateUserMatchDto dto)
    {
        var (result, error) = await _service.CreateForMatchAsync(seasonId, matchId, dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetById), new { id = result!.Id }, result);
    }

    // ── POST api/seasons/{seasonId}/matches/{matchId}/usermatches/initialize ─

    [Authorize]
    [HttpPost("api/seasons/{seasonId:int}/matches/{matchId:int}/usermatches/initialize")]
    public async Task<IActionResult> InitializeUsers(int seasonId, int matchId)
    {
        var (created, error) = await _service.InitializeUsersForMatchAsync(seasonId, matchId);
        if (error != null) return BadRequest(new { error });
        return Ok(new { created });
    }

    // ── GET api/seasons/{seasonId}/usermatches ───────────────────────────────

    [HttpGet("api/seasons/{seasonId:int}/usermatches")]
    public async Task<IActionResult> GetAggregatedBySeason(int seasonId) =>
        Ok(await _service.GetAggregatedBySeasonAsync(seasonId));

    // ── POST api/seasons/{seasonId}/usermatches ──────────────────────────────

    [Authorize]
    [HttpPost("api/seasons/{seasonId:int}/usermatches")]
    public async Task<IActionResult> CreateAggregated(int seasonId, CreateUserMatchDto dto)
    {
        var (result, error) = await _service.CreateAggregatedAsync(seasonId, dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetById), new { id = result!.Id }, result);
    }

    // ── GET api/usermatches/{id} ─────────────────────────────────────────────

    [HttpGet("api/usermatches/{id:int}", Name = "GetUserMatchById")]
    public async Task<IActionResult> GetById(int id)
    {
        var um = await _service.GetByIdAsync(id);
        if (um == null) return NotFound();
        return Ok(um);
    }

    // ── DELETE api/usermatches/{id} ──────────────────────────────────────────

    [Authorize]
    [HttpDelete("api/usermatches/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _service.DeleteAsync(id);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
