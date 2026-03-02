using System.ComponentModel.DataAnnotations;
namespace NHLStats.Domain.Entities;

public class RosterPlayer
{
    public int Id { get; set; }
    [Required]
    public string FirstName { get; set; } = null!;
    [Required]
    public string Surname { get; set; } = null!;
    public string? Position { get; set; }
    public int TeamId { get; set; }
    public int SeasonId { get; set; }
    public bool IsActive { get; set; } = true;

    public Team? Team { get; set; }
    public Season? Season { get; set; }
}
