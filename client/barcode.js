// ============================================================================
// Mi Despensa PWA — Barcode Scanner Module (Sprint 5 Update)
// Supports camera device enumeration (webcam + environment camera selection).
// Uses native BarcodeDetector API. Zero external dependencies.
// Sprint 3 Epic 1 + Sprint 5 fix — Bitera Digital SAS
// ============================================================================

(function() {
  'use strict';

  const modalEl         = document.getElementById('modal-barcode-scanner');
  const videoEl         = document.getElementById('scanner-video');
  const statusEl        = document.getElementById('scanner-status');
  const resultAreaEl    = document.getElementById('scanner-result-area');
  const detectedCodeEl  = document.getElementById('scanner-detected-code');
  const nameInputEl     = document.getElementById('scanner-product-name-input');
  const btnUseNameEl    = document.getElementById('btn-scanner-use-name');
  const btnCloseEl      = document.getElementById('btn-close-scanner');
  const btnScanEl       = document.getElementById('btn-scan-barcode');
  const instructionsEl  = document.getElementById('scanner-instructions');
  const cameraSelectEl  = document.getElementById('scanner-camera-select');
  const btnSwitchCamEl  = document.getElementById('btn-switch-camera');

  // Target product name input in the main form
  const productNameInput = document.getElementById('new-product-name');

  let detector     = null;
  let stream       = null;
  let rafId        = null;
  let paused       = false;
  let cameraDevices = [];   // all videoinput devices
  let activeDeviceId = '';  // currently streaming deviceId

  // ── BarcodeDetector support check ────────────────────────────────────────
  function isSupported() {
    return typeof window.BarcodeDetector !== 'undefined';
  }

  // ── Enumerate available camera devices ───────────────────────────────────
  async function enumerateCameras() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      cameraDevices = devices.filter(d => d.kind === 'videoinput');
    } catch (e) {
      cameraDevices = [];
    }

    if (!cameraSelectEl) return;

    cameraSelectEl.innerHTML = '';
    if (cameraDevices.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'No se encontraron cámaras';
      cameraSelectEl.appendChild(opt);
      return;
    }

    cameraDevices.forEach((device, i) => {
      const opt = document.createElement('option');
      opt.value = device.deviceId;
      // Human-friendly label: prefer given label, else generic name
      const label = device.label || `Cámara ${i + 1}`;
      // Annotate environment vs. user facing
      const hint = label.toLowerCase().includes('back') || label.toLowerCase().includes('environment') || label.toLowerCase().includes('rear')
        ? ' (Trasera)' : (label.toLowerCase().includes('front') || label.toLowerCase().includes('user') ? ' (Frontal)' : '');
      opt.textContent = label + hint;
      if (device.deviceId === activeDeviceId) opt.selected = true;
      cameraSelectEl.appendChild(opt);
    });
  }

  // ── Start streaming a specific device ────────────────────────────────────
  async function startCamera(deviceId) {
    // Stop existing stream
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    paused = true;
    if (rafId) cancelAnimationFrame(rafId);

    const constraints = deviceId
      ? { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } }
      : { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // If exact deviceId fails (e.g. webcam constraints), try without constraints
      if (deviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { deviceId } });
        } catch (err2) {
          showStatus('No se pudo acceder a esta cámara: ' + err2.message, true);
          return;
        }
      } else {
        if (err.name === 'NotAllowedError') {
          showStatus('Acceso a la cámara denegado. Habilitá el permiso en el navegador.', true);
        } else {
          showStatus('No se pudo acceder a la cámara: ' + err.message, true);
        }
        return;
      }
    }

    // Capture active device ID from track
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
    activeDeviceId = settings.deviceId || deviceId || '';

    // Update selector to match active device
    if (cameraSelectEl) cameraSelectEl.value = activeDeviceId;

    videoEl.srcObject = stream;
    try { await videoEl.play(); } catch (e) { /* may throw if already playing */ }

    resetResultArea();
    showStatus('Apunta la cámara al código de barras...');
    paused = false;
    scanLoop();
  }

  // ── Open scanner modal ────────────────────────────────────────────────────
  async function openScanner() {
    if (!isSupported()) {
      showUnsupportedFallback();
      return;
    }

    // Build BarcodeDetector for most common formats
    try {
      detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'qr_code', 'data_matrix']
      });
    } catch (e) {
      try { detector = new window.BarcodeDetector(); }
      catch (e2) { showUnsupportedFallback(); return; }
    }

    modalEl.classList.remove('hidden');

    // First: request permission so enumerateDevices returns labels
    try {
      // Prefer environment camera on first open; falls back to any
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
    } catch (err) {
      // Try without facing mode (for desktop webcams)
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err2) {
        if (err2.name === 'NotAllowedError') {
          showStatus('Acceso a la cámara denegado. Habilitá el permiso en el navegador.', true);
        } else {
          showStatus('No se pudo acceder a la cámara: ' + err2.message, true);
        }
        return;
      }
    }

    // Set active device before enumerate so we can mark it in the list
    const vt = stream.getVideoTracks()[0];
    const vtSettings = vt && vt.getSettings ? vt.getSettings() : {};
    activeDeviceId = vtSettings.deviceId || '';

    // Enumerate cameras (labels available after permission granted)
    await enumerateCameras();

    videoEl.srcObject = stream;
    try { await videoEl.play(); } catch (e) {}

    resetResultArea();
    paused = false;
    scanLoop();
  }

  // ── Scan loop via requestAnimationFrame ───────────────────────────────────
  async function scanLoop() {
    if (paused || !videoEl.srcObject) return;

    if (videoEl.readyState >= videoEl.HAVE_ENOUGH_DATA) {
      try {
        const barcodes = await detector.detect(videoEl);
        if (barcodes && barcodes.length > 0) {
          onBarcodeDetected(barcodes[0].rawValue);
          return; // Pause loop on detection
        }
      } catch (e) { /* silently skip detection errors */ }
    }

    rafId = requestAnimationFrame(scanLoop);
  }

  // ── Handle detected barcode ───────────────────────────────────────────────
  function onBarcodeDetected(rawValue) {
    paused = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (navigator.vibrate) navigator.vibrate(100);

    detectedCodeEl.textContent = rawValue;
    nameInputEl.value = '';
    resultAreaEl.style.display = 'flex';
    if (instructionsEl) instructionsEl.style.display = 'none';
    showStatus('✅ ¡Código detectado! Confirma o escribe el nombre del producto.');
    nameInputEl.focus();
  }

  // ── Confirm and transfer name to product form ─────────────────────────────
  function confirmName() {
    const name = nameInputEl.value.trim();
    if (!name) {
      nameInputEl.style.borderColor = 'var(--accent-red)';
      nameInputEl.placeholder = 'Escribe el nombre del producto';
      return;
    }
    if (productNameInput) productNameInput.value = name;
    closeScanner();
    if (productNameInput) productNameInput.focus();
  }

  // ── Close scanner and stop camera stream ──────────────────────────────────
  function closeScanner() {
    paused = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    videoEl.srcObject = null;
    activeDeviceId = '';
    modalEl.classList.add('hidden');
    resetResultArea();
  }

  // ── Reset result panel ────────────────────────────────────────────────────
  function resetResultArea() {
    resultAreaEl.style.display = 'none';
    detectedCodeEl.textContent = '';
    nameInputEl.value = '';
    nameInputEl.style.borderColor = '';
    if (instructionsEl) instructionsEl.style.display = '';
    showStatus('Apunta la cámara al código de barras...');
  }

  // ── Show status text ──────────────────────────────────────────────────────
  function showStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
  }

  // ── Fallback for unsupported browsers ─────────────────────────────────────
  function showUnsupportedFallback() {
    modalEl.classList.remove('hidden');
    showStatus('Tu navegador no soporta el escáner automático. Escribe el nombre del producto manualmente, o usa Chrome/Edge en Android.', true);
    if (resultAreaEl) resultAreaEl.style.display = 'none';
    // Show manual name entry directly
    if (nameInputEl) {
      nameInputEl.style.display = 'block';
      nameInputEl.placeholder = 'Escribe el nombre del producto';
    }
    if (btnUseNameEl) btnUseNameEl.style.display = 'block';
  }

  // ── Resume scan after result dismissed ────────────────────────────────────
  function resumeScan() {
    resetResultArea();
    paused = false;
    scanLoop();
  }

  // ── Wire up events (deferred to DOMContentLoaded) ─────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    if (btnScanEl)      btnScanEl.addEventListener('click', openScanner);
    if (btnCloseEl)     btnCloseEl.addEventListener('click', closeScanner);
    if (btnUseNameEl)   btnUseNameEl.addEventListener('click', confirmName);

    if (nameInputEl) {
      nameInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmName();
        if (e.key === 'Escape') resumeScan();
      });
    }

    // Camera switch button
    if (btnSwitchCamEl) {
      btnSwitchCamEl.addEventListener('click', () => {
        const selectedId = cameraSelectEl ? cameraSelectEl.value : '';
        if (selectedId && selectedId !== activeDeviceId) {
          startCamera(selectedId);
        }
      });
    }

    // Close on backdrop click
    if (modalEl) {
      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) closeScanner();
      });
    }
  });

})();
