using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SeasonsController : ControllerBase
{
    private readonly ISeasonService _service;

    public SeasonsController(ISeasonService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await _service.GetAllAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var season = await _service.GetByIdAsync(id);
        return season == null ? NotFound() : Ok(season);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create(CreateSeasonDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [Authorize]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateSeasonDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var updated = await _service.UpdateAsync(id, dto);
        return updated == null ? NotFound() : Ok(updated);
    }

    [Authorize]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var success = await _service.DeleteAsync(id);
        return success ? NoContent() : NotFound();
    }

    [HttpGet("{id:int}/users")]
    public async Task<IActionResult> GetUsers(int id)
    {
        var users = await _service.GetSeasonUsersAsync(id);
        return users == null ? NotFound() : Ok(users);
    }

    [Authorize]
    [HttpPost("{id:int}/users/{userId:int}")]
    public async Task<IActionResult> AssignUser(int id, int userId)
    {
        var result = await _service.AssignUserAsync(id, userId);
        return result == null ? NotFound() : Ok(result);
    }

    [Authorize]
    [HttpDelete("{id:int}/users/{userId:int}")]
    public async Task<IActionResult> RemoveUser(int id, int userId)
    {
        var success = await _service.RemoveUserAsync(id, userId);
        return success ? NoContent() : NotFound();
    }
}
