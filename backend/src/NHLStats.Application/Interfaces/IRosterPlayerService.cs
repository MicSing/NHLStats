using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IRosterPlayerService
{
    Task<IEnumerable<RosterPlayerDto>> GetBySeasonAsync(int seasonId);
    Task<RosterPlayerDto?> GetByIdAsync(int id);
    Task<RosterPlayerDto?> GetBySeasonAndPlayerIdAsync(int seasonId, int playerId);
    Task<RosterPlayerDto> CreateAsync(int seasonId, CreateRosterPlayerDto dto);
    Task<RosterPlayerDto?> UpdateAsync(int seasonId, int id, UpdateRosterPlayerDto dto);
    Task<bool> DeleteAsync(int seasonId, int id);
    Task<CsvImportResultDto> ImportFromCsvAsync(int seasonId, string csvContent);
    Task<(IEnumerable<RosterPlayerDto> Players, string? Error)> CopyFromSeasonAsync(int targetSeasonId, int sourceSeasonId);
}
