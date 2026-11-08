package ec.edu.ups.restaurant.security;

import java.util.UUID;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import reactor.core.publisher.Mono;

public final class Tenant {
  private Tenant() {}
  public static Mono<AppPrincipal> principal() {
    return ReactiveSecurityContextHolder.getContext().map(context -> (AppPrincipal) context.getAuthentication().getPrincipal());
  }
  public static Mono<UUID> restaurantId() { return principal().map(AppPrincipal::restaurantId); }
}
