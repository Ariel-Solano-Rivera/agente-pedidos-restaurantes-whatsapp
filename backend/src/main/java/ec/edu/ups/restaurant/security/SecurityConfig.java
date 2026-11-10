package ec.edu.ups.restaurant.security;

import java.nio.charset.StandardCharsets;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

@Configuration
public class SecurityConfig {
  @Bean PasswordEncoder passwordEncoder() { return PasswordEncoderFactories.createDelegatingPasswordEncoder(); }
  @Bean SecurityWebFilterChain security(ServerHttpSecurity http) {
    return http.csrf(csrf -> csrf.disable())
      .authorizeExchange(exchanges -> exchanges
        .pathMatchers("/actuator/health").permitAll()
        .pathMatchers(HttpMethod.OPTIONS, "/**").permitAll()
        .pathMatchers("/api/**").authenticated()
        .anyExchange().denyAll())
      .exceptionHandling(errors -> errors.authenticationEntryPoint((exchange, error) -> writeError(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Usuario o contraseña incorrectos.")))
      // Credenciales incorrectas: el mismo 401 JSON, sin `WWW-Authenticate`, para que el navegador no abra su diálogo nativo sobre el formulario.
      .httpBasic(basic -> basic.authenticationEntryPoint((exchange, error) -> writeError(exchange, HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Usuario o contraseña incorrectos.")))
      .build();
  }
  private Mono<Void> writeError(ServerWebExchange exchange, HttpStatus status, String code, String message) {
    var response = exchange.getResponse();
    response.setStatusCode(status);
    response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
    var body = String.format("{\"code\":\"%s\",\"message\":\"%s\"}", code, message).getBytes(StandardCharsets.UTF_8);
    return response.writeWith(Mono.just(response.bufferFactory().wrap(body)));
  }
}
