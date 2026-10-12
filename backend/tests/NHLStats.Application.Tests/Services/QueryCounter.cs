using System.Data.Common;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace NHLStats.Application.Tests.Services;

/// <summary>
/// Counts the SELECT queries a DbContext sends — guards against N+1 regressions. Writes are left
/// out: SQLite sends one command per changed row, while SQL Server batches a SaveChanges into one.
/// </summary>
public sealed class QueryCounter : DbCommandInterceptor
{
    public int Count { get; private set; }

    public void Reset() => Count = 0;

    private void Track(DbCommand command)
    {
        if (command.CommandText.TrimStart().StartsWith("SELECT", StringComparison.OrdinalIgnoreCase))
            Count++;
    }

    public override InterceptionResult<DbDataReader> ReaderExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result)
    { Track(command); return result; }

    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    { Track(command); return ValueTask.FromResult(result); }

    public override InterceptionResult<object> ScalarExecuting(DbCommand command, CommandEventData eventData, InterceptionResult<object> result)
    { Track(command); return result; }

    public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<object> result, CancellationToken cancellationToken = default)
    { Track(command); return ValueTask.FromResult(result); }
}
