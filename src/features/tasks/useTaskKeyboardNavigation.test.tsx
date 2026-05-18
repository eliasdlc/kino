import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { useTaskKeyboardNavigation } from "./useTaskKeyboardNavigation";
import type { Task } from "./tasks.types";

const mockTasks: Task[] = [
  { id: "task-1", title: "Task 1", status: "backlog" } as Task,
  { id: "task-2", title: "Task 2", status: "today" } as Task,
  { id: "task-3", title: "Task 3", status: "done" } as Task,
];

describe("useTaskKeyboardNavigation", () => {
  let handlers: Parameters<typeof useTaskKeyboardNavigation>[1];

  beforeEach(() => {
    handlers = {
      onSelect: vi.fn(),
      onToggle: vi.fn(),
      onDelete: vi.fn(),
    };
  });

  it("should initialize with no task focused", () => {
    const { result } = renderHook(() =>
      useTaskKeyboardNavigation(mockTasks, handlers)
    );
    expect(result.current.focusedTaskId).toBeNull();
  });

  it("should move focus down with j/ArrowDown", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() =>
      useTaskKeyboardNavigation(mockTasks, handlers)
    );

    await user.keyboard("j");
    expect(result.current.focusedTaskId).toBe("task-1");

    await user.keyboard("{ArrowDown}");
    expect(result.current.focusedTaskId).toBe("task-2");
  });

  it("should move focus up with k/ArrowUp", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() =>
      useTaskKeyboardNavigation(mockTasks, handlers)
    );

    // Focus last item first
    act(() => {
      result.current.setFocusedIndex(2);
    });
    expect(result.current.focusedTaskId).toBe("task-3");

    await user.keyboard("k");
    expect(result.current.focusedTaskId).toBe("task-2");

    await user.keyboard("{ArrowUp}");
    expect(result.current.focusedTaskId).toBe("task-1");

    // Shouldn't go below 0
    await user.keyboard("k");
    expect(result.current.focusedTaskId).toBe("task-1");
  });

  it("should call onSelect when Enter is pressed on a focused task", async () => {
    const user = userEvent.setup();
    renderHook(() => useTaskKeyboardNavigation(mockTasks, handlers));

    await user.keyboard("j"); // Focus task-1
    await user.keyboard("{Enter}");

    expect(handlers.onSelect).toHaveBeenCalledWith(mockTasks[0]);
  });

  it("should call onToggle when Space or e is pressed on a focused task", async () => {
    const user = userEvent.setup();
    renderHook(() => useTaskKeyboardNavigation(mockTasks, handlers));

    await user.keyboard("j"); // Focus task-1
    await user.keyboard(" ");
    expect(handlers.onToggle).toHaveBeenCalledWith("task-1");

    await user.keyboard("j"); // Focus task-2
    await user.keyboard("e");
    expect(handlers.onToggle).toHaveBeenCalledWith("task-2");
  });

  it("should call onDelete when Backspace or Delete is pressed on a focused task", async () => {
    const user = userEvent.setup();
    renderHook(() => useTaskKeyboardNavigation(mockTasks, handlers));

    await user.keyboard("j"); // Focus task-1
    await user.keyboard("{Backspace}");
    expect(handlers.onDelete).toHaveBeenCalledWith(mockTasks[0]);

    await user.keyboard("j"); // Focus task-2
    await user.keyboard("{Delete}");
    expect(handlers.onDelete).toHaveBeenCalledWith(mockTasks[1]);
  });

  it("should not trigger handlers when disabled", async () => {
    const user = userEvent.setup();
    const { result } = renderHook(() =>
      useTaskKeyboardNavigation(mockTasks, handlers, { enabled: false })
    );

    await user.keyboard("j");
    expect(result.current.focusedTaskId).toBeNull(); // Shouldn't move focus

    // Force focus
    act(() => {
      result.current.setFocusedIndex(0);
    });

    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    await user.keyboard("{Backspace}");

    expect(handlers.onSelect).not.toHaveBeenCalled();
    expect(handlers.onToggle).not.toHaveBeenCalled();
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });

  it("should reset focus if tasks array shrinks below focused index", () => {
    const { result, rerender } = renderHook(
      ({ tasks }) => useTaskKeyboardNavigation(tasks, handlers),
      { initialProps: { tasks: mockTasks } }
    );

    act(() => {
      result.current.setFocusedIndex(2);
    });
    expect(result.current.focusedTaskId).toBe("task-3");

    // Shrink array
    rerender({ tasks: mockTasks.slice(0, 1) });
    expect(result.current.focusedTaskId).toBe("task-1");
  });
});
