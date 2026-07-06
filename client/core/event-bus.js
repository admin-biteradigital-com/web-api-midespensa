// ============================================================================
// EVENT BUS & DOMAIN EVENTS — Mi Despensa PWA
// Stateless pub/sub broker for modular communication
// ============================================================================

// --- Domain Events Contract ---
const DOMAIN_EVENTS = Object.freeze({
  USER_AUTHENTICATED: "UserAuthenticated",
  SESSION_RESTORED:   "SessionRestored",
  SESSION_CLEARED:    "SessionCleared",
  SESSION_EXPIRED:    "SessionExpired",
});

const EventBus = (function () {
  const listeners = {};

  // Deep clone and freeze helper to enforce payload immutability
  function deepCloneAndFreeze(obj) {
    if (obj === null || typeof obj !== "object") return obj;

    let clone;
    if (Array.isArray(obj)) {
      clone = obj.map(item => deepCloneAndFreeze(item));
    } else if (obj instanceof Date) {
      clone = new Date(obj.getTime());
    } else {
      clone = {};
      for (const key of Object.keys(obj)) {
        clone[key] = deepCloneAndFreeze(obj[key]);
      }
    }
    return Object.freeze(clone);
  }

  return {
    /**
     * Subscribe a callback to an event.
     * Returns an unsubscribe function.
     * @param {string} event 
     * @param {Function} callback 
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
      if (!event || typeof callback !== "function") return () => {};
      if (!listeners[event]) {
        listeners[event] = [];
      }
      if (!listeners[event].includes(callback)) {
        listeners[event].push(callback);
      }
      return () => this.off(event, callback);
    },

    /**
     * Unsubscribe a callback from an event.
     * @param {string} event 
     * @param {Function} callback 
     */
    off(event, callback) {
      if (!event || !listeners[event]) return;
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    },

    /**
     * Dispatch an event to all subscribers.
     * Implements error isolation and deep-frozen payloads.
     * @param {string} event 
     * @param {any} data 
     */
    dispatch(event, data) {
      if (!event || !listeners[event]) return;
      
      // Enforce absolute payload immutability by deep cloning and freezing the payload
      const immutableData = deepCloneAndFreeze(data);
      
      console.log(`[EventBus] Dispatching "${event}":`, immutableData);

      listeners[event].forEach(callback => {
        try {
          callback(immutableData);
        } catch (err) {
          console.error(`[EventBus] Error in subscriber for "${event}":`, err);
        }
      });
    }
  };
})();

// Export for Node/Vitest environments
if (typeof module !== "undefined" && module.exports) {
  module.exports = { EventBus, DOMAIN_EVENTS };
}
