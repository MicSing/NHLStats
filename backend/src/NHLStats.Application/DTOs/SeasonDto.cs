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
    GamingConsole? Console,
    bool PointsEnabled = true);

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
    GamingConsole? Console,
    bool PointsEnabled = true);

/// <param name="Color">Ring colour in the game: set by hand, else the position's colour.</param>
/// <param name="CustomColor">True when the colour was set by hand for this season.</param>
public record SeasonUserDto(int Id, string Name, bool IsActive, SeasonUserPosition? Position, bool IsActiveInSeason = true,
    string? Color = null, bool CustomColor = false);

public record AssignSeasonUserDto(SeasonUserPosition? Position = null);

public record UpdateSeasonUserPositionDto(SeasonUserPosition? Position);

public record UpdateSeasonUserActiveDto(bool IsActive);

/// <summary>Named colour (red, orange, yellow, green, cyan, blue, pink) or #rrggbb; null = the position's colour.</summary>
public record UpdateSeasonUserColorDto(string? Color);

public record CreateSeasonDto(
    [Required] string Name,
    int? HostedTeamId,
    DateTime StartedOn,
    SeasonStatus Status = SeasonStatus.Active,
    int? ParentSeasonId = null,
    LeagueType LeagueType = LeagueType.NHL,
    int? NhlYear = null,
    GamingConsole? Console = null,
    bool PointsEnabled = true);

public record UpdateSeasonDto(
    [Required] string Name,
    int? HostedTeamId,
    DateTime StartedOn,
    SeasonStatus Status = SeasonStatus.Active,
    int? ParentSeasonId = null,
    LeagueType LeagueType = LeagueType.NHL,
    int? NhlYear = null,
    GamingConsole? Console = null,
    bool PointsEnabled = true);

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
    IReadOnlyList<SeasonUserPosition> AvailablePositions,
    bool RandomOrder = false);

public record PositionWheelSpinResultDto(int UserId, SeasonUserPosition Position, PositionWheelStateDto State);
