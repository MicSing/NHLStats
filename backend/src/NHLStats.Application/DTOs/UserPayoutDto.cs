namespace NHLStats.Application.DTOs;

public record UserPayoutDto(
    int Id,
    int UserId,
    string UserName,
    int SeasonId,
    decimal Amount,
    DateTime PaidOn);

public record CreateUserPayoutDto(
    int UserId,
    decimal Amount,
    DateTime PaidOn);

public record UpdateUserPayoutDto(
    decimal Amount,
    DateTime PaidOn);
