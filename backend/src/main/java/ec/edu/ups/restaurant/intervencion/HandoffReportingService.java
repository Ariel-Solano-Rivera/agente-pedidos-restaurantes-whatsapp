package ec.edu.ups.restaurant.intervencion;

import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/** Contrato interno de lectura de derivaciones para otros módulos. */
@Service
public class HandoffReportingService {
  private final DatabaseClient db;

  public HandoffReportingService(DatabaseClient db) { this.db = db; }

  /** Derivaciones sin contestar: estado OPEN (nadie tomó el control). Es una foto del momento, no del período. */
  public Mono<Long> openCount(UUID restaurantId) {
    return db.sql("SELECT count(*) total FROM human_handoff WHERE restaurante_id=:r AND status='OPEN'").bind("r", restaurantId)
      .map((row, metadata) -> row.get("total", Long.class)).one();
  }
}
