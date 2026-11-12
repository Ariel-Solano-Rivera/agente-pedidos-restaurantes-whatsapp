package ec.edu.ups.restaurant.administracion;

import ec.edu.ups.restaurant.common.ApiException;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import org.springframework.http.HttpStatus;

/**
 * Período del dashboard en la zona horaria del restaurante: desde las 00:00 locales del primer día
 * hasta el instante actual, y el período anterior de igual duración desplazado N días hacia atrás.
 */
public record DashboardPeriod(String range, int days, OffsetDateTime from, OffsetDateTime to, OffsetDateTime previousFrom, OffsetDateTime previousTo) {
  public static DashboardPeriod of(String range, String timezone, OffsetDateTime now) {
    String value = range == null || range.isBlank() ? "TODAY" : range.trim().toUpperCase();
    int days = switch (value) {
      case "TODAY" -> 1;
      case "LAST_7_DAYS" -> 7;
      case "LAST_30_DAYS" -> 30;
      default -> throw new ApiException(HttpStatus.BAD_REQUEST, "RANGE_INVALID", "Rango no reconocido: usa TODAY, LAST_7_DAYS o LAST_30_DAYS");
    };
    ZonedDateTime local = now.atZoneSameInstant(ZoneId.of(timezone));
    ZonedDateTime start = local.toLocalDate().minusDays(days - 1L).atStartOfDay(local.getZone());
    return new DashboardPeriod(value, days, start.toOffsetDateTime(), local.toOffsetDateTime(),
      start.minusDays(days).toOffsetDateTime(), local.minusDays(days).toOffsetDateTime());
  }
}
