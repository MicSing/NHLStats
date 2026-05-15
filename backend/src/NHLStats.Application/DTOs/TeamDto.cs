using System.ComponentModel.DataAnnotations;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record TeamDto(int Id, string Name, string ShortName, LeagueType LeagueType);

public record CreateTeamDto(
    [Required][StringLength(200)] string Name,
    [Required][StringLength(10)] string ShortName,
    LeagueType LeagueType = LeagueType.NHL);

public record UpdateTeamDto(
    [Required][StringLength(200)] string Name,
    [Required][StringLength(10)] string ShortName,
    LeagueType LeagueType = LeagueType.NHL);
