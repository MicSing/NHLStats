using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class TeamStatsService : ITeamStatsService
{
    private readonly NhlStatsDbContext _db;

    public TeamStatsService(NhlStatsDbContext db)
    {
        _db = db;
    }

    public async Task<IEnumerable<TeamOptionDto>> GetHostedTeamOptionsAsync()
    {
        var hostedTeamIds = await _db.Seasons
            .Where(s => s.HostedTeamId != null)
            .Select(s => s.HostedTeamId!.Value)
            .Distinct()
            .ToListAsync();

        return await _db.Teams
            .Where(t => hostedTeamIds.Contains(t.Id))
            .OrderBy(t => t.Name)
            .Select(t => new TeamOptionDto(t.Id, t.Name, t.ShortName))
            .ToListAsync();
    }

    public async Task<IEnumerable<TeamOptionDto>> GetOpponentOptionsAsync(int hostedTeamId)
    {
        var matches = await _db.Matches
            .Where(m => m.Season!.HostedTeamId == hostedTeamId)
            .Select(m => new { m.HomeTeamId, m.AwayTeamId })
            .ToListAsync();

        var opponentIds = matches
            .Select(m => m.HomeTeamId == hostedTeamId ? m.AwayTeamId : m.HomeTeamId)
            .Distinct()
            .ToList();

        return await _db.Teams
            .Where(t => opponentIds.Contains(t.Id))
            .OrderBy(t => t.Name)
            .Select(t => new TeamOptionDto(t.Id, t.Name, t.ShortName))
            .ToListAsync();
    }

    public async Task<TeamStatsSummaryDto> GetTeamStatsAsync(int hostedTeamId, int opponentTeamId)
    {
        var matchIds = await GetMatchIdsAsync(hostedTeamId, opponentTeamId);

        if (matchIds.Count == 0)
        {
            return new TeamStatsSummaryDto(hostedTeamId, opponentTeamId, 0, null, null, null, null, null, null, 0, 0, 0, 0, 0, 0);
        }

        var goalRows = await _db.UserMatchGoals
            .Where(g => matchIds.Contains(g.UserMatch!.MatchId) && g.RosterPlayer!.TeamId == hostedTeamId)
            .Select(g => new { g.UserMatch!.UserId, g.RosterPlayerId, g.Count })
            .ToListAsync();

        var penaltyRows = await _db.UserMatchPenalties
            .Where(p => matchIds.Contains(p.UserMatch!.MatchId) && p.RosterPlayer!.TeamId == hostedTeamId)
            .Select(p => new { p.UserMatch!.UserId, p.RosterPlayerId, p.Count })
            .ToListAsync();

        var userIds = goalRows.Select(r => r.UserId).Concat(penaltyRows.Select(r => r.UserId)).Distinct().ToList();
        var playerIds = goalRows.Select(r => r.RosterPlayerId).Concat(penaltyRows.Select(r => r.RosterPlayerId)).Distinct().ToList();

        var userNames = await _db.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name ?? $"User {u.Id}");
        var players = await _db.RosterPlayers
            .Where(rp => playerIds.Contains(rp.Id))
            .ToDictionaryAsync(rp => rp.Id, rp => $"{rp.FirstName} {rp.Surname}");

        var topScoringUser = ResolveTopUserWithPairedPlayer(goalRows.Select(r => (r.UserId, r.RosterPlayerId, r.Count)), userNames, players);
        var topScoringPlayer = ResolveTopPlayerWithPairedUser(goalRows.Select(r => (r.UserId, r.RosterPlayerId, r.Count)), userNames, players);
        var topPenalizedUser = ResolveTopUserWithPairedPlayer(penaltyRows.Select(r => (r.UserId, r.RosterPlayerId, r.Count)), userNames, players);
        var topPenalizedPlayer = ResolveTopPlayerWithPairedUser(penaltyRows.Select(r => (r.UserId, r.RosterPlayerId, r.Count)), userNames, players);

        var totalGoals = goalRows.Sum(r => r.Count);
        var totalPenalties = penaltyRows.Sum(r => r.Count);

        var pointRows = await _db.UserMatchPoints
            .Where(p => matchIds.Contains(p.UserMatch!.MatchId))
            .Select(p => new { p.UserMatch!.UserId, p.Count, PointType = p.PointReason!.PointType })
            .ToListAsync();

        var totalPlus = pointRows.Where(r => r.PointType == PointType.Positive).Sum(r => r.Count);
        var totalMinus = pointRows.Where(r => r.PointType == PointType.Negative).Sum(r => r.Count);

        var plusUserIds = pointRows.Select(r => r.UserId).Distinct().ToList();
        var pointUserNames = await _db.Users
            .Where(u => plusUserIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.Name ?? $"User {u.Id}");

        var topPlusUser = pointRows
            .Where(r => r.PointType == PointType.Positive)
            .GroupBy(r => r.UserId)
            .Select(g => new TeamStatsLeaderDto(pointUserNames.GetValueOrDefault(g.Key, $"User {g.Key}"), g.Sum(x => x.Count), []))
            .Where(l => l.Count > 0)
            .OrderByDescending(l => l.Count).ThenBy(l => l.Name)
            .FirstOrDefault();

        var topMinusUser = pointRows
            .Where(r => r.PointType == PointType.Negative)
            .GroupBy(r => r.UserId)
            .Select(g => new TeamStatsLeaderDto(pointUserNames.GetValueOrDefault(g.Key, $"User {g.Key}"), g.Sum(x => x.Count), []))
            .Where(l => l.Count > 0)
            .OrderByDescending(l => l.Count).ThenBy(l => l.Name)
            .FirstOrDefault();

        var matchCount = matchIds.Count;

        return new TeamStatsSummaryDto(
            hostedTeamId,
            opponentTeamId,
            matchCount,
            topScoringUser,
            topScoringPlayer,
            topPenalizedUser,
            topPenalizedPlayer,
            topPlusUser,
            topMinusUser,
            totalPlus,
            totalMinus,
            (double)totalPlus / matchCount,
            (double)totalMinus / matchCount,
            (double)totalGoals / matchCount,
            (double)totalPenalties / matchCount);
    }

    public async Task<IEnumerable<TeamStatsMatchDto>> GetMatchesAsync(int hostedTeamId, int opponentTeamId)
    {
        var matches = await _db.Matches
            .Include(m => m.Season)
            .Where(m =>
                m.MatchDate != null &&
                m.Season!.HostedTeamId == hostedTeamId &&
                (m.HomeTeamId == opponentTeamId || m.AwayTeamId == opponentTeamId))
            .OrderByDescending(m => m.MatchDate)
            .ToListAsync();

        return matches.Select(m => new TeamStatsMatchDto(
            m.Id,
            m.SeasonId,
            m.Season?.Name ?? "",
            m.MatchDate!.Value,
            m.HomeTeamId == hostedTeamId,
            m.HomeScore,
            m.AwayScore,
            m.CompletionType));
    }

    private async Task<List<int>> GetMatchIdsAsync(int hostedTeamId, int opponentTeamId)
    {
        return await _db.Matches
            .Where(m =>
                m.Season!.HostedTeamId == hostedTeamId &&
                (m.HomeTeamId == opponentTeamId || m.AwayTeamId == opponentTeamId))
            .Select(m => m.Id)
            .ToListAsync();
    }

    private static TeamStatsLeaderDto? ResolveTopUserWithPairedPlayer(
        IEnumerable<(int UserId, int RosterPlayerId, int Count)> rows,
        Dictionary<int, string> userNames,
        Dictionary<int, string> playerNames)
    {
        var list = rows.ToList();
        if (list.Count == 0) return null;

        var top = list
            .GroupBy(r => r.UserId)
            .Select(g => new { UserId = g.Key, Total = g.Sum(x => x.Count) })
            .Where(x => x.Total > 0)
            .OrderByDescending(x => x.Total)
            .ThenBy(x => userNames.GetValueOrDefault(x.UserId, $"User {x.UserId}"))
            .FirstOrDefault();

        if (top == null) return null;

        var pairedPlayers = list
            .Where(r => r.UserId == top.UserId)
            .GroupBy(r => r.RosterPlayerId)
            .Select(g => new TeamStatsPairedContributorDto(playerNames.GetValueOrDefault(g.Key, ""), g.Sum(x => x.Count)))
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Name)
            .ToList();

        return new TeamStatsLeaderDto(
            userNames.GetValueOrDefault(top.UserId, $"User {top.UserId}"),
            top.Total,
            pairedPlayers);
    }

    private static TeamStatsLeaderDto? ResolveTopPlayerWithPairedUser(
        IEnumerable<(int UserId, int RosterPlayerId, int Count)> rows,
        Dictionary<int, string> userNames,
        Dictionary<int, string> playerNames)
    {
        var list = rows.ToList();
        if (list.Count == 0) return null;

        var top = list
            .GroupBy(r => r.RosterPlayerId)
            .Select(g => new { RosterPlayerId = g.Key, Total = g.Sum(x => x.Count) })
            .Where(x => x.Total > 0 && playerNames.ContainsKey(x.RosterPlayerId))
            .OrderByDescending(x => x.Total)
            .ThenBy(x => playerNames.GetValueOrDefault(x.RosterPlayerId, ""))
            .FirstOrDefault();

        if (top == null) return null;

        var pairedUsers = list
            .Where(r => r.RosterPlayerId == top.RosterPlayerId)
            .GroupBy(r => r.UserId)
            .Select(g => new TeamStatsPairedContributorDto(userNames.GetValueOrDefault(g.Key, $"User {g.Key}"), g.Sum(x => x.Count)))
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.Name)
            .ToList();

        return new TeamStatsLeaderDto(
            playerNames[top.RosterPlayerId],
            top.Total,
            pairedUsers);
    }
}
