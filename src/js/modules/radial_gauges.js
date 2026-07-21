/**
 * MTB Elektrik Bakım — 60 FPS Animated SVG Radial Gauges (Spindle Load, Feedrate, RPM)
 */

export function renderRadialGaugeSVG(options = {}) {
  const {
    value = 0,
    min = 0,
    max = 100,
    title = 'YÜK',
    unit = '%',
    color = '#10b981',
    size = 150
  } = options;

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  // Map 0 -> 1 to -120deg -> +120deg (240 degree total sweep)
  const angle = -120 + (pct * 240);

  const radius = 55;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  // Sweep is 240/360 = 66.6% of full circle
  const dashoffset = circumference * (1 - (pct * (240 / 360)));

  return `
    <div class="radial-gauge-card glass-card" style="display:inline-flex; flex-direction:column; align-items:center; justify-content:center; padding:12px; border-radius:var(--radius-md); background:rgba(30,41,59,0.5); width:${size + 20}px">
      <div style="font-size:11px; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px">
        ${title}
      </div>
      <div style="position:relative; width:${size}px; height:${size}px">
        <svg viewBox="0 0 140 140" style="width:100%; height:100%; transform:rotate(150deg)">
          <!-- Background Arc -->
          <circle cx="70" cy="70" r="${radius}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${strokeWidth}" stroke-dasharray="${circumference * (240/360)} ${circumference * (120/360)}" stroke-linecap="round"/>
          
          <!-- Animated Progress Arc -->
          <circle cx="70" cy="70" r="${radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" 
                  stroke-dasharray="${circumference * (240/360)} ${circumference * (120/360)}" 
                  stroke-dashoffset="${dashoffset}" 
                  stroke-linecap="round"
                  style="transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.3s ease" />
        </svg>

        <!-- Center Needle Pointer -->
        <div style="position:absolute; top:0; left:0; right:0; bottom:0; display:flex; align-items:center; justify-content:center">
          <div style="width:4px; height:45px; background:linear-gradient(to top, var(--text-primary), ${color}); border-radius:2px; transform-origin:bottom center; transform:rotate(${angle}deg); transition:transform 0.6s cubic-bezier(0.4, 0, 0.2, 1); box-shadow:0 0 8px ${color}"></div>
        </div>

        <!-- Center Hub Pin -->
        <div style="position:absolute; top:50%; left:50%; width:14px; height:14px; margin-top:-7px; margin-left:-7px; background:#1e293b; border:2px solid ${color}; border-radius:50%; box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>
      </div>

      <!-- Center Digital Reading -->
      <div style="margin-top:-18px; text-align:center">
        <span class="font-mono" style="font-size:18px; font-weight:800; color:${color}">${Math.round(value)}</span>
        <span style="font-size:11px; color:var(--text-muted)">${unit}</span>
      </div>
    </div>
  `;
}

if (typeof window !== 'undefined') {
  window.renderRadialGaugeSVG = renderRadialGaugeSVG;
}
