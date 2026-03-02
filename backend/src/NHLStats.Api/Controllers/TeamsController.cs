using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Domain;

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
}
