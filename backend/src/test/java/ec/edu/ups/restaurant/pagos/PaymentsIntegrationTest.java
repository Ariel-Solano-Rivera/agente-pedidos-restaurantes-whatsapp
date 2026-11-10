package ec.edu.ups.restaurant.pagos;

import static org.assertj.core.api.Assertions.assertThat;

import ec.edu.ups.restaurant.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;

/** Lectura de pagos por pedido con la semilla V10: filtro, verificador, aislamiento y permisos. */
class PaymentsIntegrationTest extends IntegrationTest {
  private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST = new ParameterizedTypeReference<>() {};

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
}
