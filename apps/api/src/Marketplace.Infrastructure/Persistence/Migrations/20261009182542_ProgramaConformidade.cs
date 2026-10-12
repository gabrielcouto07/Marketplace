using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Marketplace.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProgramaConformidade : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "checks_json",
                table: "shipments",
                type: "text",
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "articles_of_incorporation_url",
                table: "sellers",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "data_confirmed_at",
                table: "sellers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "email",
                table: "sellers",
                type: "character varying(254)",
                maxLength: 254,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "excluded_at",
                table: "sellers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "legal_name",
                table: "sellers",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "payout_account",
                table: "sellers",
                type: "character varying(512)",
                maxLength: 512,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "payout_holder",
                table: "sellers",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "payout_institution",
                table: "sellers",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "payout_method",
                table: "sellers",
                type: "character varying(24)",
                maxLength: 24,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "policy_accepted_at",
                table: "sellers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "policy_version_accepted",
                table: "sellers",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "suspended_until",
                table: "sellers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "tax_compliance_certificate_url",
                table: "sellers",
                type: "character varying(1024)",
                maxLength: 1024,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "verification_checklist",
                table: "sellers",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "approved_fingerprint",
                table: "products",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "brand",
                table: "products",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "material",
                table: "products",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "model",
                table: "products",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "nature",
                table: "products",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "origin_country",
                table: "products",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "package_quantity",
                table: "products",
                type: "integer",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<DateTime>(
                name: "screened_at",
                table: "products",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "unbranded",
                table: "products",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<string>(
                name: "details",
                table: "product_reports",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(1000)",
                oldMaxLength: 1000);

            migrationBuilder.AddColumn<string>(
                name: "channel",
                table: "product_reports",
                type: "character varying(24)",
                maxLength: 24,
                nullable: false,
                defaultValue: "PaginaDoProduto");

            migrationBuilder.AddColumn<DateTime>(
                name: "due_at",
                table: "product_reports",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.AddColumn<string>(
                name: "evidence_urls",
                table: "product_reports",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<bool>(
                name: "is_rights_holder",
                table: "product_reports",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "protocol",
                table: "product_reports",
                type: "character varying(24)",
                maxLength: 24,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "reporter_email",
                table: "product_reports",
                type: "character varying(254)",
                maxLength: 254,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "reporter_name",
                table: "product_reports",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "reporter_notified_at",
                table: "product_reports",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "rights_holder_name",
                table: "product_reports",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "abrupt_increase_factor",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "abrupt_increase_min_shipments",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 20);

            migrationBuilder.AddColumn<int>(
                name: "audit_sample_percent",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 10);

            migrationBuilder.AddColumn<DateTime>(
                name: "compliance_program_approved_at",
                table: "platform_settings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "concentration_threshold",
                table: "platform_settings",
                type: "integer",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.AddColumn<string>(
                name: "program_owner_email",
                table: "platform_settings",
                type: "character varying(254)",
                maxLength: 254,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "program_owner_name",
                table: "platform_settings",
                type: "character varying(160)",
                maxLength: 160,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "seller_policy_approved_at",
                table: "platform_settings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "seller_policy_version",
                table: "platform_settings",
                type: "character varying(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "2026-10-09");

            migrationBuilder.AddColumn<string>(
                name: "recipient_verification_source",
                table: "orders",
                type: "character varying(24)",
                maxLength: 24,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "recipient_verified_at",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "declaration_description",
                table: "order_items",
                type: "character varying(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "hs_code",
                table: "order_items",
                type: "character varying(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "origin_country",
                table: "order_items",
                type: "character varying(2)",
                maxLength: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contestation_evidence",
                table: "compliance_occurrences",
                type: "character varying(4000)",
                maxLength: 4000,
                nullable: false,
                defaultValue: "[]");

            migrationBuilder.AddColumn<string>(
                name: "contestation_grounds",
                table: "compliance_occurrences",
                type: "character varying(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contestation_reason",
                table: "compliance_occurrences",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "contested_at",
                table: "compliance_occurrences",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "rf_interaction_id",
                table: "compliance_occurrences",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "categories",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "compliance_trainings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    person_email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    role = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    topic = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    initial = table.Column<bool>(type: "boolean", nullable: false),
                    trained_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    registered_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_compliance_trainings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "enforcement_actions",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    occurred_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    actor_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    automatic = table.Column<bool>(type: "boolean", nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: true),
                    product_id = table.Column<Guid>(type: "uuid", nullable: true),
                    report_id = table.Column<Guid>(type: "uuid", nullable: true),
                    measure_id = table.Column<Guid>(type: "uuid", nullable: true),
                    notice_id = table.Column<Guid>(type: "uuid", nullable: true),
                    alert_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    result = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_enforcement_actions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "monitoring_alerts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    dedup_key = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: true),
                    buyer_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    summary = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    order_ids = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    details_json = table.Column<string>(type: "text", nullable: false),
                    holds_shipments = table.Column<bool>(type: "boolean", nullable: false),
                    detected_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    attribution = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    resolution_note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    resolved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    resolved_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    infraction_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_monitoring_alerts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "order_documents",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    file_name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    content_type = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    content = table.Column<byte[]>(type: "bytea", nullable: false),
                    sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_documents", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "rf_interactions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    reference = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    opened_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    due_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    indicator = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: true),
                    contestation_reason = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    occurrence_ids = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    year = table.Column<int>(type: "integer", nullable: true),
                    month = table.Column<int>(type: "integer", nullable: true),
                    official_counterfeit_permyriad = table.Column<int>(type: "integer", nullable: true),
                    official_undervaluation_permyriad = table.Column<int>(type: "integer", nullable: true),
                    official_declaration_quality_permyriad = table.Column<int>(type: "integer", nullable: true),
                    response = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    attachments = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rf_interactions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "seller_audits",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: false),
                    year = table.Column<int>(type: "integer", nullable: false),
                    reason = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    planned_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    planned_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    notice_id = table.Column<Guid>(type: "uuid", nullable: true),
                    outcome = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    findings = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_seller_audits", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "seller_infractions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    description = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    severity = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    intentional = table.Column<bool>(type: "boolean", nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: true),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    occurrence_id = table.Column<Guid>(type: "uuid", nullable: true),
                    report_id = table.Column<Guid>(type: "uuid", nullable: true),
                    alert_id = table.Column<Guid>(type: "uuid", nullable: true),
                    occurred_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    registered_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    registered_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    recidivist = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_seller_infractions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "seller_measures",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    infraction_id = table.Column<Guid>(type: "uuid", nullable: true),
                    product_id = table.Column<Guid>(type: "uuid", nullable: true),
                    applied_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    applied_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    automatic = table.Column<bool>(type: "boolean", nullable: false),
                    ends_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    revocation_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    revoked_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    notice_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_seller_measures", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "seller_notices",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: false),
                    type = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    document_kind = table.Column<string>(type: "character varying(24)", maxLength: 24, nullable: true),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    message = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    product_id = table.Column<Guid>(type: "uuid", nullable: true),
                    order_id = table.Column<Guid>(type: "uuid", nullable: true),
                    measure_id = table.Column<Guid>(type: "uuid", nullable: true),
                    infraction_id = table.Column<Guid>(type: "uuid", nullable: true),
                    audit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    due_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    read_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    emailed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    response_text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: true),
                    response_files = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    responded_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resolution = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    resolved_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    resolved_by_user_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_seller_notices", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "seller_policy_acceptances",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    policy_version = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    accepted_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    representative_name = table.Column<string>(type: "character varying(160)", maxLength: 160, nullable: false),
                    representative_document_type = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    representative_document = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                    ip_address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_seller_policy_acceptances", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_product_reports_protocol",
                table: "product_reports",
                column: "protocol",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_compliance_trainings_trained_at",
                table: "compliance_trainings",
                column: "trained_at");

            migrationBuilder.CreateIndex(
                name: "ix_enforcement_actions_occurred_at",
                table: "enforcement_actions",
                column: "occurred_at");

            migrationBuilder.CreateIndex(
                name: "ix_enforcement_actions_seller_id",
                table: "enforcement_actions",
                column: "seller_id");

            migrationBuilder.CreateIndex(
                name: "ix_monitoring_alerts_dedup_key",
                table: "monitoring_alerts",
                column: "dedup_key");

            migrationBuilder.CreateIndex(
                name: "ix_monitoring_alerts_seller_id",
                table: "monitoring_alerts",
                column: "seller_id");

            migrationBuilder.CreateIndex(
                name: "ix_monitoring_alerts_status_detected_at",
                table: "monitoring_alerts",
                columns: new[] { "status", "detected_at" });

            migrationBuilder.CreateIndex(
                name: "ix_order_documents_order_id_kind",
                table: "order_documents",
                columns: new[] { "order_id", "kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_rf_interactions_status_due_at",
                table: "rf_interactions",
                columns: new[] { "status", "due_at" });

            migrationBuilder.CreateIndex(
                name: "ix_rf_interactions_type_status",
                table: "rf_interactions",
                columns: new[] { "type", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_seller_audits_seller_id_year",
                table: "seller_audits",
                columns: new[] { "seller_id", "year" });

            migrationBuilder.CreateIndex(
                name: "ix_seller_infractions_seller_id_occurred_at",
                table: "seller_infractions",
                columns: new[] { "seller_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_seller_measures_seller_id_applied_at",
                table: "seller_measures",
                columns: new[] { "seller_id", "applied_at" });

            migrationBuilder.CreateIndex(
                name: "ix_seller_notices_seller_id_status",
                table: "seller_notices",
                columns: new[] { "seller_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_seller_notices_status_due_at",
                table: "seller_notices",
                columns: new[] { "status", "due_at" });

            migrationBuilder.CreateIndex(
                name: "ix_seller_policy_acceptances_seller_id_accepted_at",
                table: "seller_policy_acceptances",
                columns: new[] { "seller_id", "accepted_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "compliance_trainings");

            migrationBuilder.DropTable(
                name: "enforcement_actions");

            migrationBuilder.DropTable(
                name: "monitoring_alerts");

            migrationBuilder.DropTable(
                name: "order_documents");

            migrationBuilder.DropTable(
                name: "rf_interactions");

            migrationBuilder.DropTable(
                name: "seller_audits");

            migrationBuilder.DropTable(
                name: "seller_infractions");

            migrationBuilder.DropTable(
                name: "seller_measures");

            migrationBuilder.DropTable(
                name: "seller_notices");

            migrationBuilder.DropTable(
                name: "seller_policy_acceptances");

            migrationBuilder.DropIndex(
                name: "ix_product_reports_protocol",
                table: "product_reports");

            migrationBuilder.DropColumn(
                name: "checks_json",
                table: "shipments");

            migrationBuilder.DropColumn(
                name: "articles_of_incorporation_url",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "data_confirmed_at",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "email",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "excluded_at",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "legal_name",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "payout_account",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "payout_holder",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "payout_institution",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "payout_method",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "policy_accepted_at",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "policy_version_accepted",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "suspended_until",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "tax_compliance_certificate_url",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "verification_checklist",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "approved_fingerprint",
                table: "products");

            migrationBuilder.DropColumn(
                name: "brand",
                table: "products");

            migrationBuilder.DropColumn(
                name: "material",
                table: "products");

            migrationBuilder.DropColumn(
                name: "model",
                table: "products");

            migrationBuilder.DropColumn(
                name: "nature",
                table: "products");

            migrationBuilder.DropColumn(
                name: "origin_country",
                table: "products");

            migrationBuilder.DropColumn(
                name: "package_quantity",
                table: "products");

            migrationBuilder.DropColumn(
                name: "screened_at",
                table: "products");

            migrationBuilder.DropColumn(
                name: "unbranded",
                table: "products");

            migrationBuilder.DropColumn(
                name: "channel",
                table: "product_reports");

            migrationBuilder.DropColumn(
                name: "due_at",
                table: "product_reports");

            migrationBuilder.DropColumn(
                name: "evidence_urls",
                table: "product_reports");

            migrationBuilder.DropColumn(
                name: "is_rights_holder",
                table: "product_reports");

            migrationBuilder.DropColumn(
                name: "protocol",
                table: "product_reports");

            migrationBuilder.DropColumn(
                name: "reporter_email",
                table: "product_reports");

            migrationBuilder.DropColumn(
                name: "reporter_name",
                table: "product_reports");

            migrationBuilder.DropColumn(
                name: "reporter_notified_at",
                table: "product_reports");

            migrationBuilder.DropColumn(
                name: "rights_holder_name",
                table: "product_reports");

            migrationBuilder.DropColumn(
                name: "abrupt_increase_factor",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "abrupt_increase_min_shipments",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "audit_sample_percent",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "compliance_program_approved_at",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "concentration_threshold",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "program_owner_email",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "program_owner_name",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "seller_policy_approved_at",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "seller_policy_version",
                table: "platform_settings");

            migrationBuilder.DropColumn(
                name: "recipient_verification_source",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "recipient_verified_at",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "declaration_description",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "hs_code",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "origin_country",
                table: "order_items");

            migrationBuilder.DropColumn(
                name: "contestation_evidence",
                table: "compliance_occurrences");

            migrationBuilder.DropColumn(
                name: "contestation_grounds",
                table: "compliance_occurrences");

            migrationBuilder.DropColumn(
                name: "contestation_reason",
                table: "compliance_occurrences");

            migrationBuilder.DropColumn(
                name: "contested_at",
                table: "compliance_occurrences");

            migrationBuilder.DropColumn(
                name: "rf_interaction_id",
                table: "compliance_occurrences");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "categories");

            migrationBuilder.AlterColumn<string>(
                name: "details",
                table: "product_reports",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(2000)",
                oldMaxLength: 2000);
        }
    }
}
