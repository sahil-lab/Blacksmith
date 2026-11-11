package dev.blacksmith.api;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(SystemController.class)
class SystemControllerTest {
  @Autowired private MockMvc mvc;
  @MockitoBean private JdbcTemplate jdbc;

  @Test
  void readsTheSchemaVersionFromTheDatabase() throws Exception {
    when(jdbc.queryForObject(
            "SELECT schema_version FROM bootstrap_state WHERE id = 1", Integer.class))
        .thenReturn(1);
    mvc.perform(get("/api/system"))
        .andExpect(status().isOk())
        .andExpect(
            content()
                .json(
                    """
                    {"application":"Blacksmith","phase":1,"executionMode":"SIMULATED","schemaVersion":1}
                    """,
                    org.springframework.test.json.JsonCompareMode.STRICT));
  }

  @Test
  void reportsDatabaseFailureWithoutLeakingInternalDetails() throws Exception {
    when(jdbc.queryForObject(
            "SELECT schema_version FROM bootstrap_state WHERE id = 1", Integer.class))
        .thenThrow(new DataAccessResourceFailureException("sensitive-db-internals"));
    mvc.perform(get("/api/system"))
        .andExpect(status().isServiceUnavailable())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.type").value("urn:blacksmith:problem:database-unavailable"))
        .andExpect(content().string(not(containsString("sensitive-db-internals"))));
  }

  @Test
  void doesNotInventASchemaVersionWhenBootstrapStateIsMissing() throws Exception {
    when(jdbc.queryForObject(
            "SELECT schema_version FROM bootstrap_state WHERE id = 1", Integer.class))
        .thenReturn(null);
    mvc.perform(get("/api/system")).andExpect(status().isServiceUnavailable());
  }
}
