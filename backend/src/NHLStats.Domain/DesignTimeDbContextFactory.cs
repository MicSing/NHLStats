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
            var sqlConn = configuration.GetConnectionString("DefaultConnection")
                             ?? Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
            if (string.IsNullOrWhiteSpace(sqlConn))
            {
                sqlConn = "Server=(localdb)\\mssqllocaldb;Database=nhlstats;Trusted_Connection=True;MultipleActiveResultSets=true";
            }

            optionsBuilder.UseSqlServer(sqlConn);

            return new NhlStatsDbContext(optionsBuilder.Options);
        }
    }
}
