package ec.edu.ups.restaurant.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/** Conversión a WebP: tipo real, reducción al lado máximo, transparencia y rechazo de archivos que no son imagen. */
class ImageServiceTest {
  private final ImageService service = new ImageService();

  private static byte[] png(int width, int height, boolean alpha) throws Exception {
    BufferedImage image = new BufferedImage(width, height, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
    var graphics = image.createGraphics();
    graphics.setColor(Color.ORANGE); graphics.fillRect(0, 0, width, height);
    graphics.dispose();
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    ImageIO.write(image, "png", out);
    return out.toByteArray();
  }

  @Test
  void convertsPngAndJpegToWebpAndKeepsSmallImagesAsTheyAre() throws Exception {
    ImageService.Converted converted = service.convert(png(300, 200, false), "IMAGE");
    assertThat(ImageService.detectType(converted.data())).isEqualTo("image/webp");
    assertThat(converted.width()).isEqualTo(300);
    assertThat(converted.height()).isEqualTo(200);
    BufferedImage back = ImageIO.read(new ByteArrayInputStream(converted.data()));
    assertThat(back.getWidth()).isEqualTo(300);

    ByteArrayOutputStream jpeg = new ByteArrayOutputStream();
    ImageIO.write(ImageIO.read(new ByteArrayInputStream(png(40, 40, false))), "jpg", jpeg);
    assertThat(ImageService.detectType(service.convert(jpeg.toByteArray(), "LOGO").data())).isEqualTo("image/webp");
    // Un WebP de entrada también se acepta y se vuelve a guardar como WebP.
    assertThat(ImageService.detectType(service.convert(converted.data(), "IMAGE").data())).isEqualTo("image/webp");
  }

  @Test
  void shrinksToTheMaximumSideKeepingProportionAndTransparency() throws Exception {
    ImageService.Converted converted = service.convert(png(3200, 800, true), "IMAGE");
    assertThat(converted.width()).isEqualTo(1600);
    assertThat(converted.height()).isEqualTo(400);
    assertThat(converted.data().length).isLessThan(ImageService.MAX_INPUT_BYTES);
  }

  @Test
  void rejectsFilesThatAreNotImagesWithTheCallerPrefix() {
    assertThatThrownBy(() -> service.convert("<svg xmlns='http://www.w3.org/2000/svg'/>".getBytes(StandardCharsets.UTF_8), "LOGO"))
      .isInstanceOf(ApiException.class).extracting("code").isEqualTo("LOGO_INVALID_TYPE");
    byte[] truncated = new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3};
    assertThatThrownBy(() -> service.convert(truncated, "IMAGE")).isInstanceOf(ApiException.class).extracting("code").isEqualTo("IMAGE_INVALID_TYPE");
  }
}
