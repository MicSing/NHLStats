using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

/// <summary>
/// Handles UserMatch creation, retrieval, deletion and bulk initialization.
/// Routes live under two prefixes:
///   api/seasons/{seasonId}/matches/{matchId}/usermatches  — match-scoped
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

    // ── GET api/seasons/{seasonId}/usermatches ────────────────────────────────

    [HttpGet("api/seasons/{seasonId:int}/usermatches")]
    public async Task<IActionResult> GetBySeason(int seasonId) =>
        Ok(await _service.GetBySeasonAsync(seasonId));

    // ── POST api/seasons/{seasonId}/usermatches — Deprecated ─────────────────

    [Authorize(Roles = "Admin")]
    [HttpPost("api/seasons/{seasonId:int}/usermatches")]
    public IActionResult CreateAggregatedDeprecated(int seasonId) =>
        BadRequest(new { error = "This endpoint is no longer supported. Use POST /api/seasons/{seasonId}/matches/{matchId}/usermatches instead." });

    // ── POST api/seasons/{seasonId}/matches/{matchId}/usermatches ────────────

    [Authorize(Roles = "Admin")]
    [HttpPost("api/seasons/{seasonId:int}/matches/{matchId:int}/usermatches")]
    public async Task<IActionResult> CreateForMatch(
        int seasonId, int matchId, CreateUserMatchDto dto)
    {
        var (result, error) = await _service.CreateForMatchAsync(seasonId, matchId, dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetById), new { id = result!.Id }, result);
    }

    // ── POST api/seasons/{seasonId}/matches/{matchId}/usermatches/initialize ─

    [Authorize(Roles = "Admin")]
    [HttpPost("api/seasons/{seasonId:int}/matches/{matchId:int}/usermatches/initialize")]
    public async Task<IActionResult> InitializeUsers(int seasonId, int matchId)
    {
        var (created, error) = await _service.InitializeUsersForMatchAsync(seasonId, matchId);
        if (error != null) return BadRequest(new { error });
        return Ok(new { created });
    }

    // ── Aggregated Season Data ────────────────────────────────────────────────

    [HttpPost("api/users/{userId:int}/seasons/{seasonId:int}/aggregated-data")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> CreateAggregatedData(int userId, int seasonId, CreateAggregatedSeasonDataDto dto)
    {
        var (result, error) = await _service.CreateAggregatedDataAsync(userId, seasonId, dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetAggregatedData), new { userId, seasonId }, result);
    }

    [HttpGet("api/users/{userId:int}/seasons/{seasonId:int}/aggregated-data")]
    public async Task<IActionResult> GetAggregatedData(int userId, int seasonId)
    {
        var result = await _service.GetAggregatedDataAsync(userId, seasonId);
        return Ok(result);
    }

    [HttpGet("api/seasons/{seasonId:int}/aggregated-data")]
    public async Task<IActionResult> GetAggregatedDataBySeason(int seasonId)
    {
        var result = await _service.GetAggregatedDataBySeasonAsync(seasonId);
        return Ok(result);
    }

    [HttpPut("api/users/{userId:int}/seasons/{seasonId:int}/aggregated-data")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateAggregatedData(int userId, int seasonId, UpdateAggregatedSeasonDataDto dto)
    {
        var (result, error) = await _service.UpdateAggregatedDataAsync(userId, seasonId, dto);
        if (error != null) return BadRequest(new { error });
        return Ok(result);
    }

    [HttpDelete("api/users/{userId:int}/seasons/{seasonId:int}/aggregated-data")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteAggregatedData(int userId, int seasonId)
    {
        var deleted = await _service.DeleteAggregatedDataAsync(userId, seasonId);
        if (!deleted) return NotFound();
        return NoContent();
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

    [Authorize(Roles = "Admin")]
    [HttpDelete("api/usermatches/{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _service.DeleteAsync(id);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
