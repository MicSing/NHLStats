using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IRealSeasonMatchImportService
{
    Task<(ImportRealSeasonMatchesResultDto? Result, string? Error)> ImportAsync(int seasonId, CancellationToken cancellationToken = default);
}
