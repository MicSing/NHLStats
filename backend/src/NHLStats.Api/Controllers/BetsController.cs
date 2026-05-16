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

    // GET /api/betting/bets/active
    [HttpGet("api/betting/bets/active")]
    public async Task<IActionResult> GetActive()
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();
        var bets = await _betService.GetActiveAsync(loginId);
        return Ok(bets);
    }

    // GET /api/betting/bets/history
    [HttpGet("api/betting/bets/history")]
    public async Task<IActionResult> GetHistory([FromQuery] int? seasonId)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();
        var bets = await _betService.GetHistoryAsync(loginId, seasonId);
        return Ok(bets);
    }

    // GET /api/betting/bets/all
    [HttpGet("api/betting/bets/all")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var loginId = GetLoginId();
        var bets = await _betService.GetAllBetsAsync(loginId);
        return Ok(bets);
    }

    // POST /api/betting/bets
    [HttpPost("api/betting/bets")]
    public async Task<IActionResult> PlaceBet([FromBody] CreateBetDto dto)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();
        var (bet, error) = await _betService.PlaceBetAsync(loginId, dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetActive), null, bet);
    }

    // DELETE /api/betting/bets/{betId}
    [HttpDelete("api/betting/bets/{betId:guid}")]
    public async Task<IActionResult> CancelBet(Guid betId)
    {
        var loginId = GetLoginId();
        if (loginId == null) return Unauthorized();
        var (success, error) = await _betService.CancelBetAsync(betId, loginId);
        if (!success && error == "Bet not found.") return NotFound(new { error });
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
