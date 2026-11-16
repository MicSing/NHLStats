using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;

namespace NHLStats.Api.Controllers;

/// <summary>Admin management of API keys used by external clients such as the Collector.</summary>
[ApiController]
[Authorize(Roles = "Admin")]
[Route("api/admin/api-keys")]
public class ApiKeysController : ControllerBase
{
    private readonly IApiKeyService _service;

    public ApiKeysController(IApiKeyService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _service.GetAllAsync());

    /// <summary>Creates a key. The plaintext key is in the response only this once.</summary>
    [HttpPost]
    public async Task<IActionResult> Create(CreateApiKeyDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name) || dto.Name.Trim().Length > 100)
            return BadRequest(new { error = "Name is required (max 100 characters)." });
        return Ok(await _service.CreateAsync(dto.Name));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Revoke(int id) =>
        await _service.RevokeAsync(id) ? NoContent() : NotFound();
}
