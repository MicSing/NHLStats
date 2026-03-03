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
        m.Id, m.SeasonId, m.MatchNumber,
        m.HomeTeamId, m.HomeTeam?.Name,
        m.AwayTeamId, m.AwayTeam?.Name,
        m.HomeScore, m.AwayScore, m.MatchDate, m.CompletionType);

    public async Task<IEnumerable<MatchDto>> GetBySeasonAsync(int seasonId) =>
        await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Where(m => m.SeasonId == seasonId)
            .OrderBy(m => m.MatchNumber)
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
        var maxNumber = await _db.Matches
            .Where(m => m.SeasonId == seasonId)
            .MaxAsync(m => (int?)m.MatchNumber) ?? 0;

        var match = new Match
        {
            SeasonId = seasonId,
            MatchNumber = maxNumber + 1,
            HomeTeamId = dto.HomeTeamId,
            AwayTeamId = dto.AwayTeamId,
            HomeScore = 0,
            AwayScore = 0,
            MatchDate = null,
            CompletionType = CompletionType.None
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
        match.CompletionType = dto.CompletionType;
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

    public async Task<IEnumerable<MatchDto>> BatchCreateAsync(int seasonId, IEnumerable<BatchCreateMatchDto> dtos)
    {
        var dtoList = dtos.ToList();

        // Validate all team IDs upfront
        var allTeamIds = dtoList
            .SelectMany(d => new[] { d.HomeTeamId, d.AwayTeamId })
            .Distinct()
            .ToList();

        var validTeamIds = await _db.Teams
            .Where(t => allTeamIds.Contains(t.Id))
            .Select(t => t.Id)
            .ToListAsync();

        var invalidIds = allTeamIds.Except(validTeamIds).ToList();
        if (invalidIds.Count > 0)
            throw new ArgumentException($"Invalid team IDs: {string.Join(", ", invalidIds)}");

        var startNumber = await _db.Matches
            .Where(m => m.SeasonId == seasonId)
            .MaxAsync(m => (int?)m.MatchNumber) ?? 0;

        var matches = dtoList.Select((dto, i) => new Match
        {
            SeasonId = seasonId,
            MatchNumber = startNumber + i + 1,
            HomeTeamId = dto.HomeTeamId,
            AwayTeamId = dto.AwayTeamId,
            HomeScore = dto.HomeScore,
            AwayScore = dto.AwayScore,
            MatchDate = dto.MatchDate,
            CompletionType = dto.CompletionType
        }).ToList();

        _db.Matches.AddRange(matches);
        await _db.SaveChangesAsync();

        // Create UserMatch records for player points
        var userMatches = new List<UserMatch>();
        for (int i = 0; i < dtoList.Count; i++)
        {
            var dto = dtoList[i];
            var match = matches[i];
            if (dto.UserPoints != null)
            {
                foreach (var up in dto.UserPoints)
                {
                    userMatches.Add(new UserMatch
                    {
                        UserId = up.UserId,
                        MatchId = match.Id,
                        SeasonId = seasonId,
                        TotalPlus = up.Plus,
                        TotalMinus = up.Minus
                    });
                }
            }
        }
        if (userMatches.Count > 0)
        {
            _db.UserMatches.AddRange(userMatches);
            await _db.SaveChangesAsync();

            // Create UserMatchPoint records so reasons are visible in the UI.
            // Negative points → PointReason Id=1 ("Penalty", IsPositive=false)
            // Positive points → PointReason Id=9 ("Penalty", IsPositive=true)
            var pointEntries = new List<UserMatchPoint>();
            foreach (var um in userMatches)
            {
                if (um.TotalMinus > 0)
                    pointEntries.Add(new UserMatchPoint { UserMatchId = um.Id, PointReasonId = 1, Count = um.TotalMinus });
                if (um.TotalPlus > 0)
                    pointEntries.Add(new UserMatchPoint { UserMatchId = um.Id, PointReasonId = 9, Count = um.TotalPlus });
            }
            if (pointEntries.Count > 0)
            {
                _db.UserMatchPoints.AddRange(pointEntries);
                await _db.SaveChangesAsync();
            }
        }

        // Reload with navigation properties
        var ids = matches.Select(m => m.Id).ToList();
        var created = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Where(m => ids.Contains(m.Id))
            .OrderBy(m => m.MatchNumber)
            .ToListAsync();

        return created.Select(ToDto);
    }
}
