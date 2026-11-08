package ec.edu.ups.restaurant.administracion;
import ec.edu.ups.restaurant.pedidos.OrderReportingService;
import ec.edu.ups.restaurant.security.Tenant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
/** Shared, read-only business overview. It never accepts a restaurant id from the client. */
@RestController @RequestMapping("/api/v1/dashboard") public class DashboardController { private final DatabaseClient db; private final OrderReportingService orderReporting; public DashboardController(DatabaseClient db, OrderReportingService orderReporting) { this.db = db; this.orderReporting = orderReporting; } public record Task(UUID id, String title, OffsetDateTime scheduledFor) {} public record TopDish(String name, int unitsSold) {} public record Summary(String restaurantName, boolean receptionPaused, String pauseReason, OffsetDateTime generatedAt, TopDish topDish, List<Task> tasks) {} @GetMapping public Mono<Summary> summary() { return Tenant.restaurantId().flatMap(restaurantId -> Mono.zip(business(restaurantId), orderReporting.mostSoldDish(restaurantId).map(item -> new TopDish(item.name(), item.unitsSold())).defaultIfEmpty(new TopDish("Sin ventas registradas", 0)), tasks(restaurantId).collectList()).map(values -> new Summary(values.getT1().name(), values.getT1().paused(), values.getT1().reason(), OffsetDateTime.now(), values.getT2(), values.getT3()))); } private Mono<Business> business(UUID restaurantId) { return db.sql("SELECT r.name, s.reception_paused, COALESCE(s.pause_reason,'') pause_reason FROM restaurant r JOIN operation_settings s ON s.restaurante_id=r.id WHERE r.id=:r").bind("r", restaurantId).map((row, metadata) -> new Business(row.get("name", String.class), row.get("reception_paused", Boolean.class), row.get("pause_reason", String.class))).one(); } private Flux<Task> tasks(UUID restaurantId) { return db.sql("SELECT id,title,scheduled_for FROM dashboard_task WHERE restaurante_id=:r AND status='SCHEDULED' AND scheduled_for>=date_trunc('day',now()) ORDER BY scheduled_for ASC LIMIT 3").bind("r", restaurantId).map((row, metadata) -> new Task(row.get("id", UUID.class), row.get("title", String.class), row.get("scheduled_for", OffsetDateTime.class))).all(); } private record Business(String name, boolean paused, String reason) {} }
