import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendMagicLink } from "../utils/mail";

describe("Mail Utility (Resend API)", () => {
  const testEmail = "test@example.com";
  const testUrl = "https://example.com/verify?token=abc";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Debería retornar success: true y no enviar email si está en ambiente local y no hay API Key", async () => {
    const result = await sendMagicLink(testEmail, testUrl, {
      ENVIRONMENT: "local",
    });

    expect(result.success).toBe(true);
    expect(result.delivered).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Debería retornar success: false si no hay API Key y no es ambiente local", async () => {
    const result = await sendMagicLink(testEmail, testUrl, {
      ENVIRONMENT: "production",
    });

    expect(result.success).toBe(false);
    expect(result.delivered).toBe(false);
    expect(result.error).toContain("RESEND_API_KEY no configurado");
  });

  it("Debería llamar a la API de Resend y retornar success: true si se proporciona API Key", async () => {
    (fetch as any).mockResolvedValue({
      ok: true,
      text: async () => "ok",
    });

    const result = await sendMagicLink(testEmail, testUrl, {
      RESEND_API_KEY: "re_123456",
      ENVIRONMENT: "production",
    });

    expect(result.success).toBe(true);
    expect(result.delivered).toBe(true);
    expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({
      method: "POST",
      headers: {
        Authorization: "Bearer re_123456",
        "Content-Type": "application/json",
      },
    }));
  });

  it("Debería manejar errores de respuesta de la API de Resend", async () => {
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    });

    const result = await sendMagicLink(testEmail, testUrl, {
      RESEND_API_KEY: "re_123456",
      ENVIRONMENT: "production",
    });

    expect(result.success).toBe(false);
    expect(result.delivered).toBe(false);
    expect(result.error).toContain("Error de API de Resend (400): Bad Request");
  });
});
