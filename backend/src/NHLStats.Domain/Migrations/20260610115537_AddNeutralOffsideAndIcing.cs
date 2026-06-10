using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddNeutralOffsideAndIcing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "PointReasons",
                columns: new[] { "Id", "IsActive", "Name", "PointType" },
                values: new object[,]
                {
                    { 21, true, "Offside", 2 },
                    { 22, true, "Icing", 2 }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "PointReasons",
                keyColumn: "Id",
                keyValues: new object[] { 21, 22 });
        }
    }
}
