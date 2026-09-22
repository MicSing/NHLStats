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
    LeagueType LeagueType);

public record SeasonDetailDto(
    int Id,
    string Name,
    int? HostedTeamId,
    string? HostedTeamName,
    DateTime StartedOn,
    SeasonStatus Status,
    int? ParentSeasonId,
    List<SeasonUserDto> Users,
    LeagueType LeagueType);

public record SeasonUserDto(int Id, string Name, bool IsActive, SeasonUserPosition? Position);

public record AssignSeasonUserDto(SeasonUserPosition? Position = null);

public record UpdateSeasonUserPositionDto(SeasonUserPosition? Position);

public record CreateSeasonDto(
    [Required] string Name,
    int? HostedTeamId,
    DateTime StartedOn,
    SeasonStatus Status = SeasonStatus.Active,
    int? ParentSeasonId = null,
    LeagueType LeagueType = LeagueType.NHL);

public record UpdateSeasonDto(
    [Required] string Name,
    int? HostedTeamId,
    DateTime StartedOn,
    SeasonStatus Status = SeasonStatus.Active,
    int? ParentSeasonId = null,
    LeagueType LeagueType = LeagueType.NHL);
