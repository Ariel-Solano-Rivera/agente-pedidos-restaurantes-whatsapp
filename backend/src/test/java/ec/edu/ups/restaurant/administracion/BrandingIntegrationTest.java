package ec.edu.ups.restaurant.administracion;

import static org.assertj.core.api.Assertions.assertThat;

import ec.edu.ups.restaurant.support.IntegrationTest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.web.reactive.function.BodyInserters;

/** Permisos, validación, tipo real del logo, límite de tamaño, auditoría y aislamiento de la marca. */
class BrandingIntegrationTest extends IntegrationTest {
  private static final ParameterizedTypeReference<Map<String, Object>> JSON = new ParameterizedTypeReference<>() {};
  private static final byte[] PNG = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");

  private org.springframework.test.web.reactive.server.WebTestClient.ResponseSpec upload(String email, byte[] data, String filename, MediaType declared) {
    var body = new MultipartBodyBuilder();
    body.part("file", new ByteArrayResource(data) { @Override public String getFilename() { return filename; } }).contentType(declared);
    return as(email).post().uri("/api/v1/admin/branding/logo").contentType(MediaType.MULTIPART_FORM_DATA).body(BodyInserters.fromMultipartData(body.build())).exchange();
  }

  @Test
  void onlyAdminChangesColorsAndEveryRoleReadsThem() {
    as(COCINA).get().uri("/api/v1/branding").exchange().expectStatus().isOk().expectBody().jsonPath("$.primaryColor").isEqualTo("#0A3165");
    as(CAJA).put().uri("/api/v1/admin/branding").bodyValue(Map.of("primaryColor", "#111111", "secondaryColor", "#222222")).exchange().expectStatus().isForbidden();
    as(ADMIN).put().uri("/api/v1/admin/branding").bodyValue(Map.of("primaryColor", "rojo", "secondaryColor", "#222222")).exchange()
      .expectStatus().isBadRequest().expectBody().jsonPath("$.code").isEqualTo("COLOR_INVALID");
    as(ADMIN).put().uri("/api/v1/admin/branding").bodyValue(Map.of("primaryColor", "#8b1e3f", "secondaryColor", "#ffd166")).exchange().expectStatus().isOk()
      .expectBody().jsonPath("$.primaryColor").isEqualTo("#8B1E3F").jsonPath("$.contrast[0].passesAA").isEqualTo(true).jsonPath("$.contrast[1].passesAA").isEqualTo(false)
      .jsonPath("$.contrast[1].against").isEqualTo("#FFFFFF");
    as(OTHER_ADMIN).get().uri("/api/v1/branding").exchange().expectStatus().isOk().expectBody().jsonPath("$.primaryColor").isEqualTo("#1F5E3B");
    Long audits = db.sql("SELECT count(*) c FROM audit_log WHERE action='BRANDING_COLORS_UPDATE'").map((row, m) -> row.get("c", Long.class)).one().block();
    assertThat(audits).isEqualTo(1L);
  }

  @Test
  void logoIsValidatedByContentSizeAndOwner() {
    upload(ADMIN, "<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_8), "logo.png", MediaType.IMAGE_PNG)
      .expectStatus().isBadRequest().expectBody().jsonPath("$.code").isEqualTo("LOGO_INVALID_TYPE");
    upload(CAJA, PNG, "logo.png", MediaType.IMAGE_PNG).expectStatus().isForbidden();
    byte[] tooLarge = new byte[2 * 1024 * 1024 + 1];
    System.arraycopy(PNG, 0, tooLarge, 0, PNG.length);
    upload(ADMIN, tooLarge, "grande.png", MediaType.IMAGE_PNG).expectStatus().isEqualTo(413).expectBody().jsonPath("$.code").isEqualTo("LOGO_TOO_LARGE");

    Map<String, Object> saved = upload(ADMIN, PNG, "logo.jpg", MediaType.IMAGE_JPEG).expectStatus().isOk().expectBody(JSON).returnResult().getResponseBody();
    assertThat(saved.get("hasLogo")).isEqualTo(true);
    // Bloque D: se acepta PNG o JPEG, pero se guarda y sirve siempre como WebP.
    byte[] logo = as(CAJA).get().uri("/api/v1/branding/logo").exchange().expectStatus().isOk().expectHeader().contentType(MediaType.parseMediaType("image/webp")).expectBody(byte[].class).returnResult().getResponseBody();
    assertThat(new String(logo, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("RIFF");
    as(OTHER_ADMIN).get().uri("/api/v1/branding/logo").exchange().expectStatus().isNotFound();

    as(ADMIN).delete().uri("/api/v1/admin/branding/logo").exchange().expectStatus().isOk().expectBody().jsonPath("$.hasLogo").isEqualTo(false);
    as(ADMIN).get().uri("/api/v1/branding/logo").exchange().expectStatus().isNotFound();
  }
}
