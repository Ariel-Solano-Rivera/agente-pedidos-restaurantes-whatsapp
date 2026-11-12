package ec.edu.ups.restaurant.pagos;

import ec.edu.ups.restaurant.common.ApiException;
import ec.edu.ups.restaurant.security.AppPrincipal;
import ec.edu.ups.restaurant.security.Tenant;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.reactive.TransactionalOperator;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Pagos del restaurante del usuario: lectura y confirmación manual por ADMIN o CAJA (ADR-001, estados de pago
 * validados el 2026-11-11). Recibir un comprobante nunca confirma por sí solo; solo esta operación pasa un pago a CONFIRMED.
 * `orderId` filtra los pagos de un pedido (detalle del pedido); un pedido de otro restaurante devuelve una lista vacía.
 */
@RestController @RequestMapping("/api/v1/payments") @PreAuthorize("hasAnyRole('ADMIN','CAJA')")
public class PaymentController {
  /** Estados desde los que el personal puede confirmar manualmente. */
  static final Set<String> CONFIRMABLE = Set.of("PENDING", "PENDING_VERIFICATION");
  private static final String SELECT = "SELECT p.id,p.order_id,p.method,p.amount,p.status,p.reference_text,p.verified_at,u.email verified_by FROM payment p "
    + "LEFT JOIN app_user u ON u.id=p.verified_by AND u.restaurante_id=p.restaurante_id WHERE p.restaurante_id=:r";

  private final DatabaseClient db;
  private final TransactionalOperator tx;
  public PaymentController(DatabaseClient db, TransactionalOperator tx) { this.db = db; this.tx = tx; }

  public record Payment(UUID id, UUID orderId, String orderCode, String method, BigDecimal amount, String status, String reference,
                        String verifiedBy, OffsetDateTime verifiedAt) {}

  @GetMapping
  public Flux<Payment> list(@RequestParam(required = false) UUID orderId) {
    return Tenant.restaurantId().flatMapMany(r -> {
      var spec = db.sql(SELECT + (orderId != null ? " AND p.order_id=:o" : "") + " ORDER BY p.verified_at NULLS LAST, p.id").bind("r", r);
      if (orderId != null) spec = spec.bind("o", orderId);
      return spec.map((row, metadata) -> payment(row)).all();
    });
  }

  /**
   * Confirma manualmente un pago `PENDING` o `PENDING_VERIFICATION` del restaurante propio: fija `CONFIRMED`, verificador y fecha,
   * sincroniza `customer_order.payment_status`, audita y es idempotente por `Idempotency-Key`. No toca el estado del pedido.
   */
  @PostMapping("/{id}/confirm")
  public Mono<Payment> confirm(@PathVariable UUID id, @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
                               @AuthenticationPrincipal AppPrincipal user) {
    if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.trim().length() > 120)
      return Mono.error(new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "Falta la cabecera Idempotency-Key (hasta 120 caracteres)"));
    return Tenant.restaurantId().flatMap(r -> tx.transactional(
      db.sql("INSERT INTO idempotency_operation(id,restaurante_id,operation_type,idempotency_key,result_reference) VALUES(:id,:r,:type,:key,:payment) "
          + "ON CONFLICT(restaurante_id,operation_type,idempotency_key) DO NOTHING RETURNING id")
        .bind("id", UUID.randomUUID()).bind("r", r).bind("type", "PAYMENT_CONFIRM:" + id).bind("key", idempotencyKey.trim()).bind("payment", id)
        .map((row, metadata) -> row.get("id", UUID.class)).one()
        .flatMap(ignored -> db.sql("SELECT status, order_id FROM payment WHERE id=:id AND restaurante_id=:r FOR UPDATE").bind("id", id).bind("r", r)
          .map((row, metadata) -> new Locked(row.get("status", String.class), row.get("order_id", UUID.class))).one()
          .switchIfEmpty(Mono.error(notFound()))
          .flatMap(locked -> {
            if (!CONFIRMABLE.contains(locked.status)) return Mono.error(new ApiException(HttpStatus.CONFLICT, "PAYMENT_NOT_CONFIRMABLE", "Este pago ya está " + label(locked.status) + " y no se puede confirmar"));
            UUID correlation = UUID.randomUUID();
            return db.sql("UPDATE payment SET status='CONFIRMED', verified_by=:user, verified_at=now() WHERE id=:id AND restaurante_id=:r").bind("user", user.id()).bind("id", id).bind("r", r).fetch().rowsUpdated()
              .then(db.sql("UPDATE customer_order SET payment_status='CONFIRMED' WHERE id=:order AND restaurante_id=:r").bind("order", locked.orderId).bind("r", r).fetch().rowsUpdated())
              .then(db.sql("INSERT INTO audit_log(id,restaurante_id,actor_user_id,action,entity_type,entity_id,correlation_id) VALUES(:id,:r,:user,'PAYMENT_CONFIRMED','PAYMENT',:payment,:correlation)")
                .bind("id", UUID.randomUUID()).bind("r", r).bind("user", user.id()).bind("payment", id).bind("correlation", correlation).fetch().rowsUpdated());
          }))
        .then(one(r, id))
        // Clave repetida: no se repite el efecto y se devuelve el pago tal como está.
        .switchIfEmpty(one(r, id))));
  }

  private record Locked(String status, UUID orderId) {}

  private Mono<Payment> one(UUID restaurantId, UUID id) {
    return db.sql(SELECT + " AND p.id=:id").bind("r", restaurantId).bind("id", id).map((row, metadata) -> payment(row)).one().switchIfEmpty(Mono.error(notFound()));
  }

  private static Payment payment(io.r2dbc.spi.Readable row) {
    UUID order = row.get("order_id", UUID.class);
    return new Payment(row.get("id", UUID.class), order, "PED-" + order.toString().substring(0, 8).toUpperCase(), row.get("method", String.class),
      row.get("amount", BigDecimal.class), row.get("status", String.class), row.get("reference_text", String.class),
      row.get("verified_by", String.class), row.get("verified_at", OffsetDateTime.class));
  }

  private static String label(String status) {
    return switch (status) { case "CONFIRMED" -> "confirmado"; case "REJECTED" -> "rechazado"; case "NOT_REQUIRED" -> "marcado como no requerido"; default -> "en estado " + status; };
  }
  private static ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "PAYMENT_NOT_FOUND", "Pago no encontrado"); }
}
