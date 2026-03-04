package com.ligare.callcenter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http, DevFallbackAuthFilter devFilter, @Value("${app.auth.dev-fallback:false}") boolean devFallback) throws Exception {
    http
      .csrf(csrf -> csrf.disable())
      .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
      .authorizeHttpRequests(auth -> auth
        .requestMatchers("/health").permitAll()
        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()
        .requestMatchers("/api/admin/**").hasAnyRole("OWNER", "ADMIN")
        .requestMatchers("/api/supervisor/**").hasAnyRole("OWNER", "ADMIN", "SUPERVISOR")
        .requestMatchers("/api/agent/**").hasAnyRole("OWNER", "ADMIN", "SUPERVISOR", "AGENT")
        .requestMatchers("/api/auditor/**").hasAnyRole("OWNER", "ADMIN", "AUDITOR")
        .anyRequest().authenticated()
      )
      .addFilterBefore(devFilter, UsernamePasswordAuthenticationFilter.class);

    if (!devFallback) {
      http.oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
    }

    return http.build();
  }

  @Bean
  JwtAuthenticationConverter jwtAuthenticationConverter() {
    return new JwtAuthenticationConverter();
  }

  @Bean
  DevFallbackAuthFilter devFallbackAuthFilter() {
    return new DevFallbackAuthFilter();
  }
}

class DevFallbackAuthFilter extends OncePerRequestFilter {

  @Value("${app.auth.dev-fallback:false}")
  private boolean devFallback;

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    if (devFallback && SecurityContextHolder.getContext().getAuthentication() == null) {
      String user = request.getHeader("X-Dev-User");
      String role = request.getHeader("X-Dev-Role");
      if (user != null && !user.isBlank()) {
        String normalizedRole = (role == null || role.isBlank()) ? "AGENT" : role.toUpperCase();
        var auth = new UsernamePasswordAuthenticationToken(
            user,
            "N/A",
            List.of(new SimpleGrantedAuthority("ROLE_" + normalizedRole))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
      }
    }
    filterChain.doFilter(request, response);
  }
}
