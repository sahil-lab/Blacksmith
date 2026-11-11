import type { components } from "../../../packages/contracts/schema";

export type SystemInfo = components["schemas"]["SystemInfo"];
export type PreflightResponse = components["schemas"]["PreflightResponse"];
type PreflightRequest = components["schemas"]["PreflightRequest"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSystemInfo(value: unknown): value is SystemInfo {
  return (
    isObject(value) &&
    value.application === "Blacksmith" &&
    value.phase === 1 &&
    value.executionMode === "SIMULATED" &&
    typeof value.schemaVersion === "number" &&
    Number.isInteger(value.schemaVersion) &&
    value.schemaVersion >= 1
  );
}

function isPreflightResponse(value: unknown): value is PreflightResponse {
  return (
    isObject(value) &&
    typeof value.workloadName === "string" &&
    value.executionMode === "SIMULATED" &&
    value.persisted === false
  );
}

async function fetchJson(path: string, init: RequestInit = {}): Promise<unknown> {
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(path, {
    ...init,
    signal: init.signal ? AbortSignal.any([init.signal, timeout]) : timeout,
  });
  if (!response.ok) {
    throw new Error(`API request failed (HTTP ${response.status}).`);
  }
  const value: unknown = await response.json();
  return value;
}

export async function loadSystem(signal: AbortSignal): Promise<SystemInfo> {
  const [system, health] = await Promise.all([
    fetchJson("/api/system", { signal }),
    fetchJson("/actuator/health/readiness", { signal }),
  ]);
  if (!isObject(health) || health.status !== "UP") {
    throw new Error("API readiness is not UP.");
  }
  if (!isSystemInfo(system)) {
    throw new Error("API returned an unexpected system response.");
  }
  return system;
}

export async function validatePreflight(
  workloadName: string,
): Promise<PreflightResponse> {
  const request: PreflightRequest = { workloadName, simulation: true };
  const result = await fetchJson("/api/preflight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!isPreflightResponse(result) || result.workloadName !== workloadName) {
    throw new Error("API returned an unexpected preflight response.");
  }
  return result;
}
