import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import AlertBellButton from "../components/AlertBellButton";

describe("AlertBellButton", () => {
  it('shows "Set $ Alert" when alertPrice is null', () => {
    render(
      <AlertBellButton
        alertPrice={null}
        isUpAlert={false}
        isDownAlert={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Set $ Alert");
  });

  it('shows "Edit $ Alert" when alertPrice is set', () => {
    render(
      <AlertBellButton
        alertPrice={50}
        isUpAlert={false}
        isDownAlert={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Edit $ Alert");
  });

  it("renders no ping dot when not alerted", () => {
    const { container } = render(
      <AlertBellButton
        alertPrice={50}
        isUpAlert={false}
        isDownAlert={false}
        onClick={() => {}}
      />,
    );
    expect(container.querySelector(".animate-ping")).toBeNull();
  });

  it("renders green ping dot when isUpAlert", () => {
    const { container } = render(
      <AlertBellButton
        alertPrice={50}
        isUpAlert={true}
        isDownAlert={false}
        onClick={() => {}}
      />,
    );
    const ping = container.querySelector(".animate-ping");
    expect(ping).not.toBeNull();
    expect(ping.className).toContain("bg-emerald-400");
  });

  it("renders red ping dot when isDownAlert", () => {
    const { container } = render(
      <AlertBellButton
        alertPrice={120}
        isUpAlert={false}
        isDownAlert={true}
        onClick={() => {}}
      />,
    );
    const ping = container.querySelector(".animate-ping");
    expect(ping).not.toBeNull();
    expect(ping.className).toContain("bg-red-400");
  });

  it("applies emerald button styles when isUpAlert", () => {
    render(
      <AlertBellButton
        alertPrice={50}
        isUpAlert={true}
        isDownAlert={false}
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole("button").className).toContain("emerald");
  });

  it("applies red button styles when isDownAlert", () => {
    render(
      <AlertBellButton
        alertPrice={120}
        isUpAlert={false}
        isDownAlert={true}
        onClick={() => {}}
      />,
    );
    expect(screen.getByRole("button").className).toContain("red");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <AlertBellButton
        alertPrice={null}
        isUpAlert={false}
        isDownAlert={false}
        onClick={onClick}
      />,
    );
    screen.getByRole("button").click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("prefers green dot over red when both alerts true", () => {
    const { container } = render(
      <AlertBellButton
        alertPrice={50}
        isUpAlert={true}
        isDownAlert={true}
        onClick={() => {}}
      />,
    );
    const ping = container.querySelector(".animate-ping");
    expect(ping.className).toContain("bg-emerald-400");
  });
});
