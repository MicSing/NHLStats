using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/payouts")]
public class AllPayoutsController : ControllerBase
{
    private readonly IUserPayoutService _service;

    public AllPayoutsController(IUserPayoutService service) => _service = service;

    /// <summary>GET /api/payouts — all payouts across all seasons</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _service.GetAllAsync();
        return Ok(result);
    }
}

[ApiController]
[Route("api/seasons/{seasonId:int}/payouts")]
public class UserPayoutsController : ControllerBase
{
    private readonly IUserPayoutService _service;

    public UserPayoutsController(IUserPayoutService service) => _service = service;

    /// <summary>GET /api/seasons/{seasonId}/payouts</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(int seasonId)
    {
        var result = await _service.GetBySeasonAsync(seasonId);
        return Ok(result);
    }

    /// <summary>POST /api/seasons/{seasonId}/payouts</summary>
    [HttpPost]
    [Authorize]
    public async Task<IActionResult> Create(int seasonId, [FromBody] CreateUserPayoutDto dto)
    {
        var result = await _service.CreateAsync(seasonId, dto);
        return CreatedAtAction(nameof(GetAll), new { seasonId }, result);
    }

    /// <summary>PUT /api/seasons/{seasonId}/payouts/{id}</summary>
    [HttpPut("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Update(int seasonId, int id, [FromBody] UpdateUserPayoutDto dto)
    {
        var result = await _service.UpdateAsync(seasonId, id, dto);
        if (result == null) return NotFound();
        return Ok(result);
    }

    /// <summary>DELETE /api/seasons/{seasonId}/payouts/{id}</summary>
    [HttpDelete("{id:int}")]
    [Authorize]
    public async Task<IActionResult> Delete(int seasonId, int id)
    {
        var deleted = await _service.DeleteAsync(seasonId, id);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
