using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/usermatches/{userMatchId:int}/penalties")]
public class UserMatchPenaltiesController : ControllerBase
{
    private readonly IUserMatchService _service;

    public UserMatchPenaltiesController(IUserMatchService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll(int userMatchId) =>
        Ok(await _service.GetPenaltiesAsync(userMatchId));

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Add(int userMatchId, CreateUserMatchPenaltyDto dto)
    {
        var (result, error) = await _service.AddPenaltyAsync(userMatchId, dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetAll), new { userMatchId }, result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{penaltyId:int}")]
    public async Task<IActionResult> Update(int userMatchId, int penaltyId, UpdateUserMatchPenaltyDto dto)
    {
        var (result, error) = await _service.UpdatePenaltyAsync(userMatchId, penaltyId, dto);
        if (error != null) return BadRequest(new { error });
        if (result == null) return NotFound();
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{penaltyId:int}")]
    public async Task<IActionResult> Delete(int userMatchId, int penaltyId)
    {
        var deleted = await _service.DeletePenaltyAsync(userMatchId, penaltyId);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
