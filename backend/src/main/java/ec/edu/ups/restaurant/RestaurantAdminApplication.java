package ec.edu.ups.restaurant;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.security.config.annotation.method.configuration.EnableReactiveMethodSecurity;

@SpringBootApplication
@EnableReactiveMethodSecurity
public class RestaurantAdminApplication {
  public static void main(String[] args) { SpringApplication.run(RestaurantAdminApplication.class, args); }
}
