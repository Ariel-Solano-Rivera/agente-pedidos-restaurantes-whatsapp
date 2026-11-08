package ec.edu.ups.restaurant.pagos;

import ec.edu.ups.restaurant.security.Tenant;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

/** Payment confirmation is intentionally absent until ADR-001 is approved. */
@RestController @RequestMapping("/api/v1/payments") @PreAuthorize("hasAnyRole('ADMIN','CAJA')")
public class PaymentController {
  private final DatabaseClient db; public PaymentController(DatabaseClient db){this.db=db;}
  public record Payment(UUID id,String orderCode,String method,BigDecimal amount,String status,String reference,OffsetDateTime verifiedAt){}
  @GetMapping public Flux<Payment> list(){return Tenant.restaurantId().flatMapMany(r->db.sql("SELECT p.id,p.order_id,p.method,p.amount,p.status,p.reference_text,p.verified_at FROM payment p WHERE p.restaurante_id=:r ORDER BY p.id").bind("r",r).map((x,m)->new Payment(x.get("id",UUID.class),"PED-"+x.get("order_id",UUID.class).toString().substring(0,8).toUpperCase(),x.get("method",String.class),x.get("amount",BigDecimal.class),x.get("status",String.class),x.get("reference_text",String.class),x.get("verified_at",OffsetDateTime.class))).all());}
}
