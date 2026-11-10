package ec.edu.ups.restaurant.security;

import static org.assertj.core.api.Assertions.assertThat;

import ec.edu.ups.restaurant.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;

/** Un 401 nunca pide al navegador su diálogo nativo: ni sin credenciales ni con credenciales incorrectas. */
class LoginErrorIntegrationTest extends IntegrationTest {
  @Test
  void wrongPasswordAnswersJsonWithoutBasicChallenge() {
    var result = client.get().uri("/api/v1/me").headers(headers -> headers.setBasicAuth(CAJA, "incorrecta")).exchange()
      .expectStatus().isUnauthorized().expectBody().jsonPath("$.code").isEqualTo("UNAUTHORIZED").returnResult();
    assertThat(result.getResponseHeaders().get(HttpHeaders.WWW_AUTHENTICATE)).isNull();
  }

  @Test
  void missingCredentialsAnswerJsonWithoutBasicChallenge() {
    var result = client.get().uri("/api/v1/me").exchange().expectStatus().isUnauthorized().expectBody().returnResult();
    assertThat(result.getResponseHeaders().get(HttpHeaders.WWW_AUTHENTICATE)).isNull();
  }
}
