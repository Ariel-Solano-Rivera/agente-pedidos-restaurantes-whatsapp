package ec.edu.ups.restaurant.pedidos;

import static org.assertj.core.api.Assertions.assertThat;

import ec.edu.ups.restaurant.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;

/** Transiciones por rol, deshacer, idempotencia, filtros y aislamiento con la semilla V10. */
class OrdersIntegrationTest extends IntegrationTest {
  private static final ParameterizedTypeReference<Map<String, Object>> JSON = new ParameterizedTypeReference<>() {};

  private static UUID order(int n) { return seedId("t1-order-" + n); }

  private Map<String, Object> get(String email, String uri) {
    return as(email).get().uri(uri).exchange().expectStatus().isOk().expectBody(JSON).returnResult().getResponseBody();
  }

  private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec transition(String email, UUID id, String key, Map<String, Object> body) {
    return as(email).post().uri("/api/v1/orders/{id}/transitions", id).header("Idempotency-Key", key).bodyValue(body).exchange();
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> list(Map<String, Object> body, String field) { return (List<Map<String, Object>>) body.get(field); }

  @Test
  void kitchenSeesOnlyOperationalOrdersWithoutAmounts() {
    Map<String, Object> page = get(COCINA, "/api/v1/orders?size=100");
    assertThat(list(page, "items")).isNotEmpty().allSatisfy(item -> {
      assertThat(OrderTransitionPolicy.KITCHEN_VISIBLE).contains((String) item.get("status"));
      assertThat(item.get("total")).isNull();
      assertThat(item.get("paymentStatus")).isNull();
    });
    Map<String, Object> detail = get(COCINA, "/api/v1/orders/" + order(5));
    assertThat(detail.get("total")).isNull();
    assertThat(list(detail, "units")).allSatisfy(unit -> assertThat(unit.get("lineTotal")).isNull());
    as(COCINA).get().uri("/api/v1/orders/{id}", order(1)).exchange().expectStatus().isNotFound();
  }

  @Test
  void kitchenAdvancesAndUndoesItsOwnChangeOnce() {
    UUID id = order(2);
    assertThat(list(get(COCINA, "/api/v1/orders/" + id), "allowedTransitions"))
      .containsExactly(Map.of("targetStatus", "PREPARING", "direction", "FORWARD", "requiresReason", false, "destructive", false));
    transition(COCINA, id, key(), Map.of("targetStatus", "CANCELLED")).expectStatus().isEqualTo(409).expectBody().jsonPath("$.code").isEqualTo("TRANSITION_NOT_ALLOWED");
    transition(COCINA, id, key(), Map.of("targetStatus", "PREPARING")).expectStatus().isOk().expectBody().jsonPath("$.changeType").isEqualTo("AVANCE");
    assertThat(get(COCINA, "/api/v1/orders/" + id).get("undo")).isNotNull();

    as(COCINA).post().uri("/api/v1/orders/{id}/undo", id).header("Idempotency-Key", key()).exchange()
      .expectStatus().isOk().expectBody().jsonPath("$.status").isEqualTo("ACCEPTED").jsonPath("$.changeType").isEqualTo("DESHACER");
    as(COCINA).post().uri("/api/v1/orders/{id}/undo", id).header("Idempotency-Key", key()).exchange()
      .expectStatus().isEqualTo(409).expectBody().jsonPath("$.code").isEqualTo("UNDO_NOT_AVAILABLE");
    as(CAJA).post().uri("/api/v1/orders/{id}/undo", id).header("Idempotency-Key", key()).exchange().expectStatus().isForbidden()
      .expectBody().jsonPath("$.code").isEqualTo("FORBIDDEN");
  }

  @Test
  void kitchenUndoFailsAfterTheWindow() {
    UUID id = order(14);
    transition(COCINA, id, key(), Map.of("targetStatus", "PREPARING")).expectStatus().isOk();
    db.sql("UPDATE order_status_history SET created_at = now() - interval '3 minutes' WHERE order_id = :o AND change_type = 'AVANCE' AND actor_role = 'COCINA'")
      .bind("o", id).fetch().rowsUpdated().block();
    as(COCINA).post().uri("/api/v1/orders/{id}/undo", id).header("Idempotency-Key", key()).exchange()
      .expectStatus().isEqualTo(409).expectBody().jsonPath("$.code").isEqualTo("UNDO_WINDOW_EXPIRED");
  }

  @Test
  void cashierGoesBackOnlyWithAReason() {
    UUID id = order(4);
    transition(CAJA, id, key(), Map.of("targetStatus", "PREPARING")).expectStatus().isBadRequest().expectBody().jsonPath("$.code").isEqualTo("REASON_REQUIRED");
    transition(CAJA, id, key(), Map.of("targetStatus", "PREPARING", "reasonCode", "OTRO")).expectStatus().isBadRequest().expectBody().jsonPath("$.code").isEqualTo("REASON_TEXT_REQUIRED");
    transition(COCINA, id, key(), Map.of("targetStatus", "PREPARING", "reasonCode", "ERROR_AL_AVANZAR")).expectStatus().isEqualTo(409);
    transition(CAJA, id, key(), Map.of("targetStatus", "PREPARING", "reasonCode", "CLIENTE_CAMBIO_PEDIDO")).expectStatus().isOk()
      .expectBody().jsonPath("$.changeType").isEqualTo("RETROCESO");
    Map<String, Object> last = list(get(ADMIN, "/api/v1/orders/" + id), "history").get(0);
    assertThat(last).containsEntry("changeType", "RETROCESO").containsEntry("reasonCode", "CLIENTE_CAMBIO_PEDIDO")
      .containsEntry("actorRole", "CAJA").containsEntry("actorEmail", CAJA).containsEntry("previousStatus", "READY");
  }

  @Test
  void repeatedKeyDoesNotRepeatTheEffect() {
    UUID id = order(13);
    String key = key();
    transition(CAJA, id, key, Map.of("targetStatus", "ACCEPTED")).expectStatus().isOk().expectBody().jsonPath("$.changeType").isEqualTo("AVANCE");
    transition(CAJA, id, key, Map.of("targetStatus", "ACCEPTED")).expectStatus().isOk().expectBody().jsonPath("$.changeType").isEqualTo("REPETIDO");
    Long accepted = db.sql("SELECT count(*) c FROM order_status_history WHERE order_id=:o AND new_status='ACCEPTED'").bind("o", id)
      .map((row, metadata) -> row.get("c", Long.class)).one().block();
    assertThat(accepted).isEqualTo(1L);
    assertThat(get(ADMIN, "/api/v1/orders/" + id).get("restaurantDecisionBy")).isEqualTo(CAJA);
  }

  @Test
  void anotherRestaurantCannotReadOrChangeOrders() {
    UUID id = order(15);
    as(OTHER_ADMIN).get().uri("/api/v1/orders/{id}", id).exchange().expectStatus().isNotFound();
    transition(OTHER_ADMIN, id, key(), Map.of("targetStatus", "READY")).expectStatus().isNotFound();
    Map<String, Object> page = get(OTHER_ADMIN, "/api/v1/orders?size=100");
    assertThat(((Number) page.get("total")).intValue()).isEqualTo(4);
    assertThat(list(page, "items")).noneMatch(item -> item.get("id").equals(id.toString()));
    assertThat(get(ADMIN, "/api/v1/orders/" + id).get("status")).isEqualTo("PREPARING");
  }

  @Test
  void filtersSearchAndPaginateInTheBackend() {
    UUID id = order(7);
    String code = "PED-" + id.toString().substring(0, 8).toUpperCase();
    assertThat(list(get(ADMIN, "/api/v1/orders?q=" + code.toLowerCase()), "items")).extracting(item -> item.get("publicCode")).containsExactly(code);
    assertThat(list(get(ADMIN, "/api/v1/orders?size=100&fulfillment=DELIVERY"), "items")).isNotEmpty().allSatisfy(item -> assertThat(item.get("fulfillmentType")).isEqualTo("DELIVERY"));
    assertThat(list(get(ADMIN, "/api/v1/orders?size=100&status=COMPLETED&paymentStatus=CONFIRMED"), "items")).isNotEmpty();
    assertThat(list(get(ADMIN, "/api/v1/orders?q=000 000 001&size=100"), "items")).isNotEmpty().allSatisfy(item -> assertThat((String) item.get("phone")).endsWith("001"));
    Map<String, Object> firstPage = get(ADMIN, "/api/v1/orders?size=5");
    assertThat(list(firstPage, "items")).hasSize(5);
    assertThat(((Number) firstPage.get("total")).intValue()).isEqualTo(25);
    assertThat(((Number) get(ADMIN, "/api/v1/orders?range=LAST_7_DAYS&size=100").get("total")).intValue()).isLessThan(25).isGreaterThan(0);
    as(ADMIN).get().uri("/api/v1/orders?range=CUSTOM").exchange().expectStatus().isBadRequest().expectBody().jsonPath("$.code").isEqualTo("FILTER_INVALID");
    as(ADMIN).get().uri("/api/v1/orders?status=VOLANDO").exchange().expectStatus().isBadRequest();
    as(COCINA).get().uri("/api/v1/orders?paymentStatus=CONFIRMED").exchange().expectStatus().isForbidden();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Number> facet(Map<String, Object> body, String group) { return (Map<String, Number>) body.get(group); }
  private static long sum(Map<String, Number> counts) { return counts.values().stream().mapToLong(Number::longValue).sum(); }
  private long total(String email, String query) { return ((Number) get(email, "/api/v1/orders?size=1" + query).get("total")).longValue(); }

  @Test
  void facetsCountEachGroupWithTheOtherFiltersAndStayIsolated() {
    Map<String, Object> facets = get(ADMIN, "/api/v1/orders/facets");
    long all = total(ADMIN, "");
    assertThat(sum(facet(facets, "status"))).isEqualTo(all);
    assertThat(sum(facet(facets, "fulfillment"))).isEqualTo(all);
    assertThat(facet(facets, "range").get("ALL").longValue()).isEqualTo(all);
    assertThat(facet(facets, "range").get("TODAY").longValue()).isEqualTo(total(ADMIN, "&range=TODAY"));
    assertThat(facet(facets, "status").get("PENDING_DECISION").longValue()).isEqualTo(total(ADMIN, "&status=PENDING_DECISION"));

    // Con un estado elegido, su propio grupo no cambia y los demás cuentan solo ese estado.
    Map<String, Object> filtered = get(ADMIN, "/api/v1/orders/facets?status=COMPLETED");
    assertThat(filtered.get("status")).isEqualTo(facets.get("status"));
    assertThat(sum(facet(filtered, "fulfillment"))).isEqualTo(total(ADMIN, "&status=COMPLETED"));
    assertThat(facet(filtered, "paymentStatus").get("CONFIRMED").longValue()).isEqualTo(total(ADMIN, "&status=COMPLETED&paymentStatus=CONFIRMED"));

    Map<String, Object> kitchen = get(COCINA, "/api/v1/orders/facets");
    assertThat(facet(kitchen, "paymentStatus")).isEmpty();
    assertThat(facet(kitchen, "status").keySet()).isSubsetOf("ACCEPTED", "PREPARING", "READY", "COMPLETED");
    as(COCINA).get().uri("/api/v1/orders/facets?paymentStatus=CONFIRMED").exchange().expectStatus().isForbidden();

    assertThat(sum(facet(get(OTHER_ADMIN, "/api/v1/orders/facets"), "status"))).isEqualTo(total(OTHER_ADMIN, ""));
    as(ADMIN).get().uri("/api/v1/orders/facets?status=NOPE").exchange().expectStatus().isBadRequest();
  }

  @Test
  void boardListsActiveOrdersWithUnitsWithoutAmountsAndOwnUndo() {
    Map<String, Object> board = get(COCINA, "/api/v1/orders/board");
    List<Map<String, Object>> cards = list(board, "cards");
    assertThat(cards).isNotEmpty().allSatisfy(card -> {
      assertThat(card.get("status")).isIn("ACCEPTED", "PREPARING", "READY");
      assertThat(list(card, "units")).isNotEmpty().allSatisfy(unit -> assertThat(unit.get("lineTotal")).isNull());
      assertThat(card.get("statusSince")).isNotNull();
    });
    assertThat(cards.stream().filter(card -> "READY".equals(card.get("status")))).allSatisfy(card -> assertThat(list(card, "allowedTransitions")).isEmpty());

    Map<String, Object> accepted = cards.stream().filter(card -> "ACCEPTED".equals(card.get("status"))).findFirst().orElseThrow();
    String id = (String) accepted.get("id");
    transition(COCINA, UUID.fromString(id), key(), Map.of("targetStatus", "PREPARING")).expectStatus().isOk();
    Map<String, Object> moved = list(get(COCINA, "/api/v1/orders/board"), "cards").stream().filter(card -> id.equals(card.get("id"))).findFirst().orElseThrow();
    assertThat(moved.get("status")).isEqualTo("PREPARING");
    assertThat(moved.get("undo")).isNotNull();
    assertThat(list(get(CAJA, "/api/v1/orders/board"), "cards").stream().filter(card -> id.equals(card.get("id"))).findFirst().orElseThrow().get("undo")).isNull();

    assertThat(list(get(OTHER_ADMIN, "/api/v1/orders/board"), "cards")).noneSatisfy(card -> assertThat(card.get("id")).isEqualTo(id));
  }
}
