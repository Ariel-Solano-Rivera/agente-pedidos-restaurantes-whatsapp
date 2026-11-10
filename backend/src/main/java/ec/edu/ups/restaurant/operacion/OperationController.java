package ec.edu.ups.restaurant.operacion;

import ec.edu.ups.restaurant.common.ApiException;
import ec.edu.ups.restaurant.security.AppPrincipal;
import ec.edu.ups.restaurant.security.Tenant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.reactive.TransactionalOperator;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/** Administrative operational settings. It deliberately has no order-creation endpoint. */
@RestController
@RequestMapping("/api/v1")
public class OperationController {
  private final DatabaseClient db; private final TransactionalOperator tx;
  public OperationController(DatabaseClient db, TransactionalOperator tx) { this.db=db; this.tx=tx; }
  public record Settings(boolean receptionPaused,String pauseReason) {}
  public record SettingsInput(boolean receptionPaused,String pauseReason) {}
  public record Availability(UUID variantId,String dish,String variant,int onHand,int reserved,boolean soldOut) {}
  public record Adjustment(@NotNull UUID variantId,int delta,@NotBlank String reason) {}
  public record SoldOutInput(@NotNull Boolean soldOut) {}
  public record DishSoldOut(UUID dishId, boolean soldOut, int variants) {}
  public record Zone(UUID id,String name,String fee,boolean active) {}
  public record ZoneInput(@NotBlank String name,@NotBlank String fee,boolean active) {}
  public record Schedule(UUID id,int dayOfWeek,LocalTime opensAt,LocalTime closesAt,boolean closed) {}
  public record ScheduleInput(int dayOfWeek,@NotNull LocalTime opensAt,@NotNull LocalTime closesAt,boolean closed) {}

  @GetMapping("/operation/settings")
  public Mono<Settings> settings() { return Tenant.restaurantId().flatMap(r -> db.sql("SELECT reception_paused,pause_reason FROM operation_settings WHERE restaurante_id=:r").bind("r",r).map((x,m)->new Settings(x.get("reception_paused",Boolean.class),x.get("pause_reason",String.class))).one()); }
  @PutMapping("/admin/operation/settings") @PreAuthorize("hasRole('ADMIN')")
  public Mono<Settings> updateSettings(@Valid @RequestBody SettingsInput input,@AuthenticationPrincipal AppPrincipal user) { return Tenant.restaurantId().flatMap(r -> db.sql("UPDATE operation_settings SET reception_paused=:p,pause_reason=:reason,updated_at=now(),updated_by=:u WHERE restaurante_id=:r").bind("p",input.receptionPaused()).bind("reason",input.pauseReason()==null?"":input.pauseReason()).bind("u",user.id()).bind("r",r).fetch().rowsUpdated().thenReturn(new Settings(input.receptionPaused(),input.pauseReason()))); }
  @GetMapping("/availability")
  public Flux<Availability> availability() { return Tenant.restaurantId().flatMapMany(r -> db.sql("SELECT v.id,d.name dish,v.name variant,a.on_hand,a.reserved,a.sold_out FROM availability a JOIN sellable_variant v ON v.id=a.variant_id AND v.restaurante_id=a.restaurante_id JOIN dish d ON d.id=v.dish_id AND d.restaurante_id=v.restaurante_id WHERE a.restaurante_id=:r ORDER BY d.name,v.name").bind("r",r).map((x,m)->new Availability(x.get("id",UUID.class),x.get("dish",String.class),x.get("variant",String.class),x.get("on_hand",Integer.class),x.get("reserved",Integer.class),x.get("sold_out",Boolean.class))).all()); }
  @PostMapping("/availability/adjustments") @PreAuthorize("hasAnyRole('ADMIN','CAJA')")
  public Mono<Availability> adjust(@RequestHeader("Idempotency-Key") String key,@Valid @RequestBody Adjustment input,@AuthenticationPrincipal AppPrincipal user) {
    if (key.isBlank()) return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,"Idempotency-Key es obligatorio"));
    return Tenant.restaurantId().flatMap(r -> tx.transactional(
      db.sql("INSERT INTO idempotency_operation(id,restaurante_id,operation_type,idempotency_key,result_reference) VALUES(:id,:r,'AVAILABILITY_ADJUST',:k,:v) ON CONFLICT(restaurante_id,operation_type,idempotency_key) DO NOTHING")
        .bind("id",UUID.randomUUID()).bind("r",r).bind("k",key).bind("v",input.variantId()).fetch().rowsUpdated()
        .flatMap(inserted -> inserted==0 ? oneAvailability(r,input.variantId()) : db.sql("UPDATE availability SET on_hand=on_hand+:d, sold_out=false, tracked=true, updated_at=now() WHERE restaurante_id=:r AND variant_id=:v AND on_hand+:d>=reserved")
          .bind("d",input.delta()).bind("r",r).bind("v",input.variantId()).fetch().rowsUpdated()
          .flatMap(rows -> rows==0 ? Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,"Ajuste inválido o disponibilidad insuficiente")) : db.sql("INSERT INTO availability_movement(id,restaurante_id,variant_id,delta,reason,source,actor_user_id,correlation_id) VALUES(:id,:r,:v,:d,:reason,'PANEL',:u,:c)")
            .bind("id",UUID.randomUUID()).bind("r",r).bind("v",input.variantId()).bind("d",input.delta()).bind("reason",input.reason()).bind("u",user.id()).bind("c",UUID.fromString(key)).fetch().rowsUpdated().then(oneAvailability(r,input.variantId()))))));
  }
  /**
   * Marca o quita «agotado» en todas las variantes de un plato propio (ADMIN y CAJA). Idempotente por `Idempotency-Key` (UUID),
   * en una transacción y auditado en `audit_log` con usuario, fecha y `correlation_id`. No cambia cantidades, reservas ni movimientos.
   * Quitar «agotado» no repone unidades: si la variante controla cantidad y no tiene libres, el plato sigue sin estar disponible.
   */
  @PutMapping("/availability/dishes/{dishId}/sold-out") @PreAuthorize("hasAnyRole('ADMIN','CAJA')")
  public Mono<DishSoldOut> soldOut(@PathVariable UUID dishId, @RequestHeader(value = "Idempotency-Key", required = false) String key,
                                   @Valid @RequestBody SoldOutInput input, @AuthenticationPrincipal AppPrincipal user) {
    UUID correlation;
    try { correlation = UUID.fromString(key == null ? "" : key.trim()); }
    catch (IllegalArgumentException error) { return Mono.error(new ApiException(HttpStatus.BAD_REQUEST, "IDEMPOTENCY_KEY_REQUIRED", "La cabecera Idempotency-Key debe ser un UUID")); }
    boolean soldOut = input.soldOut();
    return Tenant.restaurantId().flatMap(r -> tx.transactional(
      db.sql("SELECT count(*) n FROM sellable_variant v JOIN dish d ON d.id=v.dish_id AND d.restaurante_id=v.restaurante_id WHERE d.id=:d AND d.restaurante_id=:r")
        .bind("d", dishId).bind("r", r).map((row, m) -> row.get("n", Long.class)).one()
        .flatMap(count -> db.sql("SELECT 1 FROM dish WHERE id=:d AND restaurante_id=:r").bind("d", dishId).bind("r", r).fetch().first().hasElement()
          .flatMap(exists -> !exists ? Mono.<DishSoldOut>error(new ApiException(HttpStatus.NOT_FOUND, "DISH_NOT_FOUND", "Plato no encontrado"))
            : db.sql("INSERT INTO idempotency_operation(id,restaurante_id,operation_type,idempotency_key,result_reference) VALUES(:id,:r,'DISH_SOLD_OUT',:k,:d) "
                + "ON CONFLICT(restaurante_id,operation_type,idempotency_key) DO NOTHING")
              .bind("id", UUID.randomUUID()).bind("r", r).bind("k", correlation.toString()).bind("d", dishId).fetch().rowsUpdated()
              .flatMap(inserted -> inserted == 0 ? currentSoldOut(r, dishId, count.intValue())
                : db.sql("INSERT INTO availability(restaurante_id,variant_id,on_hand,reserved,sold_out,tracked) SELECT v.restaurante_id,v.id,0,0,:s,false FROM sellable_variant v "
                    + "WHERE v.restaurante_id=:r AND v.dish_id=:d ON CONFLICT(restaurante_id,variant_id) DO NOTHING")
                  .bind("s", soldOut).bind("r", r).bind("d", dishId).fetch().rowsUpdated()
                  .then(db.sql("UPDATE availability a SET sold_out=:s, updated_at=now() FROM sellable_variant v WHERE v.id=a.variant_id AND v.restaurante_id=a.restaurante_id "
                      + "AND a.restaurante_id=:r AND v.dish_id=:d").bind("s", soldOut).bind("r", r).bind("d", dishId).fetch().rowsUpdated())
                  .then(db.sql("INSERT INTO audit_log(id,restaurante_id,actor_user_id,action,entity_type,entity_id,correlation_id) VALUES(:id,:r,:u,:a,'dish',:d,:c)")
                    .bind("id", UUID.randomUUID()).bind("r", r).bind("u", user.id()).bind("a", soldOut ? "DISH_SOLD_OUT" : "DISH_SOLD_OUT_CLEARED")
                    .bind("d", dishId).bind("c", correlation).fetch().rowsUpdated())
                  .thenReturn(new DishSoldOut(dishId, soldOut, count.intValue())))))));
  }

  private Mono<DishSoldOut> currentSoldOut(UUID r, UUID dishId, int variants) {
    return db.sql("SELECT COALESCE(bool_and(a.sold_out), false) s FROM availability a JOIN sellable_variant v ON v.id=a.variant_id AND v.restaurante_id=a.restaurante_id WHERE a.restaurante_id=:r AND v.dish_id=:d")
      .bind("r", r).bind("d", dishId).map((row, m) -> new DishSoldOut(dishId, Boolean.TRUE.equals(row.get("s", Boolean.class)), variants)).one();
  }

  @GetMapping("/operation/zones") public Flux<Zone> zones(){return Tenant.restaurantId().flatMapMany(r->db.sql("SELECT id,name,fee,active FROM delivery_zone WHERE restaurante_id=:r ORDER BY name").bind("r",r).map((x,m)->new Zone(x.get("id",UUID.class),x.get("name",String.class),x.get("fee",java.math.BigDecimal.class).toPlainString(),x.get("active",Boolean.class))).all());}
  @PostMapping("/admin/zones") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('ADMIN')") public Mono<Zone> zone(@Valid @RequestBody ZoneInput i){UUID id=UUID.randomUUID();return Tenant.restaurantId().flatMap(r->db.sql("INSERT INTO delivery_zone(id,restaurante_id,name,fee,active) VALUES(:id,:r,:n,:f,:a)").bind("id",id).bind("r",r).bind("n",i.name()).bind("f",new java.math.BigDecimal(i.fee())).bind("a",i.active()).fetch().rowsUpdated().thenReturn(new Zone(id,i.name(),i.fee(),i.active())));}
  @GetMapping("/operation/schedules") public Flux<Schedule> schedules(){return Tenant.restaurantId().flatMapMany(r->db.sql("SELECT id,day_of_week,opens_at,closes_at,closed FROM opening_hours WHERE restaurante_id=:r ORDER BY day_of_week").bind("r",r).map((x,m)->new Schedule(x.get("id",UUID.class),x.get("day_of_week",Integer.class),x.get("opens_at",LocalTime.class),x.get("closes_at",LocalTime.class),x.get("closed",Boolean.class))).all());}
  @PostMapping("/admin/schedules") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('ADMIN')") public Mono<Schedule> schedule(@Valid @RequestBody ScheduleInput i){if(i.dayOfWeek()<0||i.dayOfWeek()>6)return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,"Día inválido"));UUID id=UUID.randomUUID();return Tenant.restaurantId().flatMap(r->db.sql("INSERT INTO opening_hours(id,restaurante_id,day_of_week,opens_at,closes_at,closed) VALUES(:id,:r,:d,:o,:c,:x)").bind("id",id).bind("r",r).bind("d",i.dayOfWeek()).bind("o",i.opensAt()).bind("c",i.closesAt()).bind("x",i.closed()).fetch().rowsUpdated().thenReturn(new Schedule(id,i.dayOfWeek(),i.opensAt(),i.closesAt(),i.closed())));}
  private Mono<Availability> oneAvailability(UUID r,UUID v){return db.sql("SELECT v.id,d.name dish,v.name variant,a.on_hand,a.reserved,a.sold_out FROM availability a JOIN sellable_variant v ON v.id=a.variant_id AND v.restaurante_id=a.restaurante_id JOIN dish d ON d.id=v.dish_id AND d.restaurante_id=v.restaurante_id WHERE a.restaurante_id=:r AND a.variant_id=:v").bind("r",r).bind("v",v).map((x,m)->new Availability(x.get("id",UUID.class),x.get("dish",String.class),x.get("variant",String.class),x.get("on_hand",Integer.class),x.get("reserved",Integer.class),x.get("sold_out",Boolean.class))).one().switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND,"Variante no encontrada")));}
}
