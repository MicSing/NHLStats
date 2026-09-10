using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddBetLegOddsVersioning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "OddsFormulaVersion",
                table: "BetLegs",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 1.0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Probability",
                table: "BetLegs",
                type: "decimal(18,2)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OddsFormulaVersion",
                table: "BetLegs");

            migrationBuilder.DropColumn(
                name: "Probability",
                table: "BetLegs");
        }
    }
}
