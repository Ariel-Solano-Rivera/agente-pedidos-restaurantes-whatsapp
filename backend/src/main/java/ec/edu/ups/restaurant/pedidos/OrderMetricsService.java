package ec.edu.ups.restaurant.pedidos;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/**
 * Contrato interno de lectura con los indicadores de pedidos de un período [from, to).
 * Las definiciones están en backend/sdd/resumen-negocio.md; todo filtra restaurante_id.
 */
@Service
public class OrderMetricsService {
  private final DatabaseClient db;

  public OrderMetricsService(DatabaseClient db) { this.db = db; }

  public record Lost(long count, BigDecimal amount) {}
  public record PeriodMetrics(BigDecimal receivable, BigDecimal completedAmount, long completedCount, Lost rejected, Lost cancelled, Lost expired,
                              long accepted, long decided, BigDecimal decisionMinutes, BigDecimal preparationMinutes, long newCustomers, long returningCustomers) {}
  public record HourCount(int hour, long orders) {}
  public record Ranked(String name, long units, BigDecimal amount) {}
  public record FulfillmentShare(String mode, long orders, BigDecimal amount) {}
  public record BackwardCount(String day, String role, String changeType, long count) {}

  private static final String CTES = "WITH created AS (SELECT * FROM customer_order WHERE restaurante_id=:r AND created_at>=:from AND created_at<:to), "
    + "completed AS (SELECT o.* FROM customer_order o WHERE o.restaurante_id=:r AND o.status='COMPLETED' AND EXISTS (SELECT 1 FROM order_status_history h "
    + "WHERE h.restaurante_id=o.restaurante_id AND h.order_id=o.id AND h.new_status='COMPLETED' AND h.created_at>=:from AND h.created_at<:to)) ";

  public Mono<PeriodMetrics> period(UUID restaurantId, OffsetDateTime from, OffsetDateTime to) {
    String sql = CTES + ", decisions AS (SELECT order_id, min(created_at) decided_at FROM order_status_history WHERE restaurante_id=:r AND previous_status='PENDING_DECISION' "
      + "AND new_status IN ('ACCEPTED','REJECTED') AND change_type='AVANCE' GROUP BY order_id), "
      + "prep AS (SELECT EXTRACT(EPOCH FROM (r.ready_at - a.accepted_at))/60 minutes FROM (SELECT order_id, min(created_at) accepted_at FROM order_status_history WHERE restaurante_id=:r "
      + "AND previous_status='PENDING_DECISION' AND new_status='ACCEPTED' AND change_type='AVANCE' GROUP BY order_id) a JOIN (SELECT order_id, max(created_at) ready_at FROM order_status_history "
      + "WHERE restaurante_id=:r AND new_status='READY' AND change_type='AVANCE' GROUP BY order_id) r ON r.order_id=a.order_id WHERE r.ready_at>=:from AND r.ready_at<:to), "
      + "first_seen AS (SELECT customer_phone, min(created_at) first_at FROM customer_order WHERE restaurante_id=:r AND customer_phone IN "
      + "(SELECT customer_phone FROM created WHERE COALESCE(customer_phone,'')<>'') GROUP BY customer_phone) "
      + "SELECT (SELECT COALESCE(SUM(c.total),0) FROM created c WHERE c.status IN ('ACCEPTED','PREPARING','READY','COMPLETED') AND NOT EXISTS (SELECT 1 FROM payment p "
      + "WHERE p.restaurante_id=c.restaurante_id AND p.order_id=c.id AND p.status='CONFIRMED')) receivable, "
      + "(SELECT COALESCE(SUM(total),0) FROM completed) completed_amount, (SELECT count(*) FROM completed) completed_count, "
      + "(SELECT count(*) FROM created WHERE status='REJECTED') rejected_count, (SELECT COALESCE(SUM(total),0) FROM created WHERE status='REJECTED') rejected_amount, "
      + "(SELECT count(*) FROM created WHERE status='CANCELLED') cancelled_count, (SELECT COALESCE(SUM(total),0) FROM created WHERE status='CANCELLED') cancelled_amount, "
      + "(SELECT count(*) FROM created WHERE status='EXPIRED') expired_count, (SELECT COALESCE(SUM(total),0) FROM created WHERE status='EXPIRED') expired_amount, "
      + "(SELECT count(*) FROM created WHERE status IN ('ACCEPTED','PREPARING','READY','COMPLETED','CANCELLED')) accepted_count, "
      + "(SELECT count(*) FROM created WHERE status IN ('ACCEPTED','PREPARING','READY','COMPLETED','CANCELLED','REJECTED')) decided_count, "
      + "(SELECT round(AVG(EXTRACT(EPOCH FROM (d.decided_at - o.confirmed_by_customer_at))/60)::numeric, 1) FROM decisions d JOIN customer_order o ON o.id=d.order_id "
      + "AND o.restaurante_id=:r WHERE o.confirmed_by_customer_at IS NOT NULL AND d.decided_at>=:from AND d.decided_at<:to) decision_minutes, "
      + "(SELECT round(AVG(minutes)::numeric, 1) FROM prep) prep_minutes, "
      + "(SELECT count(*) FROM first_seen WHERE first_at>=:from) new_customers, (SELECT count(*) FROM first_seen WHERE first_at<:from) returning_customers";
    return db.sql(sql).bind("r", restaurantId).bind("from", from).bind("to", to)
      .map((row, metadata) -> new PeriodMetrics(row.get("receivable", BigDecimal.class), row.get("completed_amount", BigDecimal.class), row.get("completed_count", Long.class),
        new Lost(row.get("rejected_count", Long.class), row.get("rejected_amount", BigDecimal.class)),
        new Lost(row.get("cancelled_count", Long.class), row.get("cancelled_amount", BigDecimal.class)),
        new Lost(row.get("expired_count", Long.class), row.get("expired_amount", BigDecimal.class)),
        row.get("accepted_count", Long.class), row.get("decided_count", Long.class), row.get("decision_minutes", BigDecimal.class), row.get("prep_minutes", BigDecimal.class),
        row.get("new_customers", Long.class), row.get("returning_customers", Long.class)))
      .one();
  }

  /** Por cobrar: total de pedidos creados en [from, to) que el restaurante aceptó y no tienen pago CONFIRMED. */
  public Mono<BigDecimal> receivable(UUID restaurantId, OffsetDateTime from, OffsetDateTime to) {
    return period(restaurantId, from, to).map(PeriodMetrics::receivable);
  }

  /** Pedidos creados por hora local (0–23); siempre devuelve 24 filas. */
  public Mono<List<HourCount>> ordersByHour(UUID restaurantId, String timezone, OffsetDateTime from, OffsetDateTime to) {
    return db.sql("SELECT h.hour, count(o.id) orders FROM generate_series(0,23) h(hour) LEFT JOIN customer_order o ON o.restaurante_id=:r AND o.created_at>=:from AND o.created_at<:to "
        + "AND EXTRACT(HOUR FROM o.created_at AT TIME ZONE :tz)=h.hour GROUP BY h.hour ORDER BY h.hour")
      .bind("r", restaurantId).bind("from", from).bind("to", to).bind("tz", timezone)
      .map((row, metadata) -> new HourCount(row.get("hour", Integer.class), row.get("orders", Long.class))).all().collectList();
  }

  /** Platos con más unidades en pedidos completados en el período (importe = suma de subtotales de unidad copiados). */
  public Mono<List<Ranked>> topDishes(UUID restaurantId, OffsetDateTime from, OffsetDateTime to) {
    return db.sql(CTES + "SELECT u.dish_name_snapshot name, count(*) units, SUM(u.subtotal) amount FROM completed c JOIN order_unit u ON u.order_id=c.id AND u.restaurante_id=c.restaurante_id "
        + "GROUP BY u.dish_name_snapshot ORDER BY units DESC, amount DESC, name LIMIT 5")
      .bind("r", restaurantId).bind("from", from).bind("to", to)
      .map((row, metadata) -> new Ranked(row.get("name", String.class), row.get("units", Long.class), row.get("amount", BigDecimal.class))).all().collectList();
  }

  /** Extras más pedidos en pedidos completados en el período (importe = suma de recargos copiados). */
  public Mono<List<Ranked>> topExtras(UUID restaurantId, OffsetDateTime from, OffsetDateTime to) {
    return db.sql(CTES + "SELECT x.name_snapshot name, count(*) units, SUM(x.surcharge_snapshot) amount FROM completed c JOIN order_unit u ON u.order_id=c.id AND u.restaurante_id=c.restaurante_id "
        + "JOIN order_unit_option x ON x.order_unit_id=u.id AND x.restaurante_id=u.restaurante_id AND x.option_type='EXTRA' GROUP BY x.name_snapshot ORDER BY units DESC, amount DESC, name LIMIT 5")
      .bind("r", restaurantId).bind("from", from).bind("to", to)
      .map((row, metadata) -> new Ranked(row.get("name", String.class), row.get("units", Long.class), row.get("amount", BigDecimal.class))).all().collectList();
  }

  /** Retiro frente a entrega entre los pedidos completados en el período. */
  public Mono<List<FulfillmentShare>> fulfillment(UUID restaurantId, OffsetDateTime from, OffsetDateTime to) {
    return db.sql(CTES + "SELECT m.mode, count(c.id) orders, COALESCE(SUM(c.total),0) amount FROM (VALUES ('PICKUP'),('DELIVERY')) m(mode) "
        + "LEFT JOIN completed c ON c.fulfillment_mode=m.mode GROUP BY m.mode ORDER BY m.mode DESC")
      .bind("r", restaurantId).bind("from", from).bind("to", to)
      .map((row, metadata) -> new FulfillmentShare(row.get("mode", String.class), row.get("orders", Long.class), row.get("amount", BigDecimal.class))).all().collectList();
  }

  /** Retrocesos y deshacer por día local, rol y tipo. */
  public Mono<List<BackwardCount>> backwards(UUID restaurantId, String timezone, OffsetDateTime from, OffsetDateTime to) {
    return db.sql("SELECT to_char(created_at AT TIME ZONE :tz, 'YYYY-MM-DD') local_day, actor_role, change_type, count(*) total FROM order_status_history "
        + "WHERE restaurante_id=:r AND change_type IN ('RETROCESO','DESHACER') AND created_at>=:from AND created_at<:to GROUP BY 1,2,3 ORDER BY 1,2,3")
      .bind("r", restaurantId).bind("from", from).bind("to", to).bind("tz", timezone)
      .map((row, metadata) -> new BackwardCount(row.get("local_day", String.class), row.get("actor_role", String.class), row.get("change_type", String.class), row.get("total", Long.class)))
      .all().collectList();
  }
}
