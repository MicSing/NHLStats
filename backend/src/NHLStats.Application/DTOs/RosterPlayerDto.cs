using System.ComponentModel.DataAnnotations;

namespace NHLStats.Application.DTOs;

public record RosterPlayerDto(
    int Id,
    string FirstName,
    string Surname,
    string? Position,
    int TeamId,
    string? TeamName,
    string? TeamShortName,
    int SeasonId,
    bool IsActive);

public record CreateRosterPlayerDto(
    [Required] string FirstName,
    [Required] string Surname,
    string? Position,
    [Required][Range(1, int.MaxValue)] int TeamId);

public record UpdateRosterPlayerDto(
    [Required] string FirstName,
    [Required] string Surname,
    string? Position,
    [Required][Range(1, int.MaxValue)] int TeamId,
    bool IsActive);

public record CsvImportResultDto(
    int Imported,
    List<string> Errors);
