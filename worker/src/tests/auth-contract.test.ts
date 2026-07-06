import { describe, it, expect, beforeEach, vi } from "vitest";
// @ts-ignore
import { createRequire } from "module";

// @ts-ignore
const require = createRequire(import.meta.url);

const {
  AUTH_STATES,
  AUTH_TRANSITIONS,
  AUTH_UI_BINDINGS,
  AUTH_TERMINAL_STATES,
  FSM_EVENTS,
  getAuthState,
  setAuthState,
  setFSMEventBus,
  _resetAuthStateForTesting,
  validateAuthContract,
} = require("../../../client/auth-state.js");

describe("Auth State Contract", () => {
  beforeEach(() => {
    if (typeof _resetAuthStateForTesting === "function") {
      _resetAuthStateForTesting();
    }
  });

  it("must pass the standard state machine contract validation", () => {
    const result = validateAuthContract();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("must not contain undefined states", () => {
    expect(Object.keys(AUTH_STATES)).not.toContain("undefined");
    expect(Object.values(AUTH_STATES)).not.toContain("undefined");
  });

  it("must have UI bindings for every state", () => {
    Object.keys(AUTH_STATES).forEach(state => {
      const binding = AUTH_UI_BINDINGS[state];
      expect(binding).toBeDefined();
      expect(typeof binding).toBe("string");
    });
  });

  it("must map EMAIL_SENT to its dedicated UI view-auth-sent to render UI", () => {
    expect(AUTH_UI_BINDINGS.EMAIL_SENT).toBe("view-auth-sent");
  });

  it("must map LOADING_VERIFY to view-loading to hide all inputs", () => {
    expect(AUTH_UI_BINDINGS.LOADING_VERIFY).toBe("view-loading");
  });

  it("must ensure AUTH_FAIL never loops to EMAIL_SENT automatically", () => {
    expect(AUTH_TRANSITIONS.AUTH_FAIL).not.toContain("EMAIL_SENT");
    expect(AUTH_TRANSITIONS.AUTH_FAIL).toEqual(["EMAIL_ENTRY"]);
  });

  it("must ensure AUTH_SUCCESS maps to transitional view-auth-success container", () => {
    expect(AUTH_UI_BINDINGS.AUTH_SUCCESS).toBe("view-auth-success");
  });

  it("must enforce terminal outcomes", () => {
    expect(AUTH_TERMINAL_STATES).toContain("AUTH_SUCCESS");
    expect(AUTH_TERMINAL_STATES).toContain("AUTH_FAIL");
  });
});

describe("Auth FSM Event Bus Integration", () => {
  let mockEventBus: { dispatch: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockEventBus = {
      dispatch: vi.fn(),
    };
    
    // Reset state controller value internally
    if (typeof _resetAuthStateForTesting === "function") {
      _resetAuthStateForTesting();
    }
    
    // Inject the mock event bus
    setFSMEventBus(mockEventBus);
  });

  it("should emit FSM_STATE_CHANGED exactly once per transition", () => {
    // Reset state to BOOTSTRAP (first state is allowed from null)
    setAuthState(AUTH_STATES.BOOTSTRAP, null);
    expect(mockEventBus.dispatch).toHaveBeenCalledTimes(1);

    // Transition to EMAIL_ENTRY
    setAuthState(AUTH_STATES.EMAIL_ENTRY, null);
    expect(mockEventBus.dispatch).toHaveBeenCalledTimes(2);
  });

  it("should include correct payload with previousState, newState, and timestamp", () => {
    // First setAuthState sets from null -> BOOTSTRAP
    setAuthState(AUTH_STATES.BOOTSTRAP, null);
    
    expect(mockEventBus.dispatch).toHaveBeenLastCalledWith(
      FSM_EVENTS.STATE_CHANGED,
      expect.objectContaining({
        previousState: null,
        newState: AUTH_STATES.BOOTSTRAP,
        timestamp: expect.any(String),
      })
    );

    // Parse and validate timestamp formatting
    const firstCallPayload = mockEventBus.dispatch.mock.calls[0][1];
    expect(Date.parse(firstCallPayload.timestamp)).not.toBeNaN();

    // Transition BOOTSTRAP -> EMAIL_ENTRY
    setAuthState(AUTH_STATES.EMAIL_ENTRY, null);

    expect(mockEventBus.dispatch).toHaveBeenLastCalledWith(
      FSM_EVENTS.STATE_CHANGED,
      expect.objectContaining({
        previousState: AUTH_STATES.BOOTSTRAP,
        newState: AUTH_STATES.EMAIL_ENTRY,
        timestamp: expect.any(String),
      })
    );
  });

  it("should propagate optional visual/presentation data parameter in FSM_STATE_CHANGED payload", () => {
    setAuthState(AUTH_STATES.BOOTSTRAP, null);
    setAuthState(AUTH_STATES.SESSION_REHYDRATING, null);
    
    const uiData = { reason: "test_rehydration" };
    setAuthState(AUTH_STATES.AUTH_FAIL, null, uiData);

    expect(mockEventBus.dispatch).toHaveBeenLastCalledWith(
      FSM_EVENTS.STATE_CHANGED,
      expect.objectContaining({
        previousState: AUTH_STATES.SESSION_REHYDRATING,
        newState: AUTH_STATES.AUTH_FAIL,
        data: uiData,
      })
    );
  });

  it("should not crash if no event bus is injected", () => {
    // Inject null to simulate environment without EventBus
    setFSMEventBus(null);

    expect(() => {
      setAuthState(AUTH_STATES.EMAIL_SENT, null);
    }).not.toThrow();
  });
});
