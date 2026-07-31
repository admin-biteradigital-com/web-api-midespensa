import { describe, it, expect, beforeEach, vi } from "vitest";
// @ts-ignore
import { createRequire } from "module";

// @ts-ignore
const require = createRequire(import.meta.url);

const { EventBus, DOMAIN_EVENTS } = require("../../../client/core/event-bus.js");
const { SessionModule } = require("../../../client/session/session-manager.js");

// Mock LocalStorage
const localStorageMock = (function () {
  let store: { [key: string]: string } = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    removeItem(key: string) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
})();

// Assign localStorage to globalThis (required by SessionModule internals)
(globalThis as any).localStorage = localStorageMock;

// Initialize SessionModule via Dependency Injection (no global EventBus)
SessionModule.initialize(EventBus, DOMAIN_EVENTS);

// Helper to create a fake JWT token with a given payload for testing.
// This does NOT sign the token; it only creates a decodable Base64 payload.
function createTestJWT(payload: Record<string, any>): string {
  const base64Url = (str: string) =>
    btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = base64Url(JSON.stringify({ alg: "HS256" }));
  const body = base64Url(JSON.stringify(payload));
  const signature = "test-signature";
  return `${header}.${body}.${signature}`;
}

// Standard valid JWT claims for most tests
const VALID_JWT_CLAIMS = {
  userId: "user-123",
  email: "hash-abc",
  hogarId: "hogar-456",
  typ: "session",
  iss: "biteradigital:midespensa:auth",
  aud: "biteradigital:midespensa:app",
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
};

// ============================================================================
// DOMAIN_EVENTS Contract Tests
// ============================================================================

describe("Phase 1.1: DOMAIN_EVENTS Contract", () => {
  it("should export a frozen DOMAIN_EVENTS object", () => {
    expect(DOMAIN_EVENTS).toBeDefined();
    expect(Object.isFrozen(DOMAIN_EVENTS)).toBe(true);
  });

  it("should contain all five required domain event names", () => {
    expect(DOMAIN_EVENTS.USER_AUTHENTICATED).toBe("UserAuthenticated");
    expect(DOMAIN_EVENTS.SESSION_RESTORED).toBe("SessionRestored");
    expect(DOMAIN_EVENTS.SESSION_CLEARED).toBe("SessionCleared");
    expect(DOMAIN_EVENTS.SESSION_EXPIRED).toBe("SessionExpired");
    expect(DOMAIN_EVENTS.SESSION_RECONCILED).toBe("SessionReconciled");
  });

  it("should reject mutations to the DOMAIN_EVENTS contract", () => {
    expect(() => {
      (DOMAIN_EVENTS as any).NEW_EVENT = "ShouldFail";
    }).toThrow();
  });
});

// ============================================================================
// EventBus Infrastructure Tests
// ============================================================================

describe("Phase 1.1: EventBus Infrastructure", () => {
  it("should register and trigger listeners correctly", () => {
    let fired = false;
    let receivedData: any = null;

    const cb = (data: any) => {
      fired = true;
      receivedData = data;
    };

    EventBus.on("test-event", cb);
    EventBus.dispatch("test-event", { value: 42 });

    expect(fired).toBe(true);
    expect(receivedData).toEqual({ value: 42 });

    EventBus.off("test-event", cb);
  });

  it("should isolate subscriber errors so other subscribers still run", () => {
    let secondFired = false;

    const badCb = () => {
      throw new Error("Subscriber failure simulation");
    };
    const goodCb = () => {
      secondFired = true;
    };

    EventBus.on("fail-test", badCb);
    EventBus.on("fail-test", goodCb);

    expect(() => EventBus.dispatch("fail-test", {})).not.toThrow();
    expect(secondFired).toBe(true);

    EventBus.off("fail-test", badCb);
    EventBus.off("fail-test", goodCb);
  });

  it("should deep-freeze payloads to guarantee full immutability", () => {
    let intercepted: any = null;
    const cb = (data: any) => {
      intercepted = data;
    };

    EventBus.on("freeze-test", cb);
    EventBus.dispatch("freeze-test", { prop: "value", nested: { deep: true } });

    // Top-level frozen
    expect(Object.isFrozen(intercepted)).toBe(true);
    expect(() => { intercepted.prop = "modified"; }).toThrow();

    // Nested level frozen
    expect(Object.isFrozen(intercepted.nested)).toBe(true);
    expect(() => { intercepted.nested.deep = false; }).toThrow();

    EventBus.off("freeze-test", cb);
  });

  it("should return an unsubscribe function from on()", () => {
    let callCount = 0;
    const cb = () => { callCount++; };

    const unsubscribe = EventBus.on("unsub-test", cb);

    expect(typeof unsubscribe).toBe("function");

    EventBus.dispatch("unsub-test", {});
    expect(callCount).toBe(1);

    // Unsubscribe and verify no further calls
    unsubscribe();
    EventBus.dispatch("unsub-test", {});
    expect(callCount).toBe(1);
  });
});

// ============================================================================
// SessionModule Infrastructure Tests (Dependency Injection)
// ============================================================================

describe("Phase 1.1: SessionModule Infrastructure (DI)", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("should dispatch UserAuthenticated and persist schema_version", () => {
    let eventReceived: any = null;
    const cb = (e: any) => { eventReceived = e; };

    const unsub = EventBus.on(DOMAIN_EVENTS.USER_AUTHENTICATED, cb);

    const testUser = { emailHash: "abcdef", hogarId: "123" };
    SessionModule.initSession("test-token", testUser);

    expect(localStorageMock.getItem("token")).toBe("test-token");
    expect(JSON.parse(localStorageMock.getItem("user") || "{}")).toEqual(testUser);
    expect(localStorageMock.getItem("schema_version")).toBe("v1");

    expect(eventReceived).not.toBeNull();
    expect(eventReceived.data.token).toBe("test-token");
    expect(eventReceived.data.user).toEqual(testUser);
    expect(eventReceived.metadata.version).toBe("1.0.0");

    unsub();
  });

  it("should dispatch SessionCleared and remove schema_version", () => {
    let cleared = false;
    const cb = () => { cleared = true; };

    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_CLEARED, cb);

    localStorageMock.setItem("token", "active-token");
    localStorageMock.setItem("user", "{}");
    localStorageMock.setItem("schema_version", "v1");

    SessionModule.clearSession();

    expect(localStorageMock.getItem("token")).toBeNull();
    expect(localStorageMock.getItem("user")).toBeNull();
    expect(localStorageMock.getItem("schema_version")).toBeNull();
    expect(cleared).toBe(true);

    unsub();
  });

  it("should dispatch SessionRestored on successful rehydration with valid JWT", () => {
    let restored = false;
    const cb = () => { restored = true; };

    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_RESTORED, cb);

    const testUser = { id: "user-123", emailHash: "hash-abc", hogarId: "hogar-456" };
    const token = createTestJWT(VALID_JWT_CLAIMS);
    localStorageMock.setItem("token", token);
    localStorageMock.setItem("user", JSON.stringify(testUser));
    localStorageMock.setItem("schema_version", "v1");

    const session = SessionModule.rehydrateSession();

    expect(session).not.toBeNull();
    expect(session!.user).toEqual(testUser);
    expect(restored).toBe(true);

    unsub();
  });

  it("should self-heal storage corruption and dispatch SessionCleared", () => {
    let cleared = false;
    const cb = () => { cleared = true; };

    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_CLEARED, cb);

    localStorageMock.setItem("token", "token-val");
    localStorageMock.setItem("user", "corrupt-json-string{");
    localStorageMock.setItem("schema_version", "v1");

    const session = SessionModule.rehydrateSession();

    expect(session).toBeNull();
    expect(localStorageMock.getItem("token")).toBeNull();
    expect(cleared).toBe(true);

    unsub();
  });

  it("should dispatch SessionExpired with reason via DOMAIN_EVENTS contract", () => {
    let eventReceived: any = null;
    const cb = (e: any) => { eventReceived = e; };

    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_EXPIRED, cb);

    localStorageMock.setItem("token", "expiring-token");
    localStorageMock.setItem("user", "{}");

    SessionModule.expireSession("token_expired");

    expect(localStorageMock.getItem("token")).toBeNull();
    expect(eventReceived).not.toBeNull();
    expect(eventReceived.data.reason).toBe("token_expired");

    unsub();
  });
});

// ============================================================================
// Session Reconciliation Tests
// ============================================================================

describe("Phase 1.1: Session Reconciliation", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("should reconcile and emit SessionReconciled when user.hogarId diverges from JWT", () => {
    let reconciledEvent: any = null;
    let restoredEvent: any = null;
    const reconCb = (e: any) => { reconciledEvent = e; };
    const restCb = (e: any) => { restoredEvent = e; };

    const unsubRecon = EventBus.on(DOMAIN_EVENTS.SESSION_RECONCILED, reconCb);
    const unsubRest = EventBus.on(DOMAIN_EVENTS.SESSION_RESTORED, restCb);

    // Simulate inconsistent state: JWT has hogarId but user object does not
    const token = createTestJWT(VALID_JWT_CLAIMS);
    const inconsistentUser = { id: "user-123", emailHash: "hash-abc", hogarId: null };
    localStorageMock.setItem("token", token);
    localStorageMock.setItem("user", JSON.stringify(inconsistentUser));
    localStorageMock.setItem("schema_version", "v1");

    const session = SessionModule.rehydrateSession();

    // Verify reconciliation event was dispatched
    expect(reconciledEvent).not.toBeNull();
    expect(reconciledEvent.data.differences).toEqual([
      { property: "hogarId", stored: null, jwt: "hogar-456" }
    ]);

    // Verify user was corrected in memory
    expect(session).not.toBeNull();
    expect(session!.user.hogarId).toBe("hogar-456");

    // Verify user was persisted to disk
    const persistedUser = JSON.parse(localStorageMock.getItem("user")!);
    expect(persistedUser.hogarId).toBe("hogar-456");

    // Verify SessionRestored was also dispatched with corrected user
    expect(restoredEvent).not.toBeNull();
    expect(restoredEvent.data.user.hogarId).toBe("hogar-456");

    unsubRecon();
    unsubRest();
  });

  it("should NOT emit SessionReconciled when user matches JWT claims exactly", () => {
    let reconciledEvent: any = null;
    let restored = false;
    const reconCb = (e: any) => { reconciledEvent = e; };
    const restCb = () => { restored = true; };

    const unsubRecon = EventBus.on(DOMAIN_EVENTS.SESSION_RECONCILED, reconCb);
    const unsubRest = EventBus.on(DOMAIN_EVENTS.SESSION_RESTORED, restCb);

    const token = createTestJWT(VALID_JWT_CLAIMS);
    const consistentUser = { id: "user-123", emailHash: "hash-abc", hogarId: "hogar-456" };
    localStorageMock.setItem("token", token);
    localStorageMock.setItem("user", JSON.stringify(consistentUser));
    localStorageMock.setItem("schema_version", "v1");

    SessionModule.rehydrateSession();

    expect(reconciledEvent).toBeNull();
    expect(restored).toBe(true);

    unsubRecon();
    unsubRest();
  });

  it("should expire session when JWT is expired", () => {
    let expiredEvent: any = null;
    const cb = (e: any) => { expiredEvent = e; };
    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_EXPIRED, cb);

    const expiredClaims = {
      ...VALID_JWT_CLAIMS,
      exp: Math.floor(Date.now() / 1000) - 100,
    };
    const token = createTestJWT(expiredClaims);
    localStorageMock.setItem("token", token);
    localStorageMock.setItem("user", JSON.stringify({ id: "user-123" }));
    localStorageMock.setItem("schema_version", "v1");

    const session = SessionModule.rehydrateSession();

    expect(session).toBeNull();
    expect(expiredEvent).not.toBeNull();
    expect(expiredEvent.data.reason).toBe("token_expired");
    expect(localStorageMock.getItem("token")).toBeNull();

    unsub();
  });

  it("should clear session when JWT has invalid issuer", () => {
    let cleared = false;
    const cb = () => { cleared = true; };
    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_CLEARED, cb);

    const badClaims = { ...VALID_JWT_CLAIMS, iss: "evil:service" };
    const token = createTestJWT(badClaims);
    localStorageMock.setItem("token", token);
    localStorageMock.setItem("user", JSON.stringify({ id: "user-123" }));
    localStorageMock.setItem("schema_version", "v1");

    const session = SessionModule.rehydrateSession();

    expect(session).toBeNull();
    expect(cleared).toBe(true);

    unsub();
  });

  it("should clear session when schema version is outdated", () => {
    let cleared = false;
    const cb = () => { cleared = true; };
    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_CLEARED, cb);

    const token = createTestJWT(VALID_JWT_CLAIMS);
    localStorageMock.setItem("token", token);
    localStorageMock.setItem("user", JSON.stringify({ id: "user-123" }));
    localStorageMock.setItem("schema_version", "v0");

    const session = SessionModule.rehydrateSession();

    expect(session).toBeNull();
    expect(cleared).toBe(true);
    expect(localStorageMock.getItem("token")).toBeNull();

    unsub();
  });

  it("should clear session when schema version is missing", () => {
    let cleared = false;
    const cb = () => { cleared = true; };
    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_CLEARED, cb);

    const token = createTestJWT(VALID_JWT_CLAIMS);
    localStorageMock.setItem("token", token);
    localStorageMock.setItem("user", JSON.stringify({ id: "user-123" }));
    // No schema_version set

    const session = SessionModule.rehydrateSession();

    expect(session).toBeNull();
    expect(cleared).toBe(true);

    unsub();
  });

  it("should reconcile multiple divergent properties simultaneously", () => {
    let reconciledEvent: any = null;
    const cb = (e: any) => { reconciledEvent = e; };
    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_RECONCILED, cb);

    const token = createTestJWT(VALID_JWT_CLAIMS);
    const wrongUser = { id: "old-id", emailHash: "old-hash", hogarId: null };
    localStorageMock.setItem("token", token);
    localStorageMock.setItem("user", JSON.stringify(wrongUser));
    localStorageMock.setItem("schema_version", "v1");

    const session = SessionModule.rehydrateSession();

    expect(reconciledEvent).not.toBeNull();
    expect(reconciledEvent.data.differences).toHaveLength(3);
    expect(session!.user).toEqual({ id: "user-123", emailHash: "hash-abc", hogarId: "hogar-456" });

    const persisted = JSON.parse(localStorageMock.getItem("user")!);
    expect(persisted.id).toBe("user-123");
    expect(persisted.emailHash).toBe("hash-abc");
    expect(persisted.hogarId).toBe("hogar-456");

    unsub();
  });

  it("should reconcile and recover missing properties (Case 6)", () => {
    let reconciledEvent: any = null;
    const cb = (e: any) => { reconciledEvent = e; };
    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_RECONCILED, cb);

    const token = createTestJWT(VALID_JWT_CLAIMS);
    const incompleteUser = { id: "user-123", emailHash: "hash-abc" }; // hogarId is completely missing/undefined
    localStorageMock.setItem("token", token);
    localStorageMock.setItem("user", JSON.stringify(incompleteUser));
    localStorageMock.setItem("schema_version", "v1");

    const session = SessionModule.rehydrateSession();

    expect(reconciledEvent).not.toBeNull();
    expect(reconciledEvent.data.differences).toEqual([
      { property: "hogarId", stored: undefined, jwt: "hogar-456" }
    ]);
    expect(session!.user.hogarId).toBe("hogar-456");

    const persisted = JSON.parse(localStorageMock.getItem("user")!);
    expect(persisted.hogarId).toBe("hogar-456");

    unsub();
  });

  it("should guarantee idempotency on consecutive rehydrations (Case 7)", () => {
    let reconciledCount = 0;
    const cb = () => { reconciledCount++; };
    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_RECONCILED, cb);

    const token = createTestJWT(VALID_JWT_CLAIMS);
    const wrongUser = { id: "user-123", emailHash: "hash-abc", hogarId: null };
    localStorageMock.setItem("token", token);
    localStorageMock.setItem("user", JSON.stringify(wrongUser));
    localStorageMock.setItem("schema_version", "v1");

    // First hydration: should reconcile
    const session1 = SessionModule.rehydrateSession();
    expect(reconciledCount).toBe(1);
    expect(session1!.user.hogarId).toBe("hogar-456");

    // Second hydration: should restock from the already corrected state without another reconciliation event
    const session2 = SessionModule.rehydrateSession();
    expect(reconciledCount).toBe(1); // Still 1
    expect(session2!.user.hogarId).toBe("hogar-456");

    unsub();
  });
});
