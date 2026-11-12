package ec.edu.ups.restaurant.administracion;

import ec.edu.ups.restaurant.administracion.BrandingPolicy.ContrastCheck;
import ec.edu.ups.restaurant.common.ApiException;
import ec.edu.ups.restaurant.common.ImageService;
import ec.edu.ups.restaurant.security.AppPrincipal;
import ec.edu.ups.restaurant.security.Tenant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.buffer.DataBufferLimitException;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.reactive.TransactionalOperator;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

/**
 * Marca del restaurante del usuario autenticado: colores y logo. Lectura para todos los roles (el panel la aplica);
 * cambios solo ADMIN, auditados. El logo se guarda en PostgreSQL vía R2DBC, sin E/S bloqueante.
 */
@RestController
@RequestMapping("/api/v1")
public class BrandingController {
  private static final String DEFAULT_PRIMARY = "#0A3165";
  private static final String DEFAULT_SECONDARY = "#0A5EAE";

  private final DatabaseClient db;
  private final TransactionalOperator tx;
  private final ImageService images;

  public BrandingController(DatabaseClient db, TransactionalOperator tx, ImageService images) {
    this.db = db;
    this.tx = tx;
    this.images = images;
  }

  public record Branding(String primaryColor, String secondaryColor, boolean hasLogo, OffsetDateTime updatedAt, List<ContrastCheck> contrast) {}
  public record BrandingInput(String primaryColor, String secondaryColor) {}

  @GetMapping("/branding")
  public Mono<Branding> branding() {
    return Tenant.restaurantId().flatMap(this::current);
  }

  @GetMapping("/branding/logo")
  public Mono<ResponseEntity<byte[]>> logo() {
    return Tenant.restaurantId().flatMap(r -> db.sql("SELECT logo_content_type, logo_data FROM restaurant_branding WHERE restaurante_id=:r AND logo_data IS NOT NULL").bind("r", r)
      .map((row, m) -> ResponseEntity.ok().contentType(MediaType.parseMediaType(row.get("logo_content_type", String.class))).cacheControl(CacheControl.noCache())
        .body(row.get("logo_data", byte[].class))).one()
      .switchIfEmpty(Mono.error(new ApiException(HttpStatus.NOT_FOUND, "LOGO_NOT_FOUND", "El restaurante no tiene logo"))));
  }

  @PutMapping("/admin/branding")
  @PreAuthorize("hasRole('ADMIN')")
  public Mono<Branding> update(@RequestBody BrandingInput input, @AuthenticationPrincipal AppPrincipal user) {
    String primary = BrandingPolicy.normalizeColor(input.primaryColor(), "color principal");
    String secondary = BrandingPolicy.normalizeColor(input.secondaryColor(), "color secundario");
    return Tenant.restaurantId().flatMap(r -> tx.transactional(
      db.sql("INSERT INTO restaurant_branding(restaurante_id,primary_color,secondary_color,updated_by,updated_at) VALUES(:r,:p,:s,:u,now()) "
          + "ON CONFLICT (restaurante_id) DO UPDATE SET primary_color=EXCLUDED.primary_color, secondary_color=EXCLUDED.secondary_color, updated_by=EXCLUDED.updated_by, updated_at=now()")
        .bind("r", r).bind("p", primary).bind("s", secondary).bind("u", user.id()).fetch().rowsUpdated()
        .then(audit(r, user, "BRANDING_COLORS_UPDATE"))
        .then(current(r))));
  }

  @PostMapping(value = "/admin/branding/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  @PreAuthorize("hasRole('ADMIN')")
  /** Logo (bloque D): mismo servicio que las fotos de platos; se valida por firma, se convierte a WebP fuera de WebFlux y se guarda solo WebP. */
  public Mono<Branding> uploadLogo(@RequestPart("file") FilePart file, @AuthenticationPrincipal AppPrincipal user) {
    return Tenant.restaurantId().flatMap(r -> DataBufferUtils.join(file.content(), BrandingPolicy.MAX_LOGO_BYTES)
      .onErrorMap(DataBufferLimitException.class, error -> new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "LOGO_TOO_LARGE", "El logo supera 2 MB"))
      .map(buffer -> {
        byte[] data = new byte[buffer.readableByteCount()];
        buffer.read(data);
        DataBufferUtils.release(buffer);
        return data;
      })
      .switchIfEmpty(Mono.error(new ApiException(HttpStatus.BAD_REQUEST, "LOGO_EMPTY", "El archivo está vacío")))
      .flatMap(data -> {
        if (data.length == 0) return Mono.error(new ApiException(HttpStatus.BAD_REQUEST, "LOGO_EMPTY", "El archivo está vacío"));
        BrandingPolicy.detectImageType(data);
        return images.toWebp(data, "LOGO").flatMap(converted -> tx.transactional(db.sql("INSERT INTO restaurant_branding(restaurante_id,primary_color,secondary_color,logo_content_type,logo_data,updated_by,updated_at) "
            + "VALUES(:r,:p,:s,:t,:d,:u,now()) ON CONFLICT (restaurante_id) DO UPDATE SET logo_content_type=EXCLUDED.logo_content_type, logo_data=EXCLUDED.logo_data, "
            + "updated_by=EXCLUDED.updated_by, updated_at=now()")
          .bind("r", r).bind("p", DEFAULT_PRIMARY).bind("s", DEFAULT_SECONDARY).bind("t", ImageService.WEBP).bind("d", converted.data()).bind("u", user.id()).fetch().rowsUpdated()
          .then(audit(r, user, "BRANDING_LOGO_UPDATE"))
          .then(current(r))));
      }));
  }

  @DeleteMapping("/admin/branding/logo")
  @PreAuthorize("hasRole('ADMIN')")
  public Mono<Branding> deleteLogo(@AuthenticationPrincipal AppPrincipal user) {
    return Tenant.restaurantId().flatMap(r -> tx.transactional(
      db.sql("UPDATE restaurant_branding SET logo_content_type=NULL, logo_data=NULL, updated_by=:u, updated_at=now() WHERE restaurante_id=:r")
        .bind("u", user.id()).bind("r", r).fetch().rowsUpdated()
        .then(audit(r, user, "BRANDING_LOGO_DELETE"))
        .then(current(r))));
  }

  private Mono<Branding> current(UUID restaurantId) {
    return db.sql("SELECT primary_color, secondary_color, logo_data IS NOT NULL has_logo, updated_at FROM restaurant_branding WHERE restaurante_id=:r").bind("r", restaurantId)
      .map((row, m) -> branding(row.get("primary_color", String.class), row.get("secondary_color", String.class), Boolean.TRUE.equals(row.get("has_logo", Boolean.class)),
        row.get("updated_at", OffsetDateTime.class))).one()
      .defaultIfEmpty(branding(DEFAULT_PRIMARY, DEFAULT_SECONDARY, false, null));
  }

  private static Branding branding(String primary, String secondary, boolean hasLogo, OffsetDateTime updatedAt) {
    return new Branding(primary, secondary, hasLogo, updatedAt, BrandingPolicy.contrast(primary, secondary));
  }

  private Mono<Void> audit(UUID restaurantId, AppPrincipal user, String action) {
    return db.sql("INSERT INTO audit_log(id,restaurante_id,actor_user_id,action,entity_type,entity_id,correlation_id) VALUES(:id,:r,:u,:a,'RESTAURANT_BRANDING',:r,:c)")
      .bind("id", UUID.randomUUID()).bind("r", restaurantId).bind("u", user.id()).bind("a", action).bind("c", UUID.randomUUID()).fetch().rowsUpdated().then();
  }
}
