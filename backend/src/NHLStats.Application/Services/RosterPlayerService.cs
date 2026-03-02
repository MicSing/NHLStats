using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class RosterPlayerService : IRosterPlayerService
{
    private readonly NhlStatsDbContext _db;

    public RosterPlayerService(NhlStatsDbContext db) => _db = db;

    private static RosterPlayerDto ToDto(RosterPlayer p) => new(
        p.Id,
        p.FirstName,
        p.Surname,
        p.Position,
        p.TeamId,
        p.Team?.Name,
        p.Team?.ShortName,
        p.SeasonId,
        p.IsActive);

    public async Task<IEnumerable<RosterPlayerDto>> GetBySeasonAsync(int seasonId) =>
        await _db.RosterPlayers
            .Include(p => p.Team)
            .Where(p => p.SeasonId == seasonId)
            .OrderBy(p => p.Surname).ThenBy(p => p.FirstName)
            .Select(p => ToDto(p))
            .ToListAsync();

    public async Task<RosterPlayerDto?> GetByIdAsync(int id)
    {
        var player = await _db.RosterPlayers
            .Include(p => p.Team)
            .FirstOrDefaultAsync(p => p.Id == id);
        return player == null ? null : ToDto(player);
    }

    public async Task<RosterPlayerDto> CreateAsync(int seasonId, CreateRosterPlayerDto dto)
    {
        var player = new RosterPlayer
        {
            FirstName = dto.FirstName,
            Surname = dto.Surname,
            Position = dto.Position,
            TeamId = dto.TeamId,
            SeasonId = seasonId,
            IsActive = true
        };
        _db.RosterPlayers.Add(player);
        await _db.SaveChangesAsync();
        return await GetByIdAsync(player.Id) ?? ToDto(player);
    }

    public async Task<RosterPlayerDto?> UpdateAsync(int id, UpdateRosterPlayerDto dto)
    {
        var player = await _db.RosterPlayers
            .Include(p => p.Team)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (player == null) return null;

        player.FirstName = dto.FirstName;
        player.Surname = dto.Surname;
        player.Position = dto.Position;
        player.TeamId = dto.TeamId;
        player.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var player = await _db.RosterPlayers.FindAsync(id);
        if (player == null) return false;

        _db.RosterPlayers.Remove(player);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<CsvImportResultDto> ImportFromCsvAsync(int seasonId, string csvContent)
    {
        // Build a lookup of ShortName → TeamId for fast validation
        var teams = await _db.Teams.ToDictionaryAsync(t => t.ShortName.ToUpperInvariant(), t => t.Id);

        var errors = new List<string>();
        var toAdd = new List<RosterPlayer>();
        var lines = csvContent
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(l => l.Trim())
            .Where(l => l.Length > 0)
            .ToList();

        // Skip optional header row (if first line looks like a header)
        int startIndex = 0;
        if (lines.Count > 0 &&
            lines[0].StartsWith("FirstName", StringComparison.OrdinalIgnoreCase))
        {
            startIndex = 1;
        }

        for (int i = startIndex; i < lines.Count; i++)
        {
            var lineNumber = i + 1;
            var parts = lines[i].Split(',');
            if (parts.Length < 4)
            {
                errors.Add($"Line {lineNumber}: expected 4 columns (FirstName,Surname,Position,TeamShortName), got {parts.Length}.");
                continue;
            }

            var firstName = parts[0].Trim();
            var surname = parts[1].Trim();
            var position = parts[2].Trim();
            var teamShortName = parts[3].Trim();

            if (string.IsNullOrWhiteSpace(firstName))
            {
                errors.Add($"Line {lineNumber}: FirstName is required.");
                continue;
            }

            if (string.IsNullOrWhiteSpace(surname))
            {
                errors.Add($"Line {lineNumber}: Surname is required.");
                continue;
            }

            if (!teams.TryGetValue(teamShortName.ToUpperInvariant(), out var teamId))
            {
                errors.Add($"Line {lineNumber}: team short name '{teamShortName}' not found.");
                continue;
            }

            toAdd.Add(new RosterPlayer
            {
                FirstName = firstName,
                Surname = surname,
                Position = string.IsNullOrWhiteSpace(position) ? null : position,
                TeamId = teamId,
                SeasonId = seasonId,
                IsActive = true
            });
        }

        if (toAdd.Count > 0)
        {
            _db.RosterPlayers.AddRange(toAdd);
            await _db.SaveChangesAsync();
        }

        return new CsvImportResultDto(toAdd.Count, errors);
    }

    public async Task<(IEnumerable<RosterPlayerDto> Players, string? Error)> CopyFromSeasonAsync(
        int targetSeasonId, int sourceSeasonId)
    {
        var sourceExists = await _db.Seasons.AnyAsync(s => s.Id == sourceSeasonId);
        if (!sourceExists)
            return ([], $"Source season {sourceSeasonId} not found.");

        var targetExists = await _db.Seasons.AnyAsync(s => s.Id == targetSeasonId);
        if (!targetExists)
            return ([], $"Target season {targetSeasonId} not found.");

        var sourcePlayers = await _db.RosterPlayers
            .Where(p => p.SeasonId == sourceSeasonId)
            .ToListAsync();

        if (sourcePlayers.Count == 0)
            return ([], $"Source season {sourceSeasonId} has no roster players to copy.");

        var copies = sourcePlayers.Select(p => new RosterPlayer
        {
            FirstName = p.FirstName,
            Surname = p.Surname,
            Position = p.Position,
            TeamId = p.TeamId,
            SeasonId = targetSeasonId,
            IsActive = true
        }).ToList();

        _db.RosterPlayers.AddRange(copies);
        await _db.SaveChangesAsync();

        // Reload with Team navigation for full DTOs
        var ids = copies.Select(p => p.Id).ToHashSet();
        var created = await _db.RosterPlayers
            .Include(p => p.Team)
            .Where(p => ids.Contains(p.Id))
            .ToListAsync();

        return (created.Select(ToDto), null);
    }
}
