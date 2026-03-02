using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MoneyConfigController : ControllerBase
{
    private readonly IMoneyConfigService _service;

    public MoneyConfigController(IMoneyConfigService service) => _service = service;

    [HttpGet("current")]
    public async Task<IActionResult> GetCurrent()
    {
        var config = await _service.GetCurrentAsync();
        return config == null ? NotFound() : Ok(config);
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory() =>
        Ok(await _service.GetHistoryAsync());

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create(CreateMoneyConfigDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var (config, error) = await _service.CreateAsync(dto);
        if (error != null) return UnprocessableEntity(new { error });
        return CreatedAtAction(nameof(GetCurrent), config);
    }
}
