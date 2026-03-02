using System.ComponentModel.DataAnnotations;
namespace NHLStats.Domain.Entities;

public class PointReason
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = null!;
    public bool IsPositive { get; set; }
    public bool IsActive { get; set; } = true;
}
