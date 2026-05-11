using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class BettingOddsService : IBettingOddsService
{
    private readonly NhlStatsDbContext _db;
    private const decimal AppMargin = 0.80m;

    public BettingOddsService(NhlStatsDbContext db) => _db = db;

    private static decimal ComputeOdds(decimal probability)
    {
        probability = Math.Clamp(probability, 0.01m, 0.99m);
        return AppMargin / probability;
    }

    public async Task RecalculateForMatchAsync(int matchId)
    {
        var match = await _db.Matches
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null) return;

        var now = DateTime.UtcNow;
        var oddsToUpsert = new List<MatchOdds>();

        // ── Team Win Odds ───────────────────────────────────────────────────────
        var homeP = await ComputeTeamWinProbabilityAsync(match.HomeTeamId, match.SeasonId);
        var awayP = await ComputeTeamWinProbabilityAsync(match.AwayTeamId, match.SeasonId);

        oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.TeamWin, TargetId = match.HomeTeamId, Probability = homeP, Odds = ComputeOdds(homeP), ComputedOn = now });
        oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.TeamWin, TargetId = match.AwayTeamId, Probability = awayP, Odds = ComputeOdds(awayP), ComputedOn = now });

        // ── User Goal/Penalty Odds ──────────────────────────────────────────────
        var activeUserIds = await _db.SeasonUsers
            .Where(su => su.Season!.Matches.Any(m => m.Id == matchId))
            .Select(su => su.UserId)
            .Distinct()
            .ToListAsync();

        foreach (var userId in activeUserIds)
        {
            var goalP = await ComputeUserEventProbabilityAsync(userId, matchId, isGoal: true);
            var penP = await ComputeUserEventProbabilityAsync(userId, matchId, isGoal: false);

            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.UserGoal, TargetId = userId, Probability = goalP, Odds = ComputeOdds(goalP), ComputedOn = now });
            oddsToUpsert.Add(new MatchOdds { MatchId = matchId, BetType = OddsBetType.UserPenalty, TargetId = userId, Probability = penP, Odds = ComputeOdds(penP), ComputedOn = now });
        }

        await UpsertMatchOddsAsync(oddsToUpsert);
    }

    public async Task RecalculateAllUpcomingAsync()
    {
        var upcomingMatchIds = await _db.Matches
            .Where(m => m.CompletionType == CompletionType.None)
            .Select(m => m.Id)
            .ToListAsync();

        foreach (var matchId in upcomingMatchIds)
            await RecalculateForMatchAsync(matchId);
    }

    public async Task<MatchOddsDto?> GetMatchOddsAsync(int matchId)
    {
        var matchExists = await _db.Matches.AnyAsync(m => m.Id == matchId);
        if (!matchExists) return null;

        var matchOddsRows = await _db.MatchOdds
            .Where(o => o.MatchId == matchId)
            .ToListAsync();

        if (!matchOddsRows.Any()) return null;

        var match = await _db.Matches
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .AsNoTracking()
            .FirstAsync(m => m.Id == matchId);

        var teamWinRows = matchOddsRows.Where(o => o.BetType == OddsBetType.TeamWin).ToList();
        TeamWinOddsDto? teamWin = null;
        if (teamWinRows.Count >= 2)
        {
            var homeRow = teamWinRows.FirstOrDefault(r => r.TargetId == match.HomeTeamId);
            var awayRow = teamWinRows.FirstOrDefault(r => r.TargetId == match.AwayTeamId);
            if (homeRow != null && awayRow != null)
                teamWin = new TeamWinOddsDto(match.HomeTeamId, homeRow.Odds, match.AwayTeamId, awayRow.Odds);
        }

        var userIds = matchOddsRows.Select(o => o.TargetId).Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        var users = await _db.Users.Where(u => userIds.Contains(u.Id)).AsNoTracking().ToDictionaryAsync(u => u.Id, u => u.Name);

        var userGoal = matchOddsRows
            .Where(o => o.BetType == OddsBetType.UserGoal && o.TargetId.HasValue)
            .Select(o => new UserOddsDto(o.TargetId!.Value, users.GetValueOrDefault(o.TargetId!.Value), o.Odds))
            .ToList();

        var userPenalty = matchOddsRows
            .Where(o => o.BetType == OddsBetType.UserPenalty && o.TargetId.HasValue)
            .Select(o => new UserOddsDto(o.TargetId!.Value, users.GetValueOrDefault(o.TargetId!.Value), o.Odds))
            .ToList();

        var computedOn = matchOddsRows.Max(o => o.ComputedOn);
        return new MatchOddsDto(teamWin, userGoal, userPenalty, computedOn);
    }

    // ── Probability helpers ─────────────────────────────────────────────────────

    // With prev season data:    P = 0.10*Pprev + 0.65*Pcurr + 0.25*Plast10
    // Without prev season data: P = 0.75*Pcurr  + 0.25*Plast10
    // Zero samples → 0 (no inflation), clamp final to [0.01, 0.99]

    private static decimal BlendProbability(decimal pprev, bool hasPrev, decimal pcurr, decimal plast10)
        => hasPrev
            ? 0.10m * pprev + 0.65m * pcurr + 0.25m * plast10
            : 0.75m * pcurr + 0.25m * plast10;

    private async Task<decimal> ComputeTeamWinProbabilityAsync(int teamId, int currentSeasonId)
    {
        // Plast10: last 10 completed matches across any season
        var last10 = await _db.Matches
            .Where(m => (m.HomeTeamId == teamId || m.AwayTeamId == teamId)
                        && m.CompletionType != CompletionType.None)
            .OrderByDescending(m => m.MatchDate)
            .Take(10)
            .ToListAsync();

        decimal plast10 = last10.Count == 0 ? 0m
            : (decimal)last10.Count(m => IsWinner(m, teamId)) / last10.Count;

        // Pcurr: current season win rate
        var currMatches = await _db.Matches
            .Where(m => m.SeasonId == currentSeasonId
                        && (m.HomeTeamId == teamId || m.AwayTeamId == teamId)
                        && m.CompletionType != CompletionType.None)
            .ToListAsync();

        decimal pcurr = currMatches.Count == 0 ? 0m
            : (decimal)currMatches.Count(m => IsWinner(m, teamId)) / currMatches.Count;

        // Pprev: previous season win rate (highest seasonId < currentSeasonId)
        var prevSeasonId = await _db.Matches
            .Where(m => m.SeasonId < currentSeasonId
                        && (m.HomeTeamId == teamId || m.AwayTeamId == teamId))
            .OrderByDescending(m => m.SeasonId)
            .Select(m => (int?)m.SeasonId)
            .FirstOrDefaultAsync();

        decimal pprev = 0m;
        bool hasPrev = false;
        if (prevSeasonId.HasValue)
        {
            var prevMatches = await _db.Matches
                .Where(m => m.SeasonId == prevSeasonId.Value
                            && (m.HomeTeamId == teamId || m.AwayTeamId == teamId)
                            && m.CompletionType != CompletionType.None)
                .ToListAsync();
            if (prevMatches.Count > 0)
            {
                pprev = (decimal)prevMatches.Count(m => IsWinner(m, teamId)) / prevMatches.Count;
                hasPrev = true;
            }
        }

        return BlendProbability(pprev, hasPrev, pcurr, plast10);
    }

    private async Task<decimal> ComputeUserEventProbabilityAsync(int userId, int matchId, bool isGoal)
    {
        var targetMatch = await _db.Matches.AsNoTracking().FirstAsync(m => m.Id == matchId);
        var currentSeasonId = targetMatch.SeasonId;

        // Plast10: last 10 completed matches for this user
        var last10UserMatches = await _db.UserMatches
            .Include(um => um.Match)
            .Where(um => um.UserId == userId && um.Match!.CompletionType != CompletionType.None)
            .OrderByDescending(um => um.Match!.MatchDate)
            .Take(10)
            .ToListAsync();

        decimal plast10 = 0m;
        if (last10UserMatches.Count > 0)
        {
            var umIds = last10UserMatches.Select(um => um.Id).ToList();
            var withEvents = isGoal
                ? await CountUserMatchesWithGoalAsync(umIds)
                : await CountUserMatchesWithPenaltyAsync(umIds);
            plast10 = (decimal)withEvents / last10UserMatches.Count;
        }

        // Pcurr: current season event rate
        var currUserMatches = await _db.UserMatches
            .Include(um => um.Match)
            .Where(um => um.UserId == userId && um.SeasonId == currentSeasonId
                         && um.Match!.CompletionType != CompletionType.None)
            .ToListAsync();

        decimal pcurr = 0m;
        if (currUserMatches.Count > 0)
        {
            var umIds = currUserMatches.Select(um => um.Id).ToList();
            var withEvents = isGoal
                ? await CountUserMatchesWithGoalAsync(umIds)
                : await CountUserMatchesWithPenaltyAsync(umIds);
            pcurr = (decimal)withEvents / currUserMatches.Count;
        }

        // Pprev: previous season event rate
        var prevSeasonId = await _db.UserMatches
            .Where(um => um.UserId == userId && um.SeasonId < currentSeasonId)
            .OrderByDescending(um => um.SeasonId)
            .Select(um => (int?)um.SeasonId)
            .FirstOrDefaultAsync();

        decimal pprev = 0m;
        bool hasPrev = false;
        if (prevSeasonId.HasValue)
        {
            var prevUserMatches = await _db.UserMatches
                .Include(um => um.Match)
                .Where(um => um.UserId == userId && um.SeasonId == prevSeasonId.Value
                             && um.Match!.CompletionType != CompletionType.None)
                .ToListAsync();
            if (prevUserMatches.Count > 0)
            {
                var umIds = prevUserMatches.Select(um => um.Id).ToList();
                var withEvents = isGoal
                    ? await CountUserMatchesWithGoalAsync(umIds)
                    : await CountUserMatchesWithPenaltyAsync(umIds);
                if (withEvents > 0)
                {
                    pprev = (decimal)withEvents / prevUserMatches.Count;
                    hasPrev = true;
                }
            }
        }

        return BlendProbability(pprev, hasPrev, pcurr, plast10);
    }

    private async Task<int> CountUserMatchesWithGoalAsync(List<int> userMatchIds)
    {
        return await _db.UserMatchGoals
            .Where(g => userMatchIds.Contains(g.UserMatchId))
            .SumAsync(g => (int?)g.Count) ?? 0;
    }

    private async Task<int> CountUserMatchesWithPenaltyAsync(List<int> userMatchIds)
    {
        return await _db.UserMatchPenalties
            .Where(p => userMatchIds.Contains(p.UserMatchId))
            .SumAsync(p => (int?)p.Count) ?? 0;
    }

    private static bool IsWinner(Match match, int teamId)
    {
        if (match.HomeScore == match.AwayScore) return false;
        return match.HomeTeamId == teamId
            ? match.HomeScore > match.AwayScore
            : match.AwayScore > match.HomeScore;
    }

    private async Task UpsertMatchOddsAsync(List<MatchOdds> newOdds)
    {
        foreach (var odds in newOdds)
        {
            var existing = await _db.MatchOdds
                .FirstOrDefaultAsync(o => o.MatchId == odds.MatchId
                                          && o.BetType == odds.BetType
                                          && o.TargetId == odds.TargetId);
            if (existing == null)
                _db.MatchOdds.Add(odds);
            else
            {
                existing.Probability = odds.Probability;
                existing.Odds = odds.Odds;
                existing.ComputedOn = odds.ComputedOn;
            }
        }

        await _db.SaveChangesAsync();
    }
}
