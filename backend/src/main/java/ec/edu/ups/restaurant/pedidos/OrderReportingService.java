package ec.edu.ups.restaurant.pedidos;
import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
/** Read-only reporting contract for consumers outside the pedidos module. */
@Service public class OrderReportingService { private final DatabaseClient db; public OrderReportingService(DatabaseClient db) { this.db = db; } public record MostSoldDish(String name, int unitsSold) {} public Mono<MostSoldDish> mostSoldDish(UUID restaurantId) { return db.sql("SELECT dish_name_snapshot, COUNT(*)::int units_sold FROM order_unit WHERE restaurante_id=:r GROUP BY dish_name_snapshot ORDER BY COUNT(*) DESC,dish_name_snapshot ASC LIMIT 1").bind("r", restaurantId).map((row, metadata) -> new MostSoldDish(row.get("dish_name_snapshot", String.class), row.get("units_sold", Integer.class))).one(); } }
