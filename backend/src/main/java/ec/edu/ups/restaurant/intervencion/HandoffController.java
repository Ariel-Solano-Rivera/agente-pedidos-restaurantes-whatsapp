package ec.edu.ups.restaurant.intervencion;

import ec.edu.ups.restaurant.security.AppPrincipal;
import ec.edu.ups.restaurant.security.Tenant;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController @RequestMapping("/api/v1/handoffs") @PreAuthorize("hasAnyRole('ADMIN','CAJA')")
public class HandoffController {
  private final DatabaseClient db; public HandoffController(DatabaseClient db){this.db=db;}
  public record Handoff(UUID id,UUID conversationId,String customerName,String reason,String status,String assignee,OffsetDateTime createdAt){}
  @GetMapping public Flux<Handoff> list(){return Tenant.restaurantId().flatMapMany(r->db.sql("SELECT h.id,h.conversation_id,c.customer_name,h.reason,h.status,u.email assignee,h.created_at FROM human_handoff h JOIN conversation c ON c.id=h.conversation_id AND c.restaurante_id=h.restaurante_id LEFT JOIN app_user u ON u.id=h.assigned_user_id AND u.restaurante_id=h.restaurante_id WHERE h.restaurante_id=:r ORDER BY h.created_at DESC").bind("r",r).map((x,m)->new Handoff(x.get("id",UUID.class),x.get("conversation_id",UUID.class),x.get("customer_name",String.class),x.get("reason",String.class),x.get("status",String.class),x.get("assignee",String.class),x.get("created_at",OffsetDateTime.class))).all());}
  @PostMapping("/{id}/claim") public Mono<Void> claim(@PathVariable UUID id,@AuthenticationPrincipal AppPrincipal u){return update(id,u,"IN_PROGRESS","HUMAN",false);}
  @PostMapping("/{id}/release") public Mono<Void> release(@PathVariable UUID id,@AuthenticationPrincipal AppPrincipal u){return update(id,u,"RESOLVED","AGENT",true);}
  private Mono<Void> update(UUID id,AppPrincipal u,String status,String control,boolean mine){return Tenant.restaurantId().flatMap(r->{String sql="UPDATE human_handoff SET status=:s,assigned_user_id=:u WHERE id=:id AND restaurante_id=:r"+(mine?" AND assigned_user_id=:u":" AND status IN ('OPEN','IN_PROGRESS')");return db.sql(sql).bind("s",status).bind("u",u.id()).bind("id",id).bind("r",r).fetch().rowsUpdated().flatMap(rows->{if(rows==0)return Mono.error(new ResponseStatusException(mine?HttpStatus.FORBIDDEN:HttpStatus.NOT_FOUND,"Derivación no disponible"));return db.sql("UPDATE conversation SET control_mode=:c WHERE id=(SELECT conversation_id FROM human_handoff WHERE id=:id AND restaurante_id=:r) AND restaurante_id=:r").bind("c",control).bind("id",id).bind("r",r).fetch().rowsUpdated().then();});});}
}
