using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class RealSeasonMatchImportService : IRealSeasonMatchImportService
{
    private readonly NhlStatsDbContext _db;
    private readonly INhlScheduleClient _scheduleClient;

    public RealSeasonMatchImportService(NhlStatsDbContext db, INhlScheduleClient scheduleClient)
    {
        _db = db;
        _scheduleClient = scheduleClient;
    }

    public async Task<(ImportRealSeasonMatchesResultDto? Result, string? Error)> ImportAsync(int seasonId, CancellationToken cancellationToken = default)
    {
        var season = await _db.Seasons.FirstOrDefaultAsync(s => s.Id == seasonId, cancellationToken);
        if (season == null)
            return (null, $"Season {seasonId} not found.");
        if (season.NhlYear == null)
            return (null, "Season has no NHL year configured. Set it before importing the real season schedule.");

        IReadOnlyList<NhlGameDto> games;
        try
        {
            games = await _scheduleClient.GetRegularSeasonGamesAsync(season.NhlYear.Value, cancellationToken);
        }
        catch (Exception ex)
        {
            return (null, $"Failed to fetch the real NHL schedule: {ex.Message}");
        }

        var teamIdsByShortName = await _db.Teams
            .ToDictionaryAsync(t => t.ShortName.ToUpperInvariant(), t => t.Id, cancellationToken);

        var existingNhlGameIds = (await _db.Matches
            .Where(m => m.SeasonId == seasonId && m.NhlGameId != null)
            .Select(m => m.NhlGameId!.Value)
            .ToListAsync(cancellationToken))
            .ToHashSet();

        var startNumber = await _db.Matches
            .Where(m => m.SeasonId == seasonId)
            .MaxAsync(m => (int?)m.MatchNumber, cancellationToken) ?? 0;

        var errors = new List<string>();
        var toAdd = new List<Match>();
        var skipped = 0;

        foreach (var game in games)
        {
            if (existingNhlGameIds.Contains(game.NhlGameId))
            {
                skipped++;
                continue;
            }

            if (!teamIdsByShortName.TryGetValue(game.HomeTeamAbbrev.ToUpperInvariant(), out var homeTeamId))
            {
                errors.Add($"Game {game.NhlGameId} on {game.GameDateUtc:d}: home team '{game.HomeTeamAbbrev}' not found.");
                skipped++;
                continue;
            }

            if (!teamIdsByShortName.TryGetValue(game.AwayTeamAbbrev.ToUpperInvariant(), out var awayTeamId))
            {
                errors.Add($"Game {game.NhlGameId} on {game.GameDateUtc:d}: away team '{game.AwayTeamAbbrev}' not found.");
                skipped++;
                continue;
            }

            toAdd.Add(new Match
            {
                SeasonId = seasonId,
                MatchNumber = startNumber + toAdd.Count + 1,
                HomeTeamId = homeTeamId,
                AwayTeamId = awayTeamId,
                HomeScore = 0,
                AwayScore = 0,
                MatchDate = game.GameDateUtc,
                CompletionType = CompletionType.None,
                NhlGameId = game.NhlGameId
            });
        }

        if (toAdd.Count > 0)
        {
            _db.Matches.AddRange(toAdd);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return (new ImportRealSeasonMatchesResultDto(toAdd.Count, skipped, errors), null);
    }
}
