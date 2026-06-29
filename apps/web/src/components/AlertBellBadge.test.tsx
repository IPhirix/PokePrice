import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AlertBellBadge } from "./AlertBellBadge";

describe("AlertBellBadge", () => {
  it("renders nothing when not alerted", () => {
    const { container } = render(
      <AlertBellBadge isUpAlert={false} isDownAlert={false} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders green ping dot when isUpAlert", () => {
    const { container } = render(
      <AlertBellBadge isUpAlert={true} isDownAlert={false} />,
    );
    const ping = container.querySelector(".animate-ping");
    expect(ping).not.toBeNull();
    expect(ping!.className).toContain("bg-emerald-400");
  });

  it("renders red ping dot when isDownAlert", () => {
    const { container } = render(
      <AlertBellBadge isUpAlert={false} isDownAlert={true} />,
    );
    const ping = container.querySelector(".animate-ping");
    expect(ping).not.toBeNull();
    expect(ping!.className).toContain("bg-red-400");
  });

  it("prefers green over red when both true", () => {
    const { container } = render(
      <AlertBellBadge isUpAlert={true} isDownAlert={true} />,
    );
    const ping = container.querySelector(".animate-ping");
    expect(ping!.className).toContain("bg-emerald-400");
  });

  it("renders solid dot alongside ping dot", () => {
    const { container } = render(
      <AlertBellBadge isUpAlert={true} isDownAlert={false} />,
    );
    const dots = container.querySelectorAll(".rounded-full");
    expect(dots.length).toBe(2);
  });
});
