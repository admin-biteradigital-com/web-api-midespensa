// ============================================================================
// SESSION MANAGER — Mi Despensa PWA
// Manages credentials storage and dispatches domain events via injected bus
// ============================================================================

const SessionModule = (function () {
  const TOKEN_KEY = "token";
  const USER_KEY = "user";

  let _eventBus = null;
  let _events = null;

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
        const token = localStorage.getItem(TOKEN_KEY);
        const rawUser = localStorage.getItem(USER_KEY);

        if (token && rawUser) {
          const user = JSON.parse(rawUser);
          
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
