package dev.blacksmith.api;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PreflightController.class)
@Import(JsonConfiguration.class)
class PreflightControllerTest {
  @Autowired private MockMvc mvc;

  @Test
  void validatesSyntheticInputWithoutClaimingExecutionOrPersistence() throws Exception {
    mvc.perform(
            post("/api/preflight")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"workloadName":"synthetic-demo","simulation":true}
                    """))
        .andExpect(status().isOk())
        .andExpect(
            content()
                .json(
                    """
                    {"workloadName":"synthetic-demo","executionMode":"SIMULATED","persisted":false}
                    """,
                    org.springframework.test.json.JsonCompareMode.STRICT));
  }

  @Test
  void acceptsMaximumLengthLabel() throws Exception {
    mvc.perform(
            post("/api/preflight")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"workloadName\":\"" + "a".repeat(64) + "\",\"simulation\":true}"))
        .andExpect(status().isOk());
  }

  @ParameterizedTest
  @MethodSource("invalidRequests")
  void rejectsInvalidInputAndExecutionRequests(String body) throws Exception {
    mvc.perform(post("/api/preflight").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isBadRequest())
        .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
        .andExpect(jsonPath("$.status").value(400))
        .andExpect(jsonPath("$.workloadName").doesNotExist())
        .andExpect(jsonPath("$.trace").doesNotExist());
  }

  @Test
  void providesFieldErrorsWithoutEchoingSubmittedValues() throws Exception {
    mvc.perform(
            post("/api/preflight")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {"workloadName":"secret;command","simulation":false}
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.errors[?(@.field == 'simulation')]").isNotEmpty())
        .andExpect(
            content()
                .string(
                    org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("secret;command"))));
  }

  static Stream<String> invalidRequests() {
    return Stream.of(
        "{}",
        "{\"workloadName\":\"\",\"simulation\":true}",
        "{\"workloadName\":\"   \",\"simulation\":true}",
        "{\"workloadName\":\"../escape\",\"simulation\":true}",
        "{\"workloadName\":\"$(whoami)\",\"simulation\":true}",
        "{\"workloadName\":\"" + "a".repeat(65) + "\",\"simulation\":true}",
        "{\"workloadName\":\"demo\"}",
        "{\"workloadName\":\"demo\",\"simulation\":null}",
        "{\"workloadName\":\"demo\",\"simulation\":false}",
        "{\"workloadName\":\"demo\",\"simulation\":\"true\"}",
        "{\"workloadName\":123,\"simulation\":true}",
        "{\"workloadName\":1.5,\"simulation\":true}",
        "{\"workloadName\":true,\"simulation\":true}",
        "{\"workloadName\":\"demo\",\"simulation\":true,\"command\":\"echo test\"}",
        "{\"workloadName\":\"demo\",\"simulation\":true} {}",
        "not-json");
  }
}
