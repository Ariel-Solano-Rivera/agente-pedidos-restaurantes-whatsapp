package ec.edu.ups.restaurant.pedidos;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/** Contrato interno de solo lectura de pedidos para módulos externos (resumen, CRM). */
@Service
public class OrderReportingService {
  private final DatabaseClient db;

  public OrderReportingService(DatabaseClient db) { this.db = db; }

  public record MostSoldDish(String name, int unitsSold) {}
  public record CustomerOrder(UUID id, String publicCode, String status, BigDecimal total, OffsetDateTime createdAt) {}
  public record CustomerHistory(long orders, long completed, BigDecimal completedAmount, List<CustomerOrder> recent) {}

  public Mono<MostSoldDish> mostSoldDish(UUID restaurantId) {
    return db.sql("SELECT dish_name_snapshot, COUNT(*)::int units_sold FROM order_unit WHERE restaurante_id=:r GROUP BY dish_name_snapshot ORDER BY COUNT(*) DESC,dish_name_snapshot ASC LIMIT 1")
      .bind("r", restaurantId).map((row, metadata) -> new MostSoldDish(row.get("dish_name_snapshot", String.class), row.get("units_sold", Integer.class))).one();
  }

  /** Pedidos de un cliente del mismo restaurante: totales y los 10 más recientes. */
  public Mono<CustomerHistory> customerHistory(UUID restaurantId, UUID customerId) {
    Mono<List<CustomerOrder>> recent = db.sql("SELECT id,status,total,created_at FROM customer_order WHERE restaurante_id=:r AND customer_id=:c ORDER BY created_at DESC LIMIT 10")
      .bind("r", restaurantId).bind("c", customerId)
      .map((row, metadata) -> new CustomerOrder(row.get("id", UUID.class), OrderController.code(row.get("id", UUID.class)), row.get("status", String.class),
        row.get("total", BigDecimal.class), row.get("created_at", OffsetDateTime.class))).all().collectList();
    Mono<Counts> counts = db.sql("SELECT count(*) orders, count(*) FILTER (WHERE status='COMPLETED') completed, COALESCE(SUM(total) FILTER (WHERE status='COMPLETED'),0) amount "
        + "FROM customer_order WHERE restaurante_id=:r AND customer_id=:c").bind("r", restaurantId).bind("c", customerId)
      .map((row, metadata) -> new Counts(row.get("orders", Long.class), row.get("completed", Long.class), row.get("amount", BigDecimal.class))).one();
    return Mono.zip(counts, recent).map(values -> new CustomerHistory(values.getT1().orders(), values.getT1().completed(), values.getT1().amount(), values.getT2()));
  }

  private record Counts(long orders, long completed, BigDecimal amount) {}
}
