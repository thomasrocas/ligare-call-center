package com.ligare.callcenter;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = {"app.auth.dev-fallback=true"})
@AutoConfigureMockMvc
class AuthControllerTest {

  @Autowired
  MockMvc mvc;

  @Test
  void rejectsWithoutDevHeaders() throws Exception {
    mvc.perform(get("/api/auth/me"))
      .andExpect(status().isForbidden());
  }

  @Test
  void returnsUserWhenDevHeadersProvided() throws Exception {
    mvc.perform(get("/api/auth/me")
      .header("X-Dev-User", "dev@ligare.com")
      .header("X-Dev-Role", "SUPERVISOR"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.user").value("dev@ligare.com"))
      .andExpect(jsonPath("$.roles[0]").value("ROLE_SUPERVISOR"));
  }
}
