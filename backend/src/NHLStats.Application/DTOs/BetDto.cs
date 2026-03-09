using NHLStats.Domain.Entities;

namespace NHLStats.Application.DTOs;

public record BetDto(
    Guid Id,
    int MatchId,
    BetType BetType,
    int? UserId,
    int? TeamId,
    string CreatedBy,
    DateTime CreatedOn,
    DateTime? UpdatedOn,
    DateTime? EvaluatedOn);

public record CurrentUserBetDto(
    Guid Id,
    BetType BetType,
    int? UserId,
    int? TeamId,
    DateTime CreatedOn,
    DateTime? UpdatedOn,
    DateTime? EvaluatedOn);

public record CreateBetDto(
    BetType BetType,
    int? UserId,
    int? TeamId);

public record UpdateBetDto(
    BetType BetType,
    int? UserId,
    int? TeamId,
    DateTime? EvaluatedOn);
