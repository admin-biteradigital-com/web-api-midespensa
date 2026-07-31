// ============================================================================
// SESSION MANAGER — Mi Despensa PWA
// Manages credentials storage and dispatches domain events via injected bus
// ============================================================================

const SessionModule = (function () {
  const TOKEN_KEY = "token";
  const USER_KEY = "user";
  const SCHEMA_KEY = "schema_version";
  const SCHEMA_VERSION = "v1";

  let _eventBus = null;
  let _events = null;

  // Helper to decode JWT payload safely
  function decodeJWTPayload(token) {
    if (!token) return null;
    try {
      const base64Url = token.split(".")[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      let jsonPayload;
      if (typeof window === "undefined" && typeof Buffer !== "undefined") {
        jsonPayload = Buffer.from(base64, "base64").toString("utf8");
      } else {
        jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );
      }
      return JSON.parse(jsonPayload);
    } catch (e) {
      console.warn("[SessionModule] Failed to decode JWT payload:", e);
      return null;
    }
  }

  // Helper to safely dispatch via injected EventBus
  function safeDispatch(eventName, payload) {
    if (_eventBus) {
      _eventBus.dispatch(eventName, payload);
    } else {
      console.warn(`[SessionModule] EventBus not initialized. Cannot dispatch "${eventName}"`);
    }
  }

  return {
    /**
     * Initializes the Session Module with dependency injection.
     * @param {object} eventBus The event bus instance.
     * @param {object} domainEvents Optional domain events enum.
     */
    initialize(eventBus, domainEvents) {
      _eventBus = eventBus;
      _events = domainEvents || (typeof DOMAIN_EVENTS !== "undefined" ? DOMAIN_EVENTS : null);
      console.log("[SessionModule] Initialized with EventBus dependency injection.");
    },

    /**
     * Initializes and persists an active session.
     * @param {string} token 
     * @param {object} user 
     */
    initSession(token, user) {
      if (!token || !user) return;
      try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        localStorage.setItem(SCHEMA_KEY, SCHEMA_VERSION);
      } catch (err) {
        console.error("[SessionModule] Storage write error:", err);
      }

      const eventName = _events ? _events.USER_AUTHENTICATED : "UserAuthenticated";
      safeDispatch(eventName, {
        metadata: { version: "1.0.0", timestamp: new Date().toISOString() },
        data: { token, user }
      });
    },

    /**
     * Clears session storage and dispatches SessionCleared.
     */
    clearSession() {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(SCHEMA_KEY);
      } catch (err) {
        console.error("[SessionModule] Storage remove error:", err);
      }

      const eventName = _events ? _events.SESSION_CLEARED : "SessionCleared";
      safeDispatch(eventName, {
        metadata: { version: "1.0.0", timestamp: new Date().toISOString() },
        data: {}
      });
    },

    /**
     * Clears session storage due to expiration and dispatches SessionExpired.
     * @param {string} reason 
     */
    expireSession(reason = "expired") {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(SCHEMA_KEY);
      } catch (err) {
        console.error("[SessionModule] Storage remove error:", err);
      }

      const eventName = _events ? _events.SESSION_EXPIRED : "SessionExpired";
      safeDispatch(eventName, {
        metadata: { version: "1.0.0", timestamp: new Date().toISOString() },
        data: { reason }
      });
    },

    /**
     * Restores session from localStorage.
     * Dispatches SessionRestored if successful, or SessionCleared on corruption.
     * @returns {object|null}
     */
    rehydrateSession() {
      try {
        // 1. Schema version check
        const storedSchema = localStorage.getItem(SCHEMA_KEY);
        if (storedSchema !== SCHEMA_VERSION) {
          console.warn(`[SessionModule] Schema mismatch or missing: expected "${SCHEMA_VERSION}", got "${storedSchema}". Clearing session.`);
          this.clearSession();
          return null;
        }

        const token = localStorage.getItem(TOKEN_KEY);
        const rawUser = localStorage.getItem(USER_KEY);

        if (token && rawUser) {
          // 2. Validate JWT Semantics offline (exp, iss, aud, typ)
          const payload = decodeJWTPayload(token);
          if (!payload) {
            console.warn("[SessionModule] Token payload could not be decoded. Clearing session.");
            this.clearSession();
            return null;
          }

          // Check expiration
          const nowInSecs = Math.floor(Date.now() / 1000);
          if (!payload.exp || payload.exp <= nowInSecs) {
            console.warn(`[SessionModule] Token expired (exp: ${payload.exp}, now: ${nowInSecs}). Expiring session.`);
            this.expireSession("token_expired");
            return null;
          }

          // Check issuer, audience, and type
          if (
            payload.iss !== "biteradigital:midespensa:auth" ||
            payload.aud !== "biteradigital:midespensa:app" ||
            payload.typ !== "session"
          ) {
            console.warn("[SessionModule] Token payload semantically invalid. Clearing session.", payload);
            this.clearSession();
            return null;
          }

          let user = JSON.parse(rawUser);

          // 3. Declarative Session Reconciliation (Principle Open/Closed)
          const SESSION_MAP = {
            "userId": "id",
            "email": "emailHash",
            "hogarId": "hogarId"
          };

          const differences = [];
          for (const [claimKey, userProp] of Object.entries(SESSION_MAP)) {
            const jwtValue = payload[claimKey];
            const userValue = user[userProp];
            if (jwtValue !== userValue) {
              differences.push({
                property: userProp,
                stored: userValue,
                jwt: jwtValue
              });
            }
          }

          if (differences.length > 0) {
            console.log("[SessionModule] Reconciling session state due to differences:", differences);
            const healedUser = { ...user };
            for (const diff of differences) {
              healedUser[diff.property] = diff.jwt;
            }
            user = healedUser;

            // Persist the reconciled user object
            localStorage.setItem(USER_KEY, JSON.stringify(user));

            // Dispatch domain/infrastructure event "SessionReconciled"
            const reconcileEventName = _events ? _events.SESSION_RECONCILED : "SessionReconciled";
            safeDispatch(reconcileEventName, {
              metadata: { version: "1.0.0", timestamp: new Date().toISOString() },
              data: { differences }
            });
          }

          const eventName = _events ? _events.SESSION_RESTORED : "SessionRestored";
          safeDispatch(eventName, {
            metadata: { version: "1.0.0", timestamp: new Date().toISOString() },
            data: { token, user }
          });
          return { token, user };
        }
      } catch (err) {
        console.error("[SessionModule] Storage corruption detected during rehydration:", err);
        this.clearSession(); // Self-healing fallback
      }
      return null;
    },

    /**
     * Subscribes to cross-tab storage events to sync session state.
     */
    listenToStorageChanges() {
      if (typeof window === "undefined" || !window.addEventListener) return;

      window.addEventListener("storage", (e) => {
        if (e.key === TOKEN_KEY && !e.newValue) {
          console.log("[SessionModule] Session cleared in another tab.");
          this.clearSession();
        }
      });
    }
  };
})();

// Export for Node/Vitest environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = { SessionModule };
}
