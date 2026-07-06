// ============================================================================
// AUTH STATE CONTRACT & STATE MACHINE — Mi Despensa PWA
// Single Source of Truth for Authentication UX States
// ============================================================================

// --- State Definitions (Finite, Immutable) ---
const AUTH_STATES = Object.freeze({
  BOOTSTRAP:           "BOOTSTRAP",
  EMAIL_ENTRY:         "EMAIL_ENTRY",
  EMAIL_SENT:          "EMAIL_SENT",
  LOADING_VERIFY:      "LOADING_VERIFY",
  AUTHENTICATING:      "AUTHENTICATING",
  AUTH_SUCCESS:        "AUTH_SUCCESS",
  AUTH_FAIL:           "AUTH_FAIL",
  SESSION_REHYDRATING: "SESSION_REHYDRATING",
});

// --- FSM Events Contract (Low-Level Telemetry Only) ---
const FSM_EVENTS = Object.freeze({
  STATE_CHANGED: "FSM_STATE_CHANGED",
});

// --- Valid Transitions (Directed Graph) ---
const AUTH_TRANSITIONS = Object.freeze({
  BOOTSTRAP:           ["EMAIL_ENTRY", "LOADING_VERIFY", "SESSION_REHYDRATING"],
  EMAIL_ENTRY:         ["EMAIL_SENT"],
  EMAIL_SENT:          ["EMAIL_ENTRY", "EMAIL_SENT", "LOADING_VERIFY"],
  LOADING_VERIFY:      ["AUTHENTICATING", "AUTH_FAIL"],
  AUTHENTICATING:      ["AUTH_SUCCESS", "AUTH_FAIL"],
  AUTH_SUCCESS:        ["SESSION_REHYDRATING", "EMAIL_ENTRY", "AUTH_FAIL"],
  AUTH_FAIL:           ["EMAIL_ENTRY"],
  SESSION_REHYDRATING: ["EMAIL_ENTRY", "AUTH_SUCCESS", "AUTH_FAIL"],
});

// --- UI Bindings (Every State → Exactly One View) ---
const AUTH_UI_BINDINGS = Object.freeze({
  BOOTSTRAP:           "view-loading",
  EMAIL_ENTRY:         "view-auth",
  EMAIL_SENT:          "view-auth-sent",
  LOADING_VERIFY:      "view-loading",
  AUTHENTICATING:      "view-loading",
  AUTH_SUCCESS:        "view-auth-success",
  AUTH_FAIL:           "view-auth-fail",
  SESSION_REHYDRATING: "view-loading",
});

// --- Loading Messages Per State ---
const AUTH_LOADING_MESSAGES = Object.freeze({
  BOOTSTRAP:           { title: "Ingresando a Mi Despensa...",  desc: "Por favor, espera un momento." },
  LOADING_VERIFY:      { title: "Verificando tu acceso...",     desc: "Validando enlace de seguridad..." },
  AUTHENTICATING:      { title: "Iniciando sesión...",          desc: "Cargando tu perfil familiar..." },
  SESSION_REHYDRATING: { title: "Cargando tu despensa...",      desc: "Conectando al servidor..." },
});

// --- Timeout Policy (ms) ---
const AUTH_TIMEOUTS = Object.freeze({
  LOADING_VERIFY: 10000,
});

// --- Terminal States ---
const AUTH_TERMINAL_STATES = Object.freeze(["AUTH_SUCCESS", "AUTH_FAIL"]);

// --- Injected EventBus (No Global References) ---
let _fsmEventBus = null;

/**
 * Injects the EventBus dependency into the FSM.
 * Must be called before any setAuthState() if event emission is desired.
 * @param {object} eventBus The EventBus instance with a dispatch() method.
 */
function setFSMEventBus(eventBus) {
  _fsmEventBus = eventBus;
  console.log("[AUTH FSM] EventBus injected via setFSMEventBus().");
}

// --- Runtime State Controller ---
let _currentAuthState = null;

function getAuthState() {
  return _currentAuthState;
}

/**
 * Sets the new authentication state, checks transitions, and triggers UI bindings.
 * @param {string} newState One of the valid AUTH_STATES.
 * @param {object} context The context containing showView, setLoadingMessage, and onTimeout.
 * @param {object|null} data Optional UI/presentation payload. RULE: This payload belongs exclusively to the presentation layer. It MUST NOT contain domain/session data (such as tokens or credentials) destined for SessionModule.
 */
function setAuthState(newState, context, data = null) {
  // Guard 1: No undefined/null states
  if (!newState || newState === "undefined" || !AUTH_STATES[newState]) {
    const err = `AUTH_STATE_INVALID: attempted to set "${newState}"`;
    console.error(err);
    throw new Error(err);
  }

  // Guard 2: Valid transition only (skip on first set from null)
  if (_currentAuthState !== null) {
    const allowed = AUTH_TRANSITIONS[_currentAuthState];
    if (!allowed || !allowed.includes(newState)) {
      const err = `INVALID_TRANSITION: ${_currentAuthState} → ${newState}`;
      console.error(err);
      throw new Error(err);
    }
  }

  const previousState = _currentAuthState;
  _currentAuthState = newState;

  console.log(`[AUTH FSM] ${previousState || "null"} → ${newState}`);

  // Guard 3: UI binding enforcement
  if (context && context.showView) {
    const viewId = AUTH_UI_BINDINGS[newState];
    const messages = AUTH_LOADING_MESSAGES[newState];
    if (messages && context.setLoadingMessage) {
      context.setLoadingMessage(messages.title, messages.desc);
    }
    context.showView(viewId);
  }

  // Guard 4: Timeout enforcement for LOADING_VERIFY
  if (newState === AUTH_STATES.LOADING_VERIFY) {
    const timeout = AUTH_TIMEOUTS.LOADING_VERIFY;
    setTimeout(() => {
      if (_currentAuthState === AUTH_STATES.LOADING_VERIFY) {
        console.warn(`[AUTH FSM] TIMEOUT: ${newState} exceeded ${timeout}ms`);
        if (context && context.onTimeout) {
          context.onTimeout();
        }
      }
    }, timeout);
  }

  // --- FSM Event Emission (via injected bus) ---
  if (_fsmEventBus) {
    _fsmEventBus.dispatch(FSM_EVENTS.STATE_CHANGED, {
      previousState: previousState,
      newState: newState,
      timestamp: new Date().toISOString(),
      data: data,
    });
  }

  return newState;
}

// --- Contract Validation (used by CI/CD tests) ---
function validateAuthContract() {
  const errors = [];

  // 1. Every state must have a transition entry
  for (const state of Object.values(AUTH_STATES)) {
    if (!(state in AUTH_TRANSITIONS)) {
      errors.push(`Missing transition definition for state: ${state}`);
    }
  }

  // 2. Every state must have a UI binding
  for (const state of Object.values(AUTH_STATES)) {
    if (!(state in AUTH_UI_BINDINGS)) {
      errors.push(`Missing UI binding for state: ${state}`);
    }
  }

  // 3. No undefined keys in any map
  for (const key of Object.keys(AUTH_TRANSITIONS)) {
    if (key === "undefined" || !AUTH_STATES[key]) {
      errors.push(`Undefined state in transitions: ${key}`);
    }
  }

  // 4. All transition targets must be valid states
  for (const [from, targets] of Object.entries(AUTH_TRANSITIONS)) {
    for (const target of targets) {
      if (!AUTH_STATES[target]) {
        errors.push(`Invalid transition target: ${from} → ${target}`);
      }
    }
  }

  // 5. Terminal states must exist
  for (const terminal of AUTH_TERMINAL_STATES) {
    if (!AUTH_STATES[terminal]) {
      errors.push(`Terminal state not defined: ${terminal}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function _resetAuthStateForTesting() {
  _currentAuthState = null;
  _fsmEventBus = null;
}

// Export for Node.js test environment
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    AUTH_STATES,
    AUTH_TRANSITIONS,
    AUTH_UI_BINDINGS,
    AUTH_LOADING_MESSAGES,
    AUTH_TIMEOUTS,
    AUTH_TERMINAL_STATES,
    FSM_EVENTS,
    getAuthState,
    setAuthState,
    setFSMEventBus,
    _resetAuthStateForTesting,
    validateAuthContract,
  };
}
