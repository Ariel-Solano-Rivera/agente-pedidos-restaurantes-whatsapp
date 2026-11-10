package ec.edu.ups.restaurant.pagos;

import ec.edu.ups.restaurant.security.Tenant;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

/**
 * Lectura de pagos del restaurante del usuario. La confirmación manual sigue ausente hasta aprobar ADR-001.
 * `orderId` filtra los pagos de un pedido (detalle del pedido); un pedido de otro restaurante devuelve una lista vacía.
 */
@RestController @RequestMapping("/api/v1/payments") @PreAuthorize("hasAnyRole('ADMIN','CAJA')")
public class PaymentController {
  private final DatabaseClient db;
  public PaymentController(DatabaseClient db) { this.db = db; }

  public record Payment(UUID id, UUID orderId, String orderCode, String method, BigDecimal amount, String status, String reference,
                        String verifiedBy, OffsetDateTime verifiedAt) {}

  @GetMapping
  public Flux<Payment> list(@RequestParam(required = false) UUID orderId) {
    return Tenant.restaurantId().flatMapMany(r -> {
      var spec = db.sql("SELECT p.id,p.order_id,p.method,p.amount,p.status,p.reference_text,p.verified_at,u.email verified_by FROM payment p "
          + "LEFT JOIN app_user u ON u.id=p.verified_by AND u.restaurante_id=p.restaurante_id "
          + "WHERE p.restaurante_id=:r" + (orderId != null ? " AND p.order_id=:o" : "") + " ORDER BY p.verified_at NULLS LAST, p.id")
        .bind("r", r);
      if (orderId != null) spec = spec.bind("o", orderId);
      return spec.map((row, metadata) -> {
        UUID order = row.get("order_id", UUID.class);
        return new Payment(row.get("id", UUID.class), order, "PED-" + order.toString().substring(0, 8).toUpperCase(), row.get("method", String.class),
          row.get("amount", BigDecimal.class), row.get("status", String.class), row.get("reference_text", String.class),
          row.get("verified_by", String.class), row.get("verified_at", OffsetDateTime.class));
      }).all();
    });
  }
}
