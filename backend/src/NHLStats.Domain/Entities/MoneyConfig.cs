namespace NHLStats.Domain.Entities;

public class MoneyConfig
{
    public int Id { get; set; }
    public decimal NegativePointValue { get; set; }
    public decimal PositivePointValue { get; set; }
    public DateTime EffectiveFrom { get; set; }
}
