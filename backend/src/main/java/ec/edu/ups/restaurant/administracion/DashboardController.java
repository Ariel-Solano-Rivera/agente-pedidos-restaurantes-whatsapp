package ec.edu.ups.restaurant.administracion;

import ec.edu.ups.restaurant.intervencion.HandoffReportingService;
import ec.edu.ups.restaurant.menu.MenuReportingService;
import ec.edu.ups.restaurant.pagos.PaymentReportingService;
import ec.edu.ups.restaurant.pedidos.OrderMetricsService;
import ec.edu.ups.restaurant.pedidos.OrderMetricsService.BackwardCount;
import ec.edu.ups.restaurant.pedidos.OrderMetricsService.FulfillmentShare;
import ec.edu.ups.restaurant.pedidos.OrderMetricsService.HourCount;
import ec.edu.ups.restaurant.pedidos.OrderMetricsService.PeriodMetrics;
import ec.edu.ups.restaurant.pedidos.OrderMetricsService.Ranked;
import ec.edu.ups.restaurant.pedidos.OrderReportingService;
import ec.edu.ups.restaurant.security.AppPrincipal;
import ec.edu.ups.restaurant.security.Tenant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * Resumen compartido de Inicio y dashboard de ADMIN. Solo lectura; nunca recibe restaurante_id del cliente.
 * Combina contratos internos de lectura de pedidos, pagos, menú e intervención humana.
 */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
  private final DatabaseClient db;
  private final OrderReportingService orderReporting;
  private final OrderMetricsService orderMetrics;
  private final PaymentReportingService payments;
  private final MenuReportingService menu;
  private final HandoffReportingService handoffs;

  public DashboardController(DatabaseClient db, OrderReportingService orderReporting, OrderMetricsService orderMetrics, PaymentReportingService payments,
                             MenuReportingService menu, HandoffReportingService handoffs) {
    this.db = db;
    this.orderReporting = orderReporting;
    this.orderMetrics = orderMetrics;
    this.payments = payments;
    this.menu = menu;
    this.handoffs = handoffs;
  }

  public record Task(UUID id, String title, OffsetDateTime scheduledFor) {}
  public record TopDish(String name, int unitsSold) {}
  public record CashToday(BigDecimal collected, BigDecimal receivable) {}
  public record Summary(String restaurantName, boolean receptionPaused, String pauseReason, OffsetDateTime generatedAt, TopDish topDish, List<Task> tasks, CashToday cash) {}

  public record Compare<T>(T current, T previous) {}
  public record LostCause(String cause, long count, BigDecimal amount, long previousCount, BigDecimal previousAmount) {}
  public record AdminDashboard(String range, String timezone, OffsetDateTime from, OffsetDateTime to, OffsetDateTime previousFrom, OffsetDateTime previousTo, OffsetDateTime generatedAt,
                               Compare<BigDecimal> collected, Compare<BigDecimal> receivable, Compare<BigDecimal> completedSales, Compare<Long> completedOrders,
                               Compare<BigDecimal> averageTicket, Compare<BigDecimal> acceptanceRate, Compare<BigDecimal> decisionMinutes, Compare<BigDecimal> preparationMinutes,
                               List<LostCause> lostSales, Compare<Long> newCustomers, Compare<Long> returningCustomers, List<HourCount> ordersByHour, List<Ranked> topDishes,
                               List<Ranked> topExtras, List<FulfillmentShare> fulfillment, long openHandoffs, List<String> soldOutDishes, List<BackwardCount> backwards) {}

  /** Inicio para todos los roles. `cash` (cobrado y por cobrar de hoy) solo para ADMIN y CAJA; COCINA no recibe montos. */
  @GetMapping
  public Mono<Summary> summary(@AuthenticationPrincipal AppPrincipal user) {
    boolean money = user.getAuthorities().stream().anyMatch(authority -> List.of("ROLE_ADMIN", "ROLE_CAJA").contains(authority.getAuthority()));
    return Tenant.restaurantId().flatMap(restaurantId -> Mono.zip(business(restaurantId),
        orderReporting.mostSoldDish(restaurantId).map(item -> new TopDish(item.name(), item.unitsSold())).defaultIfEmpty(new TopDish("Sin ventas registradas", 0)),
        tasks(restaurantId).collectList(),
        money ? cashToday(restaurantId).map(java.util.Optional::of) : Mono.just(java.util.Optional.<CashToday>empty()))
      .map(values -> new Summary(values.getT1().name(), values.getT1().paused(), values.getT1().reason(), OffsetDateTime.now(), values.getT2(), values.getT3(), values.getT4().orElse(null))));
  }

  /** Dashboard de ADMIN con comparación frente al período anterior de igual duración. */
  @GetMapping("/admin")
  @PreAuthorize("hasRole('ADMIN')")
  public Mono<AdminDashboard> admin(@RequestParam(required = false) String range) {
    return Tenant.restaurantId().flatMap(restaurantId -> clock(restaurantId).flatMap(clock -> {
      DashboardPeriod period = DashboardPeriod.of(range, clock.timezone, clock.now);
      Mono<PeriodMetrics> current = orderMetrics.period(restaurantId, period.from(), period.to());
      Mono<PeriodMetrics> previous = orderMetrics.period(restaurantId, period.previousFrom(), period.previousTo());
      Mono<List<BigDecimal>> collected = Flux.concat(payments.collected(restaurantId, period.from(), period.to()), payments.collected(restaurantId, period.previousFrom(), period.previousTo())).collectList();
      Mono<Breakdown> breakdown = Mono.zip(orderMetrics.ordersByHour(restaurantId, clock.timezone, period.from(), period.to()), orderMetrics.topDishes(restaurantId, period.from(), period.to()),
          orderMetrics.topExtras(restaurantId, period.from(), period.to()), orderMetrics.fulfillment(restaurantId, period.from(), period.to()),
          handoffs.openCount(restaurantId), menu.soldOutDishes(restaurantId), orderMetrics.backwards(restaurantId, clock.timezone, period.from(), period.to()))
        .map(values -> new Breakdown(values.getT1(), values.getT2(), values.getT3(), values.getT4(), values.getT5(), values.getT6(), values.getT7()));
      return Mono.zip(current, previous, collected, breakdown).map(values -> {
        PeriodMetrics now = values.getT1();
        PeriodMetrics before = values.getT2();
        Breakdown b = values.getT4();
        return new AdminDashboard(period.range(), clock.timezone, period.from(), period.to(), period.previousFrom(), period.previousTo(), OffsetDateTime.now(),
          new Compare<>(values.getT3().get(0), values.getT3().get(1)), new Compare<>(now.receivable(), before.receivable()),
          new Compare<>(now.completedAmount(), before.completedAmount()), new Compare<>(now.completedCount(), before.completedCount()),
          new Compare<>(ratio(now.completedAmount(), now.completedCount(), 2), ratio(before.completedAmount(), before.completedCount(), 2)),
          new Compare<>(ratio(BigDecimal.valueOf(now.accepted()), now.decided(), 4), ratio(BigDecimal.valueOf(before.accepted()), before.decided(), 4)),
          new Compare<>(now.decisionMinutes(), before.decisionMinutes()), new Compare<>(now.preparationMinutes(), before.preparationMinutes()),
          List.of(lost("REJECTED", now.rejected(), before.rejected()), lost("CANCELLED", now.cancelled(), before.cancelled()), lost("EXPIRED", now.expired(), before.expired())),
          new Compare<>(now.newCustomers(), before.newCustomers()), new Compare<>(now.returningCustomers(), before.returningCustomers()),
          b.hours, b.dishes, b.extras, b.fulfillment, b.openHandoffs, b.soldOut, b.backwards);
      });
    }));
  }

  private Mono<CashToday> cashToday(UUID restaurantId) {
    return clock(restaurantId).flatMap(clock -> {
      DashboardPeriod today = DashboardPeriod.of("TODAY", clock.timezone, clock.now);
      return Mono.zip(payments.collected(restaurantId, today.from(), today.to()), orderMetrics.receivable(restaurantId, today.from(), today.to()))
        .map(values -> new CashToday(values.getT1(), values.getT2()));
    });
  }

  private Mono<Clock> clock(UUID restaurantId) {
    return db.sql("SELECT timezone, now() db_now FROM restaurant WHERE id=:r").bind("r", restaurantId)
      .map((row, metadata) -> new Clock(row.get("timezone", String.class), row.get("db_now", OffsetDateTime.class))).one();
  }

  private static LostCause lost(String cause, OrderMetricsService.Lost now, OrderMetricsService.Lost before) {
    return new LostCause(cause, now.count(), now.amount(), before.count(), before.amount());
  }

  /** División exacta con redondeo HALF_UP; null cuando no hay base (sin pedidos). */
  static BigDecimal ratio(BigDecimal numerator, long denominator, int scale) {
    return denominator == 0 ? null : numerator.divide(BigDecimal.valueOf(denominator), scale, RoundingMode.HALF_UP);
  }

  private Mono<Business> business(UUID restaurantId) {
    return db.sql("SELECT r.name, s.reception_paused, COALESCE(s.pause_reason,'') pause_reason FROM restaurant r JOIN operation_settings s ON s.restaurante_id=r.id WHERE r.id=:r")
      .bind("r", restaurantId).map((row, metadata) -> new Business(row.get("name", String.class), row.get("reception_paused", Boolean.class), row.get("pause_reason", String.class))).one();
  }

  private Flux<Task> tasks(UUID restaurantId) {
    return db.sql("SELECT id,title,scheduled_for FROM dashboard_task WHERE restaurante_id=:r AND status='SCHEDULED' AND scheduled_for>=date_trunc('day',now()) ORDER BY scheduled_for ASC LIMIT 3")
      .bind("r", restaurantId).map((row, metadata) -> new Task(row.get("id", UUID.class), row.get("title", String.class), row.get("scheduled_for", OffsetDateTime.class))).all();
  }

  private record Business(String name, boolean paused, String reason) {}
  private record Clock(String timezone, OffsetDateTime now) {}
  private record Breakdown(List<HourCount> hours, List<Ranked> dishes, List<Ranked> extras, List<FulfillmentShare> fulfillment, long openHandoffs, List<String> soldOut, List<BackwardCount> backwards) {}
}
