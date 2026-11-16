using NHLStats.Application.DTOs;

namespace NHLStats.Application.Interfaces;

public interface IApiKeyService
{
    Task<CreatedApiKeyDto> CreateAsync(string name);
    Task<IEnumerable<ApiKeyDto>> GetAllAsync();
    Task<bool> RevokeAsync(int id);
    /// <summary>Returns the active key matching the plaintext value (and records its use), or null.</summary>
    Task<ApiKeyDto?> ValidateAsync(string plaintextKey);
}
