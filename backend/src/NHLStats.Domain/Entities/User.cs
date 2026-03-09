using System.ComponentModel.DataAnnotations;
namespace NHLStats.Domain.Entities;

public class User
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = null!;
    public bool IsActive { get; set; } = true;

    public ICollection<SeasonUser>? SeasonUsers { get; set; }
    public ICollection<UserMatch>? UserMatches { get; set; }
    public ICollection<Bet>? Bets { get; set; }
}
