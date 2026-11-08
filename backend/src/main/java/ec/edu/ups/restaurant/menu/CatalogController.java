package ec.edu.ups.restaurant.menu;

import ec.edu.ups.restaurant.security.Tenant;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1")
public class CatalogController {
  private final DatabaseClient db;
  public CatalogController(DatabaseClient db) { this.db = db; }
  public record Item(UUID id, String name, boolean active) {}
  public record ItemInput(@NotBlank String name, boolean active) {}

  @GetMapping("/menu/catalog/presentations") public Flux<Item> presentations() { return Tenant.restaurantId().flatMapMany(rest -> items("menu_presentation", rest)); }
  @GetMapping("/menu/catalog/ingredients") public Flux<Item> ingredients() { return Tenant.restaurantId().flatMapMany(rest -> items("catalog_ingredient", rest)); }
  @PostMapping("/admin/catalog/presentations") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('ADMIN')") public Mono<Item> createPresentation(@Valid @RequestBody ItemInput input) { return Tenant.restaurantId().flatMap(rest -> create("menu_presentation", rest, input)); }
  @PostMapping("/admin/catalog/ingredients") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('ADMIN')") public Mono<Item> createIngredient(@Valid @RequestBody ItemInput input) { return Tenant.restaurantId().flatMap(rest -> create("catalog_ingredient", rest, input)); }
  @PutMapping("/admin/catalog/presentations/{id}") @PreAuthorize("hasRole('ADMIN')") public Mono<Item> updatePresentation(@PathVariable UUID id, @Valid @RequestBody ItemInput input) { return Tenant.restaurantId().flatMap(rest -> update("menu_presentation", rest, id, input)); }
  @PutMapping("/admin/catalog/ingredients/{id}") @PreAuthorize("hasRole('ADMIN')") public Mono<Item> updateIngredient(@PathVariable UUID id, @Valid @RequestBody ItemInput input) { return Tenant.restaurantId().flatMap(rest -> update("catalog_ingredient", rest, id, input)); }
  @DeleteMapping("/admin/catalog/presentations/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasRole('ADMIN')") public Mono<Void> deletePresentation(@PathVariable UUID id) { return Tenant.restaurantId().flatMap(rest -> delete("menu_presentation", rest, id)); }
  @DeleteMapping("/admin/catalog/ingredients/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasRole('ADMIN')") public Mono<Void> deleteIngredient(@PathVariable UUID id) { return Tenant.restaurantId().flatMap(rest -> delete("catalog_ingredient", rest, id)); }

  private Flux<Item> items(String table, UUID rest) { return db.sql("SELECT id,name,active FROM " + table + " WHERE restaurante_id=:r ORDER BY name").bind("r", rest).map((row, metadata) -> new Item(row.get("id", UUID.class), row.get("name", String.class), row.get("active", Boolean.class))).all(); }
  private Mono<Item> create(String table, UUID rest, ItemInput input) { String name = input.name().trim(); UUID id = UUID.randomUUID(); return nameTaken(table, rest, name, null).flatMap(taken -> taken ? Mono.error(new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un elemento con ese nombre")) : db.sql("INSERT INTO " + table + "(id,restaurante_id,name,active) VALUES(:id,:r,:n,:a)").bind("id", id).bind("r", rest).bind("n", name).bind("a", input.active()).fetch().rowsUpdated().thenReturn(new Item(id, name, input.active()))); }
  private Mono<Item> update(String table, UUID rest, UUID id, ItemInput input) { String name = input.name().trim(); return exists(table, rest, id).flatMap(found -> { if (!found) return Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Elemento de catálogo no encontrado")); return nameTaken(table, rest, name, id).flatMap(taken -> taken ? Mono.error(new ResponseStatusException(HttpStatus.CONFLICT, "Ya existe un elemento con ese nombre")) : db.sql("UPDATE " + table + " SET name=:n,active=:a WHERE id=:id AND restaurante_id=:r").bind("id", id).bind("r", rest).bind("n", name).bind("a", input.active()).fetch().rowsUpdated().thenReturn(new Item(id, name, input.active()))); }); }
  private Mono<Void> delete(String table, UUID rest, UUID id) { return db.sql("DELETE FROM " + table + " WHERE id=:id AND restaurante_id=:r").bind("id", id).bind("r", rest).fetch().rowsUpdated().flatMap(rows -> rows == 0 ? Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "Elemento de catálogo no encontrado")) : Mono.empty()); }
  private Mono<Boolean> exists(String table, UUID rest, UUID id) { return db.sql("SELECT EXISTS(SELECT 1 FROM " + table + " WHERE id=:id AND restaurante_id=:r) present").bind("id", id).bind("r", rest).map((row, metadata) -> row.get("present", Boolean.class)).one(); }
  private Mono<Boolean> nameTaken(String table, UUID rest, String name, UUID except) { String sql = "SELECT EXISTS(SELECT 1 FROM " + table + " WHERE restaurante_id=:r AND name=:n" + (except == null ? "" : " AND id<>:id") + ") present"; DatabaseClient.GenericExecuteSpec query = db.sql(sql).bind("r", rest).bind("n", name); if (except != null) query = query.bind("id", except); return query.map((row, metadata) -> row.get("present", Boolean.class)).one(); }
}
