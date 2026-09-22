using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchIsPlayoff : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPlayoff",
                table: "Matches",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Backfill: NHL regular seasons are 82 games, so any existing match numbered
            // beyond that within its season is a playoff match.
            migrationBuilder.Sql(@"
                UPDATE Matches
                SET IsPlayoff = 1
                WHERE MatchNumber > 82;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsPlayoff",
                table: "Matches");
        }
    }
}
