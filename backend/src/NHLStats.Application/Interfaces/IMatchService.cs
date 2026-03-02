using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IMatchService
{
    Task<IEnumerable<MatchDto>> GetBySeasonAsync(int seasonId);
    Task<MatchDto?> GetByIdAsync(int id);
    Task<MatchDto> CreateAsync(int seasonId, CreateMatchDto dto);
    Task<MatchDto?> UpdateAsync(int id, UpdateMatchDto dto);
    Task<bool> DeleteAsync(int id);
    Task<IEnumerable<MatchDto>> BatchCreateAsync(int seasonId, IEnumerable<CreateMatchDto> dtos);
}
