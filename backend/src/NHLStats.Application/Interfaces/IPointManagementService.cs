using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IPointManagementService
{
    Task<(IEnumerable<PointListItemDto> Items, int TotalCount)> GetPointsPagedAsync(
        int? seasonId, string? pointType, int? userId, int page, int pageSize);

    Task<IEnumerable<PointListItemDto>> BulkUpdateAmountsAsync(BulkUpdatePointsDto dto);
}
