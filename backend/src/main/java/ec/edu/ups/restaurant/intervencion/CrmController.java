package ec.edu.ups.restaurant.intervencion;

import ec.edu.ups.restaurant.common.ApiException;
import ec.edu.ups.restaurant.pedidos.OrderReportingService;
import ec.edu.ups.restaurant.pedidos.OrderReportingService.CustomerHistory;
import ec.edu.ups.restaurant.security.AppPrincipal;
import ec.edu.ups.restaurant.security.Tenant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.reactive.TransactionalOperator;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

/**
 * CRM de conversaciones sintéticas (ADMIN y CAJA). «Por contestar» se calcula: el último mensaje es del cliente.
 * Responder exige tener el control (derivación IN_PROGRESS asignada al usuario) y no envía nada por WhatsApp.
 */
@RestController
@RequestMapping("/api/v1/crm/conversations")
@PreAuthorize("hasAnyRole('ADMIN','CAJA')")
public class CrmController {
  private static final String BASE = "WITH last AS (SELECT DISTINCT ON (conversation_id) conversation_id, author_type, body, created_at FROM conversation_message "
    + "WHERE restaurante_id=:r ORDER BY conversation_id, created_at DESC, id DESC), "
    + "h AS (SELECT DISTINCT ON (conversation_id) conversation_id, id, status, reason, context_summary, assigned_user_id FROM human_handoff WHERE restaurante_id=:r "
    + "ORDER BY conversation_id, (status <> 'RESOLVED') DESC, created_at DESC) "
    + "SELECT c.id, c.customer_id, COALESCE(cu.name, c.customer_name, 'Cliente sin nombre') customer_name, cu.phone, c.control_mode, c.created_at, l.author_type last_author, l.body last_body, "
    + "COALESCE(l.created_at, c.created_at) last_at, h.id handoff_id, h.status handoff_status, h.reason handoff_reason, h.context_summary, h.assigned_user_id, u.email assignee "
    + "FROM conversation c LEFT JOIN customer cu ON cu.id=c.customer_id AND cu.restaurante_id=c.restaurante_id LEFT JOIN last l ON l.conversation_id=c.id "
    + "LEFT JOIN h ON h.conversation_id=c.id LEFT JOIN app_user u ON u.id=h.assigned_user_id AND u.restaurante_id=c.restaurante_id WHERE c.restaurante_id=:r";

  private final DatabaseClient db;
  private final TransactionalOperator tx;
  private final OrderReportingService orders;

  public CrmController(DatabaseClient db, TransactionalOperator tx, OrderReportingService orders) {
    this.db = db;
    this.tx = tx;
    this.orders = orders;
  }

  public record HandoffInfo(UUID id, String status, String reason, String context, String assignee, boolean mine) {}
  public record ConversationSummary(UUID id, UUID customerId, String customerName, String phone, String controlMode, boolean awaitingReply, String lastAuthor, String lastMessage,
                                    OffsetDateTime lastMessageAt, HandoffInfo handoff) {}
  public record Page(List<ConversationSummary> items, int page, int size, long total) {}
  public record Message(UUID id, String authorType, String authorEmail, String body, OffsetDateTime createdAt) {}
  public record Customer(UUID id, String name, String phone, OffsetDateTime since, CustomerHistory history) {}
  public record ConversationDetail(ConversationSummary conversation, boolean canReply, List<Message> messages, Customer customer) {}
  public record ReplyInput(@NotBlank @Size(max = 2000) String body) {}

  @GetMapping
  public Mono<Page> list(@RequestParam(defaultValue = "ALL") String tab, @RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page,
                         @RequestParam(defaultValue = "20") int size, @AuthenticationPrincipal AppPrincipal user) {
    if (page < 0 || size < 1 || size > 100) throw new ApiException(HttpStatus.BAD_REQUEST, "FILTER_INVALID", "Página o tamaño inválidos (1 a 100)");
    var where = new StringBuilder();
    Map<String, Object> binds = new LinkedHashMap<>();
    switch (tab.trim().toUpperCase()) {
      case "PENDING" -> where.append(" AND l.author_type='CUSTOMER'");
      case "HUMAN" -> where.append(" AND c.control_mode='HUMAN'");
      case "ALL" -> { }
      default -> throw new ApiException(HttpStatus.BAD_REQUEST, "FILTER_INVALID", "Pestaña no reconocida: PENDING, HUMAN o ALL");
    }
    if (q != null && !q.isBlank()) {
      String text = q.trim();
      if (text.length() > 80) throw new ApiException(HttpStatus.BAD_REQUEST, "FILTER_INVALID", "La búsqueda admite hasta 80 caracteres");
      where.append(" AND (COALESCE(cu.name, c.customer_name) ILIKE :q OR cu.phone ILIKE :q");
      binds.put("q", "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
      String digits = text.replaceAll("\\D", "");
      if (!digits.isEmpty()) {
        where.append(" OR regexp_replace(COALESCE(cu.phone,''),'\\D','','g') LIKE :digits");
        binds.put("digits", "%" + digits + "%");
      }
      where.append(")");
    }
    return Tenant.restaurantId().flatMap(r -> {
      String sql = BASE + where;
      Mono<Long> total = bind(db.sql("SELECT count(*) total FROM (" + sql + ") x"), r, binds).map((row, m) -> row.get("total", Long.class)).one();
      Mono<List<ConversationSummary>> items = bind(db.sql(sql + " ORDER BY last_at DESC, c.id LIMIT :limit OFFSET :offset"), r, binds)
        .bind("limit", size).bind("offset", (long) page * size).map((row, m) -> summary(row, user.id())).all().collectList();
      return Mono.zip(items, total).map(values -> new Page(values.getT1(), page, size, values.getT2()));
    });
  }

  @GetMapping("/{id}")
  public Mono<ConversationDetail> detail(@PathVariable UUID id, @AuthenticationPrincipal AppPrincipal user) {
    return Tenant.restaurantId().flatMap(r -> db.sql(BASE + " AND c.id=:id").bind("r", r).bind("id", id).map((row, m) -> summary(row, user.id())).one()
      .switchIfEmpty(Mono.error(notFound()))
      .flatMap(conversation -> Mono.zip(messages(r, id), customer(r, conversation.customerId()).map(java.util.Optional::of).defaultIfEmpty(java.util.Optional.empty()))
        .map(values -> new ConversationDetail(conversation, canReply(conversation), values.getT1(), values.getT2().orElse(null)))));
  }

  /** Responde como persona: guarda un mensaje STAFF con idempotencia. No se envía por WhatsApp (TBD). */
  @PostMapping("/{id}/messages")
  @ResponseStatus(HttpStatus.CREATED)
  public Mono<Message> reply(@PathVariable UUID id, @RequestHeader(value = "Idempotency-Key", required = false) String key, @Valid @RequestBody ReplyInput input,
                             @AuthenticationPrincipal AppPrincipal user) {
    if (key == null || key.isBlank() || key.length() > 120) throw new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key es obligatorio (máximo 120 caracteres)");
    UUID messageId = UUID.randomUUID();
    return Tenant.restaurantId().flatMap(r -> tx.transactional(
      db.sql("INSERT INTO idempotency_operation(id,restaurante_id,operation_type,idempotency_key,result_reference) VALUES(:id,:r,:type,:key,:msg) "
          + "ON CONFLICT(restaurante_id,operation_type,idempotency_key) DO NOTHING RETURNING id")
        .bind("id", UUID.randomUUID()).bind("r", r).bind("type", "CRM_REPLY:" + id).bind("key", key.trim()).bind("msg", messageId)
        .map((row, m) -> row.get("id", UUID.class)).one()
        .flatMap(ignored -> db.sql("SELECT c.control_mode, EXISTS(SELECT 1 FROM human_handoff h WHERE h.restaurante_id=c.restaurante_id AND h.conversation_id=c.id "
              + "AND h.status='IN_PROGRESS' AND h.assigned_user_id=:u) holds FROM conversation c WHERE c.id=:id AND c.restaurante_id=:r FOR UPDATE")
            .bind("u", user.id()).bind("id", id).bind("r", r).map((row, m) -> "HUMAN".equals(row.get("control_mode", String.class)) && Boolean.TRUE.equals(row.get("holds", Boolean.class))).one()
            .switchIfEmpty(Mono.error(notFound()))
            .flatMap(holds -> {
              if (!holds) return Mono.error(new ApiException(HttpStatus.CONFLICT, "CONTROL_REQUIRED", "Toma el control de la conversación antes de responder"));
              UUID correlation = UUID.randomUUID();
              return db.sql("INSERT INTO conversation_message(id,restaurante_id,conversation_id,author_type,author_user_id,body,correlation_id) VALUES(:id,:r,:c,'STAFF',:u,:b,:corr)")
                .bind("id", messageId).bind("r", r).bind("c", id).bind("u", user.id()).bind("b", input.body().trim()).bind("corr", correlation).fetch().rowsUpdated()
                .then(db.sql("INSERT INTO audit_log(id,restaurante_id,actor_user_id,action,entity_type,entity_id,correlation_id) VALUES(:id,:r,:u,'CRM_STAFF_REPLY','CONVERSATION',:c,:corr)")
                  .bind("id", UUID.randomUUID()).bind("r", r).bind("u", user.id()).bind("c", id).bind("corr", correlation).fetch().rowsUpdated())
                .then(message(r, messageId));
            }))
        .switchIfEmpty(Mono.defer(() -> db.sql("SELECT result_reference FROM idempotency_operation WHERE restaurante_id=:r AND operation_type=:type AND idempotency_key=:key")
          .bind("r", r).bind("type", "CRM_REPLY:" + id).bind("key", key.trim()).map((row, m) -> row.get("result_reference", UUID.class)).one()
          .flatMap(previous -> message(r, previous))))));
  }

  private Mono<List<Message>> messages(UUID r, UUID conversationId) {
    return db.sql("SELECT m.id,m.author_type,u.email,m.body,m.created_at FROM conversation_message m LEFT JOIN app_user u ON u.id=m.author_user_id AND u.restaurante_id=m.restaurante_id "
        + "WHERE m.restaurante_id=:r AND m.conversation_id=:c ORDER BY m.created_at, m.id").bind("r", r).bind("c", conversationId)
      .map((row, m) -> new Message(row.get("id", UUID.class), row.get("author_type", String.class), row.get("email", String.class), row.get("body", String.class),
        row.get("created_at", OffsetDateTime.class))).all().collectList();
  }

  private Mono<Message> message(UUID r, UUID messageId) {
    return db.sql("SELECT m.id,m.author_type,u.email,m.body,m.created_at FROM conversation_message m LEFT JOIN app_user u ON u.id=m.author_user_id AND u.restaurante_id=m.restaurante_id "
        + "WHERE m.restaurante_id=:r AND m.id=:id").bind("r", r).bind("id", messageId)
      .map((row, m) -> new Message(row.get("id", UUID.class), row.get("author_type", String.class), row.get("email", String.class), row.get("body", String.class),
        row.get("created_at", OffsetDateTime.class))).one();
  }

  private Mono<Customer> customer(UUID r, UUID customerId) {
    if (customerId == null) return Mono.empty();
    return db.sql("SELECT id,name,phone,created_at FROM customer WHERE id=:id AND restaurante_id=:r").bind("id", customerId).bind("r", r)
      .map((row, m) -> new CustomerBase(row.get("id", UUID.class), row.get("name", String.class), row.get("phone", String.class), row.get("created_at", OffsetDateTime.class))).one()
      .flatMap(base -> orders.customerHistory(r, customerId).map(history -> new Customer(base.id(), base.name(), base.phone(), base.since(), history)));
  }

  private static boolean canReply(ConversationSummary conversation) {
    return "HUMAN".equals(conversation.controlMode()) && conversation.handoff() != null && conversation.handoff().mine() && "IN_PROGRESS".equals(conversation.handoff().status());
  }

  private static ConversationSummary summary(io.r2dbc.spi.Row row, UUID userId) {
    UUID handoffId = row.get("handoff_id", UUID.class);
    UUID assigned = row.get("assigned_user_id", UUID.class);
    HandoffInfo handoff = handoffId == null ? null : new HandoffInfo(handoffId, row.get("handoff_status", String.class), row.get("handoff_reason", String.class),
      row.get("context_summary", String.class), row.get("assignee", String.class), userId.equals(assigned));
    return new ConversationSummary(row.get("id", UUID.class), row.get("customer_id", UUID.class), row.get("customer_name", String.class), row.get("phone", String.class),
      row.get("control_mode", String.class), "CUSTOMER".equals(row.get("last_author", String.class)), row.get("last_author", String.class), row.get("last_body", String.class),
      row.get("last_at", OffsetDateTime.class), handoff);
  }

  private static DatabaseClient.GenericExecuteSpec bind(DatabaseClient.GenericExecuteSpec spec, UUID r, Map<String, Object> binds) {
    spec = spec.bind("r", r);
    for (var entry : binds.entrySet()) spec = spec.bind(entry.getKey(), entry.getValue());
    return spec;
  }

  private static ApiException notFound() { return new ApiException(HttpStatus.NOT_FOUND, "CONVERSATION_NOT_FOUND", "Conversación no encontrada"); }
  private record CustomerBase(UUID id, String name, String phone, OffsetDateTime since) {}
}
