package dev.blacksmith.api;

import java.net.URI;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
  private static final Logger LOG = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @Override
  protected ResponseEntity<Object> handleMethodArgumentNotValid(
      MethodArgumentNotValidException exception,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    List<FieldIssue> issues =
        exception.getBindingResult().getFieldErrors().stream()
            .map(error -> new FieldIssue(error.getField(), error.getDefaultMessage()))
            .distinct()
            .toList();
    LOG.warn(
        "Request rejected: code=validation fields={}",
        issues.stream().map(FieldIssue::field).distinct().toList());
    ProblemDetail problem =
        problem(HttpStatus.BAD_REQUEST, "validation", "Request failed validation.");
    problem.setProperty("errors", issues);
    return handleExceptionInternal(exception, problem, headers, status, request);
  }

  @Override
  protected ResponseEntity<Object> handleHttpMessageNotReadable(
      HttpMessageNotReadableException exception,
      HttpHeaders headers,
      HttpStatusCode status,
      WebRequest request) {
    LOG.warn("Request rejected: code=invalid-json");
    return handleExceptionInternal(
        exception,
        problem(
            HttpStatus.BAD_REQUEST,
            "invalid-json",
            "Request body must match the documented JSON schema."),
        headers,
        status,
        request);
  }

  @ExceptionHandler(DataAccessException.class)
  public ProblemDetail handleDataAccess(DataAccessException exception) {
    LOG.error("Database query failed: exceptionType={}", exception.getClass().getSimpleName());
    return problem(
        HttpStatus.SERVICE_UNAVAILABLE,
        "database-unavailable",
        "Database is unavailable. Check readiness and retry later.");
  }

  private static ProblemDetail problem(HttpStatus status, String code, String detail) {
    ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
    problem.setType(URI.create("urn:blacksmith:problem:" + code));
    return problem;
  }

  public record FieldIssue(String field, String message) {}
}
