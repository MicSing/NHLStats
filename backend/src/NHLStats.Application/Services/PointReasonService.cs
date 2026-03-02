using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class PointReasonService : IPointReasonService
{
    private readonly NhlStatsDbContext _db;

    public PointReasonService(NhlStatsDbContext db) => _db = db;

    private static PointReasonDto ToDto(PointReason p) => new(p.Id, p.Name, p.IsPositive, p.IsActive);

    public async Task<IEnumerable<PointReasonDto>> GetAllAsync(bool activeOnly = false)
    {
        var query = _db.PointReasons.AsQueryable();
        if (activeOnly) query = query.Where(p => p.IsActive);
        return await query.OrderBy(p => p.Name).Select(p => ToDto(p)).ToListAsync();
    }

    public async Task<PointReasonDto?> GetByIdAsync(int id)
    {
        var p = await _db.PointReasons.FindAsync(id);
        return p == null ? null : ToDto(p);
    }

    public async Task<PointReasonDto> CreateAsync(CreatePointReasonDto dto)
    {
        var reason = new PointReason { Name = dto.Name, IsPositive = dto.IsPositive };
        _db.PointReasons.Add(reason);
        await _db.SaveChangesAsync();
        return ToDto(reason);
    }

    public async Task<PointReasonDto?> UpdateAsync(int id, UpdatePointReasonDto dto)
    {
        var reason = await _db.PointReasons.FindAsync(id);
        if (reason == null) return null;

        reason.Name = dto.Name;
        reason.IsPositive = dto.IsPositive;
        reason.IsActive = dto.IsActive;
        await _db.SaveChangesAsync();
        return ToDto(reason);
    }

    public async Task<bool> DeleteOrDeactivateAsync(int id)
    {
        var reason = await _db.PointReasons.FindAsync(id);
        if (reason == null) return false;

        var inUse = await _db.UserMatchPoints.AnyAsync(p => p.PointReasonId == id);
        if (inUse)
        {
            reason.IsActive = false;
        }
        else
        {
            _db.PointReasons.Remove(reason);
        }
        await _db.SaveChangesAsync();
        return true;
    }
}
