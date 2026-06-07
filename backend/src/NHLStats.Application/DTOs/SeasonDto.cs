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
    List<UserDto> Users,
    LeagueType LeagueType);

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
