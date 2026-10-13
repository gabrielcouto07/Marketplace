using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FaixasImpostoImportacao : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Bancos existentes recebem as faixas da Portaria MF 1.342/2026: 0% até US$ 50 e 60% − US$ 30 acima.
            migrationBuilder.AddColumn<int>(
                name: "import_duty_high_tier_basis_points",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 6000);

            migrationBuilder.AddColumn<long>(
                name: "import_duty_high_tier_deduction_usd_cents",
                table: "platform_settings",
                type: "bigint",
                nullable: false,
                defaultValue: 3000L);

            migrationBuilder.AddColumn<int>(
                name: "import_duty_low_tier_basis_points",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "import_duty_high_tier_basis_points",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "import_duty_high_tier_deduction_usd_cents",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "import_duty_low_tier_basis_points",
                table: "platform_settings");
        }
    }
}
