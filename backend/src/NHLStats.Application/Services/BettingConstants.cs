namespace NHLStats.Application.Services;

public static class BettingConstants
{
    public const decimal AggregatedPositiveValue = 0.25m;
    public const decimal AggregatedNegativeValue = 0.50m;

    public static decimal GrossPayout(decimal amount, decimal odds) => amount * odds;
}
