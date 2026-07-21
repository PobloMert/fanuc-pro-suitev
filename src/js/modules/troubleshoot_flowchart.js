/**
 * MTB Elektrik Bakım — Interactive Animated Troubleshooting Decision Flowchart
 */

import { escapeHTML } from '../utils.js';

export function renderInteractiveFlowchartSVG(currentStep = 'step1', selectedPath = {}) {
  const isStep1Done = selectedPath.step1 !== undefined;
  const isStep2Done = selectedPath.step2 !== undefined;
  const isStep3Done = selectedPath.step3 !== undefined;

  return `
    <div class="glass-card" style="padding:16px; border-radius:var(--radius-md); margin-bottom:16px">
      <div style="font-weight:700; font-size:13px; color:var(--text-accent); margin-bottom:12px; display:flex; align-items:center; justify-content:space-between">
        <span>🌳 İnteraktif Arıza Teşhis Karar Ağacı (Interactive Flowchart)</span>
        <span class="tag tag-blue" style="font-size:10.5px">Canlı Akış Şeması</span>
      </div>

      <svg viewBox="0 0 900 180" style="width:100%; height:auto; background:var(--bg-card); border-radius:var(--radius-sm); border:1px solid var(--border); padding:10px">
        <defs>
          <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <!-- Connecting Line 1 -> 2 -->
        <path d="M 220 90 L 360 90" stroke="${isStep1Done ? '#10b981' : '#334155'}" stroke-width="3" stroke-dasharray="${isStep1Done ? 'none' : '4,4'}" filter="${isStep1Done ? 'url(#laserGlow)' : 'none'}"/>
        
        <!-- Connecting Line 2 -> 3 -->
        <path d="M 520 90 L 660 90" stroke="${isStep2Done ? '#10b981' : '#334155'}" stroke-width="3" stroke-dasharray="${isStep2Done ? 'none' : '4,4'}" filter="${isStep2Done ? 'url(#laserGlow)' : 'none'}"/>

        <!-- Flow Node 1: Soru 1 -->
        <g transform="translate(40, 45)" class="flow-node" style="cursor:pointer" onclick="window.onFlowchartNodeClick('step1')">
          <rect width="180" height="90" rx="8" fill="var(--bg-card2)" stroke="${currentStep === 'step1' ? '#3b82f6' : (isStep1Done ? '#10b981' : 'var(--border)')}" stroke-width="2"/>
          <text x="90" y="30" fill="#60a5fa" font-size="11" font-weight="bold" text-anchor="middle">ADIM 1: ALARM KONTROLÜ</text>
          <text x="90" y="52" fill="var(--text-secondary)" font-size="10.5" text-anchor="middle">Ekran/Pano Alarmı Var mı?</text>
          <rect x="20" y="62" width="140" height="20" rx="4" fill="${isStep1Done ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.15)'}"/>
          <text x="90" y="76" fill="${isStep1Done ? '#4ade80' : '#93c5fd'}" font-size="10" font-weight="bold" text-anchor="middle">
            ${selectedPath.step1 !== undefined ? (selectedPath.step1 ? '✅ Alarm Var' : '❌ Alarm Yok') : '▶ Yanıtla'}
          </text>
        </g>

        <!-- Flow Node 2: Soru 2 -->
        <g transform="translate(340, 45)" class="flow-node" style="cursor:pointer" onclick="window.onFlowchartNodeClick('step2')">
          <rect width="180" height="90" rx="8" fill="var(--bg-card2)" stroke="${currentStep === 'step2' ? '#3b82f6' : (isStep2Done ? '#10b981' : 'var(--border)')}" stroke-width="2"/>
          <text x="90" y="30" fill="#f59e0b" font-size="11" font-weight="bold" text-anchor="middle">ADIM 2: KUMANDA VOLTAJI</text>
          <text x="90" y="52" fill="var(--text-secondary)" font-size="10.5" text-anchor="middle">24VDC Kumanda Var mı?</text>
          <rect x="20" y="62" width="140" height="20" rx="4" fill="${isStep2Done ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.15)'}"/>
          <text x="90" y="76" fill="${isStep2Done ? '#4ade80' : '#fcd34d'}" font-size="10" font-weight="bold" text-anchor="middle">
            ${selectedPath.step2 !== undefined ? (selectedPath.step2 ? '✅ 24V Var' : '❌ 24V Kesik') : '▶ Yanıtla'}
          </text>
        </g>

        <!-- Flow Node 3: Soru 3 -->
        <g transform="translate(640, 45)" class="flow-node" style="cursor:pointer" onclick="window.onFlowchartNodeClick('step3')">
          <rect width="180" height="90" rx="8" fill="var(--bg-card2)" stroke="${currentStep === 'step3' ? '#3b82f6' : (isStep3Done ? '#10b981' : 'var(--border)')}" stroke-width="2"/>
          <text x="90" y="30" fill="#a78bfa" font-size="11" font-weight="bold" text-anchor="middle">ADIM 3: NOKTA ATIŞI TEŞHİS</text>
          <text x="90" y="52" fill="var(--text-secondary)" font-size="10.5" text-anchor="middle">Kök Neden & Çözüm</text>
          <rect x="20" y="62" width="140" height="20" rx="4" fill="${isStep3Done ? 'rgba(16,185,129,0.2)' : 'rgba(167,139,250,0.15)'}"/>
          <text x="90" y="76" fill="${isStep3Done ? '#4ade80' : '#c4b5fd'}" font-size="10" font-weight="bold" text-anchor="middle">
            ${isStep3Done ? '🎯 Reçete Hazır' : '⏳ Bekliyor'}
          </text>
        </g>
      </svg>
    </div>
  `;
}

export function onFlowchartNodeClick(stepId) {
  if (typeof window.showToast === 'function') {
    window.showToast(`Teşhis Adımı Seçildi: ${stepId.toUpperCase()}`, 'info');
  }
  const wrap = document.getElementById('flowchart-svg-wrap');
  if (wrap && window.renderInteractiveFlowchartSVG) {
    const activePath = { step1: true };
    if (stepId === 'step2' || stepId === 'step3') activePath.step2 = true;
    if (stepId === 'step3') activePath.step3 = true;
    wrap.innerHTML = window.renderInteractiveFlowchartSVG(stepId, activePath);
  }
}

if (typeof window !== 'undefined') {
  window.renderInteractiveFlowchartSVG = renderInteractiveFlowchartSVG;
  window.onFlowchartNodeClick = onFlowchartNodeClick;
}

