package dev.blacksmith.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class SkeletonIT {
  @Autowired private TestRestTemplate http;
  @Autowired private JdbcTemplate jdbc;
  @Autowired private ObjectMapper json;

  @Test
  void migrationAndDatabaseBackedSystemInfoMatchTheContract() throws Exception {
    assertThat(
            jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE version = '1' AND success",
                Integer.class))
        .isEqualTo(1);
    assertThat(jdbc.queryForObject("SELECT count(*) FROM bootstrap_state", Integer.class))
        .isEqualTo(1);
    ResponseEntity<String> response = http.getForEntity("/api/system", String.class);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(json.readTree(response.getBody()))
        .isEqualTo(
            json.readTree(
                """
                {"application":"Blacksmith","phase":1,"executionMode":"SIMULATED","schemaVersion":1}
                """));
  }

  @Test
  void exposesReadinessAndLivenessWithoutDatabaseDetails() throws Exception {
    for (String probe : new String[] {"liveness", "readiness"}) {
      ResponseEntity<String> response =
          http.getForEntity("/actuator/health/" + probe, String.class);
      assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
      assertThat(json.readTree(response.getBody())).isEqualTo(json.readTree("{\"status\":\"UP\"}"));
    }
  }

  @Test
  void preflightDoesNotPersistAJobOrCreateDomainTables() throws Exception {
    ResponseEntity<String> response =
        http.postForEntity(
            "/api/preflight",
            new PreflightController.PreflightRequest("integration-demo", true),
            String.class);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    JsonNode body = json.readTree(response.getBody());
    assertThat(body.get("executionMode").asText()).isEqualTo("SIMULATED");
    assertThat(body.get("persisted").asBoolean()).isFalse();
    assertThat(
            jdbc.queryForList(
                "SELECT table_name FROM information_schema.tables "
                    + "WHERE table_schema = 'public' ORDER BY table_name",
                String.class))
        .containsExactly("bootstrap_state", "flyway_schema_history");
    assertThat(jdbc.queryForObject("SELECT count(*) FROM bootstrap_state", Integer.class))
        .isEqualTo(1);
  }

  @Test
  void rejectsNonStringLabelsWithTheProductionJsonConfiguration() {
    ResponseEntity<String> response =
        http.postForEntity(
            "/api/preflight", Map.of("workloadName", 123, "simulation", true), String.class);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
  }

  @Test
  void futureDomainRoutesAndManagementInternalsAreNotExposed() {
    for (String path : new String[] {"/jobs", "/runners", "/metrics", "/actuator/env"}) {
      assertThat(http.getForEntity(path, String.class).getStatusCode())
          .isEqualTo(HttpStatus.NOT_FOUND);
    }
  }
}
