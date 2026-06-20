import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleMagicLink, handleVerifyMagicLink } from "../routes/auth";
import { handleCreateHogar, handleGetHogar } from "../routes/hogar";
import { handleInventoryAdd, handleInventoryRemove, handleGetInventory } from "../routes/inventory";
import { D1QueryGate, TenantContext } from "../middleware/tel";
import { authMiddleware, createToken } from "../middleware/auth";
import { JWTPayload } from "../../../shared/types";

// Setup mocks
const mockAuditProvider = {
  recordEvent: vi.fn().mockResolvedValue(undefined),
};

const mockDB = {
  prepare: vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: [] }),
    }),
  }),
  batch: vi.fn().mockResolvedValue([]),
};

const queryGate = new D1QueryGate(mockDB as any);
const env = {
  JWT_SECRET: "my-test-jwt-secret-key-32-bytes-long",
  ENCRYPTION_KEY_HEX: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  ENVIRONMENT: "local",
};

describe("Route Handlers Integration & Middlewares", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authMiddleware", () => {
    it("Debería retornar null si falta el encabezado Authorization o no empieza con Bearer", async () => {
      const req1 = new Request("https://example.com/api/v1/hogar");
      const res1 = await authMiddleware(req1, env);
      expect(res1).toBeNull();

      const req2 = new Request("https://example.com/api/v1/hogar", {
        headers: { Authorization: "Basic abc" },
      });
      const res2 = await authMiddleware(req2, env);
      expect(res2).toBeNull();
    });

    it("Debería retornar payload si el token es válido, o null si es inválido", async () => {
      const payload: Omit<JWTPayload, "exp"> = {
        userId: "user-1",
        email: "hash-email",
        hogarId: "hogar-1",
      };
      const token = await createToken(payload, env.JWT_SECRET);

      const req = new Request("https://example.com/api/v1/hogar", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const res = await authMiddleware(req, env);
      expect(res).toBeDefined();
      expect(res?.userId).toBe("user-1");
      expect(res?.hogarId).toBe("hogar-1");

      const badReq = new Request("https://example.com/api/v1/hogar", {
        headers: { Authorization: `Bearer bad-token-here` },
      });
      const badRes = await authMiddleware(badReq, env);
      expect(badRes).toBeNull();
    });
  });

  describe("Authentication Routes", () => {
    it("handleMagicLink debería validar e-mail, registrar evento y retornar token/debugUrl", async () => {
      const request = new Request("https://example.com/api/v1/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "user@biteradigital.com" }),
      });

      const response = await handleMagicLink(request, env, queryGate, mockAuditProvider);
      expect(response.status).toBe(200);

      const json = await response.json() as any;
      expect(json.success).toBe(true);
      expect(json.token).toBeDefined();
      expect(json.debugUrl).toBeDefined();
      expect(mockAuditProvider.recordEvent).toHaveBeenCalledWith(
        "SYSTEM_CONTROL_PLANE",
        "AUTH_MAGIC_LINK_REQUESTED",
        expect.any(Object)
      );
    });

    it("handleMagicLink debería retornar 400 si el email no es válido", async () => {
      const request = new Request("https://example.com/api/v1/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "invalid-email" }),
      });

      const response = await handleMagicLink(request, env, queryGate, mockAuditProvider);
      expect(response.status).toBe(400);
    });

    it("handleVerifyMagicLink debería autenticar token, persistir usuario y registrar AUTH_SUCCESS", async () => {
      const linkRequest = new Request("https://example.com/api/v1/auth/magic-link", {
        method: "POST",
        body: JSON.stringify({ email: "user@biteradigital.com" }),
      });
      const linkResp = await handleMagicLink(linkRequest, env, queryGate, mockAuditProvider);
      const { token } = await linkResp.json() as { token: string };

      const mockQueryGate = {
        executeSystemFirst: vi.fn().mockResolvedValue(null),
        executeSystemQuery: vi.fn().mockResolvedValue([]),
      } as any;

      const verifyRequest = new Request("https://example.com/api/v1/auth/verify", {
        method: "POST",
        body: JSON.stringify({ token }),
      });

      const response = await handleVerifyMagicLink(verifyRequest, env, mockQueryGate, mockAuditProvider);
      expect(response.status).toBe(200);

      const json = await response.json() as any;
      expect(json.success).toBe(true);
      expect(json.token).toBeDefined();
      expect(mockAuditProvider.recordEvent).toHaveBeenCalledWith(
        expect.any(String),
        "AUTH_SUCCESS",
        expect.any(Object),
        null
      );
    });

    it("handleVerifyMagicLink debería registrar AUTH_FAILED si el token es inválido o expira", async () => {
      const verifyRequest = new Request("https://example.com/api/v1/auth/verify", {
        method: "POST",
        body: JSON.stringify({ token: "expired-or-bad-token" }),
      });

      const response = await handleVerifyMagicLink(verifyRequest, env, queryGate, mockAuditProvider);
      expect(response.status).toBe(401);
      expect(mockAuditProvider.recordEvent).toHaveBeenCalledWith(
        "SYSTEM_CONTROL_PLANE",
        "AUTH_FAILED",
        expect.any(Object)
      );
    });
  });

  describe("Household Routes", () => {
    const sessionUser: JWTPayload = {
      userId: "user-123",
      email: "hashed-email-here",
      hogarId: null,
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it("handleCreateHogar debería crear un nuevo hogar y registrar HOGAR_CREATE", async () => {
      const request = new Request("https://example.com/api/v1/hogar", {
        method: "POST",
        body: JSON.stringify({ name: "Mi Dulce Hogar" }),
      });

      const mockQueryGate = {
        executeSystemFirst: vi.fn().mockResolvedValue(null),
        executeSystemQuery: vi.fn().mockResolvedValue([]),
      } as any;

      const response = await handleCreateHogar(request, env, mockQueryGate, sessionUser, mockAuditProvider);
      expect(response.status).toBe(200);

      const json = await response.json() as any;
      expect(json.success).toBe(true);
      expect(json.token).toBeDefined();
      expect(mockAuditProvider.recordEvent).toHaveBeenCalledWith(
        "user-123",
        "HOGAR_CREATE",
        expect.objectContaining({ name: "Mi Dulce Hogar" }),
        expect.any(String)
      );
    });

    it("handleCreateHogar debería fallar si falta el nombre", async () => {
      const request = new Request("https://example.com/api/v1/hogar", {
        method: "POST",
        body: JSON.stringify({ name: "" }),
      });

      const response = await handleCreateHogar(request, env, queryGate, sessionUser, mockAuditProvider);
      expect(response.status).toBe(400);
    });

    it("handleCreateHogar debería fallar si el usuario ya posee un hogar", async () => {
      const request = new Request("https://example.com/api/v1/hogar", {
        method: "POST",
        body: JSON.stringify({ name: "Hogar 2" }),
      });

      const mockQueryGate = {
        executeSystemFirst: vi.fn().mockResolvedValue({ id: "h-existing", name: "Hogar 1" }),
      } as any;

      const response = await handleCreateHogar(request, env, mockQueryGate, sessionUser, mockAuditProvider);
      expect(response.status).toBe(400);
    });

    it("handleGetHogar debería retornar los detalles del hogar si existe", async () => {
      const request = new Request("https://example.com/api/v1/hogar", { method: "GET" });
      const userWithHogar: JWTPayload = { ...sessionUser, hogarId: "hogar-123" };

      const mockQueryGate = {
        executeTenantFirst: vi.fn().mockResolvedValue({ id: "hogar-123", name: "Mi Despensa", owner_id: "user-123" }),
      } as any;

      const response = await handleGetHogar(request, mockQueryGate, userWithHogar);
      expect(response.status).toBe(200);
      const json = await response.json() as any;
      expect(json.success).toBe(true);
      expect(json.hogar.name).toBe("Mi Despensa");
    });

    it("handleGetHogar debería retornar 404 si el hogar no existe", async () => {
      const request = new Request("https://example.com/api/v1/hogar", { method: "GET" });
      const userWithHogar: JWTPayload = { ...sessionUser, hogarId: "hogar-123" };

      const mockQueryGate = {
        executeTenantFirst: vi.fn().mockResolvedValue(null),
      } as any;

      const response = await handleGetHogar(request, mockQueryGate, userWithHogar);
      expect(response.status).toBe(404);
    });

    it("handleGetHogar debería retornar 404 si el usuario no tiene hogar asociado", async () => {
      const request = new Request("https://example.com/api/v1/hogar", { method: "GET" });
      const response = await handleGetHogar(request, queryGate, sessionUser);
      expect(response.status).toBe(404);
    });
  });

  describe("Inventory Routes", () => {
    const sessionUser: JWTPayload = {
      userId: "user-123",
      email: "hashed-email-here",
      hogarId: "hogar-123",
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    it("handleGetInventory debería retornar el listado de inventario", async () => {
      const request = new Request("https://example.com/api/v1/inventory", { method: "GET" });
      const mockQueryGate = {
        executeTenantQuery: vi.fn().mockResolvedValue([{ id: "p-1", product_name: "Pan", quantity: 2 }]),
      } as any;

      const response = await handleGetInventory(request, mockQueryGate, sessionUser);
      expect(response.status).toBe(200);
      const json = await response.json() as any;
      expect(json.inventory).toHaveLength(1);
    });

    it("handleInventoryAdd debería aumentar stock e insertar eventos", async () => {
      const request = new Request("https://example.com/api/v1/inventory/add", {
        method: "POST",
        body: JSON.stringify({ product_name: "Yogur", quantity_delta: 4 }),
      });

      const mockQueryGate = {
        executeTenantFirst: vi.fn().mockResolvedValue(null),
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({}),
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as any;

      const response = await handleInventoryAdd(request, mockQueryGate, sessionUser, mockAuditProvider);
      expect(response.status).toBe(200);

      const json = await response.json() as any;
      expect(json.success).toBe(true);
      expect(json.product.quantity).toBe(4);
      expect(mockAuditProvider.recordEvent).toHaveBeenCalledWith(
        "user-123",
        "STOCK_MUTATION_ADD",
        expect.objectContaining({ product_name: "Yogur", quantity_delta: 4 }),
        "hogar-123"
      );
    });

    it("handleInventoryRemove debería reducir stock y retornar 200", async () => {
      const request = new Request("https://example.com/api/v1/inventory/remove", {
        method: "POST",
        body: JSON.stringify({ product_name: "Yogur", quantity_delta: 2 }),
      });

      const mockQueryGate = {
        executeTenantFirst: vi.fn().mockResolvedValue({ id: "p-1", product_name: "Yogur", quantity: 5 }),
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({}),
        }),
        batch: vi.fn().mockResolvedValue([]),
      } as any;

      const response = await handleInventoryRemove(request, mockQueryGate, sessionUser, mockAuditProvider);
      expect(response.status).toBe(200);
      const json = await response.json() as any;
      expect(json.product.quantity).toBe(3);
      expect(mockAuditProvider.recordEvent).toHaveBeenCalledWith(
        "user-123",
        "STOCK_MUTATION_REMOVE",
        expect.objectContaining({ product_name: "Yogur", quantity_delta: 2 }),
        "hogar-123"
      );
    });

    it("handleInventoryRemove debería retornar 400 si el stock final es negativo (invariante)", async () => {
      const request = new Request("https://example.com/api/v1/inventory/remove", {
        method: "POST",
        body: JSON.stringify({ product_name: "Yogur", quantity_delta: 10 }),
      });

      const mockQueryGate = {
        executeTenantFirst: vi.fn().mockResolvedValue({ id: "p-1", product_name: "Yogur", quantity: 5 }),
      } as any;

      const response = await handleInventoryRemove(request, mockQueryGate, sessionUser, mockAuditProvider);
      expect(response.status).toBe(400);
    });
  });
});
