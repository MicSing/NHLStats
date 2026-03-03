using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class UserPayoutService : IUserPayoutService
{
    private readonly NhlStatsDbContext _db;

    public UserPayoutService(NhlStatsDbContext db) => _db = db;

    public async Task<IEnumerable<UserPayoutDto>> GetAllAsync()
    {
        return await _db.UserPayouts
            .Include(p => p.User)
            .OrderByDescending(p => p.PaidOn)
            .Select(p => new UserPayoutDto(
                p.Id,
                p.UserId,
                p.User != null ? p.User.Name : "",
                p.SeasonId,
                p.Amount,
                p.PaidOn))
            .ToListAsync();
    }

    public async Task<IEnumerable<UserPayoutDto>> GetBySeasonAsync(int seasonId)
    {
        return await _db.UserPayouts
            .Include(p => p.User)
            .Where(p => p.SeasonId == seasonId)
            .OrderByDescending(p => p.PaidOn)
            .Select(p => new UserPayoutDto(
                p.Id,
                p.UserId,
                p.User != null ? p.User.Name : "",
                p.SeasonId,
                p.Amount,
                p.PaidOn))
            .ToListAsync();
    }

    public async Task<UserPayoutDto> CreateAsync(int seasonId, CreateUserPayoutDto dto)
    {
        var payout = new UserPayout
        {
            UserId = dto.UserId,
            SeasonId = seasonId,
            Amount = dto.Amount,
            PaidOn = dto.PaidOn
        };

        _db.UserPayouts.Add(payout);
        await _db.SaveChangesAsync();

        await _db.Entry(payout).Reference(p => p.User).LoadAsync();

        return new UserPayoutDto(
            payout.Id,
            payout.UserId,
            payout.User?.Name ?? "",
            payout.SeasonId,
            payout.Amount,
            payout.PaidOn);
    }

    public async Task<UserPayoutDto?> UpdateAsync(int seasonId, int id, UpdateUserPayoutDto dto)
    {
        var payout = await _db.UserPayouts
            .Include(p => p.User)
            .FirstOrDefaultAsync(p => p.Id == id && p.SeasonId == seasonId);

        if (payout == null) return null;

        payout.Amount = dto.Amount;
        payout.PaidOn = dto.PaidOn;

        await _db.SaveChangesAsync();

        return new UserPayoutDto(
            payout.Id,
            payout.UserId,
            payout.User?.Name ?? "",
            payout.SeasonId,
            payout.Amount,
            payout.PaidOn);
    }

    public async Task<bool> DeleteAsync(int seasonId, int id)
    {
        var payout = await _db.UserPayouts
            .FirstOrDefaultAsync(p => p.Id == id && p.SeasonId == seasonId);

        if (payout == null) return false;

        _db.UserPayouts.Remove(payout);
        await _db.SaveChangesAsync();
        return true;
    }
}
