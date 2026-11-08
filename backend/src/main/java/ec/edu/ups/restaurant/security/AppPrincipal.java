package ec.edu.ups.restaurant.security;

import java.util.Collection;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

public record AppPrincipal(UUID id, UUID restaurantId, String username, String password,
                           Collection<? extends GrantedAuthority> authorities, boolean enabled) implements UserDetails {
  @Override public Collection<? extends GrantedAuthority> getAuthorities() { return authorities; }
  @Override public String getPassword() { return password; }
  @Override public String getUsername() { return username; }
  @Override public boolean isEnabled() { return enabled; }
  @Override public boolean isAccountNonExpired() { return true; }
  @Override public boolean isAccountNonLocked() { return true; }
  @Override public boolean isCredentialsNonExpired() { return true; }
}
