using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain.Entities;

namespace NHLStats.Api.Controllers;

/// <summary>Admin review of event proposals submitted by the Collector.</summary>
[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/matches/{matchId:int}/proposals")]
public class MatchEventProposalsController : ControllerBase
{
    private readonly IMatchEventProposalService _service;

    public MatchEventProposalsController(IMatchEventProposalService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll(int matchId, [FromQuery] ProposalStatus? status) =>
        Ok(await _service.GetByMatchAsync(matchId, status));

    [HttpPost("{proposalId:int}/confirm")]
    public async Task<IActionResult> Confirm(int matchId, int proposalId, [FromBody] ConfirmProposalDto? dto)
    {
        var (result, error, notFound) = await _service.ConfirmAsync(matchId, proposalId, dto ?? new ConfirmProposalDto());
        if (notFound) return NotFound();
        if (error != null) return BadRequest(new { error });
        return Ok(result);
    }

    [HttpPost("{proposalId:int}/reject")]
    public async Task<IActionResult> Reject(int matchId, int proposalId)
    {
        var (result, error, notFound) = await _service.RejectAsync(matchId, proposalId);
        if (notFound) return NotFound();
        if (error != null) return BadRequest(new { error });
        return Ok(result);
    }
}
