using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class MatchEventService : IMatchEventService
{
    private readonly NhlStatsDbContext _db;
    private readonly IUserMatchService _userMatchService;
    private readonly IBetService _betService;

    public MatchEventService(
        NhlStatsDbContext db,
        IUserMatchService userMatchService,
        IBetService betService)
    {
        _db = db;
        _userMatchService = userMatchService;
        _betService = betService;
    }

    private static MatchEventDto ToDto(MatchEvent e)
    {
        var goal = e.UserMatchGoal;
        var penalty = e.UserMatchPenalty;
        var point = e.UserMatchPoint;

        string? playerName = null;
        int? rosterPlayerId = null;
        int? userMatchId = null;
        string? userName = null;
        string? pointReasonName = null;
        PointType? pointType = null;
        GoalType? goalType = null;

        if (goal != null)
        {
            rosterPlayerId = goal.RosterPlayerId;
            playerName = $"{goal.RosterPlayer?.FirstName} {goal.RosterPlayer?.Surname}".Trim();
            userMatchId = goal.UserMatchId;
            userName = goal.UserMatch?.User?.Name;
            goalType = goal.GoalType;
        }
        else if (penalty != null)
        {
            rosterPlayerId = penalty.RosterPlayerId;
            playerName = $"{penalty.RosterPlayer?.FirstName} {penalty.RosterPlayer?.Surname}".Trim();
            userMatchId = penalty.UserMatchId;
            userName = penalty.UserMatch?.User?.Name;
        }
        else if (point != null)
        {
            userMatchId = point.UserMatchId;
            userName = point.UserMatch?.User?.Name;
            pointReasonName = point.PointReason?.Name;
            pointType = point.PointReason?.PointType;
        }

        return new MatchEventDto(
            e.Id,
            e.MatchId,
            e.OrderIndex,
            e.EventType,
            e.IsOpponent,
            e.EventSubtype,
            e.UserMatchGoalId,
            e.UserMatchPenaltyId,
            e.UserMatchPointId,
            rosterPlayerId,
            playerName,
            userMatchId,
            userName,
            pointReasonName,
            pointType,
            goalType,
            e.CreatedAt);
    }

    public async Task<IEnumerable<MatchEventDto>> GetEventsByMatchAsync(int matchId)
    {
        var events = await _db.MatchEvents
            .AsNoTracking()
            .Include(e => e.UserMatchGoal)
                .ThenInclude(g => g!.RosterPlayer)
            .Include(e => e.UserMatchGoal)
                .ThenInclude(g => g!.UserMatch)
                    .ThenInclude(um => um!.User)
            .Include(e => e.UserMatchPenalty)
                .ThenInclude(p => p!.RosterPlayer)
            .Include(e => e.UserMatchPenalty)
                .ThenInclude(p => p!.UserMatch)
                    .ThenInclude(um => um!.User)
            .Include(e => e.UserMatchPoint)
                .ThenInclude(p => p!.PointReason)
            .Include(e => e.UserMatchPoint)
                .ThenInclude(p => p!.UserMatch)
                    .ThenInclude(um => um!.User)
            .Where(e => e.MatchId == matchId)
            .OrderBy(e => e.OrderIndex)
            .ToListAsync();

        return events.Select(ToDto);
    }

    public async Task<(MatchEventDto? result, string? error)> AddEventAsync(int matchId, CreateTeamMatchEventDto dto)
    {
        var match = await _db.Matches
            .Include(m => m.Season)
            .FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null)
            return (null, $"Match {matchId} not found.");

        var maxOrder = await _db.MatchEvents
            .Where(e => e.MatchId == matchId)
            .Select(e => (int?)e.OrderIndex)
            .MaxAsync() ?? 0;

        var nextOrder = maxOrder + 1;

        var matchEvent = new MatchEvent
        {
            MatchId = matchId,
            OrderIndex = nextOrder,
            EventType = dto.EventType,
            IsOpponent = dto.IsOpponent,
            EventSubtype = dto.EventSubtype,
            CreatedAt = DateTime.UtcNow
        };

        _db.MatchEvents.Add(matchEvent);

        bool hostedIsHome = match.HomeTeamId == match.Season?.HostedTeamId;

        if (dto.EventType == MatchEventType.Goal)
        {
            if (dto.IsOpponent)
            {
                if (hostedIsHome) match.AwayScore++;
                else match.HomeScore++;
            }
            else
            {
                if (hostedIsHome) match.HomeScore++;
                else match.AwayScore++;
            }
        }
        else if (dto.EventType == MatchEventType.PeriodChange)
        {
            if (match.CompletionType == CompletionType.None)
            {
                match.CompletionType = CompletionType.InProgress;
                if (!match.MatchDate.HasValue)
                    match.MatchDate = DateTime.UtcNow;
            }
        }
        else if (dto.EventType == MatchEventType.MatchEnd)
        {
            var targetCompletion = dto.EventSubtype switch
            {
                "OT" => CompletionType.Overtime,
                "SO" => CompletionType.Shootout,
                _ => CompletionType.RegularTime
            };

            match.CompletionType = targetCompletion;
            if (!match.MatchDate.HasValue)
                match.MatchDate = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            await _userMatchService.ApplyMatchEndAutoPointsAsync(
                matchId, match.HomeScore, match.AwayScore,
                match.Season?.HostedTeamId, match.HomeTeamId);
            await _betService.EvaluateMatchBetsAsync(matchId);
            return (ToDto(matchEvent), null);
        }

        await _db.SaveChangesAsync();

        return (ToDto(matchEvent), null);
    }

    public async Task<(bool success, string? error)> ReorderEventsAsync(int matchId, List<int> eventIds)
    {
        var events = await _db.MatchEvents
            .Where(e => e.MatchId == matchId)
            .ToListAsync();

        if (events.Count != eventIds.Count || !events.All(e => eventIds.Contains(e.Id)))
            return (false, "Event ID list does not match existing events for this match.");

        var dict = events.ToDictionary(e => e.Id);

        // Step 1: Set temporary negative indices to avoid unique constraint collision
        for (int i = 0; i < eventIds.Count; i++)
        {
            dict[eventIds[i]].OrderIndex = -(i + 1);
        }
        await _db.SaveChangesAsync();

        // Step 2: Set final positive indices
        for (int i = 0; i < eventIds.Count; i++)
        {
            dict[eventIds[i]].OrderIndex = i + 1;
        }
        await _db.SaveChangesAsync();

        return (true, null);
    }

    public async Task<bool> DeleteEventAsync(int matchId, int eventId)
    {
        var evt = await _db.MatchEvents
            .Include(e => e.Match)
                .ThenInclude(m => m!.Season)
            .FirstOrDefaultAsync(e => e.Id == eventId && e.MatchId == matchId);

        if (evt == null) return false;

        var match = evt.Match;
        bool hostedIsHome = match != null && match.HomeTeamId == match.Season?.HostedTeamId;

        bool wasMatchEnd = evt.EventType == MatchEventType.MatchEnd;

        // Clean up linked player entities and adjust scores if needed
        if (evt.UserMatchGoalId.HasValue)
        {
            var goal = await _db.UserMatchGoals.FindAsync(evt.UserMatchGoalId.Value);
            if (goal != null)
            {
                if (goal.GoalType != GoalType.Shootout && match != null)
                {
                    if (hostedIsHome) match.HomeScore = Math.Max(0, match.HomeScore - goal.Count);
                    else match.AwayScore = Math.Max(0, match.AwayScore - goal.Count);
                }
                _db.UserMatchGoals.Remove(goal);
            }
        }
        else if (evt.UserMatchPenaltyId.HasValue)
        {
            var pen = await _db.UserMatchPenalties.FindAsync(evt.UserMatchPenaltyId.Value);
            if (pen != null) _db.UserMatchPenalties.Remove(pen);
        }
        else if (evt.UserMatchPointId.HasValue)
        {
            var pt = await _db.UserMatchPoints.FindAsync(evt.UserMatchPointId.Value);
            if (pt != null) _db.UserMatchPoints.Remove(pt);
        }
        else if (evt.EventType == MatchEventType.Goal && match != null)
        {
            if (evt.IsOpponent)
            {
                if (hostedIsHome) match.AwayScore = Math.Max(0, match.AwayScore - 1);
                else match.HomeScore = Math.Max(0, match.HomeScore - 1);
            }
            else
            {
                if (hostedIsHome) match.HomeScore = Math.Max(0, match.HomeScore - 1);
                else match.AwayScore = Math.Max(0, match.AwayScore - 1);
            }
        }
        else if (evt.EventType == MatchEventType.MatchEnd && match != null)
        {
            if (evt.EventSubtype == "SO" || match.CompletionType == CompletionType.Shootout)
            {
                var tieScore = Math.Min(match.HomeScore, match.AwayScore);
                match.HomeScore = tieScore;
                match.AwayScore = tieScore;
            }
            match.CompletionType = CompletionType.InProgress;
        }

        _db.MatchEvents.Remove(evt);
        await _db.SaveChangesAsync();

        // Resequence remaining events to be 1..N
        var remaining = await _db.MatchEvents
            .Where(e => e.MatchId == matchId)
            .OrderBy(e => e.OrderIndex)
            .ToListAsync();

        for (int i = 0; i < remaining.Count; i++)
            remaining[i].OrderIndex = -(i + 1);
        await _db.SaveChangesAsync();

        for (int i = 0; i < remaining.Count; i++)
            remaining[i].OrderIndex = i + 1;
        await _db.SaveChangesAsync();

        if (wasMatchEnd)
        {
            await _betService.EvaluateMatchBetsAsync(matchId);
        }

        return true;
    }

    public async Task<(MatchDto? match, string? error)> EndShootoutAsync(int matchId)
    {
        var match = await _db.Matches
            .Include(m => m.Season)
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .FirstOrDefaultAsync(m => m.Id == matchId);

        if (match == null)
            return (null, $"Match {matchId} not found.");

        var events = await _db.MatchEvents
            .Where(e => e.MatchId == matchId)
            .ToListAsync();

        var ourSoGoals = events.Count(e => e.EventType == MatchEventType.ShootoutGoal && !e.IsOpponent);
        var oppSoGoals = events.Count(e => e.EventType == MatchEventType.ShootoutGoal && e.IsOpponent);

        if (ourSoGoals == oppSoGoals)
            return (null, "Shootout cannot end in a tie. Record a decisive shootout goal first.");

        bool hostedIsHome = match.HomeTeamId == match.Season?.HostedTeamId;

        if (ourSoGoals > oppSoGoals)
        {
            if (hostedIsHome) match.HomeScore++;
            else match.AwayScore++;
        }
        else
        {
            if (hostedIsHome) match.AwayScore++;
            else match.HomeScore++;
        }

        var maxOrder = events.Select(e => (int?)e.OrderIndex).Max() ?? 0;
        _db.MatchEvents.Add(new MatchEvent
        {
            MatchId = matchId,
            OrderIndex = maxOrder + 1,
            EventType = MatchEventType.MatchEnd,
            EventSubtype = "SO",
            CreatedAt = DateTime.UtcNow
        });

        match.CompletionType = CompletionType.Shootout;
        if (!match.MatchDate.HasValue)
            match.MatchDate = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        await _userMatchService.ApplyMatchEndAutoPointsAsync(
            matchId, match.HomeScore, match.AwayScore,
            match.Season?.HostedTeamId, match.HomeTeamId);
        await _betService.EvaluateMatchBetsAsync(matchId);

        var matchDto = new MatchDto(
            match.Id,
            match.SeasonId,
            match.MatchNumber,
            match.HomeTeamId,
            match.HomeTeam?.Name,
            match.HomeTeam?.ShortName,
            match.AwayTeamId,
            match.AwayTeam?.Name,
            match.AwayTeam?.ShortName,
            match.HomeScore,
            match.AwayScore,
            match.MatchDate,
            match.CompletionType,
            match.Phase,
            match.PlayoffRound);

        return (matchDto, null);
    }
}
