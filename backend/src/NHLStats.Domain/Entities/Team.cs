using System.ComponentModel.DataAnnotations;
namespace NHLStats.Domain.Entities;

public class Team
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = null!;
    [Required]
    public string ShortName { get; set; } = null!;
    public LeagueType LeagueType { get; set; } = LeagueType.NHL;

    public ICollection<RosterPlayer>? RosterPlayers { get; set; }
    public ICollection<Match>? HomeMatches { get; set; }
    public ICollection<Match>? AwayMatches { get; set; }
    public ICollection<BetLeg>? BetLegs { get; set; }
}
