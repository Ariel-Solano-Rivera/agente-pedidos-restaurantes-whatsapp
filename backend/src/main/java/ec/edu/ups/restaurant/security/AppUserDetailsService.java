package ec.edu.ups.restaurant.security;

import java.util.UUID;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.ReactiveUserDetailsService;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

@Service
public class AppUserDetailsService implements ReactiveUserDetailsService {
  private final DatabaseClient db;
  public AppUserDetailsService(DatabaseClient db) { this.db = db; }
  @Override public Mono<UserDetails> findByUsername(String username) {
    return db.sql("SELECT id, restaurante_id, email, password_hash, role, active FROM app_user WHERE email=:email")
      .bind("email", username.toLowerCase())
      .map((row, meta) -> (UserDetails) new AppPrincipal(row.get("id", UUID.class), row.get("restaurante_id", UUID.class),
        row.get("email", String.class), row.get("password_hash", String.class),
        java.util.List.of(new SimpleGrantedAuthority("ROLE_" + row.get("role", String.class))), Boolean.TRUE.equals(row.get("active", Boolean.class))))
      .one();
  }
}
