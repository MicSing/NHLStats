using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PointReasonsController : ControllerBase
{
    private readonly IPointReasonService _service;

    public PointReasonsController(IPointReasonService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool activeOnly = false) =>
        Ok(await _service.GetAllAsync(activeOnly));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var reason = await _service.GetByIdAsync(id);
        return reason == null ? NotFound() : Ok(reason);
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create(CreatePointReasonDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var created = await _service.CreateAsync(dto);
        return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
    }

    [Authorize]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdatePointReasonDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var updated = await _service.UpdateAsync(id, dto);
        return updated == null ? NotFound() : Ok(updated);
    }

    [Authorize]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var success = await _service.DeleteOrDeactivateAsync(id);
        return success ? NoContent() : NotFound();
    }
}
