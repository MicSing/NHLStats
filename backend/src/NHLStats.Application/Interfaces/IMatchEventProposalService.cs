using NHLStats.Application.DTOs;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Interfaces;

public interface IMatchEventProposalService
{
    Task<IEnumerable<IngestMatchSummaryDto>> GetOpenMatchesAsync();
    Task<IngestMatchContextDto?> GetContextAsync(int matchId);
    Task<(IReadOnlyList<IngestEventResultDto>? results, string? error)> SubmitAsync(int matchId, int apiKeyId, IReadOnlyList<IngestEventDto> events);
    Task<IEnumerable<MatchEventProposalDto>> GetByMatchAsync(int matchId, ProposalStatus? status = null);
    Task<(MatchEventProposalDto? result, string? error, bool notFound)> ConfirmAsync(int matchId, int proposalId, ConfirmProposalDto dto);
    Task<(MatchEventProposalDto? result, string? error, bool notFound)> RejectAsync(int matchId, int proposalId);
    /// <summary>Goals, assists, canadian points (G + A) and fights per user in a season. Statistics only.</summary>
    Task<IEnumerable<UserCollectorStatsDto>> GetSeasonStatsAsync(int seasonId);
}
