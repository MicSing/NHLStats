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
    private readonly IBetService _betService;
    private readonly IBettingBalanceService _balanceService;
    private readonly IBettingOddsService _oddsService;

    public BetsController(IBetService betService, IBettingBalanceService balanceService, IBettingOddsService oddsService)
    {
        _betService = betService;
        _balanceService = balanceService;
        _oddsService = oddsService;
    }

    // GET /api/betting/balance
    [HttpGet("api/betting/balance")]
    public async Task<IActionResult> GetBalance()
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();
        var balance = await _balanceService.GetBalanceAsync(loginId);
        return Ok(balance);
    }

    // GET /api/betting/matches/{matchId}/odds
    [HttpGet("api/betting/matches/{matchId:int}/odds")]
    public async Task<IActionResult> GetMatchOdds(int matchId)
    {
        var odds = await _oddsService.GetMatchOddsAsync(matchId);
        return odds == null ? NotFound() : Ok(odds);
    }

    // GET /api/betting/history
    [HttpGet("api/betting/history")]
    public async Task<IActionResult> GetHistory([FromQuery] int? seasonId)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();
        var history = await _betService.GetHistoryAsync(loginId, seasonId);
        return Ok(history);
    }

    // GET /api/betting/matches/{matchId}/bet
    [HttpGet("api/betting/matches/{matchId:int}/bet")]
    public async Task<IActionResult> GetForMatch(int matchId)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();
        var bet = await _betService.GetForMatchAsync(matchId, loginId);
        return bet == null ? NotFound() : Ok(bet);
    }

    // POST /api/betting/matches/{matchId}/bet
    [HttpPost("api/betting/matches/{matchId:int}/bet")]
    public async Task<IActionResult> PlaceBet(int matchId, [FromBody] CreateBetDto dto)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();
        var (bet, error) = await _betService.PlaceBetAsync(matchId, loginId, dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetForMatch), new { matchId }, bet);
    }

    // PUT /api/betting/matches/{matchId}/bet
    [HttpPut("api/betting/matches/{matchId:int}/bet")]
    public async Task<IActionResult> UpdateBet(int matchId, [FromBody] UpdateBetDto dto)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();
        var (bet, error) = await _betService.UpdateBetAsync(matchId, loginId, dto);
        if (error == "Bet not found for this match.") return NotFound(new { error });
        if (error != null) return BadRequest(new { error });
        return Ok(bet);
    }

    // DELETE /api/betting/matches/{matchId}/bet
    [HttpDelete("api/betting/matches/{matchId:int}/bet")]
    public async Task<IActionResult> CancelBet(int matchId)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();
        var (success, error) = await _betService.CancelBetAsync(matchId, loginId);
        if (!success && error == "Bet not found for this match.") return NotFound(new { error });
        if (!success) return BadRequest(new { error });
        return NoContent();
    }

    // POST /api/admin/matches/{matchId}/re-evaluate-bets (admin only)
    [HttpPost("api/admin/matches/{matchId:int}/re-evaluate-bets")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ReEvaluateBets(int matchId)
    {
        await _betService.EvaluateMatchBetsAsync(matchId);
        return Ok(new { message = "Bets re-evaluated." });
    }

    private string? GetLoginId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ??
        User.FindFirstValue(JwtRegisteredClaimNames.Sub);
}
