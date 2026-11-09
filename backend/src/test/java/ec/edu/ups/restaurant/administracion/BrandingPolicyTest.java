package ec.edu.ups.restaurant.administracion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class BrandingPolicyTest {
  @Test
  void colorsMustBeSixDigitHexAndAreNormalized() {
    assertThat(BrandingPolicy.normalizeColor(" #0a5eae ", "color")).isEqualTo("#0A5EAE");
    for (String invalid : new String[] {"0A5EAE", "#0A5", "#GGGGGG", "", null, "#0A5EAE00"}) {
      assertThatThrownBy(() -> BrandingPolicy.normalizeColor(invalid, "color")).extracting("code").isEqualTo("COLOR_INVALID");
    }
  }

  @Test
  void contrastFollowsWcagAgainstWhite() {
    assertThat(BrandingPolicy.ratio("#000000", "#FFFFFF")).isEqualByComparingTo("21");
    assertThat(BrandingPolicy.ratio("#FFFFFF", "#FFFFFF")).isEqualByComparingTo("1");
    var checks = BrandingPolicy.contrast("#0A3165", "#FFE066");
    assertThat(checks.get(0).passesAA()).isTrue();
    assertThat(checks.get(0).against()).isEqualTo("#FFFFFF");
    assertThat(checks.get(1).passesAA()).isFalse();
    assertThat(BrandingPolicy.contrast("#767676", "#777777")).extracting(BrandingPolicy.ContrastCheck::passesAA).containsExactly(true, false);
  }

  @Test
  void imageTypeComesFromTheContentNotTheName() {
    assertThat(BrandingPolicy.detectImageType(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 0})).isEqualTo("image/png");
    assertThat(BrandingPolicy.detectImageType(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0})).isEqualTo("image/jpeg");
    assertThat(BrandingPolicy.detectImageType("RIFF0000WEBPVP8 ".getBytes(StandardCharsets.US_ASCII))).isEqualTo("image/webp");
    assertThatThrownBy(() -> BrandingPolicy.detectImageType("<svg></svg>".getBytes(StandardCharsets.UTF_8))).extracting("code").isEqualTo("LOGO_INVALID_TYPE");
    assertThatThrownBy(() -> BrandingPolicy.detectImageType("GIF89a......".getBytes(StandardCharsets.US_ASCII))).extracting("code").isEqualTo("LOGO_INVALID_TYPE");
  }
}
