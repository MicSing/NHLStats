using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

// ─── Context the Collector downloads before a match ──────────────────────────

public record IngestMatchSummaryDto(
    int Id,
    int SeasonId,
    string? SeasonName,
    int MatchNumber,
    int HomeTeamId,
    string? HomeTeamShortName,
    int AwayTeamId,
    string? AwayTeamShortName,
    int HomeScore,
    int AwayScore,
    CompletionType CompletionType,
    DateTime? MatchDate);

public record IngestUserDto(
    int UserId,
    string Name,
    SeasonUserPosition? Position,
    string? Color = null);

public record IngestRosterPlayerDto(
    int RosterPlayerId,
    string FirstName,
    string Surname,
    string? Position);

public record IngestMatchContextDto(
    IngestMatchSummaryDto Match,
    int? HostedTeamId,
    bool HostedIsHome,
    IReadOnlyList<IngestUserDto> Users,
    IReadOnlyList<IngestRosterPlayerDto> Roster);

// ─── Event proposals ─────────────────────────────────────────────────────────

/// <summary>An assist on a goal by a user's roster player.</summary>
public record IngestAssistDto(int UserId, int RosterPlayerId);

public record IngestEventDto(
    string ClientEventId,
    MatchEventType EventType,
    bool IsOpponent = false,
    string? EventSubtype = null,
    GoalType? GoalType = null,
    int? UserId = null,
    int? RosterPlayerId = null,
    List<IngestAssistDto>? Assists = null,
    FightOutcome? FightOutcome = null,
    int? Period = null,
    string? GameClock = null,
    string? Strength = null,
    ProposalConfidence Confidence = ProposalConfidence.Low,
    string? Note = null,
    string? MediaRef = null,
    DateTime? OccurredAt = null);

public record IngestEventBatchDto(List<IngestEventDto> Events);

public record IngestEventResultDto(
    string ClientEventId,
    int? ProposalId,
    bool Duplicate,
    string? Error);

public record ProposalAssistDto(int UserId, string? UserName, int RosterPlayerId, string? PlayerName);

public record MatchEventProposalDto(
    int Id,
    int MatchId,
    string ClientEventId,
    string? ApiKeyName,
    MatchEventType EventType,
    bool IsOpponent,
    string? EventSubtype,
    GoalType? GoalType,
    int? UserId,
    string? UserName,
    int? RosterPlayerId,
    string? PlayerName,
    IReadOnlyList<ProposalAssistDto> Assists,
    FightOutcome? FightOutcome,
    int? Period,
    string? GameClock,
    string? Strength,
    ProposalConfidence Confidence,
    string? Note,
    string? MediaRef,
    DateTime? OccurredAt,
    ProposalStatus Status,
    int? MatchEventId,
    DateTime CreatedAt,
    DateTime? ResolvedAt);

/// <summary>
/// Optional corrections an admin applies while confirming. A null field keeps the proposed value;
/// set <see cref="ClearUser"/> to confirm a goal/penalty as unattributed (e.g. a computer-controlled player).
/// </summary>
public record ConfirmProposalDto(
    int? UserId = null,
    int? RosterPlayerId = null,
    bool? IsOpponent = null,
    GoalType? GoalType = null,
    string? EventSubtype = null,
    bool ClearUser = false,
    /// <summary>Replaces the proposed assists when set (an empty list removes them).</summary>
    List<IngestAssistDto>? Assists = null,
    FightOutcome? FightOutcome = null);

// ─── Statistics recorded through the Collector (no money) ────────────────────

public record UserCollectorStatsDto(
    int UserId,
    string UserName,
    int Goals,
    int Assists,
    int Points,
    int FightsWon,
    int FightsLost,
    int FightsDraw);
