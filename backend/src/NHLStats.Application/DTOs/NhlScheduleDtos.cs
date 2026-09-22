namespace NHLStats.Application.DTOs;

public record NhlGameDto(
    long NhlGameId,
    string HomeTeamAbbrev,
    string AwayTeamAbbrev,
    DateTime GameDateUtc);

public record ImportRealSeasonMatchesResultDto(
    int Imported,
    int Skipped,
    List<string> Errors);
