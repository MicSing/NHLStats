namespace NHLStats.Application.DTOs;

public record CreateApiKeyDto(string Name);

public record ApiKeyDto(
    int Id,
    string Name,
    string Prefix,
    DateTime CreatedAt,
    DateTime? LastUsedAt,
    DateTime? RevokedAt);

/// <summary>Returned only once, at creation: the plaintext key is not stored.</summary>
public record CreatedApiKeyDto(ApiKeyDto ApiKey, string Key);
