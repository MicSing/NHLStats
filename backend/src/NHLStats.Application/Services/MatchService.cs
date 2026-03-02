using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class MatchService : IMatchService
{
    private readonly NhlStatsDbContext _db;

    public MatchService(NhlStatsDbContext db) => _db = db;

    private static MatchDto ToDto(Match m) => new(
        m.Id, m.SeasonId,
        m.HomeTeamId, m.HomeTeam?.Name,
        m.AwayTeamId, m.AwayTeam?.Name,
        m.HomeScore, m.AwayScore, m.MatchDate);

    public async Task<IEnumerable<MatchDto>> GetBySeasonAsync(int seasonId) =>
        await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Where(m => m.SeasonId == seasonId)
            .OrderBy(m => m.MatchDate)
            .Select(m => ToDto(m))
            .ToListAsync();

    public async Task<MatchDto?> GetByIdAsync(int id)
    {
        var match = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .FirstOrDefaultAsync(m => m.Id == id);
        return match == null ? null : ToDto(match);
    }

    public async Task<MatchDto> CreateAsync(int seasonId, CreateMatchDto dto)
    {
        var match = new Match
        {
            SeasonId = seasonId,
            HomeTeamId = dto.HomeTeamId,
            AwayTeamId = dto.AwayTeamId,
            HomeScore = dto.HomeScore,
            AwayScore = dto.AwayScore,
            MatchDate = dto.MatchDate
        };
        _db.Matches.Add(match);
        await _db.SaveChangesAsync();
        return await GetByIdAsync(match.Id) ?? ToDto(match);
    }

    public async Task<MatchDto?> UpdateAsync(int id, UpdateMatchDto dto)
    {
        var match = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .FirstOrDefaultAsync(m => m.Id == id);
        if (match == null) return null;

        match.HomeTeamId = dto.HomeTeamId;
        match.AwayTeamId = dto.AwayTeamId;
        match.HomeScore = dto.HomeScore;
        match.AwayScore = dto.AwayScore;
        match.MatchDate = dto.MatchDate;
        await _db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var match = await _db.Matches.FindAsync(id);
        if (match == null) return false;

        _db.Matches.Remove(match);
        await _db.SaveChangesAsync();
        return true;
    }
}
