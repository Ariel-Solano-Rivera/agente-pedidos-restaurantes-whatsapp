package ec.edu.ups.restaurant.support;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.reactive.AutoConfigureWebTestClient;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base de pruebas de integración: PostgreSQL real en un contenedor, migraciones Flyway V1..Vn
 * con los dos restaurantes ficticios, y la API completa con seguridad.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureWebTestClient
public abstract class IntegrationTest {
  protected static final String ADMIN = "admin@marazul.test";
  protected static final String CAJA = "caja@marazul.test";
  protected static final String COCINA = "cocina@marazul.test";
  protected static final String OTHER_ADMIN = "admin@sierraverde.test";

  static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

  static {
    POSTGRES.start();
  }

  @DynamicPropertySource
  static void database(DynamicPropertyRegistry registry) {
    String hostPort = POSTGRES.getHost() + ":" + POSTGRES.getMappedPort(5432) + "/" + POSTGRES.getDatabaseName();
    registry.add("spring.r2dbc.url", () -> "r2dbc:postgresql://" + hostPort);
    registry.add("spring.r2dbc.username", POSTGRES::getUsername);
    registry.add("spring.r2dbc.password", POSTGRES::getPassword);
    registry.add("spring.flyway.url", () -> "jdbc:postgresql://" + hostPort);
    registry.add("spring.flyway.user", POSTGRES::getUsername);
    registry.add("spring.flyway.password", POSTGRES::getPassword);
  }

  @Autowired protected WebTestClient client;
  @Autowired protected DatabaseClient db;

  protected WebTestClient as(String email) {
    return client.mutate().defaultHeaders(headers -> headers.setBasicAuth(email, "password")).build();
  }

  /** Mismo identificador que genera la semilla SQL con md5(text)::uuid. */
  protected static UUID seedId(String text) {
    try {
      String hex = HexFormat.of().formatHex(MessageDigest.getInstance("MD5").digest(text.getBytes(StandardCharsets.UTF_8)));
      return UUID.fromString(hex.replaceFirst("(\\w{8})(\\w{4})(\\w{4})(\\w{4})(\\w{12})", "$1-$2-$3-$4-$5"));
    } catch (Exception error) {
      throw new IllegalStateException(error);
    }
  }

  protected static String key() { return UUID.randomUUID().toString(); }
}
