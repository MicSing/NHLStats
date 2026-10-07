using System.ComponentModel.DataAnnotations;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record SeasonDto(
    int Id,
    string Name,
    int? HostedTeamId,
    string? HostedTeamName,
    DateTime StartedOn,
    SeasonStatus Status,
    int? ParentSeasonId,
    LeagueType LeagueType,
    int? NhlYear,
    GamingConsole? Console);

public record SeasonDetailDto(
    int Id,
    string Name,
    int? HostedTeamId,
    string? HostedTeamName,
    DateTime StartedOn,
    SeasonStatus Status,
    int? ParentSeasonId,
    List<SeasonUserDto> Users,
    LeagueType LeagueType,
    int? NhlYear,
    GamingConsole? Console);

public record SeasonUserDto(int Id, string Name, bool IsActive, SeasonUserPosition? Position, bool IsActiveInSeason = true);

public record AssignSeasonUserDto(SeasonUserPosition? Position = null);

public record UpdateSeasonUserPositionDto(SeasonUserPosition? Position);

public record UpdateSeasonUserActiveDto(bool IsActive);

public record CreateSeasonDto(
    [Required] string Name,
    int? HostedTeamId,
    DateTime StartedOn,
    SeasonStatus Status = SeasonStatus.Active,
    int? ParentSeasonId = null,
    LeagueType LeagueType = LeagueType.NHL,
    int? NhlYear = null,
    GamingConsole? Console = null);

public record UpdateSeasonDto(
    [Required] string Name,
    int? HostedTeamId,
    DateTime StartedOn,
    SeasonStatus Status = SeasonStatus.Active,
    int? ParentSeasonId = null,
    LeagueType LeagueType = LeagueType.NHL,
    int? NhlYear = null,
    GamingConsole? Console = null);

/// <summary>A season-active player in position-wheel spin order, with the previous-season stats that ranked them.</summary>
public record PositionWheelEntryDto(
    int UserId,
    string Name,
    SeasonUserPosition? Position,
    bool HasPreviousStats,
    int MinusPoints,
    int PlusPoints,
    int Penalties,
    int Goals);

public record PositionWheelStateDto(
    int? PreviousSeasonId,
    string? PreviousSeasonName,
    IReadOnlyList<PositionWheelEntryDto> Order,
    int? CurrentSpinnerUserId,
    IReadOnlyList<SeasonUserPosition> AvailablePositions);

public record PositionWheelSpinResultDto(int UserId, SeasonUserPosition Position, PositionWheelStateDto State);
