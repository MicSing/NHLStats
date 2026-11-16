using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

/// <summary>
/// Event proposals submitted by external clients (the Collector) through the ingest API.
/// A proposal changes nothing until an admin confirms it; confirming replays it through the
/// same services the admin UI uses for manual entry.
/// </summary>
public class MatchEventProposalService : IMatchEventProposalService
{
    public const int MaxBatchSize = 100;

    private static readonly HashSet<MatchEventType> AllowedTypes =
    [
        MatchEventType.Goal,
        MatchEventType.Penalty,
        MatchEventType.PeriodChange,
        MatchEventType.MatchEnd,
        MatchEventType.ShootoutGoal
    ];

    private readonly NhlStatsDbContext _db;
    private readonly IMatchEventService _matchEventService;
    private readonly IUserMatchService _userMatchService;

    public MatchEventProposalService(
        NhlStatsDbContext db,
        IMatchEventService matchEventService,
        IUserMatchService userMatchService)
    {
        _db = db;
        _matchEventService = matchEventService;
        _userMatchService = userMatchService;
    }

    // ─── Context ──────────────────────────────────────────────────────────────

    private static IngestMatchSummaryDto ToSummary(Match m) => new(
        m.Id, m.SeasonId, m.Season?.Name, m.MatchNumber,
        m.HomeTeamId, m.HomeTeam?.ShortName, m.AwayTeamId, m.AwayTeam?.ShortName,
        m.HomeScore, m.AwayScore, m.CompletionType, m.MatchDate);

    public async Task<IEnumerable<IngestMatchSummaryDto>> GetOpenMatchesAsync()
    {
        var matches = await _db.Matches
            .AsNoTracking()
            .Include(m => m.Season)
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .Where(m => m.CompletionType == CompletionType.None || m.CompletionType == CompletionType.InProgress)
            .Where(m => m.Season!.Status == SeasonStatus.Active)
            .OrderBy(m => m.SeasonId).ThenBy(m => m.MatchNumber)
            .ToListAsync();
        return matches.Select(ToSummary);
    }

    public async Task<IngestMatchContextDto?> GetContextAsync(int matchId)
    {
        var match = await _db.Matches
            .AsNoTracking()
            .Include(m => m.Season)
            .Include(m => m.HomeTeam)
            .Include(m => m.AwayTeam)
            .FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null) return null;

        var positions = await _db.SeasonUsers
            .AsNoTracking()
            .Where(su => su.SeasonId == match.SeasonId)
            .ToDictionaryAsync(su => su.UserId, su => su.Position);

        // Users of this match (UserMatch rows); fall back to active season users before initialization.
        var users = await _db.UserMatches
            .AsNoTracking()
            .Where(um => um.MatchId == matchId)
            .Select(um => new { um.UserId, um.User!.Name })
            .ToListAsync();
        if (users.Count == 0)
        {
            users = await _db.SeasonUsers
                .AsNoTracking()
                .Where(su => su.SeasonId == match.SeasonId && su.IsActive)
                .Select(su => new { su.UserId, su.User!.Name })
                .ToListAsync();
        }

        var hostedTeamId = match.Season?.HostedTeamId;
        var roster = await _db.SeasonRosterPlayers
            .AsNoTracking()
            .Where(srp => srp.SeasonId == match.SeasonId && srp.IsActive
                          && (hostedTeamId == null || srp.TeamId == hostedTeamId))
            .OrderBy(srp => srp.RosterPlayer!.Surname)
            .Select(srp => new IngestRosterPlayerDto(
                srp.RosterPlayerId,
                srp.RosterPlayer!.FirstName,
                srp.RosterPlayer!.Surname,
                srp.Position ?? srp.RosterPlayer!.Position))
            .ToListAsync();

        return new IngestMatchContextDto(
            ToSummary(match),
            hostedTeamId,
            match.HomeTeamId == hostedTeamId,
            users
                .DistinctBy(u => u.UserId)
                .OrderBy(u => u.Name)
                .Select(u => new IngestUserDto(u.UserId, u.Name, positions.GetValueOrDefault(u.UserId)))
                .ToList(),
            roster);
    }

    // ─── Submit ───────────────────────────────────────────────────────────────

    public async Task<(IReadOnlyList<IngestEventResultDto>? results, string? error)> SubmitAsync(
        int matchId, int apiKeyId, IReadOnlyList<IngestEventDto> events)
    {
        if (events.Count == 0) return ([], null);
        if (events.Count > MaxBatchSize)
            return (null, $"At most {MaxBatchSize} events per request.");

        var match = await _db.Matches.AsNoTracking().FirstOrDefaultAsync(m => m.Id == matchId);
        if (match == null) return (null, $"Match {matchId} not found.");

        var clientIds = events.Select(e => e.ClientEventId).Where(id => !string.IsNullOrWhiteSpace(id)).ToList();
        var existing = await _db.MatchEventProposals
            .AsNoTracking()
            .Where(p => p.ApiKeyId == apiKeyId && clientIds.Contains(p.ClientEventId))
            .Select(p => new { p.ClientEventId, p.Id })
            .ToDictionaryAsync(p => p.ClientEventId, p => p.Id);

        var seasonUserIds = (await _db.SeasonUsers
            .Where(su => su.SeasonId == match.SeasonId)
            .Select(su => su.UserId)
            .ToListAsync()).ToHashSet();
        var seasonRosterIds = (await _db.SeasonRosterPlayers
            .Where(srp => srp.SeasonId == match.SeasonId)
            .Select(srp => srp.RosterPlayerId)
            .ToListAsync()).ToHashSet();

        var results = new List<IngestEventResultDto>(events.Count);
        var pending = new List<(int index, MatchEventProposal entity)>();
        var seenInBatch = new HashSet<string>();

        foreach (var e in events)
        {
            var id = e.ClientEventId?.Trim() ?? "";
            string? error = null;
            if (id.Length == 0 || id.Length > 64) error = "ClientEventId is required (max 64 characters).";
            else if (!AllowedTypes.Contains(e.EventType)) error = $"Event type {e.EventType} cannot be proposed.";
            else if (e.UserId.HasValue && !seasonUserIds.Contains(e.UserId.Value)) error = $"User {e.UserId} is not in this season.";
            else if (e.RosterPlayerId.HasValue && !seasonRosterIds.Contains(e.RosterPlayerId.Value)) error = $"RosterPlayer {e.RosterPlayerId} is not in this season's roster.";

            if (error != null)
            {
                results.Add(new IngestEventResultDto(id, null, false, error));
                continue;
            }

            if (existing.TryGetValue(id, out var existingId))
            {
                results.Add(new IngestEventResultDto(id, existingId, true, null));
                continue;
            }
            if (!seenInBatch.Add(id))
            {
                results.Add(new IngestEventResultDto(id, null, true, null));
                continue;
            }

            var entity = new MatchEventProposal
            {
                MatchId = matchId,
                ApiKeyId = apiKeyId,
                ClientEventId = id,
                EventType = e.EventType,
                IsOpponent = e.IsOpponent,
                EventSubtype = Trunc(e.EventSubtype, 32),
                GoalType = e.GoalType,
                UserId = e.IsOpponent ? null : e.UserId,
                RosterPlayerId = e.IsOpponent ? null : e.RosterPlayerId,
                Period = e.Period,
                GameClock = Trunc(e.GameClock, 16),
                Strength = Trunc(e.Strength, 16),
                Confidence = e.Confidence,
                Note = Trunc(e.Note, 500),
                MediaRef = Trunc(e.MediaRef, 260),
                OccurredAt = e.OccurredAt,
                CreatedAt = DateTime.UtcNow
            };
            _db.MatchEventProposals.Add(entity);
            pending.Add((results.Count, entity));
            results.Add(new IngestEventResultDto(id, null, false, null));
        }

        if (pending.Count > 0)
        {
            await _db.SaveChangesAsync();
            foreach (var (index, entity) in pending)
                results[index] = results[index] with { ProposalId = entity.Id };
        }

        return (results, null);
    }

    private static string? Trunc(string? value, int max) =>
        value == null ? null : value.Length <= max ? value : value[..max];

    // ─── Review ───────────────────────────────────────────────────────────────

    public async Task<IEnumerable<MatchEventProposalDto>> GetByMatchAsync(int matchId, ProposalStatus? status = null)
    {
        var query = _db.MatchEventProposals.AsNoTracking().Include(p => p.ApiKey).Where(p => p.MatchId == matchId);
        if (status.HasValue) query = query.Where(p => p.Status == status.Value);
        var proposals = await query.OrderBy(p => p.CreatedAt).ThenBy(p => p.Id).ToListAsync();
        return await ToDtosAsync(proposals);
    }

    private async Task<List<MatchEventProposalDto>> ToDtosAsync(List<MatchEventProposal> proposals)
    {
        var userIds = proposals.Where(p => p.UserId.HasValue).Select(p => p.UserId!.Value).Distinct().ToList();
        var rosterIds = proposals.Where(p => p.RosterPlayerId.HasValue).Select(p => p.RosterPlayerId!.Value).Distinct().ToList();
        var users = await _db.Users.AsNoTracking().Where(u => userIds.Contains(u.Id)).ToDictionaryAsync(u => u.Id, u => u.Name);
        var players = await _db.RosterPlayers.AsNoTracking().Where(r => rosterIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id, r => $"{r.FirstName} {r.Surname}".Trim());

        return proposals.Select(p => new MatchEventProposalDto(
            p.Id, p.MatchId, p.ClientEventId, p.ApiKey?.Name,
            p.EventType, p.IsOpponent, p.EventSubtype, p.GoalType,
            p.UserId, p.UserId.HasValue ? users.GetValueOrDefault(p.UserId.Value) : null,
            p.RosterPlayerId, p.RosterPlayerId.HasValue ? players.GetValueOrDefault(p.RosterPlayerId.Value) : null,
            p.Period, p.GameClock, p.Strength, p.Confidence, p.Note, p.MediaRef, p.OccurredAt,
            p.Status, p.MatchEventId, p.CreatedAt, p.ResolvedAt)).ToList();
    }

    public async Task<(MatchEventProposalDto? result, string? error, bool notFound)> RejectAsync(int matchId, int proposalId)
    {
        var p = await _db.MatchEventProposals.Include(x => x.ApiKey)
            .FirstOrDefaultAsync(x => x.Id == proposalId && x.MatchId == matchId);
        if (p == null) return (null, null, true);
        if (p.Status != ProposalStatus.Proposed) return (null, $"Proposal is already {p.Status}.", false);

        p.Status = ProposalStatus.Rejected;
        p.ResolvedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return ((await ToDtosAsync([p]))[0], null, false);
    }

    public async Task<(MatchEventProposalDto? result, string? error, bool notFound)> ConfirmAsync(
        int matchId, int proposalId, ConfirmProposalDto dto)
    {
        var p = await _db.MatchEventProposals.Include(x => x.ApiKey)
            .FirstOrDefaultAsync(x => x.Id == proposalId && x.MatchId == matchId);
        if (p == null) return (null, null, true);
        if (p.Status != ProposalStatus.Proposed) return (null, $"Proposal is already {p.Status}.", false);

        // Apply admin corrections.
        if (dto.IsOpponent.HasValue) p.IsOpponent = dto.IsOpponent.Value;
        if (dto.ClearUser || p.IsOpponent) { p.UserId = null; p.RosterPlayerId = null; }
        if (!dto.ClearUser && !p.IsOpponent)
        {
            if (dto.UserId.HasValue) p.UserId = dto.UserId;
            if (dto.RosterPlayerId.HasValue) p.RosterPlayerId = dto.RosterPlayerId;
        }
        if (dto.GoalType.HasValue) p.GoalType = dto.GoalType;
        if (dto.EventSubtype != null) p.EventSubtype = dto.EventSubtype;

        var (matchEventId, error) = await ApplyAsync(p);
        if (error != null) return (null, error, false);

        p.Status = ProposalStatus.Confirmed;
        p.MatchEventId = matchEventId;
        p.ResolvedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return ((await ToDtosAsync([p]))[0], null, false);
    }

    private async Task<(int? matchEventId, string? error)> ApplyAsync(MatchEventProposal p)
    {
        var isAttributable = p.EventType is MatchEventType.Goal or MatchEventType.ShootoutGoal or MatchEventType.Penalty;

        if (isAttributable && !p.IsOpponent && p.UserId.HasValue)
        {
            if (!p.RosterPlayerId.HasValue)
                return (null, "RosterPlayerId is required to attribute this event to a user.");

            var userMatch = await _db.UserMatches
                .AsNoTracking()
                .FirstOrDefaultAsync(um => um.MatchId == p.MatchId && um.UserId == p.UserId.Value);
            if (userMatch == null)
                return (null, $"User {p.UserId} has no entry in match {p.MatchId}.");

            if (p.EventType == MatchEventType.Penalty)
            {
                var (penalty, penaltyError) = await _userMatchService.AddPenaltyAsync(
                    userMatch.Id, new CreateUserMatchPenaltyDto(p.RosterPlayerId.Value, 1));
                if (penaltyError != null) return (null, penaltyError);
                return (await _db.MatchEvents.Where(e => e.UserMatchPenaltyId == penalty!.Id)
                    .Select(e => (int?)e.Id).FirstOrDefaultAsync(), null);
            }

            var goalType = p.EventType == MatchEventType.ShootoutGoal
                ? GoalType.Shootout
                : p.GoalType is null or GoalType.Shootout ? GoalType.Regular : p.GoalType.Value;
            var (goal, goalError) = await _userMatchService.AddGoalAsync(
                userMatch.Id, new CreateUserMatchGoalDto(p.RosterPlayerId.Value, 1, goalType));
            if (goalError != null) return (null, goalError);

            // Manual entry bumps the hosted team's score from the UI after adding a player goal;
            // do the same here so a confirmed proposal ends in the same state.
            if (goalType != GoalType.Shootout)
            {
                var match = await _db.Matches.Include(m => m.Season).FirstAsync(m => m.Id == p.MatchId);
                if (match.HomeTeamId == match.Season?.HostedTeamId) match.HomeScore++;
                else match.AwayScore++;
                await _db.SaveChangesAsync();
            }

            return (await _db.MatchEvents.Where(e => e.UserMatchGoalId == goal!.Id)
                .Select(e => (int?)e.Id).FirstOrDefaultAsync(), null);
        }

        var (evt, eventError) = await _matchEventService.AddEventAsync(
            p.MatchId, new CreateTeamMatchEventDto(p.EventType, p.IsOpponent, p.EventSubtype));
        if (eventError != null) return (null, eventError);
        return (evt!.Id, null);
    }
}
