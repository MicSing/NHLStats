using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class SeasonService : ISeasonService
{
    private readonly NhlStatsDbContext _db;

    public SeasonService(NhlStatsDbContext db) => _db = db;

    private static SeasonDto ToDto(Season s) => new(
        s.Id, s.Name, s.HostedTeamId,
        s.HostedTeam?.Name,
        s.StartedOn, s.Status, s.ParentSeasonId);

    private static SeasonDetailDto ToDetailDto(Season s) => new(
        s.Id, s.Name, s.HostedTeamId,
        s.HostedTeam?.Name,
        s.StartedOn, s.Status, s.ParentSeasonId,
        s.SeasonUsers?
            .Select(su => new UserDto(su.User!.Id, su.User.Name, su.User.IsActive))
            .ToList() ?? []);

    public async Task<IEnumerable<SeasonDto>> GetAllAsync() =>
        await _db.Seasons
            .Include(s => s.HostedTeam)
            .OrderByDescending(s => s.StartedOn)
            .Select(s => ToDto(s))
            .ToListAsync();

    public async Task<SeasonDetailDto?> GetByIdAsync(int id)
    {
        var season = await _db.Seasons
            .Include(s => s.HostedTeam)
            .Include(s => s.SeasonUsers)
                .ThenInclude(su => su.User)
            .FirstOrDefaultAsync(s => s.Id == id);

        return season == null ? null : ToDetailDto(season);
    }

    public async Task<SeasonDto> CreateAsync(CreateSeasonDto dto)
    {
        var season = new Season
        {
            Name = dto.Name,
            HostedTeamId = dto.HostedTeamId,
            StartedOn = dto.StartedOn,
            Status = dto.Status,
            ParentSeasonId = dto.ParentSeasonId
        };
        _db.Seasons.Add(season);
        await _db.SaveChangesAsync();
        return ToDto(season);
    }

    public async Task<SeasonDto?> UpdateAsync(int id, UpdateSeasonDto dto)
    {
        var season = await _db.Seasons.Include(s => s.HostedTeam).FirstOrDefaultAsync(s => s.Id == id);
        if (season == null) return null;

        season.Name = dto.Name;
        season.HostedTeamId = dto.HostedTeamId;
        season.StartedOn = dto.StartedOn;
        season.Status = dto.Status;
        season.ParentSeasonId = dto.ParentSeasonId;
        await _db.SaveChangesAsync();
        return ToDto(season);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var season = await _db.Seasons.FindAsync(id);
        if (season == null) return false;

        _db.Seasons.Remove(season);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<SeasonDetailDto?> AssignUserAsync(int seasonId, int userId)
    {
        var season = await _db.Seasons.FindAsync(seasonId);
        var user = await _db.Users.FindAsync(userId);
        if (season == null || user == null) return null;

        var exists = await _db.SeasonUsers.AnyAsync(su => su.SeasonId == seasonId && su.UserId == userId);
        if (!exists)
        {
            _db.SeasonUsers.Add(new SeasonUser { SeasonId = seasonId, UserId = userId });
            await _db.SaveChangesAsync();
        }

        return await GetByIdAsync(seasonId);
    }

    public async Task<bool> RemoveUserAsync(int seasonId, int userId)
    {
        var su = await _db.SeasonUsers
            .FirstOrDefaultAsync(x => x.SeasonId == seasonId && x.UserId == userId);
        if (su == null) return false;

        _db.SeasonUsers.Remove(su);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<IEnumerable<UserDto>?> GetSeasonUsersAsync(int seasonId)
    {
        var seasonExists = await _db.Seasons.AnyAsync(s => s.Id == seasonId);
        if (!seasonExists) return null;

        return await _db.SeasonUsers
            .Where(su => su.SeasonId == seasonId)
            .Include(su => su.User)
            .Select(su => new UserDto(su.User!.Id, su.User.Name, su.User.IsActive))
            .ToListAsync();
    }
}
