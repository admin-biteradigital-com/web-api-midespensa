// ============================================================================
// Mi Despensa PWA — Barcode Scanner Module
// Uses native BarcodeDetector API (Chrome 83+, Android). Graceful fallback for
// browsers that don't support it. Zero external dependencies.
// Sprint 3 Epic 1 — Bitera Digital SAS
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

  // Target product name input in the main form
  const productNameInput = document.getElementById('new-product-name');

  let detector = null;
  let stream   = null;
  let rafId    = null;
  let paused   = false;

  // --- Check for BarcodeDetector API support ---
  function isSupported() {
    return typeof window.BarcodeDetector !== 'undefined';
  }

  // --- Open scanner modal ---
  async function openScanner() {
    if (!isSupported()) {
      showUnsupportedFallback();
      return;
    }

    // Build detector for most common barcode formats
    try {
      detector = new window.BarcodeDetector({
        formats: [
          'ean_13', 'ean_8', 'upc_a', 'upc_e',
          'code_128', 'code_39', 'code_93',
          'qr_code', 'data_matrix'
        ]
      });
    } catch (e) {
      // Detector may throw if formats not supported; try without format restriction
      try {
        detector = new window.BarcodeDetector();
      } catch (e2) {
        showUnsupportedFallback();
        return;
      }
    }

    // Request camera access
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        showStatus('Acceso a la cámara denegado. Por favor habilitá el permiso en el navegador.', true);
      } else {
        showStatus('No se pudo acceder a la cámara: ' + err.message, true);
      }
      modalEl.classList.remove('hidden');
      return;
    }

    videoEl.srcObject = stream;
    await videoEl.play();

    resetResultArea();
    modalEl.classList.remove('hidden');
    showStatus('Apunta la cámara al código de barras...');
    paused = false;
    scanLoop();
  }

  // --- Scan loop via requestAnimationFrame ---
  async function scanLoop() {
    if (paused || !videoEl.srcObject) return;

    if (videoEl.readyState >= videoEl.HAVE_ENOUGH_DATA) {
      try {
        const barcodes = await detector.detect(videoEl);
        if (barcodes && barcodes.length > 0) {
          onBarcodeDetected(barcodes[0].rawValue);
          return; // Pause loop after first detection
        }
      } catch (e) {
        // Silently skip detection errors mid-stream
      }
    }

    rafId = requestAnimationFrame(scanLoop);
  }

  // --- Handle detected barcode ---
  function onBarcodeDetected(rawValue) {
    paused = true;
    if (rafId) cancelAnimationFrame(rafId);

    // Haptic feedback (mobile)
    if (navigator.vibrate) navigator.vibrate(100);

    detectedCodeEl.textContent = rawValue;
    nameInputEl.value = ''; // Clear for user input
    resultAreaEl.style.display = 'flex';
    instructionsEl.style.display = 'none';
    showStatus('✅ ¡Código detectado! Confirma o escribe el nombre del producto.');
    nameInputEl.focus();
  }

  // --- Confirm and transfer name to product form ---
  function confirmName() {
    const name = nameInputEl.value.trim();
    if (!name) {
      nameInputEl.style.borderColor = 'var(--accent-red)';
      nameInputEl.placeholder = 'Escribe el nombre del producto';
      return;
    }
    productNameInput.value = name;
    closeScanner();
    productNameInput.focus();
  }

  // --- Close scanner and stop camera stream ---
  function closeScanner() {
    paused = true;
    if (rafId) cancelAnimationFrame(rafId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    videoEl.srcObject = null;
    modalEl.classList.add('hidden');
    resetResultArea();
  }

  // --- Reset result panel ---
  function resetResultArea() {
    resultAreaEl.style.display = 'none';
    detectedCodeEl.textContent = '';
    nameInputEl.value = '';
    nameInputEl.style.borderColor = '';
    if (instructionsEl) instructionsEl.style.display = '';
    showStatus('Apunta la cámara al código de barras...');
  }

  // --- Show status text ---
  function showStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? 'var(--accent-red)' : 'var(--text-muted)';
  }

  // --- Fallback for unsupported browsers ---
  function showUnsupportedFallback() {
    modalEl.classList.remove('hidden');
    showStatus('Tu navegador no soporta el escáner de códigos de barras. Usa Chrome en Android o escribe el nombre manualmente.', true);
    resultAreaEl.style.display = 'none';
  }

  // --- Resume scan after result dismissed ---
  function resumeScan() {
    resetResultArea();
    paused = false;
    scanLoop();
  }

  // --- Wire up events (deferred to DOMContentLoaded) ---
  document.addEventListener('DOMContentLoaded', () => {
    if (btnScanEl) {
      btnScanEl.addEventListener('click', openScanner);
    }
    if (btnCloseEl) {
      btnCloseEl.addEventListener('click', closeScanner);
    }
    if (btnUseNameEl) {
      btnUseNameEl.addEventListener('click', confirmName);
    }
    if (nameInputEl) {
      nameInputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') confirmName();
        if (e.key === 'Escape') resumeScan();
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
