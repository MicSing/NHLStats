using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using NHLStats.Application.DTOs;
using NHLStats.Application.Interfaces;
using NHLStats.Domain;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Services;

public class ApiKeyService : IApiKeyService
{
    public const string KeyPrefix = "nhls_";
    private const int PrefixDisplayLength = 12;

    private readonly NhlStatsDbContext _db;

    public ApiKeyService(NhlStatsDbContext db) => _db = db;

    public static string Hash(string plaintextKey) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(plaintextKey))).ToLowerInvariant();

    private static ApiKeyDto ToDto(ApiKey k) =>
        new(k.Id, k.Name, k.Prefix, k.CreatedAt, k.LastUsedAt, k.RevokedAt);

    public async Task<CreatedApiKeyDto> CreateAsync(string name)
    {
        var secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        var plaintext = KeyPrefix + secret;

        var entity = new ApiKey
        {
            Name = name.Trim(),
            Prefix = plaintext[..PrefixDisplayLength],
            KeyHash = Hash(plaintext),
            CreatedAt = DateTime.UtcNow
        };
        _db.ApiKeys.Add(entity);
        await _db.SaveChangesAsync();

        return new CreatedApiKeyDto(ToDto(entity), plaintext);
    }

    public async Task<IEnumerable<ApiKeyDto>> GetAllAsync() =>
        (await _db.ApiKeys.AsNoTracking().OrderByDescending(k => k.CreatedAt).ToListAsync()).Select(ToDto);

    public async Task<bool> RevokeAsync(int id)
    {
        var key = await _db.ApiKeys.FindAsync(id);
        if (key == null) return false;
        key.RevokedAt ??= DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<ApiKeyDto?> ValidateAsync(string plaintextKey)
    {
        if (string.IsNullOrWhiteSpace(plaintextKey)) return null;
        var hash = Hash(plaintextKey.Trim());
        var key = await _db.ApiKeys.FirstOrDefaultAsync(k => k.KeyHash == hash && k.RevokedAt == null);
        if (key == null) return null;

        // Throttle writes: one LastUsedAt update per minute is plenty.
        var now = DateTime.UtcNow;
        if (key.LastUsedAt == null || now - key.LastUsedAt > TimeSpan.FromMinutes(1))
        {
            key.LastUsedAt = now;
            await _db.SaveChangesAsync();
        }
        return ToDto(key);
    }
}
