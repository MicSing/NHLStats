using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class UserService : IUserService
{
    private readonly NhlStatsDbContext _db;

    public UserService(NhlStatsDbContext db) => _db = db;

    public async Task<IEnumerable<UserDto>> GetAllAsync() =>
        await _db.Users
            .OrderBy(u => u.Name)
            .Select(u => new UserDto(u.Id, u.Name, u.IsActive))
            .ToListAsync();

    public async Task<UserDto?> GetByIdAsync(int id) =>
        await _db.Users
            .Where(u => u.Id == id)
            .Select(u => new UserDto(u.Id, u.Name, u.IsActive))
            .FirstOrDefaultAsync();

    public async Task<UserDto> CreateAsync(CreateUserDto dto)
    {
        var user = new User { Name = dto.Name };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return new UserDto(user.Id, user.Name, user.IsActive);
    }

    public async Task<UserDto?> UpdateAsync(int id, UpdateUserDto dto)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return null;

        user.Name = dto.Name;
        user.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return new UserDto(user.Id, user.Name, user.IsActive);
    }

    public async Task<bool> DeactivateAsync(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return false;

        user.IsActive = false;
        await _db.SaveChangesAsync();
        return true;
    }
}
