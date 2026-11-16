using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Api.Authentication;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

/// <summary>
/// Endpoints for machine clients (the Collector app), authenticated by the X-Api-Key header.
/// Events submitted here are only proposals: an admin confirms or rejects them.
/// </summary>
[ApiController]
[Authorize(AuthenticationSchemes = ApiKeyAuthenticationHandler.SchemeName, Roles = ApiKeyAuthenticationHandler.CollectorRole)]
[Route("api/ingest")]
public class IngestController : ControllerBase
{
    private readonly IMatchEventProposalService _service;

    public IngestController(IMatchEventProposalService service) => _service = service;

    private int ApiKeyId => int.Parse(User.FindFirst(ApiKeyAuthenticationHandler.ApiKeyIdClaim)!.Value);

    /// <summary>Lets the client check its key and see which key it is.</summary>
    [HttpGet("whoami")]
    public IActionResult WhoAmI() => Ok(new { apiKeyId = ApiKeyId, name = User.Identity?.Name });

    /// <summary>Matches of active seasons that are not finished yet.</summary>
    [HttpGet("matches")]
    public async Task<IActionResult> GetOpenMatches() => Ok(await _service.GetOpenMatchesAsync());

    /// <summary>Users (with positions) and the hosted team's roster for a match.</summary>
    [HttpGet("matches/{matchId:int}/context")]
    public async Task<IActionResult> GetContext(int matchId)
    {
        var context = await _service.GetContextAsync(matchId);
        return context == null ? NotFound() : Ok(context);
    }

    /// <summary>Submits a batch of event proposals; idempotent per ClientEventId.</summary>
    [HttpPost("matches/{matchId:int}/events")]
    public async Task<IActionResult> SubmitEvents(int matchId, IngestEventBatchDto dto)
    {
        var (results, error) = await _service.SubmitAsync(matchId, ApiKeyId, dto.Events ?? []);
        if (error != null) return error.Contains("not found") ? NotFound(new { error }) : BadRequest(new { error });
        return Ok(new { results });
    }

    /// <summary>Proposals for a match with their review status.</summary>
    [HttpGet("matches/{matchId:int}/events")]
    public async Task<IActionResult> GetEvents(int matchId) =>
        Ok(await _service.GetByMatchAsync(matchId));
}
