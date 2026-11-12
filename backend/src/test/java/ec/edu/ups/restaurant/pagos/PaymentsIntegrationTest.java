package ec.edu.ups.restaurant.pagos;

import static org.assertj.core.api.Assertions.assertThat;

import ec.edu.ups.restaurant.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;

/** Pagos con la semilla V10: lectura por pedido, confirmación manual, idempotencia, aislamiento y permisos. */
class PaymentsIntegrationTest extends IntegrationTest {
  private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST = new ParameterizedTypeReference<>() {};
  private static final ParameterizedTypeReference<Map<String, Object>> MAP = new ParameterizedTypeReference<>() {};

  private List<Map<String, Object>> payments(String email, String query) {
    return as(email).get().uri("/api/v1/payments" + query).exchange().expectStatus().isOk().expectBody(LIST).returnResult().getResponseBody();
  }

  @Test
  void filtersByOrderShowsTheVerifierAndStaysIsolated() {
    Map<String, Object> confirmed = payments(CAJA, "").stream().filter(item -> "CONFIRMED".equals(item.get("status"))).findFirst().orElseThrow();
    String orderId = (String) confirmed.get("orderId");

    List<Map<String, Object>> forOrder = payments(CAJA, "?orderId=" + orderId);
    assertThat(forOrder).isNotEmpty().allSatisfy(item -> assertThat(item.get("orderId")).isEqualTo(orderId));
    assertThat(forOrder).anySatisfy(item -> {
      assertThat(item.get("verifiedBy")).isEqualTo(CAJA);
      assertThat(item.get("verifiedAt")).isNotNull();
    });

    assertThat(payments(OTHER_ADMIN, "?orderId=" + orderId)).isEmpty();
    as(COCINA).get().uri("/api/v1/payments?orderId=" + orderId).exchange().expectStatus().isForbidden();
  }

  @Test
  void cashierConfirmsAPendingPaymentOnceAndItIsAuditedAndIsolated() {
    Map<String, Object> pending = payments(CAJA, "").stream().filter(item -> "PENDING_VERIFICATION".equals(item.get("status"))).findFirst().orElseThrow();
    String paymentId = (String) pending.get("id"); String orderId = (String) pending.get("orderId");

    // Otro restaurante y COCINA no pueden confirmar un pago de Mar Azul.
    as(OTHER_ADMIN).post().uri("/api/v1/payments/" + paymentId + "/confirm").header("Idempotency-Key", key()).exchange().expectStatus().isNotFound();
    as(COCINA).post().uri("/api/v1/payments/" + paymentId + "/confirm").header("Idempotency-Key", key()).exchange().expectStatus().isForbidden();
    as(CAJA).post().uri("/api/v1/payments/" + paymentId + "/confirm").exchange().expectStatus().isBadRequest().expectBody().jsonPath("$.code").isEqualTo("IDEMPOTENCY_KEY_REQUIRED");

    String idempotencyKey = key();
    Map<String, Object> confirmed = as(CAJA).post().uri("/api/v1/payments/" + paymentId + "/confirm").header("Idempotency-Key", idempotencyKey)
      .exchange().expectStatus().isOk().expectBody(MAP).returnResult().getResponseBody();
    assertThat(confirmed.get("status")).isEqualTo("CONFIRMED");
    assertThat(confirmed.get("verifiedBy")).isEqualTo(CAJA);
    assertThat(confirmed.get("verifiedAt")).isNotNull();

    // El pedido refleja el pago confirmado, pero su estado no cambia por confirmar un pago.
    Map<String, Object> order = as(CAJA).get().uri("/api/v1/orders/" + orderId).exchange().expectStatus().isOk().expectBody(MAP).returnResult().getResponseBody();
    assertThat(order.get("paymentStatus")).isEqualTo("CONFIRMED");
    assertThat(order.get("status")).isNotIn("REJECTED", "CANCELLED");

    // Misma clave: sin efecto adicional; clave nueva sobre un pago ya confirmado: 409.
    as(CAJA).post().uri("/api/v1/payments/" + paymentId + "/confirm").header("Idempotency-Key", idempotencyKey).exchange().expectStatus().isOk().expectBody().jsonPath("$.status").isEqualTo("CONFIRMED");
    as(CAJA).post().uri("/api/v1/payments/" + paymentId + "/confirm").header("Idempotency-Key", key()).exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.code").isEqualTo("PAYMENT_NOT_CONFIRMABLE");

    Long audits = db.sql("SELECT count(*) n FROM audit_log WHERE action='PAYMENT_CONFIRMED' AND entity_id=:p").bind("p", java.util.UUID.fromString(paymentId)).map((row, meta) -> row.get("n", Long.class)).one().block();
    assertThat(audits).isEqualTo(1L);
    Long verifier = db.sql("SELECT count(*) n FROM payment WHERE id=:p AND status='CONFIRMED' AND verified_by IS NOT NULL AND verified_at IS NOT NULL").bind("p", java.util.UUID.fromString(paymentId)).map((row, meta) -> row.get("n", Long.class)).one().block();
    assertThat(verifier).isEqualTo(1L);
  }
}
