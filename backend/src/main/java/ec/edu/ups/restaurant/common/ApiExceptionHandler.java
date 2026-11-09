package ec.edu.ups.restaurant.common;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.support.WebExchangeBindException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebInputException;

/** Traduce errores a {code, message}; el código es estable y no incluye el número HTTP. */
@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(ApiException.class)
  ResponseEntity<Map<String, String>> api(ApiException error) {
    return body(error.status(), error.code(), error.getMessage());
  }

  @ExceptionHandler(WebExchangeBindException.class)
  ResponseEntity<Map<String, String>> validation() {
    return body(HttpStatus.BAD_REQUEST, "VALIDATION", "Datos inválidos");
  }

  @ExceptionHandler(ServerWebInputException.class)
  ResponseEntity<Map<String, String>> input(ServerWebInputException error) {
    return body(HttpStatus.BAD_REQUEST, "BAD_REQUEST", error.getReason() == null ? "Solicitud inválida" : error.getReason());
  }

  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<Map<String, String>> denied() {
    return body(HttpStatus.FORBIDDEN, "FORBIDDEN", "No tienes permiso para esta operación");
  }

  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Map<String, String>> status(ResponseStatusException error) {
    HttpStatus status = HttpStatus.valueOf(error.getStatusCode().value());
    return body(status, status.name(), error.getReason() == null ? "Solicitud inválida" : error.getReason());
  }

  private static ResponseEntity<Map<String, String>> body(HttpStatus status, String code, String message) {
    return ResponseEntity.status(status).body(Map.of("code", code, "message", message));
  }
}
