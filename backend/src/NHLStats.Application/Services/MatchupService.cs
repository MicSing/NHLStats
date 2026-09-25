using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class MatchupService : IMatchupService
{
    private readonly NhlStatsDbContext _db;

    public MatchupService(NhlStatsDbContext db)
    {
        _db = db;
    }

    public async Task<MatchupDto?> GetForMatchAsync(int matchId, int lastMatchesCount = 5)
    {
        var match = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null) return null;

        var teamA = match.HomeTeamId;
        var teamB = match.AwayTeamId;

        var previous = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Where(m => m.SeasonId == match.SeasonId && m.Id != match.Id)
            .Where(m => m.CompletionType != CompletionType.None && m.CompletionType != CompletionType.InProgress)
            .Where(m => (m.HomeTeamId == teamA && m.AwayTeamId == teamB)
                     || (m.HomeTeamId == teamB && m.AwayTeamId == teamA))
            .ToListAsync();

        var previousIds = previous.Select(m => m.Id).ToList();

        var users = await _db.UserMatches
            .Where(um => previousIds.Contains(um.MatchId))
            .Select(um => new { um.UserId, um.User!.Name })
            .Distinct()
            .ToListAsync();
        var userNames = users
            .GroupBy(u => u.UserId)
            .ToDictionary(g => g.Key, g => g.First().Name);

        var goals = await _db.UserMatchGoals
            .Where(g => previousIds.Contains(g.UserMatch!.MatchId) && g.GoalType != GoalType.Shootout)
            .GroupBy(g => g.UserMatch!.UserId)
            .Select(g => new UserTotal(g.Key, g.Sum(x => x.Count)))
            .ToListAsync();

        var penalties = await _db.UserMatchPenalties
            .Where(p => previousIds.Contains(p.UserMatch!.MatchId))
            .GroupBy(p => p.UserMatch!.UserId)
            .Select(g => new UserTotal(g.Key, g.Sum(x => x.Count)))
            .ToListAsync();

        var points = await _db.UserMatchPoints
            .Where(p => previousIds.Contains(p.UserMatch!.MatchId))
            .GroupBy(p => new { p.UserMatch!.UserId, p.PointReason!.PointType })
            .Select(g => new { g.Key.UserId, g.Key.PointType, Total = g.Sum(x => x.Count) })
            .ToListAsync();

        var plus = points
            .Where(p => p.PointType == PointType.Positive)
            .Select(p => new UserTotal(p.UserId, p.Total))
            .ToList();
        var minus = points
            .Where(p => p.PointType == PointType.Negative)
            .Select(p => new UserTotal(p.UserId, p.Total))
            .ToList();

        var lastMatches = previous
            .OrderByDescending(m => m.MatchDate ?? DateTime.MinValue)
            .ThenByDescending(m => m.MatchNumber)
            .Take(lastMatchesCount <= 0 ? 5 : lastMatchesCount)
            .Select(m => new MatchupResultDto(
                m.Id,
                m.MatchNumber,
                m.HomeTeamId,
                m.HomeTeam?.Name,
                m.AwayTeamId,
                m.AwayTeam?.Name,
                m.HomeScore,
                m.AwayScore,
                m.MatchDate,
                m.CompletionType,
                m.Phase))
            .ToList();

        return new MatchupDto(
            match.Id,
            match.SeasonId,
            match.HomeTeamId,
            match.HomeTeam?.Name,
            match.AwayTeamId,
            match.AwayTeam?.Name,
            previous.Count,
            lastMatches,
            Leaders(goals, userNames),
            Leaders(penalties, userNames),
            Leaders(plus, userNames),
            Leaders(minus, userNames));
    }

    private record UserTotal(int UserId, int Total);

    // Users sharing the highest positive total, ordered by name for a stable display.
    private static List<UserMatchInfoDto> Leaders(IEnumerable<UserTotal> totals, IReadOnlyDictionary<int, string> names)
    {
        var positive = totals.Where(t => t.Total > 0).ToList();
        if (positive.Count == 0) return [];

        var max = positive.Max(t => t.Total);
        return positive
            .Where(t => t.Total == max)
            .Select(t => new UserMatchInfoDto(t.UserId, names.GetValueOrDefault(t.UserId)))
            .OrderBy(u => u.UserName)
            .ToList();
    }
}
