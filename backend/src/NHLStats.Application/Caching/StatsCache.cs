using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Caching.Memory;
using NHLStats.Domain.Entities;

namespace NHLStats.Application.Caching;

/// <summary>
/// Short-lived in-memory cache for expensive, read-mostly stats (dashboard, achievements, season
/// totals). Every entry is tied to a data version that any data change bumps, so a cached result
/// is never served after the data behind it changed — it only saves recomputing unchanged data.
/// </summary>
public interface IStatsCache
{
    Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory);

    /// <summary>Makes every cached entry stale.</summary>
    void Invalidate();
}

public sealed class StatsCache(IMemoryCache cache) : IStatsCache
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(10);
    private long _version;

    public async Task<T> GetOrCreateAsync<T>(string key, Func<Task<T>> factory)
    {
        // Read the version before computing: if data changes mid-computation, the result is
        // stored under the old version and never served again.
        var versionedKey = $"stats:{Interlocked.Read(ref _version)}:{key}";
        if (cache.TryGetValue(versionedKey, out T? cached) && cached is not null)
            return cached;

        var value = await factory();
        cache.Set(versionedKey, value, Lifetime);
        return value;
    }

    public void Invalidate() => Interlocked.Increment(ref _version);
}

/// <summary>Invalidates <see cref="IStatsCache"/> whenever a SaveChanges writes stats-relevant data.</summary>
public sealed class StatsCacheInvalidationInterceptor(IStatsCache statsCache) : SaveChangesInterceptor
{
    // Contexts whose in-flight save touches stats-relevant data (entries are already accepted,
    // so no longer inspectable, by the time SavedChanges runs).
    private readonly System.Runtime.CompilerServices.ConditionalWeakTable<DbContext, object> _pending = new();

    public override InterceptionResult<int> SavingChanges(DbContextEventData eventData, InterceptionResult<int> result)
    {
        BeforeSave(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
    {
        BeforeSave(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override int SavedChanges(SaveChangesCompletedEventData eventData, int result)
    {
        AfterSave(eventData.Context);
        return result;
    }

    public override ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData, int result, CancellationToken cancellationToken = default)
    {
        AfterSave(eventData.Context);
        return ValueTask.FromResult(result);
    }

    public override void SaveChangesFailed(DbContextErrorEventData eventData) => AfterSave(eventData.Context);

    public override Task SaveChangesFailedAsync(DbContextErrorEventData eventData, CancellationToken cancellationToken = default)
    {
        AfterSave(eventData.Context);
        return Task.CompletedTask;
    }

    private void BeforeSave(DbContext? context)
    {
        if (context == null) return;
        // Precomputed odds and the odds' own season cache don't feed any cached stats, and are
        // rewritten in bulk after every match — they alone don't flush the cache.
        var relevant = context.ChangeTracker.Entries().Any(e =>
            e.State is EntityState.Added or EntityState.Modified or EntityState.Deleted
            && e.Entity is not MatchOdds and not UserSeasonEventDistribution);
        if (!relevant) return;
        statsCache.Invalidate();
        _pending.AddOrUpdate(context, true);
    }

    // Invalidate again once written, so nothing computed while the write was in flight survives it.
    private void AfterSave(DbContext? context)
    {
        if (context != null && _pending.Remove(context))
            statsCache.Invalidate();
    }
}
