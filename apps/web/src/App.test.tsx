import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const fetchMock = vi.fn<typeof fetch>();
const system = {
  application: "Blacksmith",
  phase: 1,
  executionMode: "SIMULATED",
  schemaVersion: 1,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readyResponses() {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(system))
    .mockResolvedValueOnce(jsonResponse({ status: "UP" }));
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("Phase 1 dashboard", () => {
  it("uses the API and validates only a simulated workload", async () => {
    readyResponses();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        workloadName: "synthetic-demo",
        executionMode: "SIMULATED",
        persisted: false,
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText("API and PostgreSQL ready")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Validate synthetic workload" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "no job was persisted or executed",
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/preflight",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ workloadName: "synthetic-demo", simulation: true }),
      }),
    );
  });

  it("shows failed readiness instead of inventing a healthy stack", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(system))
      .mockResolvedValueOnce(jsonResponse({ status: "DOWN" }, 503));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503");
    expect(screen.queryByText("API and PostgreSQL ready")).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("rejects an incompatible system response", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ...system, executionMode: "REAL" }))
      .mockResolvedValueOnce(jsonResponse({ status: "UP" }));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "unexpected system response",
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows a preflight error and allows retry", async () => {
    readyResponses();
    fetchMock.mockResolvedValueOnce(jsonResponse({ status: 400 }, 400));
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("API and PostgreSQL ready");
    await user.click(
      screen.getByRole("button", { name: "Validate synthetic workload" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Preflight failed");
    expect(screen.queryByText(/no job was persisted/)).not.toBeInTheDocument();
    expect(screen.getByRole("button")).toBeEnabled();
  });

  it("does not display execution or persistence claims from an invalid response", async () => {
    readyResponses();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        workloadName: "synthetic-demo",
        executionMode: "REAL",
        persisted: true,
      }),
    );
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText("API and PostgreSQL ready");
    await user.click(
      screen.getByRole("button", { name: "Validate synthetic workload" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "unexpected preflight response",
    );
  });
});
