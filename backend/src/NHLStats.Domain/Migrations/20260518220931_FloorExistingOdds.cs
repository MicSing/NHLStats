using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class FloorExistingOdds : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Floor all stored odds to 2 decimal places.
            // SQLite stores decimals as TEXT; CAST(x AS INTEGER) truncates toward zero (= floor for positive values).
            migrationBuilder.Sql(@"
                UPDATE MatchOdds
                SET Odds = CAST(CAST(CAST(Odds AS REAL) * 100 AS INTEGER) / 100.0 AS TEXT);

                UPDATE BetLegs
                SET Odds = CAST(CAST(CAST(Odds AS REAL) * 100 AS INTEGER) / 100.0 AS TEXT);

                UPDATE Bets
                SET TotalOdds = CAST(CAST(CAST(TotalOdds AS REAL) * 100 AS INTEGER) / 100.0 AS TEXT);
            ");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
