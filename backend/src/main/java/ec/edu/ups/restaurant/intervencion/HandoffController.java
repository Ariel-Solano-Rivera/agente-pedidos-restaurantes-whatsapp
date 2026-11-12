package ec.edu.ups.restaurant.intervencion;

import ec.edu.ups.restaurant.common.ApiException;
import ec.edu.ups.restaurant.security.AppPrincipal;
import ec.edu.ups.restaurant.security.Tenant;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.reactive.TransactionalOperator;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Derivaciones humanas. Tomar el control solo procede si la derivación está abierta o ya es de quien la toma;
 * tomar y liberar se ejecutan en una transacción, sincronizan conversation.control_mode y quedan en audit_log.
 */
@RestController
@RequestMapping("/api/v1/handoffs")
@PreAuthorize("hasAnyRole('ADMIN','CAJA')")
public class HandoffController {
  private final DatabaseClient db;
  private final TransactionalOperator tx;

  public HandoffController(DatabaseClient db, TransactionalOperator tx) {
    this.db = db;
    this.tx = tx;
  }

  public record Handoff(UUID id, UUID conversationId, String customerName, String reason, String status, String assignee, OffsetDateTime createdAt) {}

  @GetMapping
  public Flux<Handoff> list() {
    return Tenant.restaurantId().flatMapMany(r -> db.sql("SELECT h.id,h.conversation_id,c.customer_name,h.reason,h.status,u.email assignee,h.created_at FROM human_handoff h "
        + "JOIN conversation c ON c.id=h.conversation_id AND c.restaurante_id=h.restaurante_id LEFT JOIN app_user u ON u.id=h.assigned_user_id AND u.restaurante_id=h.restaurante_id "
        + "WHERE h.restaurante_id=:r ORDER BY h.created_at DESC").bind("r", r)
      .map((x, m) -> new Handoff(x.get("id", UUID.class), x.get("conversation_id", UUID.class), x.get("customer_name", String.class), x.get("reason", String.class),
        x.get("status", String.class), x.get("assignee", String.class), x.get("created_at", OffsetDateTime.class))).all());
  }

  /** Toma el control: OPEN → IN_PROGRESS asignada al usuario (repetirlo siendo el dueño no cambia nada). */
  @PostMapping("/{id}/claim")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public Mono<Void> claim(@PathVariable UUID id, @AuthenticationPrincipal AppPrincipal user) {
    return Tenant.restaurantId().flatMap(r -> tx.transactional(
      db.sql("UPDATE human_handoff SET status='IN_PROGRESS', assigned_user_id=:u WHERE id=:id AND restaurante_id=:r "
          + "AND (status='OPEN' OR (status='IN_PROGRESS' AND assigned_user_id=:u)) RETURNING conversation_id")
        .bind("u", user.id()).bind("id", id).bind("r", r).map((row, m) -> row.get("conversation_id", UUID.class)).one()
        .switchIfEmpty(Mono.defer(() -> unavailable(r, id, "HANDOFF_TAKEN", "Otra persona ya tiene el control o la derivación está resuelta")))
        .flatMap(conversation -> control(r, conversation, "HUMAN").then(audit(r, user, "HANDOFF_CLAIM", id)))));
  }

  /** Libera el control: solo quien lo tiene; IN_PROGRESS → RESOLVED y la conversación vuelve al agente. */
  @PostMapping("/{id}/release")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public Mono<Void> release(@PathVariable UUID id, @AuthenticationPrincipal AppPrincipal user) {
    return Tenant.restaurantId().flatMap(r -> tx.transactional(
      db.sql("UPDATE human_handoff SET status='RESOLVED' WHERE id=:id AND restaurante_id=:r AND status='IN_PROGRESS' AND assigned_user_id=:u RETURNING conversation_id")
        .bind("u", user.id()).bind("id", id).bind("r", r).map((row, m) -> row.get("conversation_id", UUID.class)).one()
        .switchIfEmpty(Mono.defer(() -> unavailable(r, id, "HANDOFF_NOT_HELD", "No tienes el control de esta derivación")))
        .flatMap(conversation -> control(r, conversation, "AGENT").then(audit(r, user, "HANDOFF_RELEASE", id)))));
  }

  private Mono<UUID> unavailable(UUID restaurantId, UUID id, String code, String message) {
    return db.sql("SELECT EXISTS(SELECT 1 FROM human_handoff WHERE id=:id AND restaurante_id=:r) present").bind("id", id).bind("r", restaurantId)
      .map((row, m) -> row.get("present", Boolean.class)).one()
      .flatMap(present -> Mono.error(Boolean.TRUE.equals(present) ? new ApiException(HttpStatus.CONFLICT, code, message)
        : new ApiException(HttpStatus.NOT_FOUND, "HANDOFF_NOT_FOUND", "Derivación no encontrada")));
  }

  private Mono<Long> control(UUID restaurantId, UUID conversationId, String mode) {
    return db.sql("UPDATE conversation SET control_mode=:c WHERE id=:id AND restaurante_id=:r").bind("c", mode).bind("id", conversationId).bind("r", restaurantId)
      .fetch().rowsUpdated();
  }

  private Mono<Void> audit(UUID restaurantId, AppPrincipal user, String action, UUID handoffId) {
    return db.sql("INSERT INTO audit_log(id,restaurante_id,actor_user_id,action,entity_type,entity_id,correlation_id) VALUES(:id,:r,:u,:a,'HANDOFF',:e,:c)")
      .bind("id", UUID.randomUUID()).bind("r", restaurantId).bind("u", user.id()).bind("a", action).bind("e", handoffId).bind("c", UUID.randomUUID())
      .fetch().rowsUpdated().then();
  }
}
