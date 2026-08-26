import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { signInEmail, signInSocial, signUpEmail, push } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  signUpEmail: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/shared/lib/auth-client", () => ({
  authClient: {
    signIn: { email: signInEmail, social: signInSocial },
    signUp: { email: signUpEmail },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(),
}));

import { AuthForm } from "./AuthForm";

/** Lo que devuelve el cliente cuando el servidor responde con un status de error. */
const rejected = (message: string, status: number) => ({
  data: null,
  error: { message, status, statusText: "Forbidden" },
});

/** Lo que devuelve cuando el navegador ya se está yendo al proveedor. */
const redirecting = { data: { url: "https://accounts.google.com/o/oauth2", redirect: true }, error: null };

const googleButton = () => screen.getByRole("button", { name: /Google|Redirigiendo/ });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthForm · login social", () => {
  it("un rechazo del proveedor suelta los botones y manda al correo", async () => {
    signInSocial.mockResolvedValue(rejected("Invalid origin", 403));
    render(<AuthForm mode="login" />);

    await userEvent.click(googleButton());

    expect(screen.getByText(/No se pudo conectar con Google\. Intenta con tu correo\./)).toBeDefined();
    expect(googleButton().hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("button", { name: /Entrar/ }).hasAttribute("disabled")).toBe(false);
  });

  it("si la petición no llega, invita a reintentar en vez de quedarse girando", async () => {
    signInSocial.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AuthForm mode="login" />);

    await userEvent.click(googleButton());

    expect(screen.getByText(/Revisa tu conexión y vuelve a intentarlo/)).toBeDefined();
    expect(googleButton().hasAttribute("disabled")).toBe(false);
  });

  it("nombra el proveedor que falló", async () => {
    signInSocial.mockResolvedValue(rejected("Provider not found", 400));
    render(<AuthForm mode="login" />);

    await userEvent.click(screen.getByRole("button", { name: /GitHub/ }));

    expect(screen.getByText(/No se pudo conectar con GitHub/)).toBeDefined();
  });

  it("cuando sale bien el botón se queda ocupado hasta que cambie la página", async () => {
    signInSocial.mockResolvedValue(redirecting);
    render(<AuthForm mode="login" />);

    await userEvent.click(googleButton());

    expect(screen.getByText("Redirigiendo…")).toBeDefined();
    expect(googleButton().hasAttribute("disabled")).toBe(true);
    expect(screen.queryByText(/No se pudo/)).toBeNull();
  });
});

describe("AuthForm · login con correo", () => {
  async function fillAndSubmit() {
    await userEvent.type(screen.getByLabelText("Email"), "elias@kino.app");
    await userEvent.type(screen.getByLabelText("Contraseña"), "contraseña");
    await userEvent.click(screen.getByRole("button", { name: /Entrar/ }));
  }

  it("enseña el motivo que da el servidor", async () => {
    signInEmail.mockResolvedValue(rejected("Invalid email or password", 401));
    render(<AuthForm mode="login" />);

    await fillAndSubmit();

    expect(screen.getByText("Invalid email or password")).toBeDefined();
    expect(push).not.toHaveBeenCalled();
  });

  it("si la petición no llega, lo dice y deja reintentar", async () => {
    signInEmail.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<AuthForm mode="login" />);

    await fillAndSubmit();

    expect(screen.getByText(/Revisa tu conexión y vuelve a intentarlo/)).toBeDefined();
    expect(screen.getByRole("button", { name: /Entrar/ }).hasAttribute("disabled")).toBe(false);
  });
});
