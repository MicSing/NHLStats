using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddPointTypeEnum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "IsPositive",
                table: "PointReasons",
                newName: "PointType");

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 1,
                column: "PointType",
                value: 0);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 2,
                column: "PointType",
                value: 0);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 3,
                column: "PointType",
                value: 0);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 4,
                column: "PointType",
                value: 0);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 5,
                column: "PointType",
                value: 0);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 6,
                column: "PointType",
                value: 0);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 7,
                column: "PointType",
                value: 0);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 8,
                column: "PointType",
                value: 0);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 9,
                column: "PointType",
                value: 1);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 10,
                column: "PointType",
                value: 1);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 11,
                column: "PointType",
                value: 1);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 12,
                column: "PointType",
                value: 1);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 13,
                column: "PointType",
                value: 1);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 14,
                column: "PointType",
                value: 1);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 15,
                column: "PointType",
                value: 1);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 16,
                column: "PointType",
                value: 1);

            migrationBuilder.InsertData(
                table: "PointReasons",
                columns: new[] { "Id", "IsActive", "Name", "PointType" },
                values: new object[] { 17, true, "Shorthanded Goal", 2 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 17);

            migrationBuilder.RenameColumn(
                name: "PointType",
                table: "PointReasons",
                newName: "IsPositive");

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 1,
                column: "IsPositive",
                value: false);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 2,
                column: "IsPositive",
                value: false);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 3,
                column: "IsPositive",
                value: false);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 4,
                column: "IsPositive",
                value: false);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 5,
                column: "IsPositive",
                value: false);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 6,
                column: "IsPositive",
                value: false);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 7,
                column: "IsPositive",
                value: false);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 8,
                column: "IsPositive",
                value: false);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 9,
                column: "IsPositive",
                value: true);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 10,
                column: "IsPositive",
                value: true);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 11,
                column: "IsPositive",
                value: true);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 12,
                column: "IsPositive",
                value: true);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 13,
                column: "IsPositive",
                value: true);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 14,
                column: "IsPositive",
                value: true);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 15,
                column: "IsPositive",
                value: true);

            migrationBuilder.UpdateData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValue: 16,
                column: "IsPositive",
                value: true);
        }
    }
}
