package com.ligare.callcenter;

import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class RbacProbeController {

  @GetMapping("/admin/ping")
  public Map<String, String> adminPing() {
    return Map.of("scope", "admin");
  }

  @GetMapping("/supervisor/ping")
  public Map<String, String> supervisorPing() {
    return Map.of("scope", "supervisor");
  }

  @GetMapping("/agent/ping")
  public Map<String, String> agentPing() {
    return Map.of("scope", "agent");
  }

  @GetMapping("/auditor/ping")
  public Map<String, String> auditorPing() {
    return Map.of("scope", "auditor");
  }
}
