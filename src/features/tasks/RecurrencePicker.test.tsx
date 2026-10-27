/**
 * Criterio: tocar de nuevo la ficha activa de la repetición no hace nada. Con
 * "Otra regla" activa, volver a tocarla no borra la regla escrita.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RecurrencePicker } from "./RecurrencePicker";

describe("RecurrencePicker", () => {
  it("D5: tocar otra vez Otra regla conserva la regla personalizada", () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value="FREQ=WEEKLY;BYDAY=MO,WE" onChange={onChange} />);

    const otra = screen.getByRole("button", { name: "Otra regla" });
    expect(otra).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(otra);

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("FREQ=WEEKLY;BYDAY=MO,WE")).toBeInTheDocument();
  });

  it("elegir Otra regla desde una ficha de las de siempre limpia la regla hasta que se escriba una", () => {
    const onChange = vi.fn();
    render(<RecurrencePicker value="FREQ=DAILY" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Otra regla" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
