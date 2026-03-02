using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IPointReasonService
{
    Task<IEnumerable<PointReasonDto>> GetAllAsync(bool activeOnly = false);
    Task<PointReasonDto?> GetByIdAsync(int id);
    Task<PointReasonDto> CreateAsync(CreatePointReasonDto dto);
    Task<PointReasonDto?> UpdateAsync(int id, UpdatePointReasonDto dto);
    /// <summary>Deactivates if in use, deletes if not. Returns false if not found.</summary>
    Task<bool> DeleteOrDeactivateAsync(int id);
}
