package ec.edu.ups.restaurant.menu;

import static org.assertj.core.api.Assertions.assertThat;

import ec.edu.ups.restaurant.support.IntegrationTest;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.reactive.function.BodyInserters;

/** Fotos de platos (bloque D): tipo real, conversión a WebP, permisos y aislamiento; nombres de extras unificados por V14. */
class DishImageIntegrationTest extends IntegrationTest {
  private static final ParameterizedTypeReference<List<Map<String, Object>>> LIST = new ParameterizedTypeReference<>() {};
  private static final byte[] PNG = Base64.getDecoder().decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");
  private static final String DISH = "11111111-1111-1111-1111-111111111301";

  private WebTestClient.ResponseSpec upload(String email, String dish, byte[] data, MediaType declared) {
    var body = new MultipartBodyBuilder();
    body.part("file", new ByteArrayResource(data) { @Override public String getFilename() { return "foto.bin"; } }).contentType(declared);
    return as(email).post().uri("/api/v1/admin/dishes/" + dish + "/image").contentType(MediaType.MULTIPART_FORM_DATA).body(BodyInserters.fromMultipartData(body.build())).exchange();
  }

  @Test
  void dishPhotoIsValidatedByContentConvertedToWebpAndIsolated() {
    upload(CAJA, DISH, PNG, MediaType.IMAGE_PNG).expectStatus().isForbidden();
    upload(ADMIN, DISH, "<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_8), MediaType.IMAGE_PNG)
      .expectStatus().isBadRequest().expectBody().jsonPath("$.code").isEqualTo("IMAGE_INVALID_TYPE");
    upload(OTHER_ADMIN, DISH, PNG, MediaType.IMAGE_PNG).expectStatus().isNotFound();
    // El tipo declarado no importa: se detecta por contenido y se guarda como WebP.
    upload(ADMIN, DISH, PNG, MediaType.APPLICATION_OCTET_STREAM).expectStatus().isNoContent();
    byte[] stored = as(COCINA).get().uri("/api/v1/menu/dishes/" + DISH + "/image").exchange().expectStatus().isOk()
      .expectHeader().contentType(MediaType.parseMediaType("image/webp")).expectBody(byte[].class).returnResult().getResponseBody();
    assertThat(new String(stored, 0, 4, StandardCharsets.US_ASCII)).isEqualTo("RIFF");
    assertThat(new String(stored, 8, 4, StandardCharsets.US_ASCII)).isEqualTo("WEBP");
    as(OTHER_ADMIN).get().uri("/api/v1/menu/dishes/" + DISH + "/image").exchange().expectStatus().isNotFound();
    byte[] tooLarge = new byte[2 * 1024 * 1024 + 1];
    System.arraycopy(PNG, 0, tooLarge, 0, PNG.length);
    upload(ADMIN, DISH, tooLarge, MediaType.IMAGE_PNG).expectStatus().isEqualTo(413).expectBody().jsonPath("$.code").isEqualTo("IMAGE_TOO_LARGE");
  }

  @Test
  void extraNamesAreUnifiedWithoutTouchingOrderSnapshots() {
    List<Map<String, Object>> ingredients = as(ADMIN).get().uri("/api/v1/menu/catalog/ingredients").exchange().expectStatus().isOk().expectBody(LIST).returnResult().getResponseBody();
    assertThat(ingredients).extracting(item -> item.get("name")).contains("Camarón").doesNotContain("Camarón extra");
    Long extras = db.sql("SELECT count(*) n FROM extra_option WHERE name='Camarón'").map((row, meta) -> row.get("n", Long.class)).one().block();
    assertThat(extras).isEqualTo(1L);
    Long snapshots = db.sql("SELECT count(*) n FROM order_unit_option WHERE name_snapshot='Camarón extra'").map((row, meta) -> row.get("n", Long.class)).one().block();
    assertThat(snapshots).isGreaterThan(0L);
  }
}
