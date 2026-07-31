const fs = require('fs');
const path = require('path');

const CLIENT_DIR = path.join(__dirname, '../client');

let errors = [];

function checkFile(filePath, checkFn) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  checkFn(content, path.basename(filePath));
}

// Rule 1: No file outside session-manager.js may contain localStorage
function checkLocalStorage(content, filename) {
  if (filename !== 'session-manager.js' && content.includes('localStorage')) {
    errors.push(`[Rule 1] File "${filename}" directly references localStorage. Only session-manager.js is authorized.`);
  }
}

// Rule 2: Only session-manager.js can emit session lifecycle domain events
function checkSessionLifecycleEvents(content, filename) {
  if (filename !== 'session-manager.js') {
    const forbiddenEvents = ['UserAuthenticated', 'SessionRestored', 'SessionCleared', 'SessionExpired', 'SessionReconciled'];
    forbiddenEvents.forEach(evt => {
      if (content.includes(`"${evt}"`) || content.includes(`'${evt}'`)) {
        // Find if dispatch is called with this event name (e.g. dispatch("UserAuthenticated" or dispatch(DOMAIN_EVENTS.USER_AUTHENTICATED))
        const regex = new RegExp(`dispatch\\(\\s*["']${evt}["']`, 'g');
        const eventConst = evt.replace(/([A-Z])/g, '_$1').toUpperCase().replace(/^_/, '');
        const regexEnum = new RegExp(`dispatch\\(\\s*(DOMAIN_EVENTS\\.)?${eventConst}`, 'g');
        if (regex.test(content) || regexEnum.test(content)) {
          errors.push(`[Rule 2] File "${filename}" attempts to dispatch lifecycle domain event "${evt}". Only session-manager.js is authorized.`);
        }
      }
    });
  }
}

// Rule 3: No module inside client/session/ may import or reference auth-state.js
function checkSessionStateCoupling(content, filename) {
  if (filename === 'session-manager.js') {
    if (content.includes('auth-state.js') || content.includes('AUTH_STATES') || content.includes('setAuthState') || content.includes('getAuthState')) {
      errors.push(`[Rule 3] session-manager.js references auth-state.js, AUTH_STATES, or FSM transition functions. This violates domain isolation.`);
    }
  }
}

// Rule 4: No handler in app.js can chain another domain event dispatch
function checkEventChaining(content, filename) {
  if (filename === 'app.js') {
    const setupListenersMatch = content.match(/function setupListeners\(\)\s*\{([\s\S]*?)\n\s*\}/);
    if (setupListenersMatch) {
      const body = setupListenersMatch[1];
      if (body.includes('EventBus.dispatch') || body.includes('.dispatch(')) {
        errors.push(`[Rule 4] ApplicationOrchestrator's setupListeners() contains EventBus.dispatch calls, indicating event chaining.`);
      }
    }
  }
}

// Run scans
const clientFiles = fs.readdirSync(CLIENT_DIR);
clientFiles.forEach(file => {
  const fullPath = path.join(CLIENT_DIR, file);
  if (fs.statSync(fullPath).isFile() && file.endsWith('.js')) {
    checkFile(fullPath, checkLocalStorage);
    checkFile(fullPath, checkSessionLifecycleEvents);
    checkFile(fullPath, checkSessionStateCoupling);
    checkFile(fullPath, checkEventChaining);
  }
});

// Scan subdirectories recursively
function scanDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const items = fs.readdirSync(dirPath);
  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    if (fs.statSync(fullPath).isDirectory()) {
      scanDir(fullPath);
    } else if (fs.statSync(fullPath).isFile() && item.endsWith('.js')) {
      checkFile(fullPath, checkLocalStorage);
      checkFile(fullPath, checkSessionLifecycleEvents);
      checkFile(fullPath, checkSessionStateCoupling);
      checkFile(fullPath, checkEventChaining);
    }
  });
}

scanDir(path.join(CLIENT_DIR, 'session'));
scanDir(path.join(CLIENT_DIR, 'core'));

if (errors.length > 0) {
  console.error("❌ Architectural conformance checks failed:");
  errors.forEach(err => console.error(` - ${err}`));
  process.exit(1);
} else {
  console.log("✅ Architectural conformance checks passed successfully.");
  process.exit(0);
}
