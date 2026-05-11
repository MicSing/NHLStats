using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class PointManagementService : IPointManagementService
{
    private readonly NhlStatsDbContext _db;

    public PointManagementService(NhlStatsDbContext db) => _db = db;

    public async Task<(IEnumerable<PointListItemDto> Items, int TotalCount)> GetPointsPagedAsync(
        int? seasonId, string? pointType, int? userId, int page, int pageSize)
    {
        var query = _db.UserMatchPoints
            .Include(p => p.PointReason)
            .Include(p => p.UserMatch)
                .ThenInclude(um => um!.User)
            .Include(p => p.UserMatch)
                .ThenInclude(um => um!.Match)
                    .ThenInclude(m => m!.Season)
            .AsNoTracking();

        if (seasonId.HasValue)
            query = query.Where(p => p.UserMatch!.SeasonId == seasonId.Value);

        if (!string.IsNullOrEmpty(pointType) && Enum.TryParse<PointType>(pointType, ignoreCase: true, out var parsedType))
            query = query.Where(p => p.PointReason!.PointType == parsedType);

        if (userId.HasValue)
            query = query.Where(p => p.UserMatch!.UserId == userId.Value);

        var total = await query.CountAsync();

        var items = await query
            .OrderByDescending(p => p.CreatedOn)
            .ThenBy(p => p.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new PointListItemDto(
                p.Id,
                p.UserMatchId,
                p.UserMatch!.User!.Name,
                p.UserMatch.Match != null ? p.UserMatch.Match.MatchNumber : 0,
                p.UserMatch.Match != null ? p.UserMatch.Match.Season!.Name : null,
                p.PointReason!.Name,
                p.PointReason.PointType.ToString(),
                p.Count,
                p.Amount,
                p.CreatedOn))
            .ToListAsync();

        return (items, total);
    }

    public async Task<IEnumerable<PointListItemDto>> BulkUpdateAmountsAsync(BulkUpdatePointsDto dto)
    {
        var ids = dto.Items.Select(i => i.Id).ToList();
        var points = await _db.UserMatchPoints
            .Include(p => p.PointReason)
            .Include(p => p.UserMatch)
                .ThenInclude(um => um!.User)
            .Include(p => p.UserMatch)
                .ThenInclude(um => um!.Match)
                    .ThenInclude(m => m!.Season)
            .Where(p => ids.Contains(p.Id))
            .ToListAsync();

        var amountMap = dto.Items.ToDictionary(i => i.Id, i => i.Amount);
        foreach (var point in points)
        {
            if (amountMap.TryGetValue(point.Id, out var newAmount))
                point.Amount = newAmount;
        }

        await _db.SaveChangesAsync();

        return points.Select(p => new PointListItemDto(
            p.Id,
            p.UserMatchId,
            p.UserMatch!.User!.Name,
            p.UserMatch.Match != null ? p.UserMatch.Match.MatchNumber : 0,
            p.UserMatch.Match != null ? p.UserMatch.Match.Season!.Name : null,
            p.PointReason!.Name,
            p.PointReason.PointType.ToString(),
            p.Count,
            p.Amount,
            p.CreatedOn));
    }
}
