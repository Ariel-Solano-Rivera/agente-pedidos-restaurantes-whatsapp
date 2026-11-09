package ec.edu.ups.restaurant.menu;

import static org.assertj.core.api.Assertions.assertThat;

import ec.edu.ups.restaurant.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;

/** Indicador `available` de cada plato y aislamiento del menú. */
class MenuAvailabilityIntegrationTest extends IntegrationTest {
  private static final String ENCEBOLLADO = "11111111-1111-1111-1111-111111111301";
  private static final String LIMONADA = "11111111-1111-1111-1111-111111111302";
  private static final String LIMONADA_VASO = "11111111-1111-1111-1111-111111111402";

  private List<Map<String, Object>> dishes(String email) {
    return as(email).get().uri("/api/v1/menu/dishes").exchange().expectStatus().isOk()
      .expectBody(new ParameterizedTypeReference<List<Map<String, Object>>>() {}).returnResult().getResponseBody();
  }

  private Map<String, Object> dish(String email, String id) {
    return dishes(email).stream().filter(item -> item.get("id").equals(id)).findFirst().orElseThrow();
  }

  @Test
  void trackedDishWithStockIsAvailableAndBecomesSoldOutAtZero() {
    assertThat(dish(CAJA, ENCEBOLLADO).get("available")).isEqualTo(true);
    as(CAJA).post().uri("/api/v1/availability/adjustments").header("Idempotency-Key", key())
      .bodyValue(Map.of("variantId", LIMONADA_VASO, "delta", -30, "reason", "Venta presencial ficticia")).exchange().expectStatus().isOk();
    assertThat(dish(CAJA, LIMONADA).get("available")).isEqualTo(false);
  }

  @Test
  void newDishWithoutControlledQuantityIsAvailableUnlessDeactivatedOrSoldOut() {
    Map<String, Object> created = as(ADMIN).post().uri("/api/v1/admin/dishes").bodyValue(Map.of(
        "categoryId", "11111111-1111-1111-1111-111111111202", "name", "Jugo ficticio", "description", "Prueba", "active", true,
        "variants", List.of(Map.of("presentationId", "11111111-1111-1111-1111-111111113002", "price", 2.25, "active", true))))
      .exchange().expectStatus().isCreated().expectBody(new ParameterizedTypeReference<Map<String, Object>>() {}).returnResult().getResponseBody();
    assertThat(created.get("available")).isEqualTo(true);
    db.sql("UPDATE availability SET sold_out=true WHERE variant_id IN (SELECT id FROM sellable_variant WHERE dish_id=:d)")
      .bind("d", java.util.UUID.fromString((String) created.get("id"))).fetch().rowsUpdated().block();
    assertThat(dish(ADMIN, (String) created.get("id")).get("available")).isEqualTo(false);
  }

  @Test
  void anotherRestaurantDoesNotSeeTheMenu() {
    assertThat(dishes(OTHER_ADMIN)).extracting(item -> item.get("id")).doesNotContain(ENCEBOLLADO, LIMONADA);
  }
}
