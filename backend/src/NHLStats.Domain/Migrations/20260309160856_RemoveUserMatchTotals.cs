using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class RemoveUserMatchTotals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalMinus",
                table: "UserMatches");

            migrationBuilder.DropColumn(
                name: "TotalPlus",
                table: "UserMatches");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "TotalMinus",
                table: "UserMatches",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "TotalPlus",
                table: "UserMatches",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);
        }
    }
}
