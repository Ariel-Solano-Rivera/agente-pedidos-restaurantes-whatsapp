package ec.edu.ups.restaurant.menu;

import java.util.List;
import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/** Contrato interno de lectura del menú para otros módulos. */
@Service
public class MenuReportingService {
  private final DatabaseClient db;

  public MenuReportingService(DatabaseClient db) { this.db = db; }

  /** Platos activos sin ninguna variante vendible (misma regla que `available` en MenuController). */
  public Mono<List<String>> soldOutDishes(UUID restaurantId) {
    return db.sql("SELECT d.name FROM dish d WHERE d.restaurante_id=:r AND d.active AND NOT EXISTS (SELECT 1 FROM sellable_variant v "
        + "JOIN availability a ON a.restaurante_id=v.restaurante_id AND a.variant_id=v.id WHERE v.restaurante_id=d.restaurante_id AND v.dish_id=d.id "
        + "AND v.active AND NOT a.sold_out AND (NOT a.tracked OR a.on_hand - a.reserved > 0)) ORDER BY d.name")
      .bind("r", restaurantId).map((row, metadata) -> row.get("name", String.class)).all().collectList();
  }
}
