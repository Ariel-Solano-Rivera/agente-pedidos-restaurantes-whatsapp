package ec.edu.ups.restaurant.pedidos;

import ec.edu.ups.restaurant.common.ApiException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;

/**
 * Filtros validados de la lista de pedidos. Todo valor del cliente se enlaza como parámetro;
 * el restaurante siempre es el del usuario autenticado y los rangos usan la zona horaria del restaurante.
 */
public record OrderFilter(String where, Map<String, Object> binds, int page, int size, String orderBy) {
  /** Orden estable: la fecha de recepción y, como desempate, el identificador. */
  public static final String CREATED_DESC = "CREATED_DESC";
  public static final String CREATED_ASC = "CREATED_ASC";
  public static final int MAX_SIZE = 100;
  public static final int MAX_RANGE_DAYS = 366;
  private static final String TZ = "(SELECT timezone FROM restaurant WHERE id=:r)";
  private static final String TODAY_START = "date_trunc('day', now() AT TIME ZONE " + TZ + ")";

  public static OrderFilter of(UUID restaurantId, boolean kitchen, String status, String fulfillment, String paymentStatus, String range,
                               LocalDate from, LocalDate to, String q, int page, int size) {
    return of(restaurantId, kitchen, status, fulfillment, paymentStatus, range, from, to, q, null, page, size);
  }

  public static OrderFilter of(UUID restaurantId, boolean kitchen, String status, String fulfillment, String paymentStatus, String range,
                               LocalDate from, LocalDate to, String q, String sort, int page, int size) {
    String orderBy = switch (present(sort) ? sort.trim().toUpperCase() : CREATED_DESC) {
      case CREATED_DESC -> "o.created_at DESC, o.id";
      case CREATED_ASC -> "o.created_at ASC, o.id";
      default -> throw invalid("Orden no reconocido: usa CREATED_DESC o CREATED_ASC");
    };
    if (page < 0) throw invalid("La página no puede ser negativa");
    if (size < 1 || size > MAX_SIZE) throw invalid("El tamaño de página debe estar entre 1 y " + MAX_SIZE);
    var where = new StringBuilder("o.restaurante_id=:r");
    var binds = new LinkedHashMap<String, Object>();
    binds.put("r", restaurantId);
    if (kitchen) where.append(" AND o.status IN ('ACCEPTED','PREPARING','READY','COMPLETED')");
    if (present(status)) {
      String value = status.trim().toUpperCase();
      if (!OrderTransitionPolicy.STATUSES.contains(value)) throw invalid("Estado no reconocido");
      where.append(" AND o.status=:status");
      binds.put("status", value);
    }
    if (present(fulfillment)) {
      String value = fulfillment.trim().toUpperCase();
      if (!Set.of("PICKUP", "DELIVERY").contains(value)) throw invalid("Modalidad no reconocida");
      where.append(" AND o.fulfillment_mode=:fulfillment");
      binds.put("fulfillment", value);
    }
    if (present(paymentStatus)) {
      if (kitchen) throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Cocina no filtra por pago");
      String value = paymentStatus.trim().toUpperCase();
      if (!value.matches("[A-Z_]{1,40}")) throw invalid("Estado de pago no reconocido");
      where.append(" AND o.payment_status=:payment");
      binds.put("payment", value);
    }
    if (present(range)) {
      switch (range.trim().toUpperCase()) {
        case "TODAY" -> where.append(" AND o.created_at >= ").append(TODAY_START).append(" AT TIME ZONE ").append(TZ);
        case "LAST_7_DAYS" -> where.append(" AND o.created_at >= (").append(TODAY_START).append(" - interval '6 days') AT TIME ZONE ").append(TZ);
        case "CUSTOM" -> {
          if (from == null || to == null) throw invalid("El rango personalizado requiere fecha inicial y final");
          if (to.isBefore(from)) throw invalid("La fecha final no puede ser anterior a la inicial");
          if (ChronoUnit.DAYS.between(from, to) >= MAX_RANGE_DAYS) throw invalid("El rango personalizado admite hasta 366 días");
          where.append(" AND o.created_at >= CAST(:from AS date)::timestamp AT TIME ZONE ").append(TZ)
            .append(" AND o.created_at < (CAST(:to AS date) + 1)::timestamp AT TIME ZONE ").append(TZ);
          binds.put("from", from);
          binds.put("to", to);
        }
        default -> throw invalid("Rango no reconocido");
      }
    }
    if (present(q)) {
      String text = q.trim();
      if (text.length() > 80) throw invalid("La búsqueda admite hasta 80 caracteres");
      String like = "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
      String digits = text.replaceAll("\\D", "");
      where.append(" AND (o.customer_name ILIKE :q OR o.customer_phone ILIKE :q OR ('PED-' || upper(substr(o.id::text,1,8))) LIKE upper(:q)");
      if (!digits.isEmpty()) {
        where.append(" OR regexp_replace(COALESCE(o.customer_phone,''),'\\D','','g') LIKE :digits");
        binds.put("digits", "%" + digits + "%");
      }
      where.append(")");
      binds.put("q", like);
    }
    return new OrderFilter(where.toString(), Map.copyOf(binds), page, size, orderBy);
  }

  public DatabaseClient.GenericExecuteSpec bind(DatabaseClient.GenericExecuteSpec spec) {
    for (var entry : binds.entrySet()) spec = spec.bind(entry.getKey(), entry.getValue());
    return spec;
  }

  private static boolean present(String value) { return value != null && !value.isBlank(); }
  private static ApiException invalid(String message) { return new ApiException(HttpStatus.BAD_REQUEST, "FILTER_INVALID", message); }
}
