package dev.blacksmith.api;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class SystemController {
  private final JdbcTemplate jdbc;

  public SystemController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping("/system")
  public SystemInfo systemInfo() {
    Integer schemaVersion =
        jdbc.queryForObject(
            "SELECT schema_version FROM bootstrap_state WHERE id = 1", Integer.class);
    if (schemaVersion == null) {
      throw new DataIntegrityViolationException("Bootstrap schema version is missing");
    }
    return new SystemInfo("Blacksmith", 1, "SIMULATED", schemaVersion);
  }

  public record SystemInfo(
      String application, int phase, String executionMode, int schemaVersion) {}
}
