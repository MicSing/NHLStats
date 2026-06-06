using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IAchievementService
{
    Task<UserAchievementsDto> GetUserAchievementsAsync(int userId);
}
