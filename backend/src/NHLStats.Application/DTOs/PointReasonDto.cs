using System.ComponentModel.DataAnnotations;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record PointReasonDto(int Id, string Name, PointType PointType, bool IsActive);

public record CreatePointReasonDto([Required] string Name, PointType PointType);

public record UpdatePointReasonDto([Required] string Name, PointType PointType, bool IsActive);
