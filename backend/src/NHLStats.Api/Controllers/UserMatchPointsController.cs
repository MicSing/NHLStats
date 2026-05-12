using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/usermatches/{userMatchId:int}/points")]
public class UserMatchPointsController : ControllerBase
{
    private readonly IUserMatchService _service;

    public UserMatchPointsController(IUserMatchService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll(int userMatchId) =>
        Ok(await _service.GetPointsAsync(userMatchId));

    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> Add(int userMatchId, CreateUserMatchPointDto dto)
    {
        var (result, error) = await _service.AddPointAsync(userMatchId, dto);
        if (error != null) return BadRequest(new { error });
        return CreatedAtAction(nameof(GetAll), new { userMatchId }, result);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{pointId:int}")]
    public async Task<IActionResult> Update(int userMatchId, int pointId, UpdateUserMatchPointDto dto)
    {
        var (result, error) = await _service.UpdatePointAsync(userMatchId, pointId, dto);
        if (error != null) return BadRequest(new { error });
        if (result == null) return NotFound();
        return Ok(result);
    }

    [Authorize(Roles = "Admin")]
    [HttpDelete("{pointId:int}")]
    public async Task<IActionResult> Delete(int userMatchId, int pointId)
    {
        var deleted = await _service.DeletePointAsync(userMatchId, pointId);
        if (!deleted) return NotFound();
        return NoContent();
    }
}
