package ec.edu.ups.restaurant.operacion;

import static org.assertj.core.api.Assertions.assertThat;

import ec.edu.ups.restaurant.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;

/** Marcar y quitar «agotado» por plato: efecto en `available`, idempotencia, auditoría, permisos y aislamiento. */
class DishSoldOutIntegrationTest extends IntegrationTest {
  private static final ParameterizedTypeReference<Map<String, Object>> JSON = new ParameterizedTypeReference<>() {};

  private String createDish() {
    Map<String, Object> created = as(ADMIN).post().uri("/api/v1/admin/dishes").bodyValue(Map.of(
        "categoryId", "11111111-1111-1111-1111-111111111202", "name", "Plato agotable " + UUID.randomUUID().toString().substring(0, 6), "description", "Prueba", "active", true,
        "variants", List.of(Map.of("presentationId", "11111111-1111-1111-1111-111111113002", "price", 3.5, "active", true))))
      .exchange().expectStatus().isCreated().expectBody(JSON).returnResult().getResponseBody();
    return (String) created.get("id");
  }

  private boolean available(String id) {
    return as(CAJA).get().uri("/api/v1/menu/dishes").exchange().expectStatus().isOk()
      .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {}).returnResult().getResponseBody()
      .stream().filter(item -> id.equals(item.get("id"))).findFirst().map(item -> Boolean.TRUE.equals(item.get("available"))).orElseThrow();
  }

  private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec mark(String email, String id, String idempotencyKey, boolean soldOut) {
    return as(email).put().uri("/api/v1/availability/dishes/{id}/sold-out", id).header("Idempotency-Key", idempotencyKey).bodyValue(Map.of("soldOut", soldOut)).exchange();
  }

  private long audits(String correlation) {
    return db.sql("SELECT count(*) n FROM audit_log WHERE correlation_id = CAST(:c AS uuid)").bind("c", correlation).map((row, m) -> row.get("n", Long.class)).one().block();
  }

  @Test
  void cashierMarksAndClearsSoldOutOnceWithAudit() {
    String dish = createDish();
    assertThat(available(dish)).isTrue();

    String first = key();
    mark(CAJA, dish, first, true).expectStatus().isOk().expectBody().jsonPath("$.soldOut").isEqualTo(true);
    assertThat(available(dish)).isFalse();
    mark(CAJA, dish, first, true).expectStatus().isOk();
    assertThat(audits(first)).isEqualTo(1);

    mark(CAJA, dish, key(), false).expectStatus().isOk().expectBody().jsonPath("$.soldOut").isEqualTo(false);
    assertThat(available(dish)).isTrue();
  }

  @Test
  void kitchenCannotAndOtherRestaurantDoesNotSeeTheDish() {
    String dish = createDish();
    mark(COCINA, dish, key(), true).expectStatus().isForbidden();
    mark(OTHER_ADMIN, dish, key(), true).expectStatus().isNotFound();
    mark(CAJA, dish, "no-es-uuid", true).expectStatus().isBadRequest();
    assertThat(available(dish)).isTrue();
  }
}
