using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddUserPayoutAndFixMoneyConfigSeed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserPayouts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<int>(type: "INTEGER", nullable: false),
                    SeasonId = table.Column<int>(type: "INTEGER", nullable: false),
                    Amount = table.Column<decimal>(type: "TEXT", nullable: false),
                    PaidOn = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserPayouts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserPayouts_Seasons_SeasonId",
                        column: x => x.SeasonId,
                        principalTable: "Seasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserPayouts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "MoneyConfigs",
                keyColumn: "Id",
                keyValue: 1,
                column: "NegativePointValue",
                value: 0.50m);

            migrationBuilder.CreateIndex(
                name: "IX_UserPayouts_SeasonId",
                table: "UserPayouts",
                column: "SeasonId");

            migrationBuilder.CreateIndex(
                name: "IX_UserPayouts_UserId",
                table: "UserPayouts",
                column: "UserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserPayouts");

            migrationBuilder.UpdateData(
                table: "MoneyConfigs",
                keyColumn: "Id",
                keyValue: 1,
                column: "NegativePointValue",
                value: -0.50m);
        }
    }
}
