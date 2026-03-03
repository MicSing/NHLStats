using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddSymmetricPointReasonSeeds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 4,
                column: "IsPositive",
                value: false);

            migrationBuilder.InsertData(
                table: "PointReasons",
                columns: new[] { "Id", "IsActive", "IsPositive", "Name" },
                values: new object[,]
                {
                    { 9, true, true, "Penalty" },
                    { 10, true, true, "Secondary Penalty" },
                    { 11, true, true, "Not Scoring A Goal" },
                    { 12, true, true, "Scoring 10 Goals" },
                    { 13, true, true, "Last Minute Action" },
                    { 14, true, true, "Own Goal" },
                    { 15, true, true, "Error In Defense" },
                    { 16, true, true, "Prediction" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 9);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 10);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 11);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 12);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 13);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 14);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 15);

            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 16);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 4,
                column: "IsPositive",
                value: true);
        }
    }
}
