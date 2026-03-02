using System.ComponentModel.DataAnnotations;
namespace NHLStats.Domain.Entities;

public class Team
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = null!;
    [Required]
    public string ShortName { get; set; } = null!;

    public ICollection<RosterPlayer>? RosterPlayers { get; set; }
    public ICollection<Match>? HomeMatches { get; set; }
    public ICollection<Match>? AwayMatches { get; set; }
}
