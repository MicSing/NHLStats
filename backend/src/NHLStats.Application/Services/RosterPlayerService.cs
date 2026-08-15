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

    private static RosterPlayerDto ToDto(SeasonRosterPlayer srp) => new(
        srp.RosterPlayerId,
        srp.RosterPlayer?.FirstName ?? "",
        srp.RosterPlayer?.Surname ?? "",
        srp.Position ?? srp.RosterPlayer?.Position,
        srp.TeamId,
        srp.Team?.Name,
        srp.Team?.ShortName,
        srp.SeasonId,
        srp.IsActive);

    public async Task<IEnumerable<RosterPlayerDto>> GetBySeasonAsync(int seasonId) =>
        await _db.SeasonRosterPlayers
            .Include(srp => srp.RosterPlayer)
            .Include(srp => srp.Team)
            .Where(srp => srp.SeasonId == seasonId)
            .OrderBy(srp => srp.RosterPlayer!.Surname).ThenBy(srp => srp.RosterPlayer!.FirstName)
            .Select(srp => ToDto(srp))
            .ToListAsync();

    public async Task<RosterPlayerDto?> GetByIdAsync(int id)
    {
        var srp = await _db.SeasonRosterPlayers
            .Include(s => s.RosterPlayer)
            .Include(s => s.Team)
            .FirstOrDefaultAsync(s => s.RosterPlayerId == id);
        return srp == null ? null : ToDto(srp);
    }

    public async Task<RosterPlayerDto?> GetBySeasonAndPlayerIdAsync(int seasonId, int playerId)
    {
        var srp = await _db.SeasonRosterPlayers
            .Include(s => s.RosterPlayer)
            .Include(s => s.Team)
            .FirstOrDefaultAsync(s => s.SeasonId == seasonId && s.RosterPlayerId == playerId);
        return srp == null ? null : ToDto(srp);
    }

    public async Task<RosterPlayerDto> CreateAsync(int seasonId, CreateRosterPlayerDto dto)
    {
        var firstName = dto.FirstName.Trim();
        var surname = dto.Surname.Trim();

        var existingPlayer = await _db.RosterPlayers
            .FirstOrDefaultAsync(p => p.FirstName.ToLower() == firstName.ToLower() && p.Surname.ToLower() == surname.ToLower());

        RosterPlayer player;
        if (existingPlayer != null)
        {
            player = existingPlayer;
            if (!string.IsNullOrWhiteSpace(dto.Position))
                player.Position = dto.Position.Trim();
            player.TeamId = dto.TeamId;
        }
        else
        {
            player = new RosterPlayer
            {
                FirstName = firstName,
                Surname = surname,
                Position = string.IsNullOrWhiteSpace(dto.Position) ? null : dto.Position.Trim(),
                TeamId = dto.TeamId
            };
            _db.RosterPlayers.Add(player);
            await _db.SaveChangesAsync();
        }

        var seasonPlayer = await _db.SeasonRosterPlayers
            .Include(s => s.RosterPlayer)
            .Include(s => s.Team)
            .FirstOrDefaultAsync(s => s.SeasonId == seasonId && s.RosterPlayerId == player.Id);

        if (seasonPlayer != null)
        {
            seasonPlayer.TeamId = dto.TeamId;
            seasonPlayer.Position = string.IsNullOrWhiteSpace(dto.Position) ? null : dto.Position.Trim();
            seasonPlayer.IsActive = true;
        }
        else
        {
            seasonPlayer = new SeasonRosterPlayer
            {
                SeasonId = seasonId,
                RosterPlayerId = player.Id,
                TeamId = dto.TeamId,
                Position = string.IsNullOrWhiteSpace(dto.Position) ? null : dto.Position.Trim(),
                IsActive = true
            };
            _db.SeasonRosterPlayers.Add(seasonPlayer);
        }

        await _db.SaveChangesAsync();
        return await GetBySeasonAndPlayerIdAsync(seasonId, player.Id) ?? ToDto(seasonPlayer);
    }

    public async Task<RosterPlayerDto?> UpdateAsync(int seasonId, int id, UpdateRosterPlayerDto dto)
    {
        var seasonPlayer = await _db.SeasonRosterPlayers
            .Include(s => s.RosterPlayer)
            .Include(s => s.Team)
            .FirstOrDefaultAsync(s => s.SeasonId == seasonId && s.RosterPlayerId == id);
        if (seasonPlayer == null) return null;

        seasonPlayer.TeamId = dto.TeamId;
        seasonPlayer.Position = string.IsNullOrWhiteSpace(dto.Position) ? null : dto.Position.Trim();
        seasonPlayer.IsActive = dto.IsActive;

        if (seasonPlayer.RosterPlayer != null)
        {
            seasonPlayer.RosterPlayer.FirstName = dto.FirstName.Trim();
            seasonPlayer.RosterPlayer.Surname = dto.Surname.Trim();
            if (!string.IsNullOrWhiteSpace(dto.Position))
                seasonPlayer.RosterPlayer.Position = dto.Position.Trim();
            seasonPlayer.RosterPlayer.TeamId = dto.TeamId;
        }

        await _db.SaveChangesAsync();
        return await GetBySeasonAndPlayerIdAsync(seasonId, id);
    }

    public async Task<bool> DeleteAsync(int seasonId, int id)
    {
        var seasonPlayer = await _db.SeasonRosterPlayers
            .FirstOrDefaultAsync(s => s.SeasonId == seasonId && s.RosterPlayerId == id);
        if (seasonPlayer == null) return false;

        _db.SeasonRosterPlayers.Remove(seasonPlayer);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<CsvImportResultDto> ImportFromCsvAsync(int seasonId, string csvContent)
    {
        var teams = await _db.Teams.ToDictionaryAsync(t => t.ShortName.ToUpperInvariant(), t => t.Id);

        var errors = new List<string>();
        var lines = csvContent
            .Split('\n', StringSplitOptions.RemoveEmptyEntries)
            .Select(l => l.Trim())
            .Where(l => l.Length > 0)
            .ToList();

        int startIndex = 0;
        if (lines.Count > 0 &&
            lines[0].StartsWith("FirstName", StringComparison.OrdinalIgnoreCase))
        {
            startIndex = 1;
        }

        var allDbPlayers = await _db.RosterPlayers.ToListAsync();
        var existingSeasonPlayers = await _db.SeasonRosterPlayers
            .Where(s => s.SeasonId == seasonId)
            .ToListAsync();

        var playerLookup = allDbPlayers
            .GroupBy(p => $"{p.FirstName.Trim().ToLowerInvariant()}|{p.Surname.Trim().ToLowerInvariant()}")
            .ToDictionary(g => g.Key, g => g.First());

        var seasonPlayerLookup = existingSeasonPlayers
            .ToDictionary(s => s.RosterPlayerId, s => s);

        int importedCount = 0;

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

            var key = $"{firstName.ToLowerInvariant()}|{surname.ToLowerInvariant()}";
            if (!playerLookup.TryGetValue(key, out var player))
            {
                player = new RosterPlayer
                {
                    FirstName = firstName,
                    Surname = surname,
                    Position = string.IsNullOrWhiteSpace(position) ? null : position,
                    TeamId = teamId
                };
                _db.RosterPlayers.Add(player);
                await _db.SaveChangesAsync();
                playerLookup[key] = player;
            }
            else
            {
                player.TeamId = teamId;
                if (!string.IsNullOrWhiteSpace(position))
                    player.Position = position;
            }

            if (seasonPlayerLookup.TryGetValue(player.Id, out var existingSp))
            {
                existingSp.TeamId = teamId;
                existingSp.Position = string.IsNullOrWhiteSpace(position) ? null : position;
                existingSp.IsActive = true;
            }
            else
            {
                var newSp = new SeasonRosterPlayer
                {
                    SeasonId = seasonId,
                    RosterPlayerId = player.Id,
                    TeamId = teamId,
                    Position = string.IsNullOrWhiteSpace(position) ? null : position,
                    IsActive = true
                };
                _db.SeasonRosterPlayers.Add(newSp);
                seasonPlayerLookup[player.Id] = newSp;
            }

            importedCount++;
        }

        await _db.SaveChangesAsync();
        return new CsvImportResultDto(importedCount, errors);
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

        var sourceSeasonPlayers = await _db.SeasonRosterPlayers
            .Where(p => p.SeasonId == sourceSeasonId)
            .ToListAsync();

        if (sourceSeasonPlayers.Count == 0)
            return ([], $"Source season {sourceSeasonId} has no roster players to copy.");

        var existingTargetPlayerIds = (await _db.SeasonRosterPlayers
            .Where(p => p.SeasonId == targetSeasonId)
            .Select(p => p.RosterPlayerId)
            .ToListAsync())
            .ToHashSet();

        var toAdd = new List<SeasonRosterPlayer>();
        foreach (var sp in sourceSeasonPlayers)
        {
            if (!existingTargetPlayerIds.Contains(sp.RosterPlayerId))
            {
                toAdd.Add(new SeasonRosterPlayer
                {
                    SeasonId = targetSeasonId,
                    RosterPlayerId = sp.RosterPlayerId,
                    TeamId = sp.TeamId,
                    Position = sp.Position,
                    IsActive = true
                });
            }
        }

        if (toAdd.Count > 0)
        {
            _db.SeasonRosterPlayers.AddRange(toAdd);
            await _db.SaveChangesAsync();
        }

        var result = await GetBySeasonAsync(targetSeasonId);
        return (result, null);
    }
}
