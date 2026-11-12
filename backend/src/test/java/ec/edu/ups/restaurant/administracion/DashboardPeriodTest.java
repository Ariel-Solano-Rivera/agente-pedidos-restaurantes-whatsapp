package ec.edu.ups.restaurant.administracion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class DashboardPeriodTest {
  // 2026-11-08 01:30 UTC = 2026-11-07 20:30 en Guayaquil (UTC-5): "hoy" local sigue siendo el 7.
  private static final OffsetDateTime NOW = OffsetDateTime.parse("2026-11-08T01:30:00Z");

  @Test
  void todayStartsAtLocalMidnightAndComparesWithYesterdayUpToTheSameTime() {
    DashboardPeriod period = DashboardPeriod.of("TODAY", "America/Guayaquil", NOW);
    assertThat(period.from()).isEqualTo(OffsetDateTime.parse("2026-11-07T00:00:00-05:00"));
    assertThat(period.to()).isEqualTo(OffsetDateTime.parse("2026-11-07T20:30:00-05:00"));
    assertThat(period.previousFrom()).isEqualTo(OffsetDateTime.parse("2026-11-06T00:00:00-05:00"));
    assertThat(period.previousTo()).isEqualTo(OffsetDateTime.parse("2026-11-06T20:30:00-05:00"));
  }

  @Test
  void multiDayRangesIncludeTodayAndShiftByTheirLength() {
    DashboardPeriod week = DashboardPeriod.of("last_7_days", "America/Guayaquil", NOW);
    assertThat(week.days()).isEqualTo(7);
    assertThat(week.from()).isEqualTo(OffsetDateTime.parse("2026-11-01T00:00:00-05:00"));
    assertThat(week.previousFrom()).isEqualTo(OffsetDateTime.parse("2026-10-25T00:00:00-05:00"));
    assertThat(DashboardPeriod.of("LAST_30_DAYS", "America/Guayaquil", NOW).from()).isEqualTo(OffsetDateTime.parse("2026-10-09T00:00:00-05:00"));
    assertThat(DashboardPeriod.of(null, "America/Guayaquil", NOW).range()).isEqualTo("TODAY");
  }

  @Test
  void rejectsUnknownRangesAndDividesExactly() {
    assertThatThrownBy(() -> DashboardPeriod.of("AYER", "America/Guayaquil", NOW)).extracting("code").isEqualTo("RANGE_INVALID");
    assertThat(DashboardController.ratio(new BigDecimal("10.00"), 3, 2)).isEqualByComparingTo("3.33");
    assertThat(DashboardController.ratio(BigDecimal.ONE, 0, 2)).isNull();
  }
}
