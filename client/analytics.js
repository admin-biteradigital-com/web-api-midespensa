// ============================================================================
// Mi Despensa PWA — Analytics & Reports Module
// Sprint 4: Gasto por Categoría (Canvas chart), Top Productos, Resumen, CSV Export
// Zero external dependencies — Vanilla JS + Canvas API
// Bitera Digital SAS
// ============================================================================

(function() {
  'use strict';

  // ── Category colour palette (aligned with pills in index.html) ──────────────
  const CAT_COLORS = {
    'Almacén':   '#7c3aed',
    'Lácteos':   '#0ea5e9',
    'Limpieza':  '#f59e0b',
    'Bebidas':   '#10b981',
    'Frescos':   '#ec4899',
    'Congelados':'#38bdf8',
    'Mascotas':  '#a78bfa',
    'Higiene':   '#fb923c',
    'Otros':     '#6b7280',
  };

  function catColor(name) {
    return CAT_COLORS[name] || CAT_COLORS['Otros'];
  }

  // ── Draw animated bar chart on a canvas element ────────────────────────────
  function drawBarChart(canvasEl, labels, values, colors) {
    const dpr    = window.devicePixelRatio || 1;
    const rect   = canvasEl.getBoundingClientRect();
    const W      = rect.width  || canvasEl.parentElement.offsetWidth || 320;
    const H      = parseInt(canvasEl.getAttribute('height')) || 180;

    canvasEl.width  = W * dpr;
    canvasEl.height = H * dpr;
    canvasEl.style.width  = W + 'px';
    canvasEl.style.height = H + 'px';

    const ctx = canvasEl.getContext('2d');
    ctx.scale(dpr, dpr);

    const maxVal     = Math.max(...values, 1);
    const barCount   = labels.length;
    const padLeft    = 8;
    const padRight   = 8;
    const padTop     = 16;
    const padBottom  = 28;
    const chartW     = W - padLeft - padRight;
    const chartH     = H - padTop - padBottom;
    const gap        = 6;
    const barW       = barCount > 0 ? (chartW - gap * (barCount - 1)) / barCount : 0;

    ctx.clearRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth   = 1;
    [0.25, 0.5, 0.75, 1].forEach(f => {
      const y = padTop + chartH * (1 - f);
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(W - padRight, y);
      ctx.stroke();
    });

    // Animate bars
    let frame = 0;
    const totalFrames = 30;
    function animate() {
      ctx.clearRect(0, 0, W, H);

      // Re-draw grid
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      [0.25, 0.5, 0.75, 1].forEach(f => {
        const y = padTop + chartH * (1 - f);
        ctx.beginPath();
        ctx.moveTo(padLeft, y);
        ctx.lineTo(W - padRight, y);
        ctx.stroke();
      });

      const progress = Math.min(frame / totalFrames, 1);
      const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      labels.forEach((label, i) => {
        const x      = padLeft + i * (barW + gap);
        const ratio  = values[i] / maxVal;
        const bH     = chartH * ratio * ease;
        const y      = padTop + chartH - bH;

        // Bar gradient
        const grad = ctx.createLinearGradient(0, y, 0, y + bH);
        grad.addColorStop(0, colors[i]);
        grad.addColorStop(1, colors[i] + '55');
        ctx.fillStyle = grad;

        // Rounded top corners
        const r = Math.min(4, barW / 2, bH);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + barW - r, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
        ctx.lineTo(x + barW, y + bH);
        ctx.lineTo(x, y + bH);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();

        // Value label on top (only if bar is tall enough)
        if (bH > 16 && progress > 0.8) {
          ctx.fillStyle   = '#fff';
          ctx.font        = `600 9px Outfit, sans-serif`;
          ctx.textAlign   = 'center';
          ctx.fillText(
            values[i] > 999 ? (values[i]/1000).toFixed(1)+'k' : values[i],
            x + barW / 2,
            y - 4
          );
        }

        // X-axis label (truncated)
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font      = '9px Outfit, sans-serif';
        ctx.textAlign = 'center';
        const shortLabel = label.length > 7 ? label.substring(0, 6) + '…' : label;
        ctx.fillText(shortLabel, x + barW / 2, padTop + chartH + 14);
      });

      frame++;
      if (frame <= totalFrames) requestAnimationFrame(animate);
    }
    animate();
  }

  // ── Build legend chips under the chart ────────────────────────────────────
  function buildLegend(legendEl, labels, colors) {
    legendEl.innerHTML = '';
    labels.forEach((label, i) => {
      const chip = document.createElement('div');
      chip.style.cssText = `
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 10px; color: rgba(255,255,255,0.65);
        padding: 2px 6px; border-radius: 10px;
        background: ${colors[i]}22; border: 1px solid ${colors[i]}44;
      `;
      chip.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${colors[i]};display:inline-block;"></span>${label}`;
      legendEl.appendChild(chip);
    });
  }

  // ── Main render function (called from app.js when Reportes tab opens) ──────
  window.renderReports = async function(inventory, priceHistory) {
    if (!inventory || inventory.length === 0) {
      const topEl = document.getElementById('report-top-products');
      const catEl = document.getElementById('report-category-summary');
      if (topEl) topEl.innerHTML = '<div style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px 0;">Sin datos de inventario disponibles.</div>';
      if (catEl) catEl.innerHTML = '';
      return;
    }

    // ── Aggregate by category ──────────────────────────────────────────────
    const catMap = {};
    inventory.forEach(item => {
      const cat = item.category || 'Almacén';
      if (!catMap[cat]) catMap[cat] = { items: 0, totalQty: 0, estimatedValue: 0 };
      catMap[cat].items++;
      catMap[cat].totalQty += item.quantity || 0;

      // Estimate value from last recorded price × quantity
      if (priceHistory) {
        const lastPrice = priceHistory
          .filter(p => p.product_name === item.product_name)
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
        if (lastPrice) {
          catMap[cat].estimatedValue += lastPrice.price * (item.quantity || 0);
        }
      }
    });

    const cats   = Object.keys(catMap);
    const values = cats.map(c => Math.round(catMap[c].estimatedValue));
    const colors = cats.map(c => catColor(c));

    // ── Bar Chart ──────────────────────────────────────────────────────────
    const canvas   = document.getElementById('chart-category-spend');
    const legendEl = document.getElementById('chart-legend');
    if (canvas && cats.length > 0) {
      // Wait one frame so layout is computed
      requestAnimationFrame(() => {
        const displayValues = values.some(v => v > 0) ? values : cats.map(c => catMap[c].totalQty);
        drawBarChart(canvas, cats, displayValues, colors);
        buildLegend(legendEl, cats, colors);
      });
    }

    // ── Top Products by quantity ───────────────────────────────────────────
    const topEl = document.getElementById('report-top-products');
    if (topEl) {
      const sorted = [...inventory].sort((a, b) => (b.quantity || 0) - (a.quantity || 0)).slice(0, 6);
      const maxQty = sorted[0] ? sorted[0].quantity : 1;
      topEl.innerHTML = sorted.map((item, idx) => {
        const pct   = Math.round((item.quantity / maxQty) * 100);
        const color = catColor(item.category || 'Almacén');
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`;
        return `
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:12px;font-weight:500;">${medal} ${item.product_name}</span>
              <span style="font-size:12px;font-weight:700;color:${color};">${item.quantity} uds.</span>
            </div>
            <div style="height:5px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width 0.6s ease;"></div>
            </div>
          </div>`;
      }).join('');
    }

    // ── Category summary table ─────────────────────────────────────────────
    const catEl = document.getElementById('report-category-summary');
    if (catEl) {
      catEl.innerHTML = cats.map(cat => {
        const data  = catMap[cat];
        const color = catColor(cat);
        const valueStr = data.estimatedValue > 0
          ? `$${data.estimatedValue.toLocaleString('es-UY', { maximumFractionDigits: 0 })}`
          : '—';
        return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:rgba(0,0,0,0.15);border-radius:8px;border-left:3px solid ${color};">
            <div style="display:flex;flex-direction:column;gap:2px;">
              <span style="font-size:12px;font-weight:600;">${cat}</span>
              <span style="font-size:10px;color:var(--text-muted);">${data.items} producto${data.items !== 1 ? 's' : ''} · ${data.totalQty} unidades</span>
            </div>
            <span style="font-size:13px;font-weight:700;color:${color};">${valueStr}</span>
          </div>`;
      }).join('');
    }
  };

  // ── CSV Export ──────────────────────────────────────────────────────────────
  window.exportInventoryCSV = function(inventory) {
    if (!inventory || inventory.length === 0) {
      alert('No hay datos de inventario para exportar.');
      return;
    }

    const headers = ['Producto', 'Categoría', 'Cantidad', 'Stock Mínimo', 'Última Actualización'];
    const rows    = inventory.map(item => [
      `"${(item.product_name || '').replace(/"/g, '""')}"`,
      `"${(item.category || 'Almacén').replace(/"/g, '""')}"`,
      item.quantity || 0,
      item.min_stock || 1,
      `"${item.updated_at || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob       = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url        = URL.createObjectURL(blob);
    const a          = document.createElement('a');
    const date       = new Date().toISOString().substring(0, 10);
    a.href           = url;
    a.download       = `midespensa-inventario-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

})();
