using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/usermatches/{userMatchId:int}/goals")]
public class UserMatchGoalsController : ControllerBase
{
    private readonly IUserMatchService _service;

    public UserMatchGoalsController(IUserMatchService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll(int userMatchId) =>
        Ok(await _service.GetGoalsAsync(userMatchId));

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Add(int userMatchId, CreateUserMatchGoalDto dto)
    {
        var (result, error) = await _service.AddGoalAsync(userMatchId, dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetAll), new { userMatchId }, result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{goalId:int}")]
    public async Task<IActionResult> Update(int userMatchId, int goalId, UpdateUserMatchGoalDto dto)
    {
        var (result, error) = await _service.UpdateGoalAsync(userMatchId, goalId, dto);
        if (error != null) return BadRequest(new { error });
        if (result == null) return NotFound();
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{goalId:int}")]
    public async Task<IActionResult> Delete(int userMatchId, int goalId)
    {
        var deleted = await _service.DeleteGoalAsync(userMatchId, goalId);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
