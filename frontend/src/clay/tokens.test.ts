import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "tokens.css"), "utf8");

const REQUIRED = [
  "--clay-bg",
  "--clay-surface",
  "--clay-surface-raised",
  "--clay-surface-sunken",
  "--clay-text",
  "--clay-text-muted",
  "--clay-accent",
  "--clay-good",
  "--clay-warn",
  "--clay-radius",
  "--clay-shadow",
  "--clay-shadow-lg",
  "--clay-shadow-pressed",
  "--clay-shadow-sunken",
];

describe("clay tokens", () => {
  it("declares every required token", () => {
    for (const token of REQUIRED) {
      expect(css).toContain(`${token}:`);
    }
  });

  it("redefines the palette for the dark theme", () => {
    expect(css).toContain('[data-theme="dark"]');
    const darkBlock = css.slice(css.indexOf('[data-theme="dark"]'));
    for (const token of ["--clay-bg", "--clay-surface", "--clay-text", "--clay-accent"]) {
      expect(darkBlock).toContain(`${token}:`);
    }
  });

  it("has no unparseable colour values", () => {
    // An invalid custom property silently kills the whole stylesheet, so a
    // placeholder left in by accident must fail loudly here instead.
    const values = [...css.matchAll(/--clay-[a-z-]+:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).not.toMatch(/withheld|TODO|TBD/);
    }
  });

  it("layers three shadows so surfaces read as clay", () => {
    const shadow = css.match(/--clay-shadow:\s*([^;]+);/)?.[1] ?? "";
    expect(shadow.match(/inset/g)?.length).toBeGreaterThanOrEqual(2);
    expect(shadow).toMatch(/var\(--clay-drop\)/);
  });

  it("disables motion under prefers-reduced-motion", () => {
    expect(css).toContain("prefers-reduced-motion");
  });
});
