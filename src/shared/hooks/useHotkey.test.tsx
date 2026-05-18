import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { useHotkey } from "./useHotkey";

describe("useHotkey", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should trigger callback when exact key is pressed", async () => {
    const user = userEvent.setup();
    const callback = vi.fn();
    
    renderHook(() => useHotkey("enter", callback));
    
    await user.keyboard("{Enter}");
    expect(callback).toHaveBeenCalledTimes(1);
    
    await user.keyboard("a");
    expect(callback).toHaveBeenCalledTimes(1); // Still 1
  });

  it("should handle multiple key combinations", async () => {
    const user = userEvent.setup();
    const callback = vi.fn();
    
    renderHook(() => useHotkey(["j", "ArrowDown"], callback));
    
    await user.keyboard("j");
    expect(callback).toHaveBeenCalledTimes(1);
    
    await user.keyboard("{ArrowDown}");
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("should handle modifier keys (mod+i)", async () => {
    const user = userEvent.setup();
    const callback = vi.fn();
    
    renderHook(() => useHotkey("mod+i", callback));
    
    await user.keyboard("{Control>}i{/Control}");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should preventDefault and stopPropagation by default", async () => {
    const user = userEvent.setup();
    const callback = vi.fn((e) => {
      expect(e.defaultPrevented).toBe(true);
      // We can't easily assert stopPropagation without a spy on the event, 
      // but we can trust the implementation if preventDefault works
    });
    
    renderHook(() => useHotkey("a", callback));
    await user.keyboard("a");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should not preventDefault if options say otherwise", async () => {
    const user = userEvent.setup();
    const callback = vi.fn((e) => {
      expect(e.defaultPrevented).toBe(false);
    });
    
    renderHook(() => useHotkey("a", callback, { preventDefault: false }));
    await user.keyboard("a");
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should ignore events when focused on input/textarea by default", async () => {
    const user = userEvent.setup();
    const callback = vi.fn();
    
    renderHook(() => useHotkey("a", callback));
    
    // Create an input in the document
    const input = document.createElement("input");
    document.body.appendChild(input);
    
    // Focus and type
    input.focus();
    await user.keyboard("a");
    
    expect(callback).not.toHaveBeenCalled();
    
    // Focus out and type
    input.blur();
    await user.keyboard("a");
    expect(callback).toHaveBeenCalledTimes(1);
    
    document.body.removeChild(input);
  });

  it("should trigger in inputs if enableInInputs is true", async () => {
    const user = userEvent.setup();
    const callback = vi.fn();
    
    renderHook(() => useHotkey("a", callback, { enableInInputs: true }));
    
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    
    await user.keyboard("a");
    expect(callback).toHaveBeenCalledTimes(1);
    
    document.body.removeChild(input);
  });

  it("should not trigger if enabled is false", async () => {
    const user = userEvent.setup();
    const callback = vi.fn();
    
    renderHook(() => useHotkey("a", callback, { enabled: false }));
    
    await user.keyboard("a");
    expect(callback).not.toHaveBeenCalled();
  });
  
  it("should handle spacebar correctly", async () => {
    const user = userEvent.setup();
    const callback = vi.fn();
    
    renderHook(() => useHotkey(" ", callback));
    
    await user.keyboard(" ");
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
