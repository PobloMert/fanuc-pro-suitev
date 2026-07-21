/**
 * MTB Elektrik Bakım — FANUC FSSB Optical Fiber Topology SVG Diagram Engine
 */

export function renderFSSBTopologySVG(activeSimMode = 'normal') {
  const isKablo2Broken = activeSimMode === 'kablo2';
  const isAmp1Fault = activeSimMode === 'amp1';

  const line1Color = isAmp1Fault ? '#ef4444' : '#10b981';
  const line2Color = isKablo2Broken || isAmp1Fault ? '#ef4444' : '#10b981';
  const line3Color = isKablo2Broken || isAmp1Fault ? '#ef4444' : '#10b981';

  const amp1Led = isAmp1Fault ? 'd1' : '0';
  const amp1LedColor = isAmp1Fault ? '#ef4444' : '#10b981';

  const amp2Led = (isKablo2Broken || isAmp1Fault) ? 'c1' : '0';
  const amp2LedColor = (isKablo2Broken || isAmp1Fault) ? '#f59e0b' : '#10b981';

  return `
    <svg viewBox="0 0 950 260" style="width:100%; height:auto; background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--border); padding:10px">
      <!-- Background Grid -->
      <defs>
        <linearGradient id="optLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#10b981" />
          <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Connection Line 1: Main CPU -> Amp 1 -->
      <path d="M 180 130 L 300 130" stroke="${line1Color}" stroke-width="4" stroke-dasharray="${isAmp1Fault ? '6,6' : 'none'}" filter="url(#glow)"/>
      <text x="240" y="118" fill="var(--text-muted)" font-size="10" text-anchor="middle" font-family="sans-serif">Optik Fiber 1 (COP10A)</text>

      <!-- Connection Line 2: Amp 1 -> Amp 2 -->
      <path d="M 440 130 L 560 130" stroke="${line2Color}" stroke-width="4" stroke-dasharray="${isKablo2Broken ? '6,6' : 'none'}" filter="url(#glow)"/>
      <text x="500" y="118" fill="${isKablo2Broken ? '#ef4444' : 'var(--text-muted)'}" font-size="10" text-anchor="middle" font-weight="${isKablo2Broken ? 'bold' : 'normal'}">
        ${isKablo2Broken ? '❌ Kopuk Hat' : 'Optik Fiber 2'}
      </text>

      <!-- Connection Line 3: Amp 2 -> Spindle Amp -->
      <path d="M 700 130 L 800 130" stroke="${line3Color}" stroke-width="4" filter="url(#glow)"/>
      <text x="750" y="118" fill="var(--text-muted)" font-size="10" text-anchor="middle">Optik Fiber 3</text>

      <!-- Node 1: CNC Main CPU -->
      <g transform="translate(40, 65)" class="fssb-node" onclick="window.onFssbNodeClick('cnc')" style="cursor:pointer">
        <rect width="140" height="130" rx="8" fill="var(--bg-card2)" stroke="#3b82f6" stroke-width="2"/>
        <rect width="140" height="30" rx="8" fill="#1e3a8a"/>
        <text x="70" y="20" fill="#fff" font-size="12" font-weight="bold" text-anchor="middle">CNC MAIN CPU</text>
        <text x="12" y="55" fill="var(--text-secondary)" font-size="11">Modül: FANUC 0i</text>
        <text x="12" y="75" fill="var(--text-muted)" font-size="10">Port: COP10A</text>
        <rect x="12" y="90" width="116" height="24" rx="4" fill="rgba(59,130,246,0.15)"/>
        <text x="70" y="106" fill="#60a5fa" font-size="11" font-weight="bold" text-anchor="middle">P1023 P0=1</text>
      </g>

      <!-- Node 2: Servo Amp 1 -->
      <g transform="translate(300, 65)" class="fssb-node" onclick="window.onFssbNodeClick('amp1')" style="cursor:pointer">
        <rect width="140" height="130" rx="8" fill="var(--bg-card2)" stroke="${isAmp1Fault ? '#ef4444' : '#10b981'}" stroke-width="2"/>
        <rect width="140" height="30" rx="8" fill="${isAmp1Fault ? '#7f1d1d' : '#064e3b'}"/>
        <text x="70" y="20" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">SERVO AMP 1 (X/Y)</text>
        <text x="12" y="55" fill="var(--text-secondary)" font-size="10">COP10A / COP10B</text>
        <text x="12" y="75" fill="var(--text-muted)" font-size="10">Eksen: X=1, Y=2</text>
        <rect x="12" y="90" width="116" height="24" rx="4" fill="${isAmp1Fault ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.15)'}"/>
        <text x="70" y="106" fill="${amp1LedColor}" font-size="11" font-weight="bold" text-anchor="middle">LED: [ ${amp1Led} ]</text>
      </g>

      <!-- Node 3: Servo Amp 2 -->
      <g transform="translate(560, 65)" class="fssb-node" onclick="window.onFssbNodeClick('amp2')" style="cursor:pointer">
        <rect width="140" height="130" rx="8" fill="var(--bg-card2)" stroke="${isKablo2Broken ? '#f59e0b' : '#10b981'}" stroke-width="2"/>
        <rect width="140" height="30" rx="8" fill="${isKablo2Broken ? '#78350f' : '#064e3b'}"/>
        <text x="70" y="20" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">SERVO AMP 2 (Z)</text>
        <text x="12" y="55" fill="var(--text-secondary)" font-size="10">COP10A / COP10B</text>
        <text x="12" y="75" fill="var(--text-muted)" font-size="10">Eksen: Z=3</text>
        <rect x="12" y="90" width="116" height="24" rx="4" fill="${isKablo2Broken ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.15)'}"/>
        <text x="70" y="106" fill="${amp2LedColor}" font-size="11" font-weight="bold" text-anchor="middle">LED: [ ${amp2Led} ]</text>
      </g>

      <!-- Node 4: Spindle Amp -->
      <g transform="translate(800, 65)" class="fssb-node" onclick="window.onFssbNodeClick('spindle')" style="cursor:pointer">
        <rect width="130" height="130" rx="8" fill="var(--bg-card2)" stroke="#8b5cf6" stroke-width="2"/>
        <rect width="130" height="30" rx="8" fill="#4c1d95"/>
        <text x="65" y="20" fill="#fff" font-size="11" font-weight="bold" text-anchor="middle">SPINDLE AMP</text>
        <text x="10" y="55" fill="var(--text-secondary)" font-size="10">Konnektör: JA7A</text>
        <text x="10" y="75" fill="var(--text-muted)" font-size="10">Sensör: MZ/CZ</text>
        <rect x="10" y="90" width="110" height="24" rx="4" fill="rgba(139,92,246,0.15)"/>
        <text x="65" y="106" fill="#a78bfa" font-size="11" font-weight="bold" text-anchor="middle">S1 (Sürücü Ok)</text>
      </g>
    </svg>
  `;
}

if (typeof window !== 'undefined') {
  window.renderFSSBTopologySVG = renderFSSBTopologySVG;
}
