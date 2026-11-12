package ec.edu.ups.restaurant.pagos;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

/** Contrato interno de lectura de pagos para otros módulos. */
@Service
public class PaymentReportingService {
  private final DatabaseClient db;

  public PaymentReportingService(DatabaseClient db) { this.db = db; }

  /** Cobrado: suma de pagos CONFIRMED cuya verificación (verified_at) cae en [from, to). */
  public Mono<BigDecimal> collected(UUID restaurantId, OffsetDateTime from, OffsetDateTime to) {
    return db.sql("SELECT COALESCE(SUM(amount),0) total FROM payment WHERE restaurante_id=:r AND status='CONFIRMED' AND verified_at>=:from AND verified_at<:to")
      .bind("r", restaurantId).bind("from", from).bind("to", to)
      .map((row, metadata) -> row.get("total", BigDecimal.class)).one();
  }
}
