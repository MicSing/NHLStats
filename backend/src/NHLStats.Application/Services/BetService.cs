using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;
using NHLStats.Domain.Identity;

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

    private static string MakeShortId(Guid id) => "B-" + id.ToString("N").Substring(0, 6).ToUpperInvariant();

    private async Task<string> ResolveNameAsync(string loginId)
    {
        var user = await _db.Set<ApplicationUser>()
            .AsNoTracking()
            .Include(u => u.User)
            .FirstOrDefaultAsync(u => u.Id == loginId);
        return user?.User?.Name ?? user?.UserName ?? loginId;
    }

    private async Task<Dictionary<string, string>> ResolveNamesAsync(IEnumerable<string> loginIds)
    {
        var ids = loginIds.Distinct().ToList();
        var users = await _db.Set<ApplicationUser>()
            .AsNoTracking()
            .Include(u => u.User)
            .Where(u => ids.Contains(u.Id))
            .ToListAsync();
        return users.ToDictionary(u => u.Id, u => u.User?.Name ?? u.UserName ?? u.Id);
    }

    private static string DescribeShutoutLeg(BetLeg l, bool hostedSideWins)
    {
        var hostedTeamId = l.Match?.Season?.HostedTeamId;
        string? hostedName = hostedTeamId == l.Match?.HomeTeamId ? l.Match?.HomeTeam?.Name
            : hostedTeamId == l.Match?.AwayTeamId ? l.Match?.AwayTeam?.Name
            : null;
        string? opponentName = hostedTeamId == l.Match?.HomeTeamId ? l.Match?.AwayTeam?.Name
            : hostedTeamId == l.Match?.AwayTeamId ? l.Match?.HomeTeam?.Name
            : null;
        if (hostedName == null || opponentName == null)
            return hostedSideWins ? "Hosted Team Shutout Win" : "Opponent Shutout Win";

        var (winner, shutOut) = hostedSideWins ? (hostedName, opponentName) : (opponentName, hostedName);
        return $"{winner} win, {shutOut} score 0";
    }

    private static BetDto ToDto(Bet bet, IEnumerable<BetLeg> legs, string createdByName)
    {
        var legDtos = legs
            .OrderBy(l => l.Id)
            .Select(l => new BetLegDto(
                l.Id,
                l.MatchId,
                l.Match?.MatchNumber ?? 0,
                l.Match?.SeasonId ?? 0,
                l.Match?.HomeTeam?.Name,
                l.Match?.AwayTeam?.Name,
                l.BetType,
                l.UserId,
                l.TeamId,
                l.BetType == BetType.TeamDraw ? "Draw"
                    : l.BetType == BetType.MatchTotalGoals ? $"{l.Occasions}+ Goals"
                    : l.BetType == BetType.HostedShutoutWin ? DescribeShutoutLeg(l, hostedSideWins: true)
                    : l.BetType == BetType.OpponentShutoutWin ? DescribeShutoutLeg(l, hostedSideWins: false)
                    : (l.BetType == BetType.TeamWin || l.BetType == BetType.TeamWinOrDraw) ? l.Team?.Name : l.User?.Name,
                l.Odds,
                l.Occasions,
                l.Status,
                l.EvaluatedOn))
            .ToList();

        return new BetDto(
            bet.Id,
            MakeShortId(bet.Id),
            bet.CreatedBy,
            createdByName,
            bet.Stake,
            bet.TotalOdds,
            bet.Status,
            bet.Status == BetStatus.Won ? BettingConstants.GrossPayout(bet.Stake, bet.TotalOdds) : null,
            bet.CreatedOn,
            bet.UpdatedOn,
            bet.EvaluatedOn,
            legDtos);
    }

    private IQueryable<Bet> BetsWithLegsQuery(string loginId) =>
        _db.Bets
            .AsNoTracking()
            .Include(b => b.Legs)
                .ThenInclude(l => l.Match)
                    .ThenInclude(m => m!.HomeTeam)
            .Include(b => b.Legs)
                .ThenInclude(l => l.Match)
                    .ThenInclude(m => m!.AwayTeam)
            .Include(b => b.Legs)
                .ThenInclude(l => l.Match)
                    .ThenInclude(m => m!.Season)
            .Include(b => b.Legs)
                .ThenInclude(l => l.User)
            .Include(b => b.Legs)
                .ThenInclude(l => l.Team)
            .Where(b => b.CreatedBy == loginId);

    public async Task<IReadOnlyList<BetDto>> GetActiveAsync(string loginId)
    {
        var bets = await BetsWithLegsQuery(loginId)
            .Where(b => b.Status == BetStatus.Pending)
            .OrderByDescending(b => b.CreatedOn)
            .ToListAsync();
        var name = await ResolveNameAsync(loginId);
        return bets.Select(b => ToDto(b, b.Legs, name)).ToList();
    }

    public async Task<IReadOnlyList<BetDto>> GetHistoryAsync(string loginId, int? seasonId)
    {
        var query = BetsWithLegsQuery(loginId)
            .Where(b => b.Status != BetStatus.Pending);
        if (seasonId.HasValue)
        {
            query = query.Where(b => b.Legs.Any(l => l.Match!.SeasonId == seasonId.Value));
        }
        var bets = await query.OrderByDescending(b => b.CreatedOn).ToListAsync();
        var name = await ResolveNameAsync(loginId);
        return bets.Select(b => ToDto(b, b.Legs, name)).ToList();
    }

    private static BetLegDto AnonymizeLeg(BetLegDto leg) => new BetLegDto(
        leg.Id,
        MatchId: leg.MatchId,
        MatchNumber: leg.MatchNumber,
        SeasonId: leg.SeasonId,
        HomeTeamName: leg.HomeTeamName,
        AwayTeamName: leg.AwayTeamName,
        BetType: default,
        UserId: null,
        TeamId: null,
        TargetName: null,
        Odds: 0,
        Occasions: 1,
        leg.Status,
        leg.EvaluatedOn,
        IsAnonymized: true);

    public async Task<IReadOnlyList<BetDto>> GetAllBetsAsync(string? currentLoginId)
    {
        var bets = await _db.Bets
            .AsNoTracking()
            .Include(b => b.Legs)
                .ThenInclude(l => l.Match)
                    .ThenInclude(m => m!.HomeTeam)
            .Include(b => b.Legs)
                .ThenInclude(l => l.Match)
                    .ThenInclude(m => m!.AwayTeam)
            .Include(b => b.Legs)
                .ThenInclude(l => l.Match)
                    .ThenInclude(m => m!.Season)
            .Include(b => b.Legs)
                .ThenInclude(l => l.User)
            .Include(b => b.Legs)
                .ThenInclude(l => l.Team)
            .OrderByDescending(b => b.CreatedOn)
            .ToListAsync();
        var names = await ResolveNamesAsync(bets.Select(b => b.CreatedBy));
        return bets.Select(b =>
        {
            var dto = ToDto(b, b.Legs, names.GetValueOrDefault(b.CreatedBy, b.CreatedBy));
            if (b.CreatedBy == currentLoginId) return dto;
            var anonymizedLegs = dto.Legs
                .Select(l => l.EvaluatedOn == null && b.Status == BetStatus.Pending ? AnonymizeLeg(l) : l)
                .ToList();
            return dto with { Legs = anonymizedLegs };
        }).ToList();
    }

    public async Task<(BetDto? Bet, string? Error)> PlaceBetAsync(string loginId, CreateBetDto dto)
    {
        if (dto.Legs == null || dto.Legs.Count == 0)
            return (null, "Ticket must contain at least one leg.");
        if (dto.Stake <= 0)
            return (null, "Bet stake must be greater than 0.");

        var matchIds = dto.Legs.Select(l => l.MatchId).Distinct().ToList();
        var matches = await _db.Matches.AsNoTracking()
            .Where(m => matchIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id);

        var appUser = await _db.Set<ApplicationUser>()
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == loginId);
        var currentUserId = appUser?.UserId;

        var userMatchIds = currentUserId.HasValue
            ? (await _db.UserMatches.AsNoTracking()
                .Where(um => matchIds.Contains(um.MatchId) && um.UserId == currentUserId.Value)
                .Select(um => um.MatchId)
                .ToListAsync()).ToHashSet()
            : new HashSet<int>();

        var legsToInsert = new List<BetLeg>();
        decimal totalOdds = 1m;
        var matchesWithTeamOutcomeLeg = new HashSet<int>();
        var matchesWithGoalTotalLeg = new HashSet<int>();
        var matchesWithPlusPointLeg = new HashSet<int>();
        var matchesWithMinusPointLeg = new HashSet<int>();
        var matchesWithShutoutLeg = new HashSet<int>();

        foreach (var legDto in dto.Legs)
        {
            if (!matches.TryGetValue(legDto.MatchId, out var match))
                return (null, $"Match {legDto.MatchId} not found.");
            if (match.CompletionType == CompletionType.InProgress)
                return (null, $"Match {legDto.MatchId} is in progress. Betting is locked.");
            if (match.CompletionType != CompletionType.None)
                return (null, $"Match {legDto.MatchId} is already completed. Betting is closed.");

            var validationError = await ValidateLegPayloadAsync(match, legDto.BetType, legDto.UserId, legDto.TeamId, userMatchIds.Contains(legDto.MatchId));
            if (validationError != null) return (null, validationError);

            if (userMatchIds.Contains(legDto.MatchId))
            {
                if (legDto.BetType == BetType.TeamDraw ||
                    legDto.BetType == BetType.UserPlusPoint ||
                    legDto.BetType == BetType.UserMinusPoint ||
                    legDto.BetType == BetType.OpponentShutoutWin)
                    return (null, "Match participants can only bet on team win, player goals, penalties, and hosted-team shutout.");

                if ((legDto.BetType == BetType.UserGoal || legDto.BetType == BetType.UserPenalty)
                    && currentUserId.HasValue && legDto.UserId == currentUserId.Value)
                    return (null, "You cannot bet on yourself.");
            }

            if (legDto.BetType == BetType.TeamWin || legDto.BetType == BetType.TeamWinOrDraw || legDto.BetType == BetType.TeamDraw)
            {
                if (!matchesWithTeamOutcomeLeg.Add(legDto.MatchId))
                    return (null, $"Only one match-result bet (1, X, 1X) is allowed per match in a single ticket.");
            }

            if (legDto.BetType == BetType.MatchTotalGoals)
            {
                if (!matchesWithGoalTotalLeg.Add(legDto.MatchId))
                    return (null, "Only one total-goals bet is allowed per match in a single ticket.");
            }

            if (legDto.BetType == BetType.HostedShutoutWin || legDto.BetType == BetType.OpponentShutoutWin)
            {
                if (!matchesWithShutoutLeg.Add(legDto.MatchId))
                    return (null, "Only one shutout-win bet is allowed per match in a single ticket.");
            }

            if (legDto.BetType == BetType.UserPlusPoint)
            {
                if (!matchesWithPlusPointLeg.Add(legDto.MatchId))
                    return (null, "Only one plus-point bet is allowed per match in a single ticket.");
            }

            if (legDto.BetType == BetType.UserMinusPoint)
            {
                if (!matchesWithMinusPointLeg.Add(legDto.MatchId))
                    return (null, "Only one minus-point bet is allowed per match in a single ticket.");
            }

            var occasions = legDto.BetType == BetType.MatchTotalGoals ? Math.Max(BettingConstants.MinGoalThreshold, legDto.Occasions)
                : IsUserEventBetType(legDto.BetType) ? Math.Max(1, legDto.Occasions)
                : 1;

            decimal lockedOdds;
            if (legDto.BetType == BetType.MatchTotalGoals)
            {
                var oddsRow = await _db.MatchOdds.FirstOrDefaultAsync(o =>
                    o.MatchId == legDto.MatchId && o.BetType == OddsBetType.MatchTotalGoals && o.TargetId == occasions);
                if (oddsRow == null)
                {
                    await _oddsService.RecalculateForMatchAsync(legDto.MatchId);
                    oddsRow = await _db.MatchOdds.FirstOrDefaultAsync(o =>
                        o.MatchId == legDto.MatchId && o.BetType == OddsBetType.MatchTotalGoals && o.TargetId == occasions);
                }
                if (oddsRow == null || oddsRow.Probability < BettingConstants.MinBettableProbability)
                    return (null, "This total-goals threshold is not available for betting.");
                lockedOdds = oddsRow.Odds;
            }
            else if (occasions > 1 && IsUserEventBetType(legDto.BetType) && legDto.UserId.HasValue)
            {
                var oddsBetType = BetTypeToOddsBetType(legDto.BetType);
                var occasionsResult = await _oddsService.GetUserEventOddsForOccasionsAsync(legDto.MatchId, oddsBetType, legDto.UserId.Value, occasions);
                if (occasionsResult == null)
                {
                    await _oddsService.RecalculateForMatchAsync(legDto.MatchId);
                    occasionsResult = await _oddsService.GetUserEventOddsForOccasionsAsync(legDto.MatchId, oddsBetType, legDto.UserId.Value, occasions);
                }
                if (occasionsResult == null)
                    return (null, "This selection is not available for betting.");
                lockedOdds = occasionsResult.Odds;
            }
            else
            {
                var oddsRow = await GetOddsForLegAsync(legDto.MatchId, legDto.BetType, legDto.UserId, legDto.TeamId);
                if (oddsRow == null)
                {
                    await _oddsService.RecalculateForMatchAsync(legDto.MatchId);
                    oddsRow = await GetOddsForLegAsync(legDto.MatchId, legDto.BetType, legDto.UserId, legDto.TeamId);
                }
                if (oddsRow != null && oddsRow.Probability < BettingConstants.MinBettableProbability)
                    return (null, "Probability too low — this selection is not available for betting.");
                lockedOdds = oddsRow?.Odds ?? 1.0m;
            }

            if (lockedOdds < 1.0m)
                return (null, "Odds for this bet are below 1.0 and cannot be placed.");
            totalOdds = Math.Floor(totalOdds * lockedOdds * 100m) / 100m;

            legsToInsert.Add(new BetLeg
            {
                MatchId = legDto.MatchId,
                BetType = legDto.BetType,
                UserId = (legDto.BetType == BetType.TeamWin || legDto.BetType == BetType.TeamWinOrDraw || legDto.BetType == BetType.TeamDraw
                          || legDto.BetType == BetType.HostedShutoutWin || legDto.BetType == BetType.OpponentShutoutWin || legDto.BetType == BetType.MatchTotalGoals)
                    ? null : legDto.UserId,
                TeamId = (legDto.BetType == BetType.TeamDraw || legDto.BetType == BetType.HostedShutoutWin
                          || legDto.BetType == BetType.OpponentShutoutWin || legDto.BetType == BetType.MatchTotalGoals)
                    ? null : legDto.TeamId,
                Odds = lockedOdds,
                Occasions = occasions,
                Status = BetLegStatus.Pending
            });
        }

        var balance = await _balanceService.GetBalanceAsync(loginId);
        if (dto.Stake > balance.AvailableBalance)
            return (null, "Insufficient betting balance.");
        if (balance.MaxWinCap > 0 && dto.Stake * totalOdds > balance.MaxWinCap)
            return (null, $"Potential winnings exceed max win cap of {balance.MaxWinCap:F2}€.");

        var bet = new Bet
        {
            Id = Guid.NewGuid(),
            CreatedBy = loginId,
            Stake = dto.Stake,
            TotalOdds = totalOdds,
            Status = BetStatus.Pending,
            CreatedOn = DateTime.UtcNow,
            Legs = legsToInsert
        };

        _db.Bets.Add(bet);
        await _db.SaveChangesAsync();

        var saved = await BetsWithLegsQuery(loginId).FirstAsync(b => b.Id == bet.Id);
        var name = await ResolveNameAsync(loginId);
        return (ToDto(saved, saved.Legs, name), null);
    }

    public async Task<(bool Success, string? Error)> CancelBetAsync(Guid betId, string loginId)
    {
        var bet = await _db.Bets
            .Include(b => b.Legs)
                .ThenInclude(l => l.Match)
            .FirstOrDefaultAsync(b => b.Id == betId && b.CreatedBy == loginId);
        if (bet == null) return (false, "Bet not found.");
        if (bet.Status != BetStatus.Pending) return (false, "Only pending bets can be cancelled.");

        foreach (var leg in bet.Legs)
        {
            if (leg.Match == null) continue;
            if (leg.Match.CompletionType == CompletionType.InProgress)
                return (false, "A match in this ticket is in progress. Cannot cancel bet.");
            if (leg.Match.CompletionType != CompletionType.None)
                return (false, "A match in this ticket is already completed. Cannot cancel bet.");
        }

        _db.Bets.Remove(bet);
        await _db.SaveChangesAsync();
        return (true, null);
    }

    public async Task CancelBetsForPlayerInMatchAsync(int matchId, int userId)
    {
        var legs = await _db.BetLegs
            .Include(l => l.Bet)
            .Where(l => l.MatchId == matchId && l.UserId == userId && l.Status == BetLegStatus.Pending)
            .ToListAsync();

        if (legs.Count == 0) return;

        var now = DateTime.UtcNow;
        foreach (var leg in legs)
        {
            leg.Status = BetLegStatus.Cancelled;
            leg.EvaluatedOn = now;
            if (leg.Bet != null && leg.Bet.Status == BetStatus.Pending)
            {
                leg.Bet.Status = BetStatus.Cancelled;
                leg.Bet.UpdatedOn = now;
                leg.Bet.EvaluatedOn = now;
            }
        }
        await _db.SaveChangesAsync();
    }

    public async Task EvaluateMatchBetsAsync(int matchId)
    {
        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null) return;

        var legs = await _db.BetLegs
            .Include(l => l.Bet)
                .ThenInclude(b => b!.Legs)
            .Where(l => l.MatchId == matchId)
            .ToListAsync();
        if (legs.Count == 0) return;

        bool matchCompleted = match.CompletionType != CompletionType.None
                              && match.CompletionType != CompletionType.InProgress;

        int? anyWinnerId = !matchCompleted ? null
            : match.HomeScore > match.AwayScore ? match.HomeTeamId
            : match.AwayScore > match.HomeScore ? match.AwayTeamId
            : (int?)null;

        int? regulationWinnerId = matchCompleted && match.CompletionType == CompletionType.RegularTime
            ? anyWinnerId
            : null;

        bool isDraw = matchCompleted && match.HomeScore == match.AwayScore;
        bool isOtOrSo = matchCompleted &&
            (match.CompletionType == CompletionType.Overtime ||
             match.CompletionType == CompletionType.Shootout);

        var hostedTeamId = await _db.Seasons.AsNoTracking()
            .Where(s => s.Id == match.SeasonId)
            .Select(s => s.HostedTeamId)
            .FirstOrDefaultAsync();

        bool? hostedShutoutWon = !matchCompleted || hostedTeamId is not int hosted
            ? (bool?)null
            : hosted == match.HomeTeamId
                ? (match.HomeScore > match.AwayScore && match.AwayScore == 0)
                : hosted == match.AwayTeamId
                    ? (match.AwayScore > match.HomeScore && match.HomeScore == 0)
                    : (bool?)null;

        bool? opponentShutoutWon = !matchCompleted || hostedTeamId is not int hostedForOpp
            ? (bool?)null
            : hostedForOpp == match.HomeTeamId
                ? (match.AwayScore > match.HomeScore && match.HomeScore == 0)
                : hostedForOpp == match.AwayTeamId
                    ? (match.HomeScore > match.AwayScore && match.AwayScore == 0)
                    : (bool?)null;

        int totalGoals = match.HomeScore + match.AwayScore;

        var userGoalCounts = await _db.UserMatchGoals
            .Include(g => g.UserMatch)
            .Where(g => g.UserMatch!.MatchId == matchId)
            .GroupBy(g => g.UserMatch!.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Sum(x => x.Count) })
            .ToDictionaryAsync(x => x.UserId, x => x.Count);

        var userPenaltyCounts = await _db.UserMatchPenalties
            .Include(p => p.UserMatch)
            .Where(p => p.UserMatch!.MatchId == matchId)
            .GroupBy(p => p.UserMatch!.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Sum(x => x.Count) })
            .ToDictionaryAsync(x => x.UserId, x => x.Count);

        var userPlusPointCounts = await _db.UserMatchPoints
            .Include(p => p.UserMatch)
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch!.MatchId == matchId && p.PointReason!.PointType == PointType.Positive)
            .GroupBy(p => p.UserMatch!.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count);

        var userMinusPointCounts = await _db.UserMatchPoints
            .Include(p => p.UserMatch)
            .Include(p => p.PointReason)
            .Where(p => p.UserMatch!.MatchId == matchId && p.PointReason!.PointType == PointType.Negative)
            .GroupBy(p => p.UserMatch!.UserId)
            .Select(g => new { UserId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.UserId, x => x.Count);

        var now = DateTime.UtcNow;
        var affectedBets = new HashSet<Bet>();

        foreach (var leg in legs)
        {
            bool? won = leg.BetType switch
            {
                BetType.TeamWin => !matchCompleted || !leg.TeamId.HasValue
                    ? (bool?)null
                    : regulationWinnerId.HasValue && regulationWinnerId.Value == leg.TeamId.Value,
                BetType.TeamWinOrDraw => !matchCompleted || !leg.TeamId.HasValue
                    ? (bool?)null
                    : (anyWinnerId.HasValue && anyWinnerId.Value == leg.TeamId.Value) || isDraw,
                BetType.TeamDraw => !matchCompleted ? (bool?)null : (isDraw || isOtOrSo),
                BetType.UserGoal => leg.UserId.HasValue
                    ? userGoalCounts.GetValueOrDefault(leg.UserId.Value) >= leg.Occasions
                    : (bool?)null,
                BetType.UserPenalty => leg.UserId.HasValue
                    ? userPenaltyCounts.GetValueOrDefault(leg.UserId.Value) >= leg.Occasions
                    : (bool?)null,
                BetType.UserPlusPoint => leg.UserId.HasValue
                    ? userPlusPointCounts.GetValueOrDefault(leg.UserId.Value) >= leg.Occasions
                    : (bool?)null,
                BetType.UserMinusPoint => leg.UserId.HasValue
                    ? userMinusPointCounts.GetValueOrDefault(leg.UserId.Value) >= leg.Occasions
                    : (bool?)null,
                BetType.MatchTotalGoals => !matchCompleted ? (bool?)null : totalGoals >= leg.Occasions,
                BetType.HostedShutoutWin => hostedShutoutWon,
                BetType.OpponentShutoutWin => opponentShutoutWon,
                _ => null
            };

            if (won.HasValue)
            {
                leg.Status = won.Value ? BetLegStatus.Won : BetLegStatus.Lost;
                leg.EvaluatedOn = now;
                if (leg.Bet != null) affectedBets.Add(leg.Bet);
            }
        }

        foreach (var bet in affectedBets)
        {
            var newStatus = RollupStatus(bet.Legs);
            if (newStatus != BetStatus.Pending)
            {
                bet.Status = newStatus;
                bet.EvaluatedOn = now;
                bet.UpdatedOn = now;
            }
        }

        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Recalculates TotalOdds for Won bets that stacked 2+ same-type plus/minus-point legs on
    /// the same match (now capped at 1 per match per type). Each offending match's plus/minus
    /// legs of one type collapse to their single highest odds; all other legs are untouched.
    /// Pure function of leg data — safe to re-run at any time (see docs/adr/0002).
    /// </summary>
    public async Task<int> RecalculatePlusMinusOddsAsync()
    {
        var wonBets = await _db.Bets
            .Include(b => b.Legs)
            .Where(b => b.Status == BetStatus.Won)
            .ToListAsync();

        int recalculated = 0;
        foreach (var bet in wonBets)
        {
            var newTotalOdds = RecomputeCollapsedTotalOdds(bet.Legs);
            if (newTotalOdds != bet.TotalOdds)
            {
                bet.TotalOdds = newTotalOdds;
                recalculated++;
            }
        }

        if (recalculated > 0)
            await _db.SaveChangesAsync();

        return recalculated;
    }

    private static decimal RecomputeCollapsedTotalOdds(IEnumerable<BetLeg> legs)
    {
        var legList = legs.ToList();
        var violatingLegIds = new HashSet<int>();
        decimal collapsedFactor = 1m;

        foreach (var betType in new[] { BetType.UserPlusPoint, BetType.UserMinusPoint })
        {
            var groups = legList
                .Where(l => l.BetType == betType)
                .GroupBy(l => l.MatchId)
                .Where(g => g.Count() >= 2);

            foreach (var group in groups)
            {
                foreach (var leg in group) violatingLegIds.Add(leg.Id);
                collapsedFactor = Math.Floor(collapsedFactor * group.Max(l => l.Odds) * 100m) / 100m;
            }
        }

        var otherLegsFactor = legList
            .Where(l => !violatingLegIds.Contains(l.Id))
            .Aggregate(1m, (acc, l) => Math.Floor(acc * l.Odds * 100m) / 100m);

        return Math.Floor(otherLegsFactor * collapsedFactor * 100m) / 100m;
    }

    private static BetStatus RollupStatus(IEnumerable<BetLeg> legs)
    {
        var list = legs.ToList();
        if (list.Any(l => l.Status == BetLegStatus.Cancelled)) return BetStatus.Cancelled;
        if (list.Any(l => l.Status == BetLegStatus.Lost)) return BetStatus.Lost;
        if (list.All(l => l.Status == BetLegStatus.Won)) return BetStatus.Won;
        return BetStatus.Pending;
    }

    private async Task<string?> ValidateLegPayloadAsync(Match match, BetType betType, int? userId, int? teamId, bool isUserInMatch)
    {
        if (betType == BetType.TeamDraw || betType == BetType.HostedShutoutWin || betType == BetType.OpponentShutoutWin)
            return null;

        if (betType == BetType.MatchTotalGoals)
        {
            var completedCount = await _db.Matches.AsNoTracking()
                .Where(m => m.SeasonId == match.SeasonId
                            && m.CompletionType != CompletionType.None
                            && m.CompletionType != CompletionType.InProgress)
                .CountAsync();
            if (completedCount < 10)
                return "At least 10 completed matches are required before betting on total goals.";
            return null;
        }

        if (betType == BetType.TeamWin || betType == BetType.TeamWinOrDraw)
        {
            if (!teamId.HasValue) return "TeamId is required for team-based bet type.";
            if (teamId.Value != match.HomeTeamId && teamId.Value != match.AwayTeamId)
                return "TeamId must be one of the match teams.";
            if (isUserInMatch)
            {
                var season = await _db.Seasons.AsNoTracking().FirstOrDefaultAsync(s => s.Id == match.SeasonId);
                if (season?.HostedTeamId == null || teamId.Value != season.HostedTeamId)
                    return "You can only bet on the season's hosted team.";
            }
            return null;
        }

        if (!userId.HasValue) return "UserId is required for user-based bet types.";
        var userExists = await _db.Users.AnyAsync(u => u.Id == userId.Value);
        if (!userExists) return "User not found.";
        return null;
    }

    private async Task<MatchOdds?> GetOddsForLegAsync(int matchId, BetType betType, int? userId, int? teamId)
    {
        var oddsBetType = betType switch
        {
            BetType.TeamWin           => OddsBetType.TeamWin,
            BetType.TeamWinOrDraw     => OddsBetType.TeamWinOrDraw,
            BetType.TeamDraw          => OddsBetType.Draw,
            BetType.UserGoal          => OddsBetType.UserGoal,
            BetType.UserPenalty       => OddsBetType.UserPenalty,
            BetType.UserPlusPoint     => OddsBetType.UserPlusPoint,
            BetType.UserMinusPoint    => OddsBetType.UserMinusPoint,
            BetType.HostedShutoutWin  => OddsBetType.HostedShutoutWin,
            BetType.OpponentShutoutWin => OddsBetType.OpponentShutoutWin,
            _ => OddsBetType.TeamWin
        };
        var targetId = (betType == BetType.TeamWin || betType == BetType.TeamWinOrDraw) ? teamId
            : (betType == BetType.TeamDraw || betType == BetType.HostedShutoutWin || betType == BetType.OpponentShutoutWin) ? (int?)null
            : userId;

        return await _db.MatchOdds
            .FirstOrDefaultAsync(o => o.MatchId == matchId && o.BetType == oddsBetType && o.TargetId == targetId);
    }

    private static bool IsUserEventBetType(BetType betType) =>
        betType is BetType.UserGoal or BetType.UserPenalty or BetType.UserPlusPoint or BetType.UserMinusPoint;

    private static OddsBetType BetTypeToOddsBetType(BetType betType) => betType switch
    {
        BetType.UserGoal       => OddsBetType.UserGoal,
        BetType.UserPenalty    => OddsBetType.UserPenalty,
        BetType.UserPlusPoint  => OddsBetType.UserPlusPoint,
        BetType.UserMinusPoint => OddsBetType.UserMinusPoint,
        BetType.TeamWin        => OddsBetType.TeamWin,
        BetType.TeamWinOrDraw  => OddsBetType.TeamWinOrDraw,
        _                      => OddsBetType.Draw
    };
}
