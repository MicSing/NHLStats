using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class UserMatchService : IUserMatchService
{
    private readonly NhlStatsDbContext _db;

    public UserMatchService(NhlStatsDbContext db) => _db = db;

    // ─── Projection helpers ───────────────────────────────────────────────────

    private static UserMatchDto ToDto(UserMatch um) => new(
        um.Id, um.UserId, um.User?.Name, um.MatchId, um.SeasonId);

    private static UserMatchPointDto ToPointDto(UserMatchPoint p) => new(
        p.Id, p.UserMatchId, p.PointReasonId, p.PointReason?.Name,
        p.PointReason?.IsPositive ?? false, p.Count);

    private static UserMatchGoalDto ToGoalDto(UserMatchGoal g) => new(
        g.Id, g.UserMatchId, g.RosterPlayerId,
        g.RosterPlayer?.FirstName, g.RosterPlayer?.Surname, g.Count, g.GoalType);

    private static UserMatchPenaltyDto ToPenaltyDto(UserMatchPenalty p) => new(
        p.Id, p.UserMatchId, p.RosterPlayerId,
        p.RosterPlayer?.FirstName, p.RosterPlayer?.Surname, p.Count);

    // ─── UserMatch CRUD ───────────────────────────────────────────────────────

    public async Task<IEnumerable<UserMatchDto>> GetByMatchAsync(int matchId) =>
        await _db.UserMatches
            .Include(um => um.User)
            .Where(um => um.MatchId == matchId)
            .Select(um => ToDto(um))
            .ToListAsync();

    public async Task<IEnumerable<UserMatchDto>> GetBySeasonAsync(int seasonId) =>
        await _db.UserMatches
            .Include(um => um.User)
            .Where(um => um.SeasonId == seasonId)
            .Select(um => ToDto(um))
            .ToListAsync();

    public async Task<UserMatchDto?> GetByIdAsync(int id)
    {
        var um = await _db.UserMatches
            .Include(um => um.User)
            .FirstOrDefaultAsync(um => um.Id == id);
        return um == null ? null : ToDto(um);
    }

    public async Task<(UserMatchDto? result, string? error)> CreateForMatchAsync(
        int seasonId, int matchId, CreateUserMatchDto dto)
    {
        // Validate the match belongs to this season
        var matchExists = await _db.Matches
            .AnyAsync(m => m.Id == matchId && m.SeasonId == seasonId);
        if (!matchExists)
            return (null, $"Match {matchId} does not belong to season {seasonId}.");

        // Validate user is in the season
        var inSeason = await _db.SeasonUsers
            .AnyAsync(su => su.SeasonId == seasonId && su.UserId == dto.UserId);
        if (!inSeason)
            return (null, $"User {dto.UserId} is not assigned to season {seasonId}.");

        // Prevent duplicate
        var duplicate = await _db.UserMatches
            .AnyAsync(um => um.MatchId == matchId && um.UserId == dto.UserId);
        if (duplicate)
            return (null, $"UserMatch for user {dto.UserId} in match {matchId} already exists.");

        var userMatch = new UserMatch
        {
            UserId = dto.UserId,
            MatchId = matchId,
            SeasonId = seasonId
        };
        _db.UserMatches.Add(userMatch);
        await _db.SaveChangesAsync();
        return (await GetByIdAsync(userMatch.Id), null);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var um = await _db.UserMatches.FindAsync(id);
        if (um == null) return false;
        _db.UserMatches.Remove(um);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<(int created, string? error)> InitializeUsersForMatchAsync(
        int seasonId, int matchId)
    {
        var matchExists = await _db.Matches
            .AnyAsync(m => m.Id == matchId && m.SeasonId == seasonId);
        if (!matchExists)
            return (0, $"Match {matchId} does not belong to season {seasonId}.");

        var seasonUserIds = await _db.SeasonUsers
            .Where(su => su.SeasonId == seasonId)
            .Select(su => su.UserId)
            .ToListAsync();

        var existingUserIds = await _db.UserMatches
            .Where(um => um.MatchId == matchId)
            .Select(um => um.UserId)
            .ToListAsync();

        var toCreate = seasonUserIds
            .Except(existingUserIds)
            .Select(userId => new UserMatch
            {
                UserId = userId,
                MatchId = matchId,
                SeasonId = seasonId
            })
            .ToList();

        _db.UserMatches.AddRange(toCreate);
        await _db.SaveChangesAsync();
        return (toCreate.Count, null);
    }

    // --- Aggregated data ────────────────────────────────────────────────────────────────

    public async Task<(AggregatedSeasonDataDto? result, string? error)> CreateAggregatedDataAsync(
        int userId, int seasonId, CreateAggregatedSeasonDataDto dto)
    {
        // Validate user is in the season
        var inSeason = await _db.SeasonUsers
            .AnyAsync(su => su.SeasonId == seasonId && su.UserId == userId);
        if (!inSeason)
            return (null, $"User {userId} is not assigned to season {seasonId}.");

        var existing = await _db.UserSeasonAggregatedData
            .FirstOrDefaultAsync(agg => agg.UserId == userId && agg.SeasonId == seasonId);
        if (existing != null)
            return (null, $"Aggregated data for user {userId} in season {seasonId} already exists.");

        var aggData = new UserSeasonAggregatedData
        {
            UserId = userId,
            SeasonId = seasonId,
            TotalPlus = dto.TotalPlus,
            TotalMinus = dto.TotalMinus,
            MatchesPlayed = dto.MatchesPlayed,
            CreatedAt = DateTime.UtcNow
        };
        _db.UserSeasonAggregatedData.Add(aggData);
        await _db.SaveChangesAsync();

        var resultDto = new AggregatedSeasonDataDto(
            aggData.Id, aggData.UserId, aggData.SeasonId, aggData.TotalPlus, aggData.TotalMinus, aggData.MatchesPlayed);
        return (resultDto, null);
    }

    public async Task<IEnumerable<AggregatedSeasonDataDto>> GetAggregatedDataAsync(int userId, int seasonId) =>
        await _db.UserSeasonAggregatedData
            .Where(agg => agg.UserId == userId && agg.SeasonId == seasonId)
            .Select(agg => new AggregatedSeasonDataDto(
                agg.Id, agg.UserId, agg.SeasonId, agg.TotalPlus, agg.TotalMinus, agg.MatchesPlayed))
            .ToListAsync();

    public async Task<IEnumerable<AggregatedSeasonDataDto>> GetAggregatedDataBySeasonAsync(int seasonId) =>
        await _db.UserSeasonAggregatedData
            .Where(agg => agg.SeasonId == seasonId)
            .Select(agg => new AggregatedSeasonDataDto(
                agg.Id, agg.UserId, agg.SeasonId, agg.TotalPlus, agg.TotalMinus, agg.MatchesPlayed))
            .ToListAsync();

    public async Task<(AggregatedSeasonDataDto? result, string? error)> UpdateAggregatedDataAsync(
        int userId, int seasonId, UpdateAggregatedSeasonDataDto dto)
    {
        var aggData = await _db.UserSeasonAggregatedData
            .FirstOrDefaultAsync(agg => agg.UserId == userId && agg.SeasonId == seasonId);
        if (aggData == null)
            return (null, $"Aggregated data for user {userId} in season {seasonId} not found.");

        aggData.TotalPlus = dto.TotalPlus;
        aggData.TotalMinus = dto.TotalMinus;
        aggData.MatchesPlayed = dto.MatchesPlayed;

        await _db.SaveChangesAsync();

        var resultDto = new AggregatedSeasonDataDto(
            aggData.Id, aggData.UserId, aggData.SeasonId, aggData.TotalPlus, aggData.TotalMinus, aggData.MatchesPlayed);
        return (resultDto, null);
    }

    public async Task<bool> DeleteAggregatedDataAsync(int userId, int seasonId)
    {
        var aggData = await _db.UserSeasonAggregatedData
            .FirstOrDefaultAsync(agg => agg.UserId == userId && agg.SeasonId == seasonId);
        if (aggData == null) return false;

        _db.UserSeasonAggregatedData.Remove(aggData);
        await _db.SaveChangesAsync();
        return true;
    }

    // ─── Points ───────────────────────────────────────────────────────────────

    public async Task<IEnumerable<UserMatchPointDto>> GetPointsAsync(int userMatchId) =>
        await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .Where(p => p.UserMatchId == userMatchId)
            .Select(p => ToPointDto(p))
            .ToListAsync();

    public async Task<(UserMatchPointDto? result, string? error)> AddPointAsync(
        int userMatchId, CreateUserMatchPointDto dto)
    {
        var userMatch = await _db.UserMatches.FindAsync(userMatchId);
        if (userMatch == null)
            return (null, $"UserMatch {userMatchId} not found.");

        var reason = await _db.PointReasons.FindAsync(dto.PointReasonId);
        if (reason == null)
            return (null, $"PointReason {dto.PointReasonId} not found.");

        var point = new UserMatchPoint
        {
            UserMatchId = userMatchId,
            PointReasonId = dto.PointReasonId,
            Count = dto.Count
        };
        _db.UserMatchPoints.Add(point);
        await _db.SaveChangesAsync();

        var loaded = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .FirstAsync(p => p.Id == point.Id);
        return (ToPointDto(loaded), null);
    }

    public async Task<(UserMatchPointDto? result, string? error)> UpdatePointAsync(
        int userMatchId, int pointId, UpdateUserMatchPointDto dto)
    {
        var userMatch = await _db.UserMatches.FindAsync(userMatchId);
        if (userMatch == null)
            return (null, $"UserMatch {userMatchId} not found.");

        var point = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .FirstOrDefaultAsync(p => p.Id == pointId && p.UserMatchId == userMatchId);
        if (point == null)
            return (null, $"Point {pointId} not found in UserMatch {userMatchId}.");

        var newReason = await _db.PointReasons.FindAsync(dto.PointReasonId);
        if (newReason == null)
            return (null, $"PointReason {dto.PointReasonId} not found.");

        point.PointReasonId = dto.PointReasonId;
        point.Count = dto.Count;

        await _db.SaveChangesAsync();

        var loaded = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .FirstAsync(p => p.Id == pointId);
        return (ToPointDto(loaded), null);
    }

    public async Task<bool> DeletePointAsync(int userMatchId, int pointId)
    {
        var point = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .FirstOrDefaultAsync(p => p.Id == pointId && p.UserMatchId == userMatchId);
        if (point == null) return false;

        _db.UserMatchPoints.Remove(point);
        await _db.SaveChangesAsync();

        return true;
    }

    // ─── Goals ────────────────────────────────────────────────────────────────

    public async Task<IEnumerable<UserMatchGoalDto>> GetGoalsAsync(int userMatchId) =>
        await _db.UserMatchGoals
            .Include(g => g.RosterPlayer)
            .Where(g => g.UserMatchId == userMatchId)
            .Select(g => ToGoalDto(g))
            .ToListAsync();

    public async Task<(UserMatchGoalDto? result, string? error)> AddGoalAsync(
        int userMatchId, CreateUserMatchGoalDto dto)
    {
        var userMatch = await _db.UserMatches.FindAsync(userMatchId);
        if (userMatch == null)
            return (null, $"UserMatch {userMatchId} not found.");

        var player = await _db.RosterPlayers.FindAsync(dto.RosterPlayerId);
        if (player == null)
            return (null, $"RosterPlayer {dto.RosterPlayerId} not found.");

        if (player.SeasonId != userMatch.SeasonId)
            return (null, $"RosterPlayer {dto.RosterPlayerId} does not belong to season {userMatch.SeasonId}.");

        var goal = new UserMatchGoal
        {
            UserMatchId = userMatchId,
            RosterPlayerId = dto.RosterPlayerId,
            Count = dto.Count,
            GoalType = dto.GoalType
        };
        _db.UserMatchGoals.Add(goal);
        await _db.SaveChangesAsync();

        var loaded = await _db.UserMatchGoals
            .Include(g => g.RosterPlayer)
            .FirstAsync(g => g.Id == goal.Id);
        return (ToGoalDto(loaded), null);
    }

    public async Task<(UserMatchGoalDto? result, string? error)> UpdateGoalAsync(
        int userMatchId, int goalId, UpdateUserMatchGoalDto dto)
    {
        var userMatch = await _db.UserMatches.FindAsync(userMatchId);
        if (userMatch == null)
            return (null, $"UserMatch {userMatchId} not found.");

        var goal = await _db.UserMatchGoals
            .FirstOrDefaultAsync(g => g.Id == goalId && g.UserMatchId == userMatchId);
        if (goal == null)
            return (null, $"Goal {goalId} not found in UserMatch {userMatchId}.");

        var player = await _db.RosterPlayers.FindAsync(dto.RosterPlayerId);
        if (player == null)
            return (null, $"RosterPlayer {dto.RosterPlayerId} not found.");

        if (player.SeasonId != userMatch.SeasonId)
            return (null, $"RosterPlayer {dto.RosterPlayerId} does not belong to season {userMatch.SeasonId}.");

        goal.RosterPlayerId = dto.RosterPlayerId;
        goal.Count = dto.Count;
        goal.GoalType = dto.GoalType;
        await _db.SaveChangesAsync();

        var loaded = await _db.UserMatchGoals
            .Include(g => g.RosterPlayer)
            .FirstAsync(g => g.Id == goalId);
        return (ToGoalDto(loaded), null);
    }

    public async Task<bool> DeleteGoalAsync(int userMatchId, int goalId)
    {
        var goal = await _db.UserMatchGoals
            .FirstOrDefaultAsync(g => g.Id == goalId && g.UserMatchId == userMatchId);
        if (goal == null) return false;

        _db.UserMatchGoals.Remove(goal);
        await _db.SaveChangesAsync();
        return true;
    }

    // ─── Penalties ────────────────────────────────────────────────────────────

    public async Task<IEnumerable<UserMatchPenaltyDto>> GetPenaltiesAsync(int userMatchId) =>
        await _db.UserMatchPenalties
            .Include(p => p.RosterPlayer)
            .Where(p => p.UserMatchId == userMatchId)
            .Select(p => ToPenaltyDto(p))
            .ToListAsync();

    public async Task<(UserMatchPenaltyDto? result, string? error)> AddPenaltyAsync(
        int userMatchId, CreateUserMatchPenaltyDto dto)
    {
        var userMatch = await _db.UserMatches.FindAsync(userMatchId);
        if (userMatch == null)
            return (null, $"UserMatch {userMatchId} not found.");

        var player = await _db.RosterPlayers.FindAsync(dto.RosterPlayerId);
        if (player == null)
            return (null, $"RosterPlayer {dto.RosterPlayerId} not found.");

        if (player.SeasonId != userMatch.SeasonId)
            return (null, $"RosterPlayer {dto.RosterPlayerId} does not belong to season {userMatch.SeasonId}.");

        var penalty = new UserMatchPenalty
        {
            UserMatchId = userMatchId,
            RosterPlayerId = dto.RosterPlayerId,
            Count = dto.Count
        };
        _db.UserMatchPenalties.Add(penalty);
        await _db.SaveChangesAsync();

        var loaded = await _db.UserMatchPenalties
            .Include(p => p.RosterPlayer)
            .FirstAsync(p => p.Id == penalty.Id);
        return (ToPenaltyDto(loaded), null);
    }

    public async Task<(UserMatchPenaltyDto? result, string? error)> UpdatePenaltyAsync(
        int userMatchId, int penaltyId, UpdateUserMatchPenaltyDto dto)
    {
        var userMatch = await _db.UserMatches.FindAsync(userMatchId);
        if (userMatch == null)
            return (null, $"UserMatch {userMatchId} not found.");

        var penalty = await _db.UserMatchPenalties
            .FirstOrDefaultAsync(p => p.Id == penaltyId && p.UserMatchId == userMatchId);
        if (penalty == null)
            return (null, $"Penalty {penaltyId} not found in UserMatch {userMatchId}.");

        var player = await _db.RosterPlayers.FindAsync(dto.RosterPlayerId);
        if (player == null)
            return (null, $"RosterPlayer {dto.RosterPlayerId} not found.");

        if (player.SeasonId != userMatch.SeasonId)
            return (null, $"RosterPlayer {dto.RosterPlayerId} does not belong to season {userMatch.SeasonId}.");

        penalty.RosterPlayerId = dto.RosterPlayerId;
        penalty.Count = dto.Count;
        await _db.SaveChangesAsync();

        var loaded = await _db.UserMatchPenalties
            .Include(p => p.RosterPlayer)
            .FirstAsync(p => p.Id == penaltyId);
        return (ToPenaltyDto(loaded), null);
    }

    public async Task<bool> DeletePenaltyAsync(int userMatchId, int penaltyId)
    {
        var penalty = await _db.UserMatchPenalties
            .FirstOrDefaultAsync(p => p.Id == penaltyId && p.UserMatchId == userMatchId);
        if (penalty == null) return false;

        _db.UserMatchPenalties.Remove(penalty);
        await _db.SaveChangesAsync();
        return true;
    }
}
