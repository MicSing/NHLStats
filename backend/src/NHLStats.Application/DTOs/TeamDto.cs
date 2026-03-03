using System.ComponentModel.DataAnnotations;

namespace NHLStats.Application.DTOs;

public record TeamDto(int Id, string Name, string ShortName);

public record CreateTeamDto(
    [Required][StringLength(200)] string Name,
    [Required][StringLength(10)] string ShortName);

public record UpdateTeamDto(
    [Required][StringLength(200)] string Name,
    [Required][StringLength(10)] string ShortName);
