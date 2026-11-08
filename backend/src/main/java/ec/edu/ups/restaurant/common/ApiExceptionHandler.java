package ec.edu.ups.restaurant.common;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {
  @ExceptionHandler(ResponseStatusException.class)
  ResponseEntity<Map<String, String>> status(ResponseStatusException error) {
    return ResponseEntity.status(error.getStatusCode()).body(Map.of("code", error.getStatusCode().toString(), "message", error.getReason() == null ? "Solicitud inválida" : error.getReason()));
  }
  @ExceptionHandler(org.springframework.web.bind.support.WebExchangeBindException.class)
  ResponseEntity<Map<String, String>> validation() { return ResponseEntity.badRequest().body(Map.of("code", "VALIDATION", "message", "Datos inválidos")); }
}
