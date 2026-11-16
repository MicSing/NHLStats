using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

/// <summary>Ring colour per user position, used by the Collector to tell users apart on screen.</summary>
[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/position-colors")]
public class PositionColorsController : ControllerBase
{
    private readonly IPositionColorService _service;

    public PositionColorsController(IPositionColorService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    [HttpPut]
    public async Task<IActionResult> Update(UpdatePositionColorsDto dto)
    {
        var (colors, error) = await _service.UpdateAsync(dto);
        return error != null ? BadRequest(new { error }) : Ok(colors);
    }
}
