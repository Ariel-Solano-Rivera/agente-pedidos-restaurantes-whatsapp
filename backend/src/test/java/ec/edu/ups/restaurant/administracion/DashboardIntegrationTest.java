package ec.edu.ups.restaurant.administracion;

import static org.assertj.core.api.Assertions.assertThat;

import ec.edu.ups.restaurant.support.IntegrationTest;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;

/** Permisos por rol, coherencia de indicadores y aislamiento del dashboard. */
class DashboardIntegrationTest extends IntegrationTest {
  private static final ParameterizedTypeReference<Map<String, Object>> JSON = new ParameterizedTypeReference<>() {};

  private Map<String, Object> get(String email, String uri) {
    return as(email).get().uri(uri).exchange().expectStatus().isOk().expectBody(JSON).returnResult().getResponseBody();
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> map(Map<String, Object> body, String field) { return (Map<String, Object>) body.get(field); }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> list(Map<String, Object> body, String field) { return (List<Map<String, Object>>) body.get(field); }

  private static BigDecimal number(Object value) { return value == null ? null : new BigDecimal(value.toString()); }

  @Test
  void onlyAdminSeesTheFullDashboardAndKitchenSeesNoAmounts() {
    as(CAJA).get().uri("/api/v1/dashboard/admin").exchange().expectStatus().isForbidden();
    as(COCINA).get().uri("/api/v1/dashboard/admin").exchange().expectStatus().isForbidden();
    assertThat(get(COCINA, "/api/v1/dashboard").get("cash")).isNull();
    Map<String, Object> cash = map(get(CAJA, "/api/v1/dashboard"), "cash");
    assertThat(cash).containsKeys("collected", "receivable").hasSize(2);
    as(ADMIN).get().uri("/api/v1/dashboard/admin?range=AYER").exchange().expectStatus().isBadRequest().expectBody().jsonPath("$.code").isEqualTo("RANGE_INVALID");
  }

  @Test
  void indicatorsAreConsistentWithEachOtherAndWithTheOrderList() {
    for (String range : List.of("TODAY", "LAST_7_DAYS", "LAST_30_DAYS")) {
      Map<String, Object> body = get(ADMIN, "/api/v1/dashboard/admin?range=" + range);
      long orders = list(body, "ordersByHour").stream().mapToLong(item -> ((Number) item.get("orders")).longValue()).sum();
      assertThat(list(body, "ordersByHour")).hasSize(24);
      if (!"LAST_30_DAYS".equals(range)) {
        long listed = ((Number) get(ADMIN, "/api/v1/orders?size=1&range=" + range).get("total")).longValue();
        assertThat(orders).as("pedidos por hora = pedidos creados en %s", range).isEqualTo(listed);
      }
      BigDecimal sales = number(map(body, "completedSales").get("current"));
      long completed = ((Number) map(body, "completedOrders").get("current")).longValue();
      BigDecimal fulfillment = list(body, "fulfillment").stream().map(item -> number(item.get("amount"))).reduce(BigDecimal.ZERO, BigDecimal::add);
      assertThat(fulfillment).isEqualByComparingTo(sales);
      if (completed > 0) assertThat(number(map(body, "averageTicket").get("current"))).isEqualByComparingTo(DashboardController.ratio(sales, completed, 2));
      assertThat(list(body, "lostSales")).extracting(item -> item.get("cause")).containsExactly("REJECTED", "CANCELLED", "EXPIRED");
    }
    Map<String, Object> month = get(ADMIN, "/api/v1/dashboard/admin?range=LAST_30_DAYS");
    assertThat(number(map(month, "completedSales").get("current"))).isPositive();
    assertThat(number(map(month, "collected").get("current"))).isPositive();
    assertThat(list(month, "topDishes")).isNotEmpty();
    assertThat(((Number) month.get("openHandoffs")).longValue()).isGreaterThanOrEqualTo(0);
  }

  @Test
  void anotherRestaurantSeesOnlyItsOwnFigures() {
    Map<String, Object> other = get(OTHER_ADMIN, "/api/v1/dashboard/admin?range=LAST_30_DAYS");
    assertThat(((Number) map(other, "completedOrders").get("current")).longValue()).isZero();
    assertThat(list(other, "topDishes")).noneMatch(item -> item.get("name").equals("Encebollado clásico"));
    assertThat(((Number) other.get("openHandoffs")).longValue()).as("solo su derivación sembrada en V12").isEqualTo(1L);
  }
}
