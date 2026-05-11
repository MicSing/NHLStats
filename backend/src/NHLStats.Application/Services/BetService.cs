using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class BetService : IBetService
{
    private readonly NhlStatsDbContext _db;
    private readonly IBettingBalanceService _balanceService;
    private readonly IBettingOddsService _oddsService;

    public BetService(NhlStatsDbContext db, IBettingBalanceService balanceService, IBettingOddsService oddsService)
    {
        _db = db;
        _balanceService = balanceService;
        _oddsService = oddsService;
    }

    private static BetDto ToDto(Bet bet) => new(
        bet.Id,
        bet.MatchId,
        bet.BetType,
        bet.UserId,
        bet.TeamId,
        bet.Amount,
        bet.Odds,
        bet.Status,
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

    public async Task<IEnumerable<BetHistoryDto>> GetHistoryAsync(string loginId, int? seasonId)
    {
        var query = _db.Bets
            .Include(b => b.Match)
                .ThenInclude(m => m!.HomeTeam)
            .Include(b => b.Match)
                .ThenInclude(m => m!.AwayTeam)
            .Include(b => b.User)
            .Include(b => b.Team)
            .Where(b => b.CreatedBy == loginId)
            .AsNoTracking();

        if (seasonId.HasValue)
            query = query.Where(b => b.Match!.SeasonId == seasonId.Value);

        var bets = await query.OrderByDescending(b => b.CreatedOn).ToListAsync();

        return bets.Select(b => new BetHistoryDto(
            b.Id,
            b.MatchId,
            b.Match?.MatchNumber ?? 0,
            b.Match?.HomeTeam?.Name,
            b.Match?.AwayTeam?.Name,
            b.BetType,
            b.UserId,
            b.BetType == BetType.TeamWin ? b.Team?.Name : b.User?.Name,
            b.TeamId,
            b.Amount,
            b.Odds,
            b.Status,
            b.Status == BetStatus.Won ? BettingConstants.GrossPayout(b.Amount, b.Odds) : null,
            b.CreatedOn,
            b.EvaluatedOn));
    }

    public async Task<(BetDto? Bet, string? Error)> PlaceBetAsync(int matchId, string loginId, CreateBetDto dto)
    {
        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null) return (null, "Match not found.");
        if (match.CompletionType == CompletionType.InProgress)
            return (null, "Match is in progress. Betting is locked.");
        if (match.CompletionType != CompletionType.None)
            return (null, "Match is already completed. Betting is closed.");

        var validationError = await ValidateBetPayloadAsync(match, dto.BetType, dto.UserId, dto.TeamId);
        if (validationError != null) return (null, validationError);

        var existing = await _db.Bets.AnyAsync(b => b.MatchId == matchId && b.CreatedBy == loginId);
        if (existing) return (null, "Bet already exists for this match. Use update instead.");

        // Get locked odds — auto-recalculate if not yet cached
        var oddsRow = await GetOddsForBetAsync(matchId, dto.BetType, dto.UserId, dto.TeamId);
        if (oddsRow == null)
        {
            await _oddsService.RecalculateForMatchAsync(matchId);
            oddsRow = await GetOddsForBetAsync(matchId, dto.BetType, dto.UserId, dto.TeamId);
        }
        var lockedOdds = oddsRow?.Odds ?? 1.0m;

        var balance = await _balanceService.GetBalanceAsync(loginId);
        if (dto.Amount <= 0) return (null, "Bet amount must be greater than 0.");
        if (dto.Amount > balance.AvailableBalance) return (null, "Insufficient betting balance.");
        if (balance.MaxWinCap > 0 && dto.Amount * lockedOdds > balance.MaxWinCap)
            return (null, $"Potential winnings exceed max win cap of {balance.MaxWinCap:F2}€.");

        var bet = new Bet
        {
            Id = Guid.NewGuid(),
            MatchId = matchId,
            BetType = dto.BetType,
            UserId = dto.BetType == BetType.TeamWin ? null : dto.UserId,
            TeamId = dto.TeamId,
            Amount = dto.Amount,
            Odds = lockedOdds,
            Status = BetStatus.Pending,
            CreatedBy = loginId,
            CreatedOn = DateTime.UtcNow
        };

        _db.Bets.Add(bet);
        await _db.SaveChangesAsync();
        return (ToDto(bet), null);
    }

    public async Task<(BetDto? Bet, string? Error)> UpdateBetAsync(int matchId, string loginId, UpdateBetDto dto)
    {
        var bet = await _db.Bets.FirstOrDefaultAsync(b => b.MatchId == matchId && b.CreatedBy == loginId);
        if (bet == null) return (null, "Bet not found for this match.");

        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null) return (null, "Match not found.");
        if (match.CompletionType == CompletionType.InProgress)
            return (null, "Match is in progress. Betting is locked.");
        if (match.CompletionType != CompletionType.None)
            return (null, "Match is already completed. Betting is closed.");

        var validationError = await ValidateBetPayloadAsync(match, dto.BetType, dto.UserId, dto.TeamId);
        if (validationError != null) return (null, validationError);

        var oddsRow = await GetOddsForBetAsync(matchId, dto.BetType, dto.UserId, dto.TeamId);
        if (oddsRow == null)
        {
            await _oddsService.RecalculateForMatchAsync(matchId);
            oddsRow = await GetOddsForBetAsync(matchId, dto.BetType, dto.UserId, dto.TeamId);
        }
        var lockedOdds = oddsRow?.Odds ?? 1.0m;

        var oldAmount = bet.Amount;
        var balance = await _balanceService.GetBalanceAsync(loginId);
        var availableWithRefund = balance.AvailableBalance + oldAmount;
        if (dto.Amount > availableWithRefund) return (null, "Insufficient betting balance.");
        if (balance.MaxWinCap > 0 && dto.Amount * lockedOdds > balance.MaxWinCap)
            return (null, $"Potential winnings exceed max win cap of {balance.MaxWinCap:F2}€.");

        bet.BetType = dto.BetType;
        bet.UserId = dto.BetType == BetType.TeamWin ? null : dto.UserId;
        bet.TeamId = dto.TeamId;
        bet.Amount = dto.Amount;
        bet.Odds = lockedOdds;
        bet.UpdatedOn = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return (ToDto(bet), null);
    }

    public async Task<(bool Success, string? Error)> CancelBetAsync(int matchId, string loginId)
    {
        var bet = await _db.Bets.FirstOrDefaultAsync(b => b.MatchId == matchId && b.CreatedBy == loginId);
        if (bet == null) return (false, "Bet not found for this match.");

        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null) return (false, "Match not found.");
        if (match.CompletionType == CompletionType.InProgress)
            return (false, "Match is in progress. Cannot cancel bet.");
        if (match.CompletionType != CompletionType.None)
            return (false, "Match is already completed. Cannot cancel bet.");

        _db.Bets.Remove(bet);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task EvaluateMatchBetsAsync(int matchId)
    {
        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null) return;

        var bets = await _db.Bets
            .Where(b => b.MatchId == matchId && b.Status == BetStatus.Pending)
            .ToListAsync();

        if (!bets.Any()) return;

        var winningTeamId = match.HomeScore > match.AwayScore ? match.HomeTeamId
            : match.AwayScore > match.HomeScore ? match.AwayTeamId
            : (int?)null;

        var userMatchGoalIds = await _db.UserMatchGoals
            .Include(g => g.UserMatch)
            .Where(g => g.UserMatch!.MatchId == matchId)
            .Select(g => g.UserMatch!.UserId)
            .Distinct()
            .ToListAsync();

        var userMatchPenaltyIds = await _db.UserMatchPenalties
            .Include(p => p.UserMatch)
            .Where(p => p.UserMatch!.MatchId == matchId)
            .Select(p => p.UserMatch!.UserId)
            .Distinct()
            .ToListAsync();

        var now = DateTime.UtcNow;
        foreach (var bet in bets)
        {
            bool? won = bet.BetType switch
            {
                BetType.TeamWin => winningTeamId.HasValue && bet.TeamId.HasValue
                    ? bet.TeamId.Value == winningTeamId.Value
                    : (bool?)null,
                BetType.UserGoal => bet.UserId.HasValue
                    ? userMatchGoalIds.Contains(bet.UserId.Value)
                    : (bool?)null,
                BetType.UserPenalty => bet.UserId.HasValue
                    ? userMatchPenaltyIds.Contains(bet.UserId.Value)
                    : (bool?)null,
                _ => null
            };

            if (won.HasValue)
            {
                bet.Status = won.Value ? BetStatus.Won : BetStatus.Lost;
                bet.EvaluatedOn = now;
            }
        }

        await _db.SaveChangesAsync();
    }

    private async Task<string?> ValidateBetPayloadAsync(Match match, BetType betType, int? userId, int? teamId)
    {
        if (betType == BetType.TeamWin)
        {
            if (!teamId.HasValue) return "TeamId is required for TeamWin bet type.";
            if (teamId.Value != match.HomeTeamId && teamId.Value != match.AwayTeamId)
                return "TeamId must be one of the match teams.";
            var season = await _db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == match.SeasonId);
            if (season?.HostedTeamId == null || teamId.Value != season.HostedTeamId)
                return "You can only bet on the season's hosted team.";
            return null;
        }

        if (!userId.HasValue) return "UserId is required for user-based bet types.";
        var userExists = await _db.Users.AnyAsync(u => u.Id == userId.Value);
        if (!userExists) return "User not found.";
        return null;
    }

    private async Task<MatchOdds?> GetOddsForBetAsync(int matchId, BetType betType, int? userId, int? teamId)
    {
        var oddsBetType = betType switch
        {
            BetType.TeamWin => OddsBetType.TeamWin,
            BetType.UserGoal => OddsBetType.UserGoal,
            BetType.UserPenalty => OddsBetType.UserPenalty,
            _ => OddsBetType.TeamWin
        };
        var targetId = betType == BetType.TeamWin ? teamId : userId;

        return await _db.MatchOdds
            .FirstOrDefaultAsync(o => o.MatchId == matchId && o.BetType == oddsBetType && o.TargetId == targetId);
    }
}
