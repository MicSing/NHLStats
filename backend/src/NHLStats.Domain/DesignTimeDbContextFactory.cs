using System;
using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace NHLStats.Domain
{
    public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<NhlStatsDbContext>
    {
        public NhlStatsDbContext CreateDbContext(string[] args)
        {
            // Try to load configuration from API project first, then environment
            var basePath = Directory.GetCurrentDirectory();

            var configBuilder = new ConfigurationBuilder()
                .SetBasePath(basePath)
                .AddJsonFile("appsettings.json", optional: true)
                .AddJsonFile(Path.Combine("..", "NHLStats.Api", "appsettings.Development.json"), optional: true)
                .AddEnvironmentVariables();

            var configuration = configBuilder.Build();

            var useSqliteEnv = Environment.GetEnvironmentVariable("USE_SQLITE") ?? configuration["UseSqlite"] ?? "false";
            var useSqlite = string.Equals(useSqliteEnv, "true", StringComparison.OrdinalIgnoreCase) || useSqliteEnv == "1";

            var optionsBuilder = new DbContextOptionsBuilder<NhlStatsDbContext>();
            if (useSqlite)
            {
                var sqliteConn = configuration.GetConnectionString("DefaultConnection")
                                 ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
                if (string.IsNullOrWhiteSpace(sqliteConn))
                {
                    var home = Environment.GetEnvironmentVariable("HOME") ?? ".";
                    var dbPath = Path.Combine(home, "data", "nhlstats.db");
                    var dbDir = Path.GetDirectoryName(dbPath) ?? Path.Combine(home, "data");
                    try
                    {
                        Directory.CreateDirectory(dbDir);
                    }
                    catch
                    {
                        dbPath = Path.Combine(Directory.GetCurrentDirectory(), "nhlstats.db");
                    }

                    sqliteConn = $"Data Source={dbPath}";
                }

                optionsBuilder.UseSqlite(sqliteConn);
            }
            else
            {
                var conn = configuration.GetConnectionString("DefaultConnection")
                           ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                           ?? "Server=localhost,1433;Database=NhlStats;User Id=sa;Password=Your_password123;TrustServerCertificate=True;";

                optionsBuilder.UseSqlServer(conn);
            }

            return new NhlStatsDbContext(optionsBuilder.Options);
        }
    }
}
