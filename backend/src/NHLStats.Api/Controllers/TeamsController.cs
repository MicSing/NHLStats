using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TeamsController : ControllerBase
{
    private readonly NhlStatsDbContext _db;

    public TeamsController(NhlStatsDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await _db.Teams
            .OrderBy(t => t.Name)
            .Select(t => new TeamDto(t.Id, t.Name, t.ShortName))
            .ToListAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var team = await _db.Teams.FindAsync(id);
        return team == null ? NotFound() : Ok(new TeamDto(team.Id, team.Name, team.ShortName));
    }

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create(CreateTeamDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var team = new Team { Name = dto.Name, ShortName = dto.ShortName };
        _db.Teams.Add(team);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = team.Id }, new TeamDto(team.Id, team.Name, team.ShortName));
    }

    [Authorize]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateTeamDto dto)
    {
        if (!ModelState.IsValid) return BadRequest(ModelState);
        var team = await _db.Teams.FindAsync(id);
        if (team == null) return NotFound();
        team.Name = dto.Name;
        team.ShortName = dto.ShortName;
        await _db.SaveChangesAsync();
        return Ok(new TeamDto(team.Id, team.Name, team.ShortName));
    }

    [Authorize]
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var team = await _db.Teams.FindAsync(id);
        if (team == null) return NotFound();
        _db.Teams.Remove(team);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

