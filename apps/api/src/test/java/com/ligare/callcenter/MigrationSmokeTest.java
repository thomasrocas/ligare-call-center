package com.ligare.callcenter;

import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;

class MigrationSmokeTest {
  @Test
  void migrationFileExists() {
    assertNotNull(getClass().getResource("/db/migration/V1__init_schema.sql"));
  }
}
