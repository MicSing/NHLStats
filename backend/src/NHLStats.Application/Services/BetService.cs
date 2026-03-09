using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class BetService : IBetService
{
    private readonly NhlStatsDbContext _db;

    public BetService(NhlStatsDbContext db) => _db = db;

    private static BetDto ToDto(Bet bet) => new(
        bet.Id,
        bet.MatchId,
        bet.BetType,
        bet.UserId,
        bet.TeamId,
        bet.CreatedBy,
        bet.CreatedOn,
        bet.UpdatedOn,
        bet.EvaluatedOn);

    public async Task<BetDto?> GetForMatchAsync(int matchId, string loginId)
    {
        var bet = await _db.Bets
            .AsNoTracking()
            .FirstOrDefaultAsync(b => b.MatchId == matchId && b.CreatedBy == loginId);

        return bet == null ? null : ToDto(bet);
    }

    public async Task<(BetDto? Bet, string? Error)> CreateForMatchAsync(int seasonId, int matchId, string loginId, CreateBetDto dto)
    {
        var (match, error) = await ValidateMatchAndPayloadAsync(seasonId, matchId, dto.BetType, dto.UserId, dto.TeamId);
        if (error != null) return (null, error);

        var existing = await _db.Bets
            .AnyAsync(b => b.MatchId == matchId && b.CreatedBy == loginId);
        if (existing) return (null, "Bet already exists for this match. Use update instead.");

        var now = DateTime.UtcNow;
        var bet = new Bet
        {
            Id = Guid.NewGuid(),
            MatchId = match!.Id,
            BetType = dto.BetType,
            UserId = dto.BetType == BetType.TeamWin ? null : dto.UserId,
            TeamId = dto.BetType == BetType.TeamWin ? dto.TeamId : dto.TeamId,
            CreatedBy = loginId,
            CreatedOn = now,
            UpdatedOn = null,
            EvaluatedOn = null
        };

        _db.Bets.Add(bet);
        await _db.SaveChangesAsync();
        return (ToDto(bet), null);
    }

    public async Task<(BetDto? Bet, string? Error)> UpdateForMatchAsync(int seasonId, int matchId, string loginId, UpdateBetDto dto)
    {
        var (match, error) = await ValidateMatchAndPayloadAsync(seasonId, matchId, dto.BetType, dto.UserId, dto.TeamId);
        if (error != null) return (null, error);

        var bet = await _db.Bets
            .FirstOrDefaultAsync(b => b.MatchId == match!.Id && b.CreatedBy == loginId);
        if (bet == null) return (null, "Bet not found for this match.");

        bet.BetType = dto.BetType;
        bet.UserId = dto.BetType == BetType.TeamWin ? null : dto.UserId;
        bet.TeamId = dto.TeamId;
        bet.EvaluatedOn = dto.EvaluatedOn;
        bet.UpdatedOn = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return (ToDto(bet), null);
    }

    public async Task<bool> DeleteForMatchAsync(int seasonId, int matchId, string loginId)
    {
        var exists = await _db.Matches
            .AnyAsync(m => m.Id == matchId && m.SeasonId == seasonId);
        if (!exists) return false;

        var bet = await _db.Bets
            .FirstOrDefaultAsync(b => b.MatchId == matchId && b.CreatedBy == loginId);
        if (bet == null) return false;

        _db.Bets.Remove(bet);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteByIdAsync(Guid id, string loginId)
    {
        var bet = await _db.Bets
            .FirstOrDefaultAsync(b => b.Id == id && b.CreatedBy == loginId);
        if (bet == null) return false;

        _db.Bets.Remove(bet);
        await _db.SaveChangesAsync();
        return true;
    }

    private async Task<(Match? Match, string? Error)> ValidateMatchAndPayloadAsync(
        int seasonId,
        int matchId,
        BetType betType,
        int? userId,
        int? teamId)
    {
        var match = await _db.Matches
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == matchId && m.SeasonId == seasonId);
        if (match == null) return (null, "Match not found for season.");

        if (betType == BetType.TeamWin)
        {
            if (!teamId.HasValue) return (null, "TeamId is required for TeamWin bet type.");
            if (teamId.Value != match.HomeTeamId && teamId.Value != match.AwayTeamId)
                return (null, "TeamId must be one of the match teams.");
            return (match, null);
        }

        if (!userId.HasValue)
            return (null, "UserId is required for user-based bet types.");

        var userExists = await _db.Users.AnyAsync(u => u.Id == userId.Value);
        if (!userExists) return (null, "User not found.");

        if (teamId.HasValue)
        {
            var teamExists = await _db.Teams.AnyAsync(t => t.Id == teamId.Value);
            if (!teamExists) return (null, "Team not found.");
        }

        return (match, null);
    }
}
