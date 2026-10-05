using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Marketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemessaConforme : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "identity_document_url",
                table: "sellers",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "legal_address",
                table: "sellers",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "responsible_document",
                table: "sellers",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "responsible_document_type",
                table: "sellers",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "responsible_name",
                table: "sellers",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ruc_certificate_url",
                table: "sellers",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "suspended_at",
                table: "sellers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "suspension_reason",
                table: "sellers",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "verified_at",
                table: "sellers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "verified_by_user_id",
                table: "sellers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "approved_name",
                table: "products",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "approved_price_amount",
                table: "products",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "moderated_at",
                table: "products",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "moderation_note",
                table: "products",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "moderation_reason",
                table: "products",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "cbs_basis_points",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ibs_municipal_basis_points",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ibs_state_basis_points",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "icms_state_overrides",
                table: "platform_settings",
                type: "character varying(400)",
                maxLength: 400,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "insurance_basis_points",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<long>(
                name: "other_expenses_amount",
                table: "platform_settings",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<int>(
                name: "price_floor_percent",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 40);

            migrationBuilder.AddColumn<string>(
                name: "protected_brands",
                table: "platform_settings",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "require_platform_label",
                table: "platform_settings",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "seller_strike_limit",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "strike_window_days",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 365);

            migrationBuilder.AddColumn<string>(
                name: "recipient_document",
                table: "orders",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "tax_breakdown",
                table: "orders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "recipient_document",
                table: "addresses",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "compliance_occurrences",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    indicator = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    source = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    code = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: true),
                    product_id = table.Column<Guid>(type: "uuid", nullable: true),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    shipment_id = table.Column<Guid>(type: "uuid", nullable: true),
                    external_id = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    occurred_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    registered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    registered_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status_changed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_compliance_occurrences", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "product_reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reporter_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reason = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    details = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    resolved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    resolved_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resolution_note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    occurrence_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_reports", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "shipments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    provider_reference = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    declaration_number = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    tracking_code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    carrier = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    has_label_file = table.Column<bool>(type: "boolean", nullable: false),
                    label_url = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: true),
                    request_json = table.Column<string>(type: "text", nullable: false),
                    last_error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    label_issued_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    posted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancelled_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    cancel_confirmed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    dir_number = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    customs_status_code = table.Column<int>(type: "integer", nullable: true),
                    customs_status = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    customs_checked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shipments", x => x.id);
                    table.ForeignKey(
                        name: "fk_shipments_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "tax_remittances",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    shipment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    import_duty_amount = table.Column<long>(type: "bigint", nullable: false),
                    icms_amount = table.Column<long>(type: "bigint", nullable: false),
                    ibs_state_amount = table.Column<long>(type: "bigint", nullable: false),
                    ibs_municipal_amount = table.Column<long>(type: "bigint", nullable: false),
                    cbs_amount = table.Column<long>(type: "bigint", nullable: false),
                    total_amount = table.Column<long>(type: "bigint", nullable: false),
                    reference = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: true),
                    last_error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    sent_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    confirmed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tax_remittances", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "shipment_labels",
                columns: table => new
                {
                    shipment_id = table.Column<Guid>(type: "uuid", nullable: false),
                    pdf = table.Column<byte[]>(type: "bytea", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shipment_labels", x => x.shipment_id);
                    table.ForeignKey(
                        name: "fk_shipment_labels_shipments_shipment_id",
                        column: x => x.shipment_id,
                        principalTable: "shipments",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Linha de configuração já existente: liga a tributação do Remessa Conforme (II + ICMS + IBS + CBS, valor
            // definitivo) e a lista padrão de marcas protegidas. Os defaults do C# só valem para bancos novos.
            migrationBuilder.Sql(
                "UPDATE platform_settings SET import_tax_mode = 'RemessaConforme', protected_brands = '"
                + Marketplace.Domain.Entities.PlatformSettings.DefaultProtectedBrands.Replace("'", "''")
                + "' WHERE protected_brands = '';");

            migrationBuilder.CreateIndex(
                name: "ix_compliance_occurrences_indicator_occurred_at",
                table: "compliance_occurrences",
                columns: new[] { "indicator", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_compliance_occurrences_seller_id_status",
                table: "compliance_occurrences",
                columns: new[] { "seller_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_compliance_occurrences_source_external_id",
                table: "compliance_occurrences",
                columns: new[] { "source", "external_id" });

            migrationBuilder.CreateIndex(
                name: "ix_product_reports_product_id",
                table: "product_reports",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_product_reports_status_created_at",
                table: "product_reports",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_shipments_order_id",
                table: "shipments",
                column: "order_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_shipments_status_updated_at",
                table: "shipments",
                columns: new[] { "status", "updated_at" });

            migrationBuilder.CreateIndex(
                name: "ix_shipments_tracking_code",
                table: "shipments",
                column: "tracking_code");

            migrationBuilder.CreateIndex(
                name: "ix_tax_remittances_order_id",
                table: "tax_remittances",
                column: "order_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_tax_remittances_status_created_at",
                table: "tax_remittances",
                columns: new[] { "status", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "compliance_occurrences");

            migrationBuilder.DropTable(
                name: "product_reports");

            migrationBuilder.DropTable(
                name: "shipment_labels");

            migrationBuilder.DropTable(
                name: "tax_remittances");

            migrationBuilder.DropTable(
                name: "shipments");

            migrationBuilder.DropColumn(
                name: "identity_document_url",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "legal_address",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "responsible_document",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "responsible_document_type",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "responsible_name",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "ruc_certificate_url",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "suspended_at",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "suspension_reason",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "verified_at",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "verified_by_user_id",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "approved_name",
                table: "products");

            migrationBuilder.DropColumn(
                name: "approved_price_amount",
                table: "products");

            migrationBuilder.DropColumn(
                name: "moderated_at",
                table: "products");

            migrationBuilder.DropColumn(
                name: "moderation_note",
                table: "products");

            migrationBuilder.DropColumn(
                name: "moderation_reason",
                table: "products");

            migrationBuilder.DropColumn(
                name: "cbs_basis_points",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "ibs_municipal_basis_points",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "ibs_state_basis_points",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "icms_state_overrides",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "insurance_basis_points",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "other_expenses_amount",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "price_floor_percent",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "protected_brands",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "require_platform_label",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "seller_strike_limit",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "strike_window_days",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "recipient_document",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "tax_breakdown",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "recipient_document",
                table: "addresses");
        }
    }
}
