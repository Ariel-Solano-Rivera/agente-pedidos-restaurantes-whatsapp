package ec.edu.ups.restaurant.pedidos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ec.edu.ups.restaurant.common.ApiException;
import ec.edu.ups.restaurant.pedidos.OrderTransitionPolicy.Direction;
import ec.edu.ups.restaurant.pedidos.OrderTransitionPolicy.Role;
import ec.edu.ups.restaurant.pedidos.OrderTransitionPolicy.Transition;
import org.junit.jupiter.api.Test;

class OrderTransitionPolicyTest {
  @Test
  void adminAndCashierFollowTheMatrix() {
    for (Role role : new Role[] {Role.ADMIN, Role.CAJA}) {
      assertThat(OrderTransitionPolicy.allowed("PENDING_DECISION", role)).extracting(Transition::targetStatus).containsExactly("ACCEPTED", "REJECTED");
      assertThat(OrderTransitionPolicy.allowed("ACCEPTED", role)).extracting(Transition::targetStatus).containsExactly("PREPARING", "CANCELLED");
      assertThat(OrderTransitionPolicy.allowed("PREPARING", role)).containsExactly(
        new Transition("READY", Direction.FORWARD, false, false), new Transition("ACCEPTED", Direction.BACKWARD, true, false));
      assertThat(OrderTransitionPolicy.allowed("READY", role)).containsExactly(
        new Transition("COMPLETED", Direction.FORWARD, false, false), new Transition("PREPARING", Direction.BACKWARD, true, false));
    }
  }

  @Test
  void terminalStatusesHaveNoTransitions() {
    for (String status : new String[] {"COMPLETED", "REJECTED", "CANCELLED", "EXPIRED"}) {
      for (Role role : Role.values()) assertThat(OrderTransitionPolicy.allowed(status, role)).isEmpty();
    }
  }

  @Test
  void acceptedCannotGoBackToPendingDecision() {
    assertThat(OrderTransitionPolicy.allowed("ACCEPTED", Role.ADMIN)).noneMatch(item -> item.direction() == Direction.BACKWARD);
  }

  @Test
  void kitchenMovesOneStepForwardOrBackwardBetweenItsThreeColumns() {
    assertThat(OrderTransitionPolicy.allowed("PENDING_DECISION", Role.COCINA)).isEmpty();
    assertThat(OrderTransitionPolicy.allowed("ACCEPTED", Role.COCINA)).containsExactly(new Transition("PREPARING", Direction.FORWARD, false, false));
    assertThat(OrderTransitionPolicy.allowed("PREPARING", Role.COCINA)).containsExactly(
      new Transition("READY", Direction.FORWARD, false, false), new Transition("ACCEPTED", Direction.BACKWARD, true, false));
    assertThat(OrderTransitionPolicy.allowed("READY", Role.COCINA)).containsExactly(new Transition("PREPARING", Direction.BACKWARD, true, false));
    // Retroceder exige motivo también en cocina, pero «Otro» se acepta con un toque, sin texto.
    assertThatThrownBy(() -> OrderTransitionPolicy.validate("READY", "PREPARING", Role.COCINA, null, null)).extracting("code").isEqualTo("REASON_REQUIRED");
    assertThat(OrderTransitionPolicy.validate("READY", "PREPARING", Role.COCINA, "OTRO", null)).isEqualTo(OrderTransitionPolicy.RETROCESO);
    assertThat(OrderTransitionPolicy.validate("PREPARING", "ACCEPTED", Role.COCINA, "FALTA_PRODUCTO", null)).isEqualTo(OrderTransitionPolicy.RETROCESO);
    assertThatThrownBy(() -> OrderTransitionPolicy.validate("READY", "COMPLETED", Role.COCINA, null, null)).extracting("code").isEqualTo("TRANSITION_NOT_ALLOWED");
    assertThatThrownBy(() -> OrderTransitionPolicy.validate("ACCEPTED", "CANCELLED", Role.COCINA, null, null))
      .isInstanceOf(ApiException.class).extracting("code").isEqualTo("TRANSITION_NOT_ALLOWED");
  }

  @Test
  void backwardRequiresReasonCodeAndTextOnlyForOther() {
    assertThat(OrderTransitionPolicy.validate("READY", "COMPLETED", Role.CAJA, null, null)).isEqualTo(OrderTransitionPolicy.AVANCE);
    assertThatThrownBy(() -> OrderTransitionPolicy.validate("READY", "PREPARING", Role.CAJA, null, null)).extracting("code").isEqualTo("REASON_REQUIRED");
    assertThatThrownBy(() -> OrderTransitionPolicy.validate("READY", "PREPARING", Role.CAJA, "INVENTADO", null)).extracting("code").isEqualTo("REASON_INVALID");
    assertThatThrownBy(() -> OrderTransitionPolicy.validate("READY", "PREPARING", Role.CAJA, "OTRO", " ")).extracting("code").isEqualTo("REASON_TEXT_REQUIRED");
    assertThat(OrderTransitionPolicy.validate("READY", "PREPARING", Role.CAJA, "FALTA_PRODUCTO", null)).isEqualTo(OrderTransitionPolicy.RETROCESO);
    assertThat(OrderTransitionPolicy.validate("PREPARING", "ACCEPTED", Role.ADMIN, "OTRO", "Se cambió de cocinero")).isEqualTo(OrderTransitionPolicy.RETROCESO);
  }
}
