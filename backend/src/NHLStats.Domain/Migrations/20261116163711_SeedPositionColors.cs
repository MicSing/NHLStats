using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class SeedPositionColors : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "PositionColors",
                columns: new[] { "Position", "Color" },
                values: new object[,]
                {
                    { 0, "blue" },
                    { 1, "yellow" },
                    { 2, "red" },
                    { 3, "green" },
                    { 4, "cyan" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "PositionColors",
                keyColumn: "Position",
                keyValue: 0);

            migrationBuilder.DeleteData(
                table: "PositionColors",
                keyColumn: "Position",
                keyValue: 1);

            migrationBuilder.DeleteData(
                table: "PositionColors",
                keyColumn: "Position",
                keyValue: 2);

            migrationBuilder.DeleteData(
                table: "PositionColors",
                keyColumn: "Position",
                keyValue: 3);

            migrationBuilder.DeleteData(
                table: "PositionColors",
                keyColumn: "Position",
                keyValue: 4);
        }
    }
}
