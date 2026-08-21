import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClayBadge, ClayButton, ClaySelect, ClaySlider, ClayTabs, ClayToggle } from ".";

describe("clay primitives", () => {
  it("ClayButton fires onClick and respects disabled", () => {
    const onClick = vi.fn();
    const { rerender } = render(<ClayButton onClick={onClick}>Run</ClayButton>);
    fireEvent.click(screen.getByText("Run"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <ClayButton onClick={onClick} disabled>
        Run
      </ClayButton>,
    );
    fireEvent.click(screen.getByText("Run"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("ClaySlider reports numbers, not strings", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={1} step={0.1} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("eps"), { target: { value: "0.7" } });
    expect(onChange).toHaveBeenCalledWith(0.7);
  });

  it("ClaySlider shows the current value in its editable field", () => {
    render(<ClaySlider label="eps" value={0.42} min={0} max={1} step={0.01} onChange={() => {}} />);
    expect((screen.getByLabelText("eps value") as HTMLInputElement).value).toBe("0.42");
  });

  it("ClaySlider accepts an exact typed value on blur", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={5} step={0.01} onChange={onChange} />);
    const field = screen.getByLabelText("eps value");
    fireEvent.change(field, { target: { value: "0.3" } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(0.3);
  });

  it("ClaySlider commits a typed value on Enter", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={5} step={0.01} onChange={onChange} />);
    const field = screen.getByLabelText("eps value");
    fireEvent.change(field, { target: { value: "1.25" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(1.25);
  });

  it("ClaySlider does not fire onChange for every keystroke while typing", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={5} step={0.01} onChange={onChange} />);
    // "0." is not yet a value the user means; committing it mid-type would
    // clobber the field out from under them.
    fireEvent.change(screen.getByLabelText("eps value"), { target: { value: "0." } });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ClaySlider clamps a typed value above the maximum", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={5} step={0.01} onChange={onChange} />);
    const field = screen.getByLabelText("eps value");
    fireEvent.change(field, { target: { value: "999" } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("ClaySlider clamps a typed value below the minimum", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="minPts" value={5} min={1} max={50} step={1} onChange={onChange} />);
    const field = screen.getByLabelText("minPts value");
    fireEvent.change(field, { target: { value: "-4" } });
    fireEvent.blur(field);
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("ClaySlider reverts junk input instead of reporting NaN", () => {
    const onChange = vi.fn();
    render(<ClaySlider label="eps" value={0.5} min={0} max={5} step={0.01} onChange={onChange} />);
    const field = screen.getByLabelText("eps value");
    fireEvent.change(field, { target: { value: "abc" } });
    fireEvent.blur(field);
    expect(onChange).not.toHaveBeenCalled();
    expect((field as HTMLInputElement).value).toBe("0.5");
  });

  it("ClayToggle flips its value", () => {
    const onChange = vi.fn();
    render(<ClayToggle label="Auto-run" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Auto-run"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("ClayTabs marks the active tab and reports changes", () => {
    const onChange = vi.fn();
    render(
      <ClayTabs
        tabs={[
          { id: "a", label: "DBSCAN" },
          { id: "b", label: "BIRCH" },
        ]}
        active="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByText("DBSCAN").getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByText("BIRCH"));
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("ClaySelect reports the chosen value", () => {
    const onChange = vi.fn();
    render(
      <ClaySelect
        label="Metric"
        value="euclidean"
        options={[
          { value: "euclidean", label: "Euclidean" },
          { value: "manhattan", label: "Manhattan" },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("Metric"), { target: { value: "manhattan" } });
    expect(onChange).toHaveBeenCalledWith("manhattan");
  });

  it("ClayBadge renders its children", () => {
    render(<ClayBadge tone="good">3 clusters</ClayBadge>);
    expect(screen.getByText("3 clusters")).toBeDefined();
  });
});
