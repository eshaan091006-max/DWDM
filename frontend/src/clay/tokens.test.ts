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

  it("uses hard offset shadows with no blur", () => {
    // Brutalism's material logic: a shadow is a displaced solid block, not a
    // soft halo. `5px 5px 0` — the third length, the blur radius, must be zero.
    const shadow = css.match(/--clay-shadow:\s*([^;]+);/)?.[1] ?? "";
    expect(shadow).toMatch(/^\d+px\s+\d+px\s+0\s/);
    expect(shadow).not.toMatch(/inset/);
  });

  it("has square corners everywhere", () => {
    for (const token of ["--clay-radius-sm", "--clay-radius", "--clay-radius-lg"]) {
      const value = css.match(new RegExp(`${token}:\\s*([^;]+);`))?.[1]?.trim();
      expect(value).toBe("0px");
    }
  });

  it("declares a visible ink border, since structure is exposed not implied", () => {
    const border = css.match(/--clay-border:\s*([^;]+);/)?.[1] ?? "";
    expect(border).toMatch(/solid/);
    expect(border).toMatch(/var\(--clay-ink\)/);
  });

  it("commits to monospace rather than a rounded humanist face", () => {
    const mono = css.match(/--clay-font-mono:\s*([^;]+);/)?.[1] ?? "";
    expect(mono).toMatch(/monospace/);
  });

  it("gives each algorithm one flat accent, never a gradient pair", () => {
    for (const algo of ["dbscan", "birch", "cure"]) {
      const block = css.slice(css.indexOf(`[data-algo="${algo}"]`));
      const accent = block.match(/--clay-accent:\s*([^;]+);/)?.[1]?.trim();
      const accent2 = block.match(/--clay-accent-2:\s*([^;]+);/)?.[1]?.trim();
      expect(accent).toMatch(/^#[0-9a-f]{6}$/i);
      // A single flat colour: the pair must match, so no gradient can form.
      expect(accent2).toBe(accent);
    }
  });

  it("meets 4.5:1 on every status fill, in both themes", () => {
    // Badge text is 11px bold — normal size for WCAG, so 4.5:1 applies.
    // White on the warn orange is only 3.57:1 and white on the dark theme's
    // lighter green is 1.91:1, which is why these text colours are tokens
    // rather than a hardcoded #fff.
    const channel = (c: number) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const luminance = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return (
        0.2126 * channel((n >> 16) & 255) +
        0.7152 * channel((n >> 8) & 255) +
        0.0722 * (n & 255 ? channel(n & 255) : 0)
      );
    };
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const token = (name: string, scope = css) =>
      scope.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];

    const light = css.slice(0, css.indexOf('[data-theme="dark"]'));
    const dark = css.slice(css.indexOf('[data-theme="dark"]'));

    const pairs: [string, string, string][] = [
      ["warn (light)", token("--clay-warn-text", light)!, token("--clay-warn", light)!],
      ["good (light)", token("--clay-good-text", light)!, token("--clay-good", light)!],
      ["good (dark)", token("--clay-good-text", dark)!, token("--clay-good", dark)!],
    ];

    for (const [label, fg, bg] of pairs) {
      expect(fg, `${label}: missing token`).toBeTruthy();
      expect(bg, `${label}: missing token`).toBeTruthy();
      expect(ratio(fg, bg), `${label} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("stops the marquee under prefers-reduced-motion", () => {
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    expect(reduced).toMatch(/\.clay-marquee-track/);
    expect(reduced).toMatch(/animation:\s*none/);
  });

  it("disables motion under prefers-reduced-motion", () => {
    expect(css).toContain("prefers-reduced-motion");
  });
});
