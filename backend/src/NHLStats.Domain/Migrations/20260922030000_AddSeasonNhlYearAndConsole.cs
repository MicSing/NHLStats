using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddSeasonNhlYearAndConsole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "Console",
                table: "Seasons",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "NhlYear",
                table: "Seasons",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "NhlGameId",
                table: "Matches",
                type: "bigint",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Console",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "NhlYear",
                table: "Seasons");

            migrationBuilder.DropColumn(
                name: "NhlGameId",
                table: "Matches");
        }
    }
}
