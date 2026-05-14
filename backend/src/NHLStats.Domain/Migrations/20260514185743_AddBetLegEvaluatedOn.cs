using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class AddBetLegEvaluatedOn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "EvaluatedOn",
                table: "BetLegs",
                type: "TEXT",
                nullable: true);

            migrationBuilder.Sql(@"
                UPDATE BetLegs
                SET EvaluatedOn = (SELECT MatchDate FROM Matches WHERE Matches.Id = BetLegs.MatchId)
                WHERE Status != 0
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EvaluatedOn",
                table: "BetLegs");
        }
    }
}
