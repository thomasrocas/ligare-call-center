package com.ligare.callcenter;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {"app.auth.dev-fallback=true"})
@AutoConfigureMockMvc
class RbacMatrixTest {

  @Autowired
  MockMvc mvc;

  @Test
  void agentCannotAccessAdminRoute() throws Exception {
    mvc.perform(get("/api/admin/ping")
        .header("X-Dev-User", "agent@ligare.com")
        .header("X-Dev-Role", "AGENT"))
      .andExpect(status().isForbidden());
  }

  @Test
  void adminCanAccessAdminRoute() throws Exception {
    mvc.perform(get("/api/admin/ping")
        .header("X-Dev-User", "admin@ligare.com")
        .header("X-Dev-Role", "ADMIN"))
      .andExpect(status().isOk());
  }

  @Test
  void auditorCanAccessAuditorRouteOnly() throws Exception {
    mvc.perform(get("/api/auditor/ping")
        .header("X-Dev-User", "auditor@ligare.com")
        .header("X-Dev-Role", "AUDITOR"))
      .andExpect(status().isOk());

    mvc.perform(get("/api/admin/ping")
        .header("X-Dev-User", "auditor@ligare.com")
        .header("X-Dev-Role", "AUDITOR"))
      .andExpect(status().isForbidden());
  }
}
