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

describe("Blacksmith build lab", () => {
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
    const { container } = render(<App />);
    expect(await screen.findByText("API and PostgreSQL ready")).toBeVisible();
    expect(container.querySelector(".app")).toHaveAttribute("data-heat", "ready");
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
    // A real validated answer is the only automatic strike.
    expect(container.querySelector("[data-strikes]")).toHaveAttribute(
      "data-strikes",
      "1",
    );
  });

  it("shows failed readiness instead of inventing a healthy stack", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(system))
      .mockResolvedValueOnce(jsonResponse({ status: "DOWN" }, 503));
    const { container } = render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("HTTP 503");
    expect(screen.queryByText("API and PostgreSQL ready")).not.toBeInTheDocument();
    expect(container.querySelector(".app")).toHaveAttribute("data-heat", "cold");
    expect(
      screen.getByRole("button", { name: "Validate synthetic workload" }),
    ).toBeDisabled();
  });

  it("counts manual strikes and keeps motion and sound controls honest", async () => {
    readyResponses();
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByText("API and PostgreSQL ready");
    const meter = container.querySelector("[data-strikes]");
    expect(meter).toHaveAttribute("data-strikes", "0");
    await user.click(screen.getByRole("button", { name: "Strike the anvil" }));
    await user.click(screen.getByRole("button", { name: "Strike the anvil" }));
    expect(meter).toHaveAttribute("data-strikes", "2");

    await user.click(screen.getByRole("button", { name: "Pause motion" }));
    expect(screen.getByRole("button", { name: "Play motion" })).toBeVisible();
    expect(container.querySelector(".app")).toHaveAttribute("data-motion", "off");

    // No audio device exists here, so the control must not claim sound is on.
    await user.click(screen.getByRole("button", { name: "Enable sound" }));
    expect(screen.getByRole("button", { name: "Enable sound" })).toBeVisible();
  });

  it("rejects an incompatible system response", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ...system, executionMode: "REAL" }))
      .mockResolvedValueOnce(jsonResponse({ status: "UP" }));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "unexpected system response",
    );
    expect(
      screen.getByRole("button", { name: "Validate synthetic workload" }),
    ).toBeDisabled();
  });

  it("says plainly that the API is unreachable instead of echoing the browser", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { container } = render(<App />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Unable to verify the local stack: The API could not be reached. Reload after restoring the API.",
    );
    expect(alert).not.toHaveTextContent("Failed to fetch");
    expect(container.querySelector(".app")).toHaveAttribute("data-heat", "cold");
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
    expect(
      screen.getByRole("button", { name: "Validate synthetic workload" }),
    ).toBeEnabled();
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

  it("switches between real payloads and clears stale validation when the label changes", async () => {
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
    await screen.findByText("API and PostgreSQL ready");
    expect(screen.getByLabelText("Request JSON")).toHaveTextContent(
      '"simulation": true',
    );
    await user.click(screen.getByRole("button", { name: "Response" }));
    expect(screen.getByText("Your response lives here.")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Validate synthetic workload" }),
    );
    expect(await screen.findByLabelText("Response JSON")).toHaveTextContent(
      '"persisted": false',
    );
    expect(screen.getByRole("button", { name: "Response" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.clear(screen.getByRole("textbox", { name: "Workload name" }));
    await user.type(
      screen.getByRole("textbox", { name: "Workload name" }),
      "next-idea",
    );
    expect(screen.getByLabelText("Request JSON")).toHaveTextContent(
      '"workloadName": "next-idea"',
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText("200 OK")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Request" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
