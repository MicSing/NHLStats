using NHLStats.Application.DTOs;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Interfaces;

public interface ISeasonService
{
    Task<IEnumerable<SeasonDto>> GetAllAsync();
    Task<SeasonDetailDto?> GetByIdAsync(int id);
    Task<SeasonDto> CreateAsync(CreateSeasonDto dto);
    Task<SeasonDto?> UpdateAsync(int id, UpdateSeasonDto dto);
    Task<bool> DeleteAsync(int id);
    Task<SeasonDetailDto?> AssignUserAsync(int seasonId, int userId, SeasonUserPosition? position = null);
    Task<bool> RemoveUserAsync(int seasonId, int userId);
    Task<IEnumerable<SeasonUserDto>?> GetSeasonUsersAsync(int seasonId);
    Task<SeasonDetailDto?> UpdateUserPositionAsync(int seasonId, int userId, SeasonUserPosition? position);
}
