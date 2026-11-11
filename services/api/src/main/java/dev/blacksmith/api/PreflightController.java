package dev.blacksmith.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PreflightController {
  @PostMapping("/preflight")
  public PreflightResponse validate(@Valid @RequestBody PreflightRequest request) {
    return new PreflightResponse(request.workloadName(), "SIMULATED", false);
  }

  public record PreflightRequest(
      @NotBlank
          @Size(max = 64)
          @Pattern(
              regexp = "[a-zA-Z0-9][a-zA-Z0-9._-]*",
              message =
                  "must start with a letter or digit and use only letters, digits, ., _, or -")
          String workloadName,
      @NotNull @AssertTrue(message = "must be true; real execution is disabled")
          Boolean simulation) {}

  public record PreflightResponse(String workloadName, String executionMode, boolean persisted) {}
}
