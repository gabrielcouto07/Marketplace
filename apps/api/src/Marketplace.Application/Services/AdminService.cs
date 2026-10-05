using Marketplace.Application.Abstractions;
using Marketplace.Application.Common;
using Marketplace.Application.Contracts;
using Marketplace.Domain;
using Marketplace.Domain.Common;
using Marketplace.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Marketplace.Application.Services;

/// <summary>Painel administrativo: visão geral, usuários, lojas, produtos, pedidos, pagamentos, repasses, cupons, câmbio, configurações e auditoria.</summary>
public sealed class AdminService(
    IAppDbContext db,
    OrderService orders,
    PaymentService payments,
    PrivacyService privacy,
    RefundService refunds,
    ComplianceService compliance,
    ICatalogCache catalogCache,
    ICurrentUser currentUser,
    TimeProvider clock)
{
    private DateTime Now => clock.GetUtcNow().UtcDateTime;

    private static readonly OrderStatus[] PaidStatuses =
    [
        OrderStatus.Pago, OrderStatus.EmPreparacao, OrderStatus.Enviado, OrderStatus.EmTransitoInternacional,
        OrderStatus.Entregue, OrderStatus.Concluido, OrderStatus.EmDisputa, OrderStatus.Devolvido,
    ];

    private void Audit(string action, string? target, string? details = null) =>
        db.AuditLogs.Add(new AuditLog { UserId = currentUser.UserId, Action = action, Target = target, OccurredAt = Now, IpAddress = currentUser.IpAddress, Details = details });

    // ----- Visão geral -----

    public async Task<AdminOverviewDto> OverviewAsync(CancellationToken ct)
    {
        var now = Now;
        var from = now.Date.AddDays(-29);
        var paid = db.Orders.AsNoTracking().Where(o => PaidStatuses.Contains(o.Status));
        var paid30 = paid.Where(o => o.CreatedAt >= from);

        var totalUsers = await db.Users.CountAsync(u => u.AnonymizedAt == null, ct);
        var newUsers = await db.Users.CountAsync(u => u.CreatedAt >= from, ct);
        var blocked = await db.Users.CountAsync(u => u.BlockedAt != null, ct);
        var sellers = await db.Sellers.GroupBy(s => s.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var products = await db.Products.GroupBy(p => p.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var byStatus = await db.Orders.GroupBy(o => o.Status).Select(g => new { g.Key, Count = g.Count() }).ToListAsync(ct);
        var gmv30 = await paid30.SumAsync(o => o.SubtotalAmount + o.ShippingAmount - o.DiscountAmount, ct);
        var gmvTotal = await paid.SumAsync(o => o.SubtotalAmount + o.ShippingAmount - o.DiscountAmount, ct);
        var tax30 = await paid30.SumAsync(o => o.ImportTaxAmount, ct);
        var fees30 = await db.Payouts.Where(p => p.PeriodStart >= from).SumAsync(p => p.PlatformFeeAmount, ct);
        var pendingPayouts = await db.Payouts.Where(p => p.Status == PayoutStatus.Agendado || p.Status == PayoutStatus.Processando).ToListAsync(ct);

        var daily = await paid30.Select(o => new { o.CreatedAt, Amount = o.SubtotalAmount + o.ShippingAmount - o.DiscountAmount }).ToListAsync(ct);
        var byDay = Enumerable.Range(0, 30).Select(i => from.AddDays(i)).Select(day =>
        {
            var rows = daily.Where(d => d.CreatedAt.Date == day).ToList();
            return new AdminSalesPointDto(day, Money.Brl(rows.Sum(r => r.Amount)), rows.Count);
        }).ToList();

        var recent = await OrderListQuery().OrderByDescending(o => o.Order.CreatedAt).Take(8).ToListAsync(ct);

        int Count(SellerStatus s) => sellers.FirstOrDefault(x => x.Key == s)?.Count ?? 0;
        int OrdersIn(OrderStatus s) => byStatus.FirstOrDefault(x => x.Key == s)?.Count ?? 0;

        return new AdminOverviewDto(
            new DateRange(from, now),
            totalUsers, newUsers, blocked,
            sellers.Sum(s => s.Count), Count(SellerStatus.Pendente), Count(SellerStatus.Suspenso),
            products.FirstOrDefault(p => p.Key == ProductStatus.Ativo)?.Count ?? 0,
            products.FirstOrDefault(p => p.Key == ProductStatus.Rascunho)?.Count ?? 0,
            byStatus.Sum(s => s.Count), await db.Orders.CountAsync(o => o.CreatedAt >= from, ct),
            OrdersIn(OrderStatus.Enviado) + OrdersIn(OrderStatus.EmTransitoInternacional),
            OrdersIn(OrderStatus.Pago) + OrdersIn(OrderStatus.EmPreparacao),
            OrdersIn(OrderStatus.EmDisputa),
            Money.Brl(gmv30), Money.Brl(gmvTotal), Money.Brl(tax30), Money.Brl(fees30),
            Money.Brl(pendingPayouts.Sum(p => p.NetAmount)), pendingPayouts.Count,
            Enum.GetValues<OrderStatus>().Select(s => new AdminStatusCountDto(s, OrdersIn(s))).ToList(),
            byDay,
            recent.Select(ToListItem).ToList());
    }

    // ----- Pedidos (consulta base reutilizada) -----

    // Linhas de consulta são classes com inicializadores: o EF Core traduz `new X { A = ... }` e permite
    // filtrar/ordenar sobre os membros depois — com records posicionais (construtor) isso não é traduzível.
    private sealed class OrderRow
    {
        public required Order Order { get; init; }
        public required string BuyerName { get; init; }
        public required string BuyerEmail { get; init; }
        public required string SellerName { get; init; }
        public PaymentMethod Method { get; init; }
        public PaymentStatus PaymentStatus { get; init; }
        public int ItemsCount { get; init; }
    }

    private IQueryable<OrderRow> OrderListQuery() =>
        from o in db.Orders.AsNoTracking()
        join u in db.Users on o.UserId equals u.Id
        join s in db.Sellers on o.SellerId equals s.Id
        join p in db.Payments on o.PaymentId equals p.Id
        select new OrderRow { Order = o, BuyerName = u.FullName, BuyerEmail = u.Email, SellerName = s.Name, Method = p.Method, PaymentStatus = p.Status, ItemsCount = o.Items.Count };

    private static AdminOrderListItemDto ToListItem(OrderRow r) =>
        new(r.Order.Id, r.Order.Number, r.Order.Status, r.Order.CreatedAt, r.Order.UpdatedAt, r.Order.UserId, r.BuyerName, r.BuyerEmail,
            r.Order.SellerId, r.SellerName, Money.Brl(r.Order.TotalAmount), r.Order.PaymentId, r.Method, r.PaymentStatus,
            r.Order.TrackingCode, r.ItemsCount);

    public async Task<PagedResult<AdminOrderListItemDto>> ListOrdersAsync(
        OrderStatus? status, string? q, Guid? sellerId, Guid? userId, bool? inTransit, int? page, int? pageSize, CancellationToken ct)
    {
        var query = OrderListQuery();
        if (status is { } s) query = query.Where(r => r.Order.Status == s);
        if (inTransit == true) query = query.Where(r => r.Order.Status == OrderStatus.Enviado || r.Order.Status == OrderStatus.EmTransitoInternacional);
        if (sellerId is { } sid) query = query.Where(r => r.Order.SellerId == sid);
        if (userId is { } uid) query = query.Where(r => r.Order.UserId == uid);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLowerInvariant();
            query = query.Where(r => r.Order.Number.ToLower().Contains(term) || r.BuyerName.ToLower().Contains(term)
                                     || r.BuyerEmail.Contains(term) || r.SellerName.ToLower().Contains(term)
                                     || (r.Order.TrackingCode != null && r.Order.TrackingCode.ToLower().Contains(term)));
        }
        var paged = await query.OrderByDescending(r => r.Order.CreatedAt).ToPagedAsync(page, pageSize, 20, ct);
        return paged.Map(ToListItem);
    }

    public async Task<AdminOrderDetailDto> GetOrderAsync(string idOrNumber, CancellationToken ct)
    {
        var order = await FindOrderAsync(idOrNumber, track: false, ct);
        var buyer = await UserSummaryAsync(order.UserId, ct) ?? throw AppException.NotFound("Comprador");
        var payment = await db.Payments.AsNoTracking().FirstAsync(p => p.Id == order.PaymentId, ct);
        var payout = await PayoutQuery().FirstOrDefaultAsync(p => p.Payout.OrderId == order.Id, ct);
        return new AdminOrderDetailDto(order.ToDto(currentUser.Locale), buyer, payment.ToDto(), payout is null ? null : ToPayoutDto(payout));
    }

    private async Task<Order> FindOrderAsync(string idOrNumber, bool track, CancellationToken ct)
    {
        var query = track ? orders.FullOrders() : orders.FullOrders().AsNoTracking();
        var order = Guid.TryParse(idOrNumber, out var id)
            ? await query.FirstOrDefaultAsync(o => o.Id == id, ct)
            : await query.FirstOrDefaultAsync(o => o.Number == idOrNumber, ct);
        return order ?? throw AppException.NotFound("Pedido");
    }

    /// <summary>Transição manual pelo admin (respeita a máquina de estados; cancelamento devolve estoque).</summary>
    public async Task<OrderDto> TransitionOrderAsync(string idOrNumber, AdminOrderTransitionRequest request, CancellationToken ct)
    {
        var order = await FindOrderAsync(idOrNumber, track: true, ct);
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : $"Admin: {request.Note.Trim()}";
        if (request.Status == OrderStatus.Cancelado)
        {
            if (!OrderStateMachine.CanTransition(order.Status, OrderStatus.Cancelado))
                throw AppException.Conflict("ORDER_INVALID_TRANSITION", $"Não é possível cancelar um pedido {order.Status}.");
            orders.MarkCancelled(order, note ?? "Cancelado pela administração.", "admin");
            // Pedido já pago: estorna a parte dele no gateway (fora da transação) e cancela o repasse.
            if (order.Payment.Status == PaymentStatus.Aprovado)
            {
                var refunded = await refunds.RefundOrderAsync(order, order.Payment, ct);
                order.Events[^1].Note += refunded ? " Estorno solicitado no meio de pagamento." : " Estorno pendente de processamento manual.";
            }
            Audit("admin.order.transition", order.Number, request.Status.ToString());
            // Estoque devolvido + pedido + auditoria na mesma transação.
            await orders.CommitCancellationAsync([order], ct);
            return order.ToDto(currentUser.Locale);
        }

        if (request.Status == OrderStatus.Enviado)
        {
            if (!string.IsNullOrWhiteSpace(request.TrackingCode)) order.TrackingCode = request.TrackingCode.Trim().ToUpperInvariant();
            if (!string.IsNullOrWhiteSpace(request.Carrier)) order.Carrier = request.Carrier.Trim();
        }
        orders.Transition(order, request.Status, note, null, "admin");
        if (request.Status == OrderStatus.Enviado && order.TrackingCode is not null && order.TrackingEvents.All(e => e.Code != Domain.Shipping.TrackingCodes.Posted))
            order.TrackingEvents.Add(new TrackingEvent
            {
                OrderId = order.Id, Code = Domain.Shipping.TrackingCodes.Posted, Description = "Objeto postado", Location = $"{order.Seller.City}, PY",
                OccurredAt = Now, ExternalId = $"seller:{order.TrackingCode}:posted",
            });
        Audit("admin.order.transition", order.Number, request.Status.ToString());
        await db.SaveChangesAsync(ct);
        return order.ToDto(currentUser.Locale);
    }

    /// <summary>Resolve disputa: Devolvido, Reembolsado (estorno no gateway) ou Concluido (a favor do vendedor).</summary>
    public async Task<OrderDto> ResolveDisputeAsync(string idOrNumber, AdminDisputeResolveRequest request, CancellationToken ct)
    {
        var order = await FindOrderAsync(idOrNumber, track: true, ct);
        if (order.Status != OrderStatus.EmDisputa) throw AppException.Conflict("ORDER_NOT_IN_DISPUTE", "Este pedido não está em disputa.");
        if (request.Outcome is not (OrderStatus.Devolvido or OrderStatus.Reembolsado or OrderStatus.Concluido))
            throw AppException.Validation("outcome", "Resultado deve ser Devolvido, Reembolsado ou Concluido.");
        var note = string.IsNullOrWhiteSpace(request.Note) ? "Disputa resolvida pela administração." : $"Disputa resolvida: {request.Note.Trim()}";
        orders.Transition(order, request.Outcome, note, null, "admin");
        if (request.Outcome == OrderStatus.Reembolsado) await RefundOrderAsync(order, ct);
        Audit("admin.dispute.resolve", order.Number, request.Outcome.ToString());
        await db.SaveChangesAsync(ct);
        return order.ToDto(currentUser.Locale);
    }

    private async Task RefundOrderAsync(Order order, CancellationToken ct)
    {
        var payout = await db.Payouts.FirstOrDefaultAsync(p => p.OrderId == order.Id, ct);
        if (payout is { Status: PayoutStatus.Processando }) { payout.Status = PayoutStatus.Falhou; payout.FailureReason = "Pedido reembolsado."; }
        var ok = await refunds.RefundOrderAsync(order, order.Payment, ct);
        if (!ok) order.Events[^1].Note += " (estorno pendente de processamento manual)";
    }

    // ----- Usuários -----

    private sealed class UserRow
    {
        public required User User { get; init; }
        public int OrdersCount { get; init; }
        public long TotalSpent { get; init; }
        public string? SellerName { get; init; }
    }

    private IQueryable<UserRow> UserListQuery() =>
        db.Users.AsNoTracking().Select(u => new UserRow
        {
            User = u,
            OrdersCount = db.Orders.Count(o => o.UserId == u.Id),
            TotalSpent = db.Orders.Where(o => o.UserId == u.Id && PaidStatuses.Contains(o.Status)).Sum(o => o.TotalAmount),
            SellerName = db.Sellers.Where(s => s.OwnerUserId == u.Id).Select(s => s.Name).FirstOrDefault(),
        });

    private static AdminUserListItemDto ToUserItem(UserRow r) =>
        new(r.User.Id, r.User.FullName, r.User.Email, r.User.Phone, r.User.Roles, r.User.CreatedAt, r.User.BlockedAt, r.User.AnonymizedAt,
            r.OrdersCount, Money.Brl(r.TotalSpent), r.SellerName);

    public async Task<PagedResult<AdminUserListItemDto>> ListUsersAsync(string? q, UserRole? role, bool? blocked, int? page, int? pageSize, CancellationToken ct)
    {
        var query = db.Users.AsNoTracking().Where(u => u.AnonymizedAt == null);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLowerInvariant();
            query = query.Where(u => u.FullName.ToLower().Contains(term) || u.Email.Contains(term) || (u.Phone != null && u.Phone.Contains(term)));
        }
        if (blocked is { } b) query = b ? query.Where(u => u.BlockedAt != null) : query.Where(u => u.BlockedAt == null);
        var ordered = query.OrderByDescending(u => u.CreatedAt);
        var (p, s) = Pagination.Normalize(page, pageSize, 20);
        // Roles é uma lista gravada como texto (conversor): o filtro por papel roda em memória sobre os ids.
        var candidates = await ordered.Select(u => new { u.Id, u.Roles }).ToListAsync(ct);
        var ids = (role is { } r ? candidates.Where(c => c.Roles.Contains(r)) : candidates).Select(c => c.Id).ToList();
        var pageIds = ids.Skip((p - 1) * s).Take(s).ToList();
        var items = await UserListQuery().Where(u => pageIds.Contains(u.User.Id)).ToListAsync(ct);
        return new PagedResult<AdminUserListItemDto>(pageIds.Select(id => ToUserItem(items.First(i => i.User.Id == id))).ToList(), p, s, ids.Count);
    }

    private async Task<AdminUserListItemDto?> UserSummaryAsync(Guid id, CancellationToken ct)
    {
        var row = await UserListQuery().FirstOrDefaultAsync(u => u.User.Id == id, ct);
        return row is null ? null : ToUserItem(row);
    }

    public async Task<AdminUserDetailDto> GetUserAsync(Guid id, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, ct) ?? throw AppException.NotFound("Usuário");
        var summary = (await UserSummaryAsync(id, ct))!;
        var addresses = await db.Addresses.AsNoTracking().Where(a => a.UserId == id && a.DeletedAt == null).ToListAsync(ct);
        var recent = await OrderListQuery().Where(r => r.Order.UserId == id).OrderByDescending(r => r.Order.CreatedAt).Take(10).ToListAsync(ct);
        var consents = await db.Consents.AsNoTracking().Where(c => c.UserId == id).OrderByDescending(c => c.AcceptedAt).ToListAsync(ct);
        var activity = await AuditQuery().Where(a => a.Log.UserId == id).OrderByDescending(a => a.Log.OccurredAt).Take(10).ToListAsync(ct);
        return new AdminUserDetailDto(summary, user.Cpf, user.EmailVerified, user.PasswordHash != null, user.GoogleSubject != null, user.BlockedReason,
            addresses.Select(a => a.ToDto()).ToList(), recent.Select(ToListItem).ToList(), consents.Select(c => c.ToDto()).ToList(), activity.Select(ToAuditItem).ToList());
    }

    public async Task<AdminUserDetailDto> UpdateUserAsync(Guid id, AdminUserUpdateRequest request, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.AnonymizedAt == null, ct) ?? throw AppException.NotFound("Usuário");
        var name = request.FullName?.Trim();
        var phone = Documents.OnlyDigits(request.Phone);
        new ValidationErrors()
            .AddIf(name is { Length: < 3 }, "fullName", "Nome com pelo menos 3 caracteres.")
            .AddIf(request.Phone is not null && phone.Length is not (0 or 10 or 11), "phone", "Telefone inválido.")
            .AddIf(request.Roles is { Count: 0 }, "roles", "O usuário precisa de pelo menos um papel.")
            .AddIf(request.Roles is not null && id == currentUser.UserId && !request.Roles.Contains(UserRole.Admin), "roles", "Você não pode remover seu próprio papel de administrador.")
            .ThrowIfAny();
        if (name is not null) user.FullName = name;
        if (request.Phone is not null) user.Phone = phone.Length == 0 ? null : phone;
        if (request.Roles is not null) user.Roles = request.Roles.Distinct().ToList();
        user.UpdatedAt = Now;
        Audit("admin.user.update", user.Email);
        await db.SaveChangesAsync(ct);
        return await GetUserAsync(id, ct);
    }

    public async Task<AdminUserDetailDto> SetBlockedAsync(Guid id, bool blocked, AdminBlockRequest? request, CancellationToken ct)
    {
        if (blocked && id == currentUser.UserId) throw AppException.Conflict("CANNOT_BLOCK_SELF", "Você não pode bloquear a si mesmo.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.AnonymizedAt == null, ct) ?? throw AppException.NotFound("Usuário");
        user.BlockedAt = blocked ? Now : null;
        user.BlockedReason = blocked ? request?.Reason?.Trim() : null;
        user.UpdatedAt = Now;
        if (blocked)
        {
            var tokens = await db.RefreshTokens.Where(t => t.UserId == id && t.RevokedAt == null).ToListAsync(ct);
            foreach (var t in tokens) t.RevokedAt = Now;
        }
        Audit(blocked ? "admin.user.block" : "admin.user.unblock", user.Email, request?.Reason);
        await db.SaveChangesAsync(ct);
        return await GetUserAsync(id, ct);
    }

    public async Task AnonymizeUserAsync(Guid id, CancellationToken ct)
    {
        if (id == currentUser.UserId) throw AppException.Conflict("CANNOT_DELETE_SELF", "Você não pode excluir a própria conta por aqui.");
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == id && u.AnonymizedAt == null, ct) ?? throw AppException.NotFound("Usuário");
        await privacy.AnonymizeAsync(user, requireNoOpenOrders: false, ct);
        Audit("admin.user.anonymize", id.ToString());
        await db.SaveChangesAsync(ct);
    }

    // ----- Vendedores -----

    private sealed class SellerRow
    {
        public required Seller Seller { get; init; }
        public string? OwnerEmail { get; init; }
        public int ProductCount { get; init; }
        public int OrdersCount { get; init; }
        public long Gross30d { get; init; }
        public int OpenDisputes { get; init; }
        public int Occurrences { get; init; }
    }

    private IQueryable<SellerRow> SellerListQuery(DateTime from) =>
        db.Sellers.AsNoTracking().Select(s => new SellerRow
        {
            Seller = s,
            OwnerEmail = db.Users.Where(u => u.Id == s.OwnerUserId).Select(u => u.Email).FirstOrDefault(),
            ProductCount = db.Products.Count(p => p.SellerId == s.Id && p.Status == ProductStatus.Ativo),
            OrdersCount = db.Orders.Count(o => o.SellerId == s.Id),
            Gross30d = db.Orders.Where(o => o.SellerId == s.Id && o.CreatedAt >= from && PaidStatuses.Contains(o.Status)).Sum(o => o.SubtotalAmount + o.ShippingAmount - o.DiscountAmount),
            OpenDisputes = db.Orders.Count(o => o.SellerId == s.Id && o.Status == OrderStatus.EmDisputa),
            Occurrences = db.ComplianceOccurrences.Count(o => o.SellerId == s.Id && o.Status != OccurrenceStatus.Anulada && o.OccurredAt >= from.AddDays(-335)),
        });

    private static AdminSellerListItemDto ToSellerItem(SellerRow r) =>
        new(r.Seller.Id, r.Seller.Slug, r.Seller.Name, r.Seller.Ruc, r.Seller.City, r.Seller.Status, r.Seller.ReputationLevel, r.Seller.IsOfficialStore,
            r.Seller.LogoUrl, r.Seller.OwnerUserId, r.OwnerEmail, r.Seller.MemberSince, r.ProductCount, r.OrdersCount, Money.Brl(r.Gross30d), r.OpenDisputes,
            r.Seller.VerifiedAt != null, r.Occurrences);

    public async Task<PagedResult<AdminSellerListItemDto>> ListSellersAsync(string? q, SellerStatus? status, int? page, int? pageSize, CancellationToken ct)
    {
        var query = SellerListQuery(Now.AddDays(-30));
        if (status is { } s) query = query.Where(x => x.Seller.Status == s);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLowerInvariant();
            query = query.Where(x => x.Seller.Name.ToLower().Contains(term) || x.Seller.Ruc.Contains(term) || x.Seller.City.ToLower().Contains(term) || (x.OwnerEmail != null && x.OwnerEmail.Contains(term)));
        }
        var paged = await query.OrderByDescending(x => x.Gross30d).ThenBy(x => x.Seller.Name).ToPagedAsync(page, pageSize, 20, ct);
        return paged.Map(ToSellerItem);
    }

    public async Task<AdminSellerDetailDto> GetSellerAsync(Guid id, CancellationToken ct)
    {
        var seller = await db.Sellers.AsNoTracking().Include(s => s.Categories).ThenInclude(c => c.Category).FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw AppException.NotFound("Loja");
        var summary = ToSellerItem(await SellerListQuery(Now.AddDays(-30)).FirstAsync(s => s.Seller.Id == id, ct));
        var recent = await OrderListQuery().Where(r => r.Order.SellerId == id).OrderByDescending(r => r.Order.CreatedAt).Take(10).ToListAsync(ct);
        var payouts = await PayoutQuery().Where(p => p.Payout.SellerId == id).OrderByDescending(p => p.Payout.ScheduledFor).Take(10).ToListAsync(ct);
        var occurrences = await compliance.SellerOccurrencesAsync(id, 20, ct);
        return new AdminSellerDetailDto(summary, seller.Description, seller.ExchangePolicy, seller.BannerUrl, seller.Rating, seller.ReviewCount,
            seller.Categories.Select(c => c.Category.ToRef()).ToList(), recent.Select(ToListItem).ToList(), payouts.Select(ToPayoutDto).ToList(),
            SellerPanelService.ToVerification(seller), occurrences);
    }

    /// <summary>
    /// Política de admissão (critério v): a equipe confere documento do responsável, constância do RUC e endereço de
    /// origem. Aprovar verifica e libera a loja (Pendente → Aprovado); recusar suspende com o motivo.
    /// </summary>
    public async Task<AdminSellerDetailDto> VerifySellerAsync(Guid id, SellerVerificationRequest request, CancellationToken ct)
    {
        var seller = await db.Sellers.FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw AppException.NotFound("Loja");
        var note = request.Note?.Trim();
        if (request.Approve)
        {
            if (!seller.HasVerificationDocuments)
                throw AppException.Validation("verification", "A loja ainda não enviou todos os documentos (responsável, documento, constância do RUC e endereço de origem).");
            seller.VerifiedAt = Now;
            seller.VerifiedByUserId = currentUser.UserId;
            if (seller.Status == SellerStatus.Pendente) seller.Status = SellerStatus.Aprovado;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(note) || note.Length < 5) throw AppException.Validation("note", "Explique o motivo da recusa (o vendedor vê esta mensagem).");
            seller.VerifiedAt = null;
            seller.Status = SellerStatus.Suspenso;
            seller.SuspendedAt = Now;
            seller.SuspensionReason = $"Cadastro recusado: {note}";
        }
        Audit(request.Approve ? "admin.seller.verify" : "admin.seller.reject", seller.Slug, note);
        await db.SaveChangesAsync(ct);
        await catalogCache.InvalidateAsync(ct);
        return await GetSellerAsync(id, ct);
    }

    public async Task<AdminSellerDetailDto> UpdateSellerAsync(Guid id, AdminSellerUpdateRequest request, CancellationToken ct)
    {
        var seller = await db.Sellers.FirstOrDefaultAsync(s => s.Id == id, ct) ?? throw AppException.NotFound("Loja");
        new ValidationErrors()
            .AddIf(request.Name is { } n && n.Trim().Length < 3, "name", "Nome com pelo menos 3 caracteres.")
            .AddIf(request.ReputationLevel is < 1 or > 5, "reputationLevel", "Reputação de 1 a 5.")
            .ThrowIfAny();
        if (request.Name is not null) seller.Name = request.Name.Trim();
        if (request.City is not null) seller.City = request.City.Trim();
        if (request.Description is not null) seller.Description = request.Description.Trim();
        if (request.Status is { } status && status != seller.Status)
        {
            var reason = request.SuspensionReason?.Trim();
            if (status == SellerStatus.Suspenso)
            {
                if (string.IsNullOrWhiteSpace(reason) || reason.Length < 5)
                    throw AppException.Validation("suspensionReason", "Informe o motivo da suspensão (fica no histórico e aparece para o vendedor).");
                seller.SuspensionReason = reason.Length > 500 ? reason[..500] : reason;
                seller.SuspendedAt = Now;
            }
            else if (status == SellerStatus.Aprovado)
            {
                if (seller.Status == SellerStatus.Pendente && seller.VerifiedAt is null)
                    throw AppException.Validation("status", "Verifique os documentos da loja antes de aprovar.");
                seller.SuspensionReason = null;
                seller.SuspendedAt = null;
            }
            seller.Status = status;
        }
        if (request.ReputationLevel is { } rep) seller.ReputationLevel = rep;
        if (request.IsOfficialStore is { } official) seller.IsOfficialStore = official;
        Audit("admin.seller.update", seller.Slug, request.Status?.ToString());
        await db.SaveChangesAsync(ct);
        await catalogCache.InvalidateAsync(ct);
        return await GetSellerAsync(id, ct);
    }

    // ----- Produtos -----

    public async Task<PagedResult<AdminProductListItemDto>> ListProductsAsync(string? q, ProductStatus? status, Guid? sellerId, int? page, int? pageSize, CancellationToken ct)
    {
        var query = db.Products.AsNoTracking().Include(p => p.Images).Include(p => p.Seller).Include(p => p.Category).AsQueryable();
        if (status is { } s) query = query.Where(p => p.Status == s);
        if (sellerId is { } sid) query = query.Where(p => p.SellerId == sid);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = Slug.Normalize(q.Trim());
            query = query.Where(p => p.SearchText.Contains(term) || p.Slug.Contains(term));
        }
        var paged = await query.OrderByDescending(p => p.UpdatedAt).ToPagedAsync(page, pageSize, 20, ct);
        var ids = paged.Items.Select(p => p.Id).ToList();
        var reports = await db.ProductReports.AsNoTracking().Where(r => ids.Contains(r.ProductId) && r.Status == ProductReportStatus.Aberta)
            .GroupBy(r => r.ProductId).Select(g => new { g.Key, Count = g.Count() }).ToDictionaryAsync(x => x.Key, x => x.Count, ct);
        return paged.Map(p => new AdminProductListItemDto(p.Id, p.Slug, p.Name, p.Thumbnail(), p.Price, p.Stock, p.Status, p.SellerId, p.Seller.Name, p.Category.Name, p.SoldCount, p.UpdatedAt,
            p.ModerationReason, p.HsCode, reports.GetValueOrDefault(p.Id)));
    }

    public async Task<AdminProductListItemDto> UpdateProductAsync(Guid id, AdminProductUpdateRequest request, CancellationToken ct)
    {
        var product = await db.Products.Include(p => p.Images).Include(p => p.Seller).Include(p => p.Category).FirstOrDefaultAsync(p => p.Id == id, ct)
                      ?? throw AppException.NotFound("Produto");
        new ValidationErrors()
            .AddIf(request.PriceAmount is < 100, "priceAmount", "Preço mínimo R$ 1,00.")
            .AddIf(request.Stock is < 0, "stock", "Estoque não pode ser negativo.")
            .AddIf(request.Name is { } n && n.Trim().Length < 5, "name", "Nome com pelo menos 5 caracteres.")
            .ThrowIfAny();
        if (request.Status is { } status && status != product.Status)
        {
            if (status == ProductStatus.Ativo)
            {
                if (product.HsCode is null) throw AppException.Validation("status", "O produto não tem NCM; peça ao vendedor para completar antes de publicar.");
                product.ApprovedName = request.Name?.Trim() ?? product.Name;
                product.ApprovedPriceAmount = request.PriceAmount ?? product.PriceAmount;
                product.ModerationReason = null;
                product.ModerationNote = null;
            }
            product.Status = status;
            product.ModeratedAt = Now;
        }
        if (request.PriceAmount is { } price) product.PriceAmount = price;
        if (request.Stock is { } stock) product.Stock = stock;
        if (request.Name is not null) { product.Name = request.Name.Trim(); product.SearchText = Slug.Normalize($"{product.Name} {product.Seller.Name}"); }
        product.UpdatedAt = Now;
        Audit("admin.product.update", product.Slug, request.Status?.ToString());
        await db.SaveChangesAsync(ct);
        await catalogCache.InvalidateAsync(ct);
        return new AdminProductListItemDto(product.Id, product.Slug, product.Name, product.Thumbnail(), product.Price, product.Stock, product.Status, product.SellerId, product.Seller.Name, product.Category.Name, product.SoldCount, product.UpdatedAt,
            product.ModerationReason, product.HsCode);
    }

    // ----- Pagamentos -----

    public async Task<PagedResult<AdminPaymentListItemDto>> ListPaymentsAsync(PaymentStatus? status, string? q, int? page, int? pageSize, CancellationToken ct)
    {
        var query = from p in db.Payments.AsNoTracking()
                    join u in db.Users on p.UserId equals u.Id
                    select new { Payment = p, u.Email };
        if (status is { } s) query = query.Where(x => x.Payment.Status == s);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLowerInvariant();
            query = query.Where(x => x.Email.Contains(term) || (x.Payment.GatewayPaymentId != null && x.Payment.GatewayPaymentId.Contains(term)) || x.Payment.Id.ToString().Contains(term));
        }
        var paged = await query.OrderByDescending(x => x.Payment.CreatedAt).ToPagedAsync(page, pageSize, 20, ct);
        var purchaseIds = paged.Items.Select(x => x.Payment.PurchaseId).ToList();
        var numbers = await db.Orders.AsNoTracking().Where(o => purchaseIds.Contains(o.PurchaseId)).Select(o => new { o.PurchaseId, o.Number }).ToListAsync(ct);
        return paged.Map(x => new AdminPaymentListItemDto(x.Payment.Id, x.Payment.PurchaseId, x.Payment.Method, x.Payment.Status, x.Payment.Money,
            x.Payment.CreatedAt, x.Payment.PaidAt, x.Payment.Gateway, x.Payment.GatewayPaymentId, x.Email,
            numbers.Where(n => n.PurchaseId == x.Payment.PurchaseId).Select(n => n.Number).OrderBy(n => n).ToList(), x.Payment.FailureReason));
    }

    /// <summary>Estorno total: gateway + pedidos → Reembolsado + repasses cancelados.</summary>
    public async Task<PaymentDto> RefundPaymentAsync(Guid id, CancellationToken ct)
    {
        var payment = await db.Payments.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Pagamento");
        if (payment.Status != PaymentStatus.Aprovado) throw AppException.Conflict("PAYMENT_NOT_REFUNDABLE", "Só pagamentos aprovados podem ser estornados.");
        if (!await refunds.RefundRemainingAsync(payment, ct))
            throw AppException.BadGateway("REFUND_FAILED", "O gateway não aceitou o estorno. Tente novamente ou estorne manualmente no painel do gateway.");
        await payments.RefundAsync(payment, Now, ct);
        Audit("admin.payment.refund", payment.Id.ToString());
        await db.SaveChangesAsync(ct);
        return payment.ToDto();
    }

    // ----- Repasses -----

    private sealed class PayoutRow
    {
        public required Payout Payout { get; init; }
        public required string SellerName { get; init; }
        public required string OrderNumber { get; init; }
    }

    private IQueryable<PayoutRow> PayoutQuery() =>
        from p in db.Payouts.AsNoTracking()
        join s in db.Sellers on p.SellerId equals s.Id
        join o in db.Orders on p.OrderId equals o.Id
        select new PayoutRow { Payout = p, SellerName = s.Name, OrderNumber = o.Number };

    private static PayoutDto ToPayoutDto(PayoutRow r) =>
        new(r.Payout.Id, r.Payout.SellerId, r.SellerName, r.Payout.OrderId, r.OrderNumber, new DateRange(r.Payout.PeriodStart, r.Payout.PeriodEnd),
            Money.Brl(r.Payout.GrossAmount), Money.Brl(r.Payout.PlatformFeeAmount), Money.Brl(r.Payout.PaymentFeeAmount), Money.Brl(r.Payout.NetAmount),
            r.Payout.Status, r.Payout.ScheduledFor, r.Payout.PaidAt, r.Payout.FailureReason);

    public async Task<PagedResult<PayoutDto>> ListPayoutsAsync(PayoutStatus? status, Guid? sellerId, int? page, int? pageSize, CancellationToken ct)
    {
        var query = PayoutQuery();
        if (status is { } s) query = query.Where(r => r.Payout.Status == s);
        if (sellerId is { } sid) query = query.Where(r => r.Payout.SellerId == sid);
        var paged = await query.OrderBy(r => r.Payout.Status).ThenBy(r => r.Payout.ScheduledFor).ToPagedAsync(page, pageSize, 20, ct);
        return paged.Map(ToPayoutDto);
    }

    public async Task<PayoutDto> SetPayoutStatusAsync(Guid id, PayoutStatus status, CancellationToken ct)
    {
        var payout = await db.Payouts.FirstOrDefaultAsync(p => p.Id == id, ct) ?? throw AppException.NotFound("Repasse");
        if (payout.Status == PayoutStatus.Pago && status != PayoutStatus.Pago)
            throw AppException.Conflict("PAYOUT_ALREADY_PAID", "Repasse já pago não pode voltar.");
        payout.Status = status;
        payout.PaidAt = status == PayoutStatus.Pago ? Now : null;
        payout.FailureReason = status == PayoutStatus.Falhou ? payout.FailureReason ?? "Marcado como falho pela administração." : null;
        Audit("admin.payout.status", payout.Id.ToString(), status.ToString());
        await db.SaveChangesAsync(ct);
        return ToPayoutDto(await PayoutQuery().FirstAsync(p => p.Payout.Id == id, ct));
    }

    // ----- Cupons -----

    private static CouponDto ToDto(Coupon c) => new(c.Id, c.Code, c.DiscountBasisPoints, c.MinSubtotalAmount, c.ExpiresAt, c.MaxUses, c.UsedCount, c.Active);

    public async Task<IReadOnlyList<CouponDto>> ListCouponsAsync(CancellationToken ct) =>
        (await db.Coupons.AsNoTracking().OrderByDescending(c => c.Active).ThenBy(c => c.Code).ToListAsync(ct)).Select(ToDto).ToList();

    public async Task<CouponDto> SaveCouponAsync(Guid? id, CouponInput input, CancellationToken ct)
    {
        var code = (input.Code ?? string.Empty).Trim().ToUpperInvariant();
        new ValidationErrors()
            .AddIf(code.Length is < 3 or > 40 || !code.All(ch => char.IsLetterOrDigit(ch) || ch == '-'), "code", "Código com 3 a 40 letras/números.")
            .AddIf(input.DiscountBasisPoints is null or < 1 or > 10000, "discountBasisPoints", "Desconto entre 0,01% e 100%.")
            .AddIf(input.MinSubtotalAmount is < 0, "minSubtotalAmount", "Valor mínimo inválido.")
            .AddIf(input.MaxUses is < 1, "maxUses", "Limite de usos inválido.")
            .ThrowIfAny();
        if (await db.Coupons.AnyAsync(c => c.Code == code && c.Id != id, ct)) throw AppException.Validation("code", "Já existe um cupom com este código.");
        Coupon coupon;
        if (id is { } existingId)
            coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Id == existingId, ct) ?? throw AppException.NotFound("Cupom");
        else { coupon = new Coupon { Id = Guid.NewGuid(), Code = code }; db.Coupons.Add(coupon); }
        coupon.Code = code;
        coupon.DiscountBasisPoints = input.DiscountBasisPoints!.Value;
        coupon.MinSubtotalAmount = input.MinSubtotalAmount;
        coupon.ExpiresAt = input.ExpiresAt;
        coupon.MaxUses = input.MaxUses;
        coupon.Active = input.Active;
        Audit(id is null ? "admin.coupon.create" : "admin.coupon.update", code);
        await db.SaveChangesAsync(ct);
        return ToDto(coupon);
    }

    public async Task DeleteCouponAsync(Guid id, CancellationToken ct)
    {
        var coupon = await db.Coupons.FirstOrDefaultAsync(c => c.Id == id, ct) ?? throw AppException.NotFound("Cupom");
        db.Coupons.Remove(coupon);
        Audit("admin.coupon.delete", coupon.Code);
        await db.SaveChangesAsync(ct);
    }

    // ----- Câmbio -----

    public async Task<IReadOnlyList<ExchangeRateDto>> ListRatesAsync(CancellationToken ct) =>
        (await db.ExchangeRates.AsNoTracking().OrderByDescending(r => r.QuotedAt).Take(50).ToListAsync(ct)).Select(r => r.ToDto()).ToList();

    public async Task<ExchangeRateDto> CreateRateAsync(ExchangeRateInput input, CancellationToken ct)
    {
        new ValidationErrors()
            .AddIf(input.From == input.To, "to", "Moedas devem ser diferentes.")
            .AddIf(input.Numerator is null or <= 0 || input.Denominator is null or <= 0, "numerator", "Informe numerador e denominador positivos.")
            .ThrowIfAny();
        var now = Now;
        var rate = new ExchangeRate
        {
            Id = Guid.NewGuid(), From = input.From, To = input.To, Numerator = input.Numerator!.Value, Denominator = input.Denominator!.Value,
            DisplayRate = DisplayRate(input.From, input.To, input.Numerator.Value, input.Denominator.Value),
            QuotedAt = now, ExpiresAt = input.ExpiresAt ?? now.AddDays(1), Source = "admin",
        };
        db.ExchangeRates.Add(rate);
        Audit("admin.rate.create", $"{input.From}->{input.To}", rate.DisplayRate);
        await db.SaveChangesAsync(ct);
        await catalogCache.InvalidateAsync(ct);
        return rate.ToDto();
    }

    private static string DisplayRate(CurrencyCode from, CurrencyCode to, long num, long den)
    {
        var fromMinor = (long)Math.Pow(10, Money.MinorDigits(from));
        var converted = new Money(fromMinor, from).Convert(from, to, num, den);
        var pt = System.Globalization.CultureInfo.GetCultureInfo("pt-BR");
        string Fmt(Money m) => m.Currency switch
        {
            CurrencyCode.BRL => "R$ " + (m.Amount / 100m).ToString("N2", pt),
            CurrencyCode.USD => "US$ " + (m.Amount / 100m).ToString("N2", pt),
            _ => "₲ " + m.Amount.ToString("N0", pt),
        };
        return $"{Fmt(new Money(fromMinor, from))} = {Fmt(converted)}";
    }

    // ----- Banners e categorias -----

    public async Task<IReadOnlyList<BannerDto>> ListBannersAsync(CancellationToken ct) =>
        (await db.Banners.AsNoTracking().OrderBy(b => b.SortOrder).ToListAsync(ct)).Select(b => b.ToDto()).ToList();

    public async Task<BannerDto> SaveBannerAsync(Guid? id, BannerInput input, CancellationToken ct)
    {
        new ValidationErrors()
            .AddIf(string.IsNullOrWhiteSpace(input.Title), "title", "Informe o título.")
            .AddIf(string.IsNullOrWhiteSpace(input.ImageUrl), "imageUrl", "Informe a imagem.")
            .AddIf(string.IsNullOrWhiteSpace(input.Href) || !input.Href.StartsWith('/'), "href", "Link deve começar com /.")
            .ThrowIfAny();
        Banner banner;
        if (id is { } existing) banner = await db.Banners.FirstOrDefaultAsync(b => b.Id == existing, ct) ?? throw AppException.NotFound("Banner");
        else { banner = new Banner { Id = Guid.NewGuid(), Title = input.Title!, ImageUrl = input.ImageUrl!, Href = input.Href! }; db.Banners.Add(banner); }
        banner.Title = input.Title!.Trim();
        banner.Subtitle = input.Subtitle?.Trim() ?? string.Empty;
        banner.ImageUrl = input.ImageUrl!.Trim();
        banner.Href = input.Href!.Trim();
        banner.Tone = input.Tone;
        banner.SortOrder = input.SortOrder;
        banner.Active = input.Active;
        Audit(id is null ? "admin.banner.create" : "admin.banner.update", banner.Title);
        await db.SaveChangesAsync(ct);
        return banner.ToDto();
    }

    public async Task DeleteBannerAsync(Guid id, CancellationToken ct)
    {
        var banner = await db.Banners.FirstOrDefaultAsync(b => b.Id == id, ct) ?? throw AppException.NotFound("Banner");
        db.Banners.Remove(banner);
        Audit("admin.banner.delete", banner.Title);
        await db.SaveChangesAsync(ct);
        await catalogCache.InvalidateAsync(ct);
    }

    public async Task<CategoryDto> SaveCategoryAsync(Guid? id, CategoryInput input, CancellationToken ct)
    {
        var name = input.Name?.Trim() ?? string.Empty;
        var slug = string.IsNullOrWhiteSpace(input.Slug) ? Slug.From(name) : Slug.From(input.Slug);
        new ValidationErrors()
            .AddIf(name.Length < 2, "name", "Informe o nome.")
            .AddIf(slug.Length < 2, "slug", "Slug inválido.")
            .AddIf(string.IsNullOrWhiteSpace(input.IconKey), "iconKey", "Informe o ícone (chave lucide).")
            .ThrowIfAny();
        if (await db.Categories.AnyAsync(c => c.Slug == slug && c.Id != id, ct)) throw AppException.Validation("slug", "Já existe uma categoria com este slug.");
        Category category;
        if (id is { } existing) category = await db.Categories.FirstOrDefaultAsync(c => c.Id == existing, ct) ?? throw AppException.NotFound("Categoria");
        else { category = new Category { Id = Guid.NewGuid(), Slug = slug, Name = name, IconKey = input.IconKey! }; db.Categories.Add(category); }
        category.Name = name;
        category.Slug = slug;
        category.IconKey = input.IconKey!.Trim();
        category.ImageUrl = string.IsNullOrWhiteSpace(input.ImageUrl) ? null : input.ImageUrl.Trim();
        category.SortOrder = input.SortOrder;
        Audit(id is null ? "admin.category.create" : "admin.category.update", slug);
        await db.SaveChangesAsync(ct);
        var count = await db.Products.CountAsync(p => p.CategoryId == category.Id && p.Status == ProductStatus.Ativo, ct);
        return category.ToDto(count);
    }

    // ----- Configurações -----

    private static readonly HashSet<string> Ufs =
    [
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
        "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
    ];

    private static bool ValidIcmsOverrides(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return true;
        var parts = raw.Split([';', ',', '\n'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var parsed = PlatformSettings.ParseIcmsOverrides(raw);
        return parsed.Count == parts.Length && parsed.Keys.All(k => Ufs.Contains(k.ToUpperInvariant()));
    }

    private static PlatformSettingsDto ToDto(PlatformSettings s) =>
        new(s.ImportTaxMode, s.ImportTaxBasisPoints, s.IcmsBasisPoints, s.PlatformFeeBasisPoints, s.PaymentFeeBasisPoints, s.FreeShippingThresholdAmount,
            s.QuoteLockMinutes, s.PixExpirationMinutes, s.BoletoDueDays, s.PayoutHoldDays, s.AutoCompleteDays, s.TermsVersion, s.PrivacyPolicyVersion, s.UpdatedAt,
            s.IcmsStateOverrides, s.IbsStateBasisPoints, s.IbsMunicipalBasisPoints, s.CbsBasisPoints, s.InsuranceBasisPoints, s.OtherExpensesAmount,
            s.SellerStrikeLimit, s.StrikeWindowDays, s.PriceFloorPercent, s.ProtectedBrands, s.RequirePlatformLabel);

    public async Task<PlatformSettingsDto> GetSettingsAsync(CancellationToken ct) =>
        ToDto(await db.PlatformSettings.AsNoTracking().FirstAsync(s => s.Id == 1, ct));

    public async Task<PlatformSettingsDto> UpdateSettingsAsync(PlatformSettingsDto input, CancellationToken ct)
    {
        new ValidationErrors()
            .AddIf(input.ImportTaxBasisPoints is < 0 or > 20000, "importTaxBasisPoints", "Alíquota entre 0% e 200%.")
            .AddIf(input.IcmsBasisPoints is < 0 or > 5000, "icmsBasisPoints", "ICMS entre 0% e 50%.")
            .AddIf(input.PlatformFeeBasisPoints is < 0 or > 5000, "platformFeeBasisPoints", "Comissão entre 0% e 50%.")
            .AddIf(input.PaymentFeeBasisPoints is < 0 or > 2000, "paymentFeeBasisPoints", "Taxa de pagamento entre 0% e 20%.")
            .AddIf(input.FreeShippingThresholdAmount < 0, "freeShippingThresholdAmount", "Valor inválido.")
            .AddIf(input.QuoteLockMinutes is < 1 or > 120, "quoteLockMinutes", "Entre 1 e 120 minutos.")
            .AddIf(input.PixExpirationMinutes is < 5 or > 1440, "pixExpirationMinutes", "Entre 5 minutos e 24 horas.")
            .AddIf(input.BoletoDueDays is < 1 or > 30, "boletoDueDays", "Entre 1 e 30 dias.")
            .AddIf(input.PayoutHoldDays is < 0 or > 90, "payoutHoldDays", "Entre 0 e 90 dias.")
            .AddIf(input.AutoCompleteDays is < 1 or > 60, "autoCompleteDays", "Entre 1 e 60 dias.")
            .AddIf(string.IsNullOrWhiteSpace(input.TermsVersion) || string.IsNullOrWhiteSpace(input.PrivacyPolicyVersion), "termsVersion", "Informe as versões dos documentos.")
            .AddIf(input.IbsStateBasisPoints is < 0 or > 3000 || input.IbsMunicipalBasisPoints is < 0 or > 3000, "ibsStateBasisPoints", "IBS entre 0% e 30%.")
            .AddIf(input.CbsBasisPoints is < 0 or > 3000, "cbsBasisPoints", "CBS entre 0% e 30%.")
            .AddIf(input.InsuranceBasisPoints is < 0 or > 2000, "insuranceBasisPoints", "Seguro entre 0% e 20%.")
            .AddIf(input.OtherExpensesAmount is < 0 or > 1_000_000, "otherExpensesAmount", "Despesas entre R$ 0 e R$ 10.000.")
            .AddIf(input.SellerStrikeLimit is < 0 or > 50, "sellerStrikeLimit", "Entre 0 (desligado) e 50 ocorrências.")
            .AddIf(input.StrikeWindowDays is < 30 or > 730, "strikeWindowDays", "Entre 30 e 730 dias.")
            .AddIf(input.PriceFloorPercent is < 0 or > 100, "priceFloorPercent", "Entre 0% e 100%.")
            .AddIf((input.ProtectedBrands ?? "").Length > 2000, "protectedBrands", "Lista muito longa (máximo 2.000 caracteres).")
            .AddIf(!ValidIcmsOverrides(input.IcmsStateOverrides), "icmsStateOverrides", "Use UF=pontos-base separados por ponto e vírgula, ex.: SP=2000; RJ=2000.")
            .ThrowIfAny();
        var s = await db.PlatformSettings.FirstAsync(x => x.Id == 1, ct);
        s.ImportTaxMode = input.ImportTaxMode;
        s.ImportTaxBasisPoints = input.ImportTaxBasisPoints;
        s.IcmsBasisPoints = input.IcmsBasisPoints;
        s.PlatformFeeBasisPoints = input.PlatformFeeBasisPoints;
        s.PaymentFeeBasisPoints = input.PaymentFeeBasisPoints;
        s.FreeShippingThresholdAmount = input.FreeShippingThresholdAmount;
        s.QuoteLockMinutes = input.QuoteLockMinutes;
        s.PixExpirationMinutes = input.PixExpirationMinutes;
        s.BoletoDueDays = input.BoletoDueDays;
        s.PayoutHoldDays = input.PayoutHoldDays;
        s.AutoCompleteDays = input.AutoCompleteDays;
        s.TermsVersion = input.TermsVersion.Trim();
        s.PrivacyPolicyVersion = input.PrivacyPolicyVersion.Trim();
        s.IcmsStateOverrides = string.Join("; ", PlatformSettings.ParseIcmsOverrides(input.IcmsStateOverrides).OrderBy(kv => kv.Key).Select(kv => $"{kv.Key}={kv.Value}"));
        s.IbsStateBasisPoints = input.IbsStateBasisPoints;
        s.IbsMunicipalBasisPoints = input.IbsMunicipalBasisPoints;
        s.CbsBasisPoints = input.CbsBasisPoints;
        s.InsuranceBasisPoints = input.InsuranceBasisPoints;
        s.OtherExpensesAmount = input.OtherExpensesAmount;
        s.SellerStrikeLimit = input.SellerStrikeLimit;
        s.StrikeWindowDays = input.StrikeWindowDays;
        s.PriceFloorPercent = input.PriceFloorPercent;
        s.ProtectedBrands = (input.ProtectedBrands ?? "").Trim();
        s.RequirePlatformLabel = input.RequirePlatformLabel;
        s.UpdatedAt = Now;
        Audit("admin.settings.update", "platform_settings");
        await db.SaveChangesAsync(ct);
        await catalogCache.InvalidateAsync(ct);
        return ToDto(s);
    }

    // ----- Auditoria -----

    private sealed class AuditRow
    {
        public required AuditLog Log { get; init; }
        public string? UserEmail { get; init; }
    }

    private IQueryable<AuditRow> AuditQuery() =>
        from a in db.AuditLogs.AsNoTracking()
        join u in db.Users on a.UserId equals u.Id into users
        from u in users.DefaultIfEmpty()
        select new AuditRow { Log = a, UserEmail = u != null ? u.Email : null };

    private static AdminAuditLogDto ToAuditItem(AuditRow r) =>
        new(r.Log.Id, r.Log.UserId, r.UserEmail, r.Log.Action, r.Log.Target, r.Log.OccurredAt, r.Log.IpAddress);

    public async Task<PagedResult<AdminAuditLogDto>> ListAuditAsync(string? q, int? page, int? pageSize, CancellationToken ct)
    {
        var query = AuditQuery();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim().ToLowerInvariant();
            query = query.Where(a => a.Log.Action.Contains(term) || (a.Log.Target != null && a.Log.Target.ToLower().Contains(term)) || (a.UserEmail != null && a.UserEmail.Contains(term)));
        }
        var paged = await query.OrderByDescending(a => a.Log.OccurredAt).ToPagedAsync(page, pageSize, 30, ct);
        return paged.Map(ToAuditItem);
    }
}
