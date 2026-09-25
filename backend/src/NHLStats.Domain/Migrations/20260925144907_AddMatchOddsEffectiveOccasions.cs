using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddMatchOddsEffectiveOccasions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "EffectiveOdds",
                table: "MatchOdds",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MaxOccasions",
                table: "MatchOdds",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MinOccasions",
                table: "MatchOdds",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EffectiveOdds",
                table: "MatchOdds");

            migrationBuilder.DropColumn(
                name: "MaxOccasions",
                table: "MatchOdds");

            migrationBuilder.DropColumn(
                name: "MinOccasions",
                table: "MatchOdds");
        }
    }
}
