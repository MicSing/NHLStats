namespace NHLStats.Application.Services;

/// <summary>
/// Process-wide lock that makes odds recalculations run one at a time. Every finished match
/// starts a background recalculation; when several matches finish in quick succession, an
/// earlier run (reading history that lacks the later results) could otherwise finish last and
/// overwrite the newer odds. Run one at a time, each pass reads the data when its turn comes,
/// so the last one always reflects the latest results.
/// </summary>
public sealed class OddsRecalculationLock
{
    private readonly SemaphoreSlim _semaphore = new(1, 1);

    public async Task<IDisposable> AcquireAsync()
    {
        await _semaphore.WaitAsync();
        return new Releaser(_semaphore);
    }

    private sealed class Releaser(SemaphoreSlim semaphore) : IDisposable
    {
        private int _released;

        public void Dispose()
        {
            if (Interlocked.Exchange(ref _released, 1) == 0)
                semaphore.Release();
        }
    }
}
