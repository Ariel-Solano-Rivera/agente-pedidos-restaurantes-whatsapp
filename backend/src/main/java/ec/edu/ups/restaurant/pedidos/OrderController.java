package ec.edu.ups.restaurant.pedidos;

import ec.edu.ups.restaurant.common.ApiException;
import ec.edu.ups.restaurant.pedidos.OrderTransitionPolicy.Role;
import ec.edu.ups.restaurant.pedidos.OrderTransitionPolicy.Transition;
import ec.edu.ups.restaurant.security.AppPrincipal;
import ec.edu.ups.restaurant.security.Tenant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.reactive.TransactionalOperator;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Pedidos sintéticos: lista filtrada y paginada, detalle, transiciones por rol y deshacer de cocina.
 * El restaurante sale siempre del usuario autenticado; COCINA no recibe montos.
 */
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {
  private final DatabaseClient db;
  private final TransactionalOperator tx;
  private final Duration undoWindow;

  public OrderController(DatabaseClient db, TransactionalOperator tx, @Value("${app.orders.kitchen-undo-window:PT2M}") Duration undoWindow) {
    this.db = db;
    this.tx = tx;
    this.undoWindow = undoWindow;
  }

  public record Page<T>(List<T> items, int page, int size, long total) {}
  public record Summary(UUID id, String publicCode, String status, String paymentStatus, String fulfillmentType, String customerName, String phone, String items, BigDecimal total, OffsetDateTime createdAt, List<Transition> allowedTransitions) {}
  public record Option(String type, String name, BigDecimal amount) {}
  public record Unit(UUID id, String dish, String variant, int quantity, BigDecimal unitPrice, BigDecimal extrasTotal, BigDecimal lineTotal, List<Option> options) {}
  public record HistoryEntry(String previousStatus, String newStatus, String changeType, String reasonCode, String reason, String actorEmail, String actorRole, OffsetDateTime createdAt) {}
  public record Undo(String targetStatus, OffsetDateTime expiresAt) {}
  public record Detail(UUID id, String publicCode, String status, String paymentStatus, String fulfillmentType, String customerName, String phone, String deliveryAddress, String deliveryReference, String deliveryZone, OffsetDateTime pickupTime, BigDecimal subtotal, BigDecimal deliveryFee, BigDecimal total, OffsetDateTime customerConfirmedAt, String restaurantDecisionBy, OffsetDateTime createdAt, List<Unit> units, List<Transition> allowedTransitions, Undo undo, List<HistoryEntry> history) {}
  public record TransitionInput(@NotBlank String targetStatus, String reasonCode, String reason) {}
  public record TransitionResult(UUID orderId, String status, String changeType) {}

  @GetMapping
  public Mono<Page<Summary>> list(@RequestParam(required = false) String status, @RequestParam(required = false) String fulfillment,
                                  @RequestParam(required = false) String paymentStatus, @RequestParam(required = false) String range,
                                  @RequestParam(required = false) LocalDate from, @RequestParam(required = false) LocalDate to,
                                  @RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size, @AuthenticationPrincipal AppPrincipal user) {
    Role role = OrderTransitionPolicy.role(user.getAuthorities());
    return Tenant.restaurantId().flatMap(restaurantId -> {
      OrderFilter filter = OrderFilter.of(restaurantId, role == Role.COCINA, status, fulfillment, paymentStatus, range, from, to, q, page, size);
      Mono<Long> total = filter.bind(db.sql("SELECT count(*) total FROM customer_order o WHERE " + filter.where()))
        .map((row, metadata) -> row.get("total", Long.class)).one();
      Mono<List<Summary>> items = filter.bind(db.sql("SELECT o.id,o.status,o.payment_status,o.fulfillment_mode,o.customer_name,o.customer_phone,o.total,o.created_at,"
          + "COALESCE(string_agg(CONCAT('1× ',u.dish_name_snapshot), ' · ' ORDER BY u.unit_number),'Sin unidades') items FROM customer_order o "
          + "LEFT JOIN order_unit u ON u.order_id=o.id AND u.restaurante_id=o.restaurante_id WHERE " + filter.where()
          + " GROUP BY o.id ORDER BY o.created_at DESC, o.id LIMIT :limit OFFSET :offset"))
        .bind("limit", filter.size()).bind("offset", (long) filter.page() * filter.size())
        .map((row, metadata) -> {
          String current = row.get("status", String.class);
          boolean kitchen = role == Role.COCINA;
          return new Summary(row.get("id", UUID.class), code(row.get("id", UUID.class)), current, kitchen ? null : row.get("payment_status", String.class),
            row.get("fulfillment_mode", String.class), row.get("customer_name", String.class), row.get("customer_phone", String.class),
            row.get("items", String.class), kitchen ? null : row.get("total", BigDecimal.class), row.get("created_at", OffsetDateTime.class),
            OrderTransitionPolicy.allowed(current, role));
        }).all().collectList();
      return Mono.zip(items, total).map(values -> new Page<>(values.getT1(), filter.page(), filter.size(), values.getT2()));
    });
  }

  @GetMapping("/{id}")
  public Mono<Detail> detail(@PathVariable UUID id, @AuthenticationPrincipal AppPrincipal user) {
    Role role = OrderTransitionPolicy.role(user.getAuthorities());
    boolean kitchen = role == Role.COCINA;
    return Tenant.restaurantId().flatMap(restaurantId -> db.sql("SELECT o.id,o.status,o.payment_status,o.fulfillment_mode,o.customer_name,o.customer_phone,o.delivery_address,o.delivery_reference,"
        + "z.name delivery_zone,o.pickup_time,o.subtotal,o.delivery_fee,o.total,o.confirmed_by_customer_at,du.email decision_by,o.created_at FROM customer_order o "
        + "LEFT JOIN delivery_zone z ON z.id=o.delivery_zone_id AND z.restaurante_id=o.restaurante_id "
        + "LEFT JOIN app_user du ON du.id=o.restaurant_decision_by AND du.restaurante_id=o.restaurante_id "
        + "WHERE o.id=:id AND o.restaurante_id=:r AND (:k=false OR o.status IN ('ACCEPTED','PREPARING','READY','COMPLETED'))")
      .bind("id", id).bind("r", restaurantId).bind("k", kitchen)
      .map((row, metadata) -> new Base(row.get("id", UUID.class), row.get("status", String.class), row.get("payment_status", String.class), row.get("fulfillment_mode", String.class),
        row.get("customer_name", String.class), row.get("customer_phone", String.class), row.get("delivery_address", String.class), row.get("delivery_reference", String.class),
        row.get("delivery_zone", String.class), row.get("pickup_time", OffsetDateTime.class), row.get("subtotal", BigDecimal.class), row.get("delivery_fee", BigDecimal.class),
        row.get("total", BigDecimal.class), row.get("confirmed_by_customer_at", OffsetDateTime.class), row.get("decision_by", String.class), row.get("created_at", OffsetDateTime.class)))
      .one()
      .switchIfEmpty(Mono.error(notFound()))
      .flatMap(base -> Mono.zip(units(restaurantId, id, kitchen).collectList(), history(restaurantId, id).collectList()).map(values -> {
        List<HistoryRow> rows = values.getT2();
        return new Detail(base.id, code(base.id), base.status, kitchen ? null : base.paymentStatus, base.mode, base.customer, base.phone, base.address, base.reference, base.zone,
          base.pickupTime, kitchen ? null : base.subtotal, kitchen ? null : base.fee, kitchen ? null : base.total, base.confirmed, base.decisionBy, base.created, values.getT1(),
          OrderTransitionPolicy.allowed(base.status, role), kitchen ? undoFor(rows, base.status, user.id()) : null, rows.stream().map(HistoryRow::entry).toList());
      })));
  }

  @PostMapping("/{id}/transitions")
  public Mono<TransitionResult> transition(@PathVariable UUID id, @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                           @Valid @RequestBody TransitionInput input, @AuthenticationPrincipal AppPrincipal user) {
    requireKey(idempotencyKey);
    String target = input.targetStatus().trim().toUpperCase();
    if (!OrderTransitionPolicy.STATUSES.contains(target)) return Mono.error(new ApiException(HttpStatus.BAD_REQUEST, "STATUS_INVALID", "Estado destino no reconocido"));
    Role role = OrderTransitionPolicy.role(user.getAuthorities());
    return Tenant.restaurantId().flatMap(restaurantId -> tx.transactional(
      register(restaurantId, "ORDER_TRANSITION:" + id, idempotencyKey, id)
        .flatMap(ignored -> lockStatus(restaurantId, id, role).flatMap(current -> {
          String changeType = OrderTransitionPolicy.validate(current, target, role, input.reasonCode(), input.reason());
          var reasonCode = OrderTransitionPolicy.RETROCESO.equals(changeType) ? OrderTransitionPolicy.parseReason(input.reasonCode()).name() : null;
          return apply(restaurantId, id, current, target, changeType, reasonCode, input.reason(), user, role);
        }))
        .switchIfEmpty(currentResult(restaurantId, id))));
  }

  /** COCINA revierte su propio último avance dentro de la ventana configurada, si el pedido sigue en el estado que dejó. */
  @PostMapping("/{id}/undo")
  @PreAuthorize("hasRole('COCINA')")
  public Mono<TransitionResult> undo(@PathVariable UUID id, @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                                     @AuthenticationPrincipal AppPrincipal user) {
    requireKey(idempotencyKey);
    return Tenant.restaurantId().flatMap(restaurantId -> tx.transactional(
      register(restaurantId, "ORDER_UNDO:" + id, idempotencyKey, id)
        .flatMap(ignored -> lockStatus(restaurantId, id, Role.COCINA).flatMap(current -> db.sql("SELECT previous_status,new_status,change_type,actor_user_id,"
              + "created_at + make_interval(secs => :w) > now() within_window FROM order_status_history WHERE restaurante_id=:r AND order_id=:o ORDER BY created_at DESC, id LIMIT 1")
            .bind("w", (double) undoWindow.toSeconds()).bind("r", restaurantId).bind("o", id)
            .map((row, metadata) -> new LastChange(row.get("previous_status", String.class), row.get("new_status", String.class), row.get("change_type", String.class),
              row.get("actor_user_id", UUID.class), Boolean.TRUE.equals(row.get("within_window", Boolean.class))))
            .one()
            .switchIfEmpty(Mono.error(undoUnavailable()))
            .flatMap(last -> {
              if (!user.id().equals(last.actor) || !OrderTransitionPolicy.AVANCE.equals(last.changeType) || !current.equals(last.newStatus)) return Mono.error(undoUnavailable());
              if (!last.withinWindow) return Mono.error(new ApiException(HttpStatus.CONFLICT, "UNDO_WINDOW_EXPIRED", "Pasó el tiempo para deshacer. Avisa a caja para corregir el estado."));
              return apply(restaurantId, id, current, last.previousStatus, OrderTransitionPolicy.DESHACER, null, "", user, Role.COCINA);
            })))
        .switchIfEmpty(currentResult(restaurantId, id))));
  }

  private Mono<TransitionResult> apply(UUID restaurantId, UUID orderId, String current, String target, String changeType, String reasonCode, String reason, AppPrincipal user, Role role) {
    UUID correlation = UUID.randomUUID();
    boolean decision = OrderTransitionPolicy.AVANCE.equals(changeType) && ("ACCEPTED".equals(target) || "REJECTED".equals(target));
    return db.sql("UPDATE customer_order SET status=:target, restaurant_decision_by=CASE WHEN :decision THEN :user ELSE restaurant_decision_by END WHERE id=:id AND restaurante_id=:r")
      .bind("target", target).bind("decision", decision).bind("user", user.id()).bind("id", orderId).bind("r", restaurantId).fetch().rowsUpdated()
      .then(bindNullable(db.sql("INSERT INTO order_status_history(id,restaurante_id,order_id,previous_status,new_status,reason,reason_code,actor_user_id,actor_role,change_type,correlation_id) "
          + "VALUES(:id,:r,:order,:previous,:next,:reason,:code,:user,:role,:type,:correlation)"), "code", reasonCode)
        .bind("id", UUID.randomUUID()).bind("r", restaurantId).bind("order", orderId).bind("previous", current).bind("next", target)
        .bind("reason", reason == null ? "" : reason.trim()).bind("user", user.id()).bind("role", role.name()).bind("type", changeType).bind("correlation", correlation)
        .fetch().rowsUpdated())
      .then(db.sql("INSERT INTO audit_log(id,restaurante_id,actor_user_id,action,entity_type,entity_id,correlation_id) VALUES(:id,:r,:user,:action,'ORDER',:order,:correlation)")
        .bind("id", UUID.randomUUID()).bind("r", restaurantId).bind("user", user.id()).bind("action", "ORDER_" + changeType + "_" + target).bind("order", orderId).bind("correlation", correlation)
        .fetch().rowsUpdated())
      .thenReturn(new TransitionResult(orderId, target, changeType));
  }

  private Mono<UUID> register(UUID restaurantId, String type, String key, UUID orderId) {
    return db.sql("INSERT INTO idempotency_operation(id,restaurante_id,operation_type,idempotency_key,result_reference) VALUES(:id,:r,:type,:key,:order) "
        + "ON CONFLICT(restaurante_id,operation_type,idempotency_key) DO NOTHING RETURNING id")
      .bind("id", UUID.randomUUID()).bind("r", restaurantId).bind("type", type).bind("key", key.trim()).bind("order", orderId)
      .map((row, metadata) -> row.get("id", UUID.class)).one();
  }

  private Mono<String> lockStatus(UUID restaurantId, UUID orderId, Role role) {
    return db.sql("SELECT status FROM customer_order WHERE id=:id AND restaurante_id=:r FOR UPDATE").bind("id", orderId).bind("r", restaurantId)
      .map((row, metadata) -> row.get("status", String.class)).one()
      .filter(status -> role != Role.COCINA || OrderTransitionPolicy.KITCHEN_VISIBLE.contains(status))
      .switchIfEmpty(Mono.error(notFound()));
  }

  private Mono<TransitionResult> currentResult(UUID restaurantId, UUID orderId) {
    return db.sql("SELECT status FROM customer_order WHERE id=:id AND restaurante_id=:r").bind("id", orderId).bind("r", restaurantId)
      .map((row, metadata) -> new TransitionResult(orderId, row.get("status", String.class), "REPETIDO")).one().switchIfEmpty(Mono.error(notFound()));
  }

  private Flux<Unit> units(UUID restaurantId, UUID orderId, boolean kitchen) {
    return db.sql("SELECT id,dish_name_snapshot,variant_name_snapshot,base_price_snapshot,subtotal FROM order_unit WHERE restaurante_id=:r AND order_id=:o ORDER BY unit_number")
      .bind("r", restaurantId).bind("o", orderId)
      .map((row, metadata) -> new UnitBase(row.get("id", UUID.class), row.get("dish_name_snapshot", String.class), row.get("variant_name_snapshot", String.class),
        row.get("base_price_snapshot", BigDecimal.class), row.get("subtotal", BigDecimal.class))).all()
      .concatMap(unit -> options(restaurantId, unit.id).collectList().map(options -> {
        BigDecimal extras = options.stream().map(Option::amount).reduce(BigDecimal.ZERO, BigDecimal::add);
        List<Option> visible = kitchen ? options.stream().map(option -> new Option(option.type(), option.name(), null)).toList() : options;
        return new Unit(unit.id, unit.dish, unit.variant, 1, kitchen ? null : unit.price, kitchen ? null : extras, kitchen ? null : unit.total, visible);
      }));
  }

  private Flux<Option> options(UUID restaurantId, UUID unitId) {
    return db.sql("SELECT option_type,name_snapshot,surcharge_snapshot FROM order_unit_option WHERE restaurante_id=:r AND order_unit_id=:u ORDER BY option_type,name_snapshot")
      .bind("r", restaurantId).bind("u", unitId)
      .map((row, metadata) -> new Option(row.get("option_type", String.class), row.get("name_snapshot", String.class), row.get("surcharge_snapshot", BigDecimal.class))).all();
  }

  private Flux<HistoryRow> history(UUID restaurantId, UUID orderId) {
    return db.sql("SELECT h.previous_status,h.new_status,h.change_type,h.reason_code,h.reason,u.email,h.actor_role,h.actor_user_id,h.created_at FROM order_status_history h "
        + "LEFT JOIN app_user u ON u.id=h.actor_user_id AND u.restaurante_id=h.restaurante_id WHERE h.restaurante_id=:r AND h.order_id=:o ORDER BY h.created_at DESC, h.id")
      .bind("r", restaurantId).bind("o", orderId)
      .map((row, metadata) -> new HistoryRow(new HistoryEntry(row.get("previous_status", String.class), row.get("new_status", String.class), row.get("change_type", String.class),
        row.get("reason_code", String.class), row.get("reason", String.class), row.get("email", String.class), row.get("actor_role", String.class),
        row.get("created_at", OffsetDateTime.class)), row.get("actor_user_id", UUID.class))).all();
  }

  /** Indica a COCINA si puede deshacer; el backend vuelve a validar todo al ejecutar la acción. */
  private Undo undoFor(List<HistoryRow> rows, String status, UUID userId) {
    if (rows.isEmpty()) return null;
    HistoryRow last = rows.get(0);
    OffsetDateTime expiresAt = last.entry.createdAt().plus(undoWindow);
    boolean mine = userId.equals(last.actorId) && OrderTransitionPolicy.AVANCE.equals(last.entry.changeType()) && status.equals(last.entry.newStatus());
    return mine && expiresAt.isAfter(OffsetDateTime.now()) ? new Undo(last.entry.previousStatus(), expiresAt) : null;
  }

  private static DatabaseClient.GenericExecuteSpec bindNullable(DatabaseClient.GenericExecuteSpec spec, String name, String value) {
    return value == null ? spec.bindNull(name, String.class) : spec.bind(name, value);
  }

  private static void requireKey(String key) {
    if (key == null || key.isBlank() || key.length() > 120) throw new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key es obligatorio (máximo 120 caracteres)");
  }

  private static ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "ORDER_NOT_FOUND", "Pedido no encontrado"); }
  private static ApiException undoUnavailable() { return new ApiException(HttpStatus.CONFLICT, "UNDO_NOT_AVAILABLE", "No hay un cambio tuyo reciente para deshacer. Avisa a caja."); }
  static String code(UUID id) { return "PED-" + id.toString().substring(0, 8).toUpperCase(); }

  private record Base(UUID id, String status, String paymentStatus, String mode, String customer, String phone, String address, String reference, String zone, OffsetDateTime pickupTime,
                      BigDecimal subtotal, BigDecimal fee, BigDecimal total, OffsetDateTime confirmed, String decisionBy, OffsetDateTime created) {}
  private record UnitBase(UUID id, String dish, String variant, BigDecimal price, BigDecimal total) {}
  private record HistoryRow(HistoryEntry entry, UUID actorId) {}
  private record LastChange(String previousStatus, String newStatus, String changeType, UUID actor, boolean withinWindow) {}
}
