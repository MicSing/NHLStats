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
            var basePath = Directory.GetCurrentDirectory();

            var configBuilder = new ConfigurationBuilder()
                .SetBasePath(basePath)
                .AddJsonFile("appsettings.json", optional: true)
                .AddJsonFile(Path.Combine("..", "NHLStats.Api", "appsettings.Development.json"), optional: true)
                .AddEnvironmentVariables();

            var configuration = configBuilder.Build();

            var optionsBuilder = new DbContextOptionsBuilder<NhlStatsDbContext>();
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

            return new NhlStatsDbContext(optionsBuilder.Options);
        }
    }
}
