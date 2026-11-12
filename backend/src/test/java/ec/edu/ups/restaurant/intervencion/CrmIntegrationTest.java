package ec.edu.ups.restaurant.intervencion;

import static org.assertj.core.api.Assertions.assertThat;

import ec.edu.ups.restaurant.support.IntegrationTest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;

/** Pestañas, búsqueda, control humano, respuesta idempotente y aislamiento del CRM (semilla V12). */
class CrmIntegrationTest extends IntegrationTest {
  private static final ParameterizedTypeReference<Map<String, Object>> JSON = new ParameterizedTypeReference<>() {};
  private static final String ORIGINAL = "11111111-1111-1111-1111-111111112501";

  private static String conv(int n) { return seedId("t4-conv-" + n).toString(); }
  private static UUID handoff(int n) { return seedId("t4-handoff-" + n); }

  private Map<String, Object> get(String email, String uri) {
    return as(email).get().uri(uri).exchange().expectStatus().isOk().expectBody(JSON).returnResult().getResponseBody();
  }

  @SuppressWarnings("unchecked")
  private List<Object> ids(String email, String uri) {
    return ((List<Map<String, Object>>) get(email, uri).get("items")).stream().map(item -> item.get("id")).toList();
  }

  private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec reply(String email, String conversation, String key, String body) {
    return as(email).post().uri("/api/v1/crm/conversations/{id}/messages", conversation).header("Idempotency-Key", key).bodyValue(Map.of("body", body)).exchange();
  }

  @Test
  void tabsAndSearchAreComputedInTheBackend() {
    assertThat(ids(CAJA, "/api/v1/crm/conversations?tab=PENDING&size=100")).contains(conv(1), conv(3), conv(6), ORIGINAL).doesNotContain(conv(4), conv(5), conv(7));
    assertThat(ids(CAJA, "/api/v1/crm/conversations?tab=HUMAN&size=100")).contains(conv(3), ORIGINAL).doesNotContain(conv(1), conv(4));
    assertThat(ids(CAJA, "/api/v1/crm/conversations?q=000000006")).containsExactly(conv(6));
    as(COCINA).get().uri("/api/v1/crm/conversations").exchange().expectStatus().isForbidden();
    as(CAJA).get().uri("/api/v1/crm/conversations?tab=OTRA").exchange().expectStatus().isBadRequest();
  }

  @Test
  @SuppressWarnings("unchecked")
  void replyingRequiresHoldingControlAndIsIdempotent() {
    String conversation = conv(2);
    reply(ADMIN, conversation, key(), "Hola").expectStatus().isEqualTo(409).expectBody().jsonPath("$.code").isEqualTo("CONTROL_REQUIRED");
    as(ADMIN).post().uri("/api/v1/handoffs/{id}/claim", handoff(2)).exchange().expectStatus().isNoContent();
    as(ADMIN).post().uri("/api/v1/handoffs/{id}/claim", handoff(2)).exchange().expectStatus().isNoContent();
    as(CAJA).post().uri("/api/v1/handoffs/{id}/claim", handoff(2)).exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.code").isEqualTo("HANDOFF_TAKEN");
    reply(CAJA, conversation, key(), "Intento de caja").expectStatus().isEqualTo(409);

    String key = key();
    Map<String, Object> first = reply(ADMIN, conversation, key, "  Sí podemos agregar chifles por $0,50.  ").expectStatus().isCreated().expectBody(JSON).returnResult().getResponseBody();
    Map<String, Object> again = reply(ADMIN, conversation, key, "Sí podemos agregar chifles por $0,50.").expectStatus().isCreated().expectBody(JSON).returnResult().getResponseBody();
    assertThat(first).containsEntry("authorType", "STAFF").containsEntry("authorEmail", ADMIN).containsEntry("body", "Sí podemos agregar chifles por $0,50.");
    assertThat(again.get("id")).isEqualTo(first.get("id"));

    Map<String, Object> detail = get(ADMIN, "/api/v1/crm/conversations/" + conversation);
    assertThat(detail.get("canReply")).isEqualTo(true);
    assertThat(((Map<String, Object>) detail.get("conversation")).get("awaitingReply")).isEqualTo(false);
    assertThat((List<Map<String, Object>>) detail.get("messages")).filteredOn(item -> "STAFF".equals(item.get("authorType"))).hasSize(1);
    assertThat(ids(ADMIN, "/api/v1/crm/conversations?tab=PENDING&size=100")).doesNotContain(conversation);

    as(CAJA).post().uri("/api/v1/handoffs/{id}/release", handoff(2)).exchange().expectStatus().isEqualTo(409).expectBody().jsonPath("$.code").isEqualTo("HANDOFF_NOT_HELD");
    as(ADMIN).post().uri("/api/v1/handoffs/{id}/release", handoff(2)).exchange().expectStatus().isNoContent();
    assertThat(((Map<String, Object>) get(ADMIN, "/api/v1/crm/conversations/" + conversation).get("conversation")).get("controlMode")).isEqualTo("AGENT");
    Long audits = db.sql("SELECT count(*) c FROM audit_log WHERE entity_id=:h AND action IN ('HANDOFF_CLAIM','HANDOFF_RELEASE')").bind("h", handoff(2))
      .map((row, m) -> row.get("c", Long.class)).one().block();
    assertThat(audits).isEqualTo(3L);
  }

  @Test
  @SuppressWarnings("unchecked")
  void customerCardShowsOnlyOrdersOfTheSameRestaurant() {
    Map<String, Object> customer = (Map<String, Object>) get(CAJA, "/api/v1/crm/conversations/" + conv(1)).get("customer");
    assertThat(customer.get("phone")).isEqualTo("+593 000 000 001");
    Map<String, Object> history = (Map<String, Object>) customer.get("history");
    assertThat(((Number) history.get("orders")).intValue()).isEqualTo(3);
    assertThat((List<Map<String, Object>>) history.get("recent")).allSatisfy(order -> assertThat((String) order.get("publicCode")).startsWith("PED-"));
  }

  @Test
  void anotherRestaurantCannotReadOrActOnConversations() {
    as(OTHER_ADMIN).get().uri("/api/v1/crm/conversations/{id}", conv(1)).exchange().expectStatus().isNotFound();
    as(OTHER_ADMIN).post().uri("/api/v1/handoffs/{id}/claim", handoff(1)).exchange().expectStatus().isNotFound();
    reply(OTHER_ADMIN, conv(1), key(), "Hola").expectStatus().isNotFound();
    assertThat(ids(OTHER_ADMIN, "/api/v1/crm/conversations?size=100")).containsExactly(conv(7));
  }
}
