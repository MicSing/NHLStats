using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin")]
public class PointsManagementController : ControllerBase
{
    private readonly IPointManagementService _service;

    public PointsManagementController(IPointManagementService service) => _service = service;

    // GET /api/admin/points?seasonId=X&pointType=Positive|Negative&userId=Y&page=1&size=50
    [HttpGet("api/admin/points")]
    public async Task<IActionResult> GetPoints(
        [FromQuery] int? seasonId,
        [FromQuery] string? pointType,
        [FromQuery] int? userId,
        [FromQuery] int page = 1,
        [FromQuery] int size = 50)
    {
        if (page < 1) page = 1;
        if (size < 1 || size > 200) size = 50;

        var (items, total) = await _service.GetPointsPagedAsync(seasonId, pointType, userId, page, size);
        return Ok(new { items, total, page, size });
    }

    // PUT /api/admin/points/bulk
    [HttpPut("api/admin/points/bulk")]
    public async Task<IActionResult> BulkUpdate([FromBody] BulkUpdatePointsDto dto)
    {
        if (dto.Items == null || !dto.Items.Any())
            return BadRequest(new { error = "No items provided." });

        var updated = await _service.BulkUpdateAmountsAsync(dto);
        return Ok(updated);
    }

}
