using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace NHLStats.Domain.Migrations
{
    /// <inheritdoc />
    public partial class RemoveOrphanBet79A423 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM BetLegs WHERE BetId = '79A42338-3725-43FC-89FB-0EC0DA22A9A8';
                DELETE FROM Bets WHERE Id = '79A42338-3725-43FC-89FB-0EC0DA22A9A8' AND CreatedBy = '64a60556-a0b0-40e9-a73e-45146a9f0a62';
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
