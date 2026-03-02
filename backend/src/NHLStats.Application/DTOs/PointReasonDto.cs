using System.ComponentModel.DataAnnotations;

namespace NHLStats.Application.DTOs;

public record PointReasonDto(int Id, string Name, bool IsPositive, bool IsActive);

public record CreatePointReasonDto([Required] string Name, bool IsPositive);

public record UpdatePointReasonDto([Required] string Name, bool IsPositive, bool IsActive);
