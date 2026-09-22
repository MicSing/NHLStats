using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchPlayoffRound : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PlayoffRound",
                table: "Matches",
                type: "int",
                nullable: true);

            // Backfill: playoff series are always created 7 games at a time (see
            // CreatePlayoffSeriesAsync), so the Nth group of 7 playoff games is round N.
            migrationBuilder.Sql(@"
                UPDATE Matches
                SET PlayoffRound = ((MatchNumber - 83) / 7) + 1
                WHERE MatchNumber > 82;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PlayoffRound",
                table: "Matches");
        }
    }
}
