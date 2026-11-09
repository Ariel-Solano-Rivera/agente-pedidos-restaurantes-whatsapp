package ec.edu.ups.restaurant.pedidos;

import ec.edu.ups.restaurant.common.ApiException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;

/**
 * Matriz de transiciones de pedido según AGENTS.md. Es la única autoridad sobre qué cambios
 * de estado se permiten; el panel solo muestra lo que esta clase devuelve.
 */
public final class OrderTransitionPolicy {
  public enum Role { ADMIN, CAJA, COCINA }
  public enum Direction { FORWARD, BACKWARD }
  public enum ReasonCode { ERROR_AL_AVANZAR, CLIENTE_CAMBIO_PEDIDO, FALTA_PRODUCTO, OTRO }

  public record Transition(String targetStatus, Direction direction, boolean requiresReason, boolean destructive) {}

  /** Tipo de cambio persistido en order_status_history.change_type. */
  public static final String AVANCE = "AVANCE";
  public static final String RETROCESO = "RETROCESO";
  public static final String DESHACER = "DESHACER";

  public static final Set<String> STATUSES = Set.of("PENDING_DECISION", "ACCEPTED", "REJECTED", "PREPARING", "READY", "COMPLETED", "CANCELLED", "EXPIRED");
  /** Estados que COCINA puede consultar. */
  public static final Set<String> KITCHEN_VISIBLE = Set.of("ACCEPTED", "PREPARING", "READY", "COMPLETED");

  private static final Map<String, List<String>> FORWARD = Map.of(
    "PENDING_DECISION", List.of("ACCEPTED", "REJECTED"),
    "ACCEPTED", List.of("PREPARING", "CANCELLED"),
    "PREPARING", List.of("READY"),
    "READY", List.of("COMPLETED"));
  /** TBD (ADR-001): ACCEPTED → PENDING_DECISION no se permite porque afecta la reserva. */
  private static final Map<String, String> BACKWARD = Map.of("PREPARING", "ACCEPTED", "READY", "PREPARING");
  private static final Set<String> KITCHEN_FORWARD = Set.of("ACCEPTED>PREPARING", "PREPARING>READY");
  private static final Set<String> DESTRUCTIVE = Set.of("REJECTED", "CANCELLED");
  private static final int MAX_REASON = 300;

  private OrderTransitionPolicy() {}

  /** Transiciones que el rol puede ejecutar desde el estado actual, en el orden en que se muestran. */
  public static List<Transition> allowed(String current, Role role) {
    var result = new java.util.ArrayList<Transition>();
    for (String target : FORWARD.getOrDefault(current, List.of())) {
      if (role != Role.COCINA || KITCHEN_FORWARD.contains(current + ">" + target)) {
        result.add(new Transition(target, Direction.FORWARD, false, DESTRUCTIVE.contains(target)));
      }
    }
    String back = BACKWARD.get(current);
    if (back != null && role != Role.COCINA) result.add(new Transition(back, Direction.BACKWARD, true, false));
    return List.copyOf(result);
  }

  /** Valida la transición y devuelve el tipo de cambio que se registra en el historial. */
  public static String validate(String current, String target, Role role, String reasonCode, String reason) {
    Transition transition = allowed(current, role).stream().filter(item -> item.targetStatus().equals(target)).findFirst()
      .orElseThrow(() -> new ApiException(HttpStatus.CONFLICT, "TRANSITION_NOT_ALLOWED", "La transición " + current + " → " + target + " no está permitida para tu rol"));
    if (transition.direction() == Direction.FORWARD) return AVANCE;
    ReasonCode code = parseReason(reasonCode);
    if (code == null) throw new ApiException(HttpStatus.BAD_REQUEST, "REASON_REQUIRED", "Elige el motivo del retroceso");
    if (code == ReasonCode.OTRO && (reason == null || reason.isBlank())) throw new ApiException(HttpStatus.BAD_REQUEST, "REASON_TEXT_REQUIRED", "Describe el motivo cuando eliges «Otro»");
    if (reason != null && reason.trim().length() > MAX_REASON) throw new ApiException(HttpStatus.BAD_REQUEST, "REASON_TOO_LONG", "El motivo admite hasta 300 caracteres");
    return RETROCESO;
  }

  public static ReasonCode parseReason(String value) {
    if (value == null || value.isBlank()) return null;
    try {
      return ReasonCode.valueOf(value.trim().toUpperCase());
    } catch (IllegalArgumentException error) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "REASON_INVALID", "Motivo de retroceso no reconocido");
    }
  }

  public static Role role(java.util.Collection<? extends org.springframework.security.core.GrantedAuthority> authorities) {
    return authorities.stream().map(authority -> authority.getAuthority().replace("ROLE_", ""))
      .filter(name -> Set.of("ADMIN", "CAJA", "COCINA").contains(name)).map(Role::valueOf).findFirst()
      .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Rol no reconocido"));
  }
}
