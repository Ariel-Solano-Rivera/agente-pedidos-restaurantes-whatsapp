package ec.edu.ups.restaurant.administracion;

import ec.edu.ups.restaurant.common.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;

/**
 * Reglas de la marca: formato de color, contraste WCAG 2.x y tipo real de la imagen por sus primeros bytes.
 * El contraste se mide contra el blanco #FFFFFF: es el texto sobre botones, barra lateral y acciones
 * (fondo = color de marca) y el fondo de tarjetas donde el color secundario se usa como texto o gráfico.
 */
public final class BrandingPolicy {
  public static final String WHITE = "#FFFFFF";
  public static final BigDecimal AA_NORMAL_TEXT = new BigDecimal("4.5");
  public static final int MAX_LOGO_BYTES = 2 * 1024 * 1024;

  public record ContrastCheck(String color, String usage, String against, BigDecimal ratio, boolean passesAA) {}

  private BrandingPolicy() {}

  public static String normalizeColor(String value, String field) {
    if (value == null || !value.trim().matches("#[0-9A-Fa-f]{6}")) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "COLOR_INVALID", "El " + field + " debe tener formato hexadecimal #RRGGBB");
    }
    return value.trim().toUpperCase(Locale.ROOT);
  }

  public static List<ContrastCheck> contrast(String primary, String secondary) {
    return List.of(
      check(primary, "Texto blanco sobre el color principal (botones y barra lateral)"),
      check(secondary, "Texto blanco sobre el color secundario y color secundario como texto o gráfico sobre fondo blanco"));
  }

  private static ContrastCheck check(String color, String usage) {
    BigDecimal ratio = ratio(color, WHITE).setScale(2, RoundingMode.HALF_UP);
    return new ContrastCheck(color, usage, WHITE, ratio, ratio.compareTo(AA_NORMAL_TEXT) >= 0);
  }

  /** Relación de contraste WCAG: (L1 + 0.05) / (L2 + 0.05), con L la luminancia relativa sRGB. */
  public static BigDecimal ratio(String first, String second) {
    double a = luminance(first), b = luminance(second);
    double ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    return BigDecimal.valueOf(ratio);
  }

  private static double luminance(String hex) {
    int rgb = Integer.parseInt(hex.substring(1), 16);
    return 0.2126 * channel((rgb >> 16) & 0xFF) + 0.7152 * channel((rgb >> 8) & 0xFF) + 0.0722 * channel(rgb & 0xFF);
  }

  private static double channel(int value) {
    double c = value / 255.0;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  /** Detecta PNG, JPEG o WebP por su firma; ignora la extensión y el tipo declarado por el cliente. */
  public static String detectImageType(byte[] data) {
    if (data.length >= 8 && (data[0] & 0xFF) == 0x89 && data[1] == 'P' && data[2] == 'N' && data[3] == 'G' && data[4] == 0x0D && data[5] == 0x0A && data[6] == 0x1A && data[7] == 0x0A) return "image/png";
    if (data.length >= 3 && (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8 && (data[2] & 0xFF) == 0xFF) return "image/jpeg";
    if (data.length >= 12 && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F' && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P') return "image/webp";
    throw new ApiException(HttpStatus.BAD_REQUEST, "LOGO_INVALID_TYPE", "El archivo no es una imagen PNG, JPEG o WebP válida");
  }
}
