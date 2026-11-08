package ec.edu.ups.restaurant.administracion;

import ec.edu.ups.restaurant.security.Tenant;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1")
public class MeController {
  @GetMapping("/me")
  public Mono<Map<String, Object>> me() {
    return Tenant.principal().map(user -> Map.of("id", user.id(), "email", user.username(), "restaurantId", user.restaurantId(), "roles", user.authorities().stream().map(a -> a.getAuthority()).toList()));
  }
}
