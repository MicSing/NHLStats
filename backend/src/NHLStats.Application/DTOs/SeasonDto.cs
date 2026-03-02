using System.ComponentModel.DataAnnotations;

namespace NHLStats.Application.DTOs;

public record SeasonDto(
    int Id,
    string Name,
    int? HostedTeamId,
    string? HostedTeamName,
    DateTime StartedOn,
    string? Status,
    int? ParentSeasonId);

public record SeasonDetailDto(
    int Id,
    string Name,
    int? HostedTeamId,
    string? HostedTeamName,
    DateTime StartedOn,
    string? Status,
    int? ParentSeasonId,
    List<UserDto> Users);

public record CreateSeasonDto(
    [Required] string Name,
    int? HostedTeamId,
    DateTime StartedOn,
    string? Status,
    int? ParentSeasonId);

public record UpdateSeasonDto(
    [Required] string Name,
    int? HostedTeamId,
    DateTime StartedOn,
    string? Status,
    int? ParentSeasonId);
