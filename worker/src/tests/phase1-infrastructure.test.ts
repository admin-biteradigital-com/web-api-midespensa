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

// ============================================================================
// DOMAIN_EVENTS Contract Tests
// ============================================================================

describe("Phase 1.1: DOMAIN_EVENTS Contract", () => {
  it("should export a frozen DOMAIN_EVENTS object", () => {
    expect(DOMAIN_EVENTS).toBeDefined();
    expect(Object.isFrozen(DOMAIN_EVENTS)).toBe(true);
  });

  it("should contain all four required domain event names", () => {
    expect(DOMAIN_EVENTS.USER_AUTHENTICATED).toBe("UserAuthenticated");
    expect(DOMAIN_EVENTS.SESSION_RESTORED).toBe("SessionRestored");
    expect(DOMAIN_EVENTS.SESSION_CLEARED).toBe("SessionCleared");
    expect(DOMAIN_EVENTS.SESSION_EXPIRED).toBe("SessionExpired");
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

  it("should dispatch UserAuthenticated via DOMAIN_EVENTS contract", () => {
    let eventReceived: any = null;
    const cb = (e: any) => { eventReceived = e; };

    const unsub = EventBus.on(DOMAIN_EVENTS.USER_AUTHENTICATED, cb);

    const testUser = { emailHash: "abcdef", hogarId: "123" };
    SessionModule.initSession("test-token", testUser);

    expect(localStorageMock.getItem("token")).toBe("test-token");
    expect(JSON.parse(localStorageMock.getItem("user") || "{}")).toEqual(testUser);

    expect(eventReceived).not.toBeNull();
    expect(eventReceived.data.token).toBe("test-token");
    expect(eventReceived.data.user).toEqual(testUser);
    expect(eventReceived.metadata.version).toBe("1.0.0");

    unsub();
  });

  it("should dispatch SessionCleared via DOMAIN_EVENTS contract", () => {
    let cleared = false;
    const cb = () => { cleared = true; };

    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_CLEARED, cb);

    localStorageMock.setItem("token", "active-token");
    localStorageMock.setItem("user", "{}");

    SessionModule.clearSession();

    expect(localStorageMock.getItem("token")).toBeNull();
    expect(localStorageMock.getItem("user")).toBeNull();
    expect(cleared).toBe(true);

    unsub();
  });

  it("should dispatch SessionRestored on successful rehydration", () => {
    let restored = false;
    const cb = () => { restored = true; };

    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_RESTORED, cb);

    const testUser = { emailHash: "xyz", hogarId: null };
    localStorageMock.setItem("token", "restored-token");
    localStorageMock.setItem("user", JSON.stringify(testUser));

    const session = SessionModule.rehydrateSession();

    expect(session).toEqual({ token: "restored-token", user: testUser });
    expect(restored).toBe(true);

    unsub();
  });

  it("should self-heal storage corruption and dispatch SessionCleared", () => {
    let cleared = false;
    const cb = () => { cleared = true; };

    const unsub = EventBus.on(DOMAIN_EVENTS.SESSION_CLEARED, cb);

    localStorageMock.setItem("token", "token-val");
    localStorageMock.setItem("user", "corrupt-json-string{");

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
