using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchPhase : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Phase",
                table: "Matches",
                type: "int",
                nullable: false,
                defaultValue: 0);

            // Backfill: NHL regular seasons are 82 games, so any existing match numbered
            // beyond that within its season is a playoff match. 1 = MatchPhase.Playoff.
            migrationBuilder.Sql(@"
                UPDATE Matches
                SET Phase = 1
                WHERE MatchNumber > 82;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Phase",
                table: "Matches");
        }
    }
}
