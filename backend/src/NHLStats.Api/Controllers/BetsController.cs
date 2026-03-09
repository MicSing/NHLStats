using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Authorize]
public class BetsController : ControllerBase
{
    private readonly IBetService _service;

    public BetsController(IBetService service) => _service = service;

    [HttpGet("api/seasons/{seasonId:int}/matches/{matchId:int}/bet")]
    public async Task<IActionResult> GetForMatch(int seasonId, int matchId)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();

        var bet = await _service.GetForMatchAsync(matchId, loginId);
        return bet == null ? NotFound() : Ok(bet);
    }

    [HttpPost("api/seasons/{seasonId:int}/matches/{matchId:int}/bet")]
    public async Task<IActionResult> CreateForMatch(int seasonId, int matchId, CreateBetDto dto)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();

        var (bet, error) = await _service.CreateForMatchAsync(seasonId, matchId, loginId, dto);
        if (error != null) return BadRequest(new { error });

        return CreatedAtAction(nameof(GetForMatch), new { seasonId, matchId }, bet);
    }

    [HttpPut("api/seasons/{seasonId:int}/matches/{matchId:int}/bet")]
    public async Task<IActionResult> UpdateForMatch(int seasonId, int matchId, UpdateBetDto dto)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();

        var (bet, error) = await _service.UpdateForMatchAsync(seasonId, matchId, loginId, dto);
        if (error == "Bet not found for this match.") return NotFound(new { error });
        if (error != null) return BadRequest(new { error });

        return Ok(bet);
    }

    [HttpDelete("api/seasons/{seasonId:int}/matches/{matchId:int}/bet")]
    public async Task<IActionResult> CancelForMatch(int seasonId, int matchId)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();

        var deleted = await _service.DeleteForMatchAsync(seasonId, matchId, loginId);
        return deleted ? NoContent() : NotFound();
    }

    [HttpDelete("api/bets/{id:guid}")]
    public async Task<IActionResult> DeleteById(Guid id)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();

        var deleted = await _service.DeleteByIdAsync(id, loginId);
        return deleted ? NoContent() : NotFound();
    }

    private string? GetLoginId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ??
        User.FindFirstValue(JwtRegisteredClaimNames.Sub);
}
