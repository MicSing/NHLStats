using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IUserPayoutService
{
    Task<IEnumerable<UserPayoutDto>> GetBySeasonAsync(int seasonId);
    Task<UserPayoutDto> CreateAsync(int seasonId, CreateUserPayoutDto dto);
    Task<UserPayoutDto?> UpdateAsync(int seasonId, int id, UpdateUserPayoutDto dto);
    Task<bool> DeleteAsync(int seasonId, int id);
}
