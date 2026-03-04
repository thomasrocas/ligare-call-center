package com.ligare.callcenter;

import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

  @GetMapping("/me")
  public Map<String, Object> me(Authentication auth) {
    return Map.of(
      "user", auth.getName(),
      "roles", auth.getAuthorities().stream().map(a -> a.getAuthority()).collect(Collectors.toList())
    );
  }
}
