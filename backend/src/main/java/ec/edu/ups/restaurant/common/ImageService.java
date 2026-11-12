package ec.edu.ups.restaurant.common;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

/**
 * Imágenes del panel (fotos de platos y logo): se aceptan PNG, JPEG y WebP validados por su firma, se reducen a un lado
 * máximo y se guardan siempre como WebP (segunda ronda, bloque D). La decodificación y codificación son bloqueantes, así
 * que se ejecutan en `Schedulers.boundedElastic()`, nunca en los hilos de WebFlux. Usa `webp-imageio` (binarios nativos).
 */
@Service
public class ImageService {
  public static final int MAX_INPUT_BYTES = 2 * 1024 * 1024;
  public static final int MAX_SIDE = 1600;
  public static final float QUALITY = 0.82f;
  public static final String WEBP = "image/webp";

  public record Converted(byte[] data, int width, int height) {}

  /** Detecta PNG, JPEG o WebP por su firma; ignora la extensión y el tipo declarado por el cliente. `null` si no es ninguno. */
  public static String detectType(byte[] data) {
    if (data.length >= 8 && (data[0] & 0xFF) == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G' && data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A) return "image/png";
    if (data.length >= 3 && (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8 && (data[2] & 0xFF) == 0xFF) return "image/jpeg";
    if (data.length >= 12 && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F' && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P') return WEBP;
    return null;
  }

  /**
   * Convierte a WebP fuera de los hilos reactivos. `codePrefix` nombra los errores (`LOGO` o `IMAGE`):
   * `{prefix}_INVALID_TYPE` si no es PNG, JPEG ni WebP o no se puede decodificar.
   */
  public Mono<Converted> toWebp(byte[] input, String codePrefix) {
    return Mono.fromCallable(() -> convert(input, codePrefix)).subscribeOn(Schedulers.boundedElastic());
  }

  Converted convert(byte[] input, String codePrefix) {
    if (detectType(input) == null) throw invalid(codePrefix);
    BufferedImage source;
    try { source = ImageIO.read(new ByteArrayInputStream(input)); } catch (IOException error) { throw invalid(codePrefix); }
    if (source == null) throw invalid(codePrefix);
    BufferedImage image = fit(source);
    try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      ImageWriter writer = ImageIO.getImageWritersByMIMEType(WEBP).next();
      ImageWriteParam param = writer.getDefaultWriteParam();
      param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
      param.setCompressionType(param.getCompressionTypes()[0]); // «Lossy»
      param.setCompressionQuality(QUALITY);
      try (MemoryCacheImageOutputStream stream = new MemoryCacheImageOutputStream(out)) {
        writer.setOutput(stream);
        writer.write(null, new IIOImage(image, null, null), param);
      } finally { writer.dispose(); }
      return new Converted(out.toByteArray(), image.getWidth(), image.getHeight());
    } catch (IOException error) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, codePrefix + "_CONVERSION_FAILED", "No se pudo convertir la imagen a WebP");
    }
  }

  /** Reduce proporcionalmente hasta MAX_SIDE y normaliza el modelo de color (RGB u RGBA) para que libwebp lo acepte. */
  private static BufferedImage fit(BufferedImage source) {
    int width = source.getWidth(), height = source.getHeight();
    double scale = Math.min(1.0, (double) MAX_SIDE / Math.max(width, height));
    int targetWidth = Math.max(1, (int) Math.round(width * scale)), targetHeight = Math.max(1, (int) Math.round(height * scale));
    boolean alpha = source.getColorModel().hasAlpha();
    BufferedImage target = new BufferedImage(targetWidth, targetHeight, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
    Graphics2D graphics = target.createGraphics();
    try {
      graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
      graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
      graphics.drawImage(source, 0, 0, targetWidth, targetHeight, null);
    } finally { graphics.dispose(); }
    return target;
  }

  private static ApiException invalid(String codePrefix) {
    return new ApiException(HttpStatus.BAD_REQUEST, codePrefix + "_INVALID_TYPE", "El archivo no es una imagen PNG, JPEG o WebP válida");
  }
}
