namespace NHLStats.Application.DTOs;

public record MoneyConfigDto(
    int Id,
    decimal NegativePointValue,
    decimal PositivePointValue,
    DateTime EffectiveFrom);

public record CreateMoneyConfigDto(
    decimal NegativePointValue,
    decimal PositivePointValue,
    DateTime EffectiveFrom);
