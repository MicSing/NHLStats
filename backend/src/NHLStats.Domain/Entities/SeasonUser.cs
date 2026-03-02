namespace NHLStats.Domain.Entities;

public class SeasonUser
{
    public int Id { get; set; }
    public int SeasonId { get; set; }
    public int UserId { get; set; }

    public Season? Season { get; set; }
    public User? User { get; set; }
}
