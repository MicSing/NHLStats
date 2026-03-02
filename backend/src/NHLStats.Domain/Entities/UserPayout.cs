namespace NHLStats.Domain.Entities;

public class UserPayout
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public User? User { get; set; }

    public int SeasonId { get; set; }
    public Season? Season { get; set; }

    public decimal Amount { get; set; }

    public DateTime PaidOn { get; set; }
}
