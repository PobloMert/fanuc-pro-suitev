'use strict';
(() => {
  const latest = new Map(); let lastPersist = 0; let renderQueued = false; let lastMarkup = '';
  const requestId = () => Math.random().toString(36).slice(2);
  function quality(sample) {
    if (sample.dataAgeMs > 10000) return 'stale';
    if (!sample.execution || !Number.isFinite(Number(sample.partCount)) || !Number.isFinite(Number(sample.spindleLoad))) return 'invalid';
    return 'good';
  }
  function render() {
    if(renderQueued)return; renderQueued=true;
    requestAnimationFrame(()=>{
      renderQueued=false;
      const grid=document.getElementById('obs-health-grid'); if(!grid)return;
      const markup=[...latest.values()].map(s=>`<div class="obs-card ${s.quality==='good'?'':s.quality==='stale'?'warn':'bad'}"><b>${escapeObs(s.machine)}</b> · ${escapeObs(s.execution)}<small>Program ${escapeObs(s.program||'-')} · Yük ${Number(s.spindleLoad||0).toFixed(1)}% · Kalite ${escapeObs(s.quality)}</small></div>`).join('');
      if(markup!==lastMarkup){lastMarkup=markup;grid.innerHTML=markup;}
    });
  }
  function escapeObs(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  window.addEventListener('fanuc:telemetry-snapshot', event => {
    const samples=(event.detail||[]).map(s=>({...s,quality:quality(s)})); samples.forEach(s=>latest.set(s.machine,s)); render();
    if(Date.now()-lastPersist>10000){lastPersist=Date.now(); parent.postMessage({type:'fanuc:telemetry',samples},'*');}
  });
  window.addEventListener('fanuc:alarm-event', event => parent.postMessage({type:'fanuc:alarm',alarm:event.detail},'*'));
  window.addEventListener('message', event => {
    if(event.data?.type!=='fanuc:summary-response')return;
    const sum=event.data.summary; if(sum?.ok) document.getElementById('obs-summary').textContent=sum.items.map(x=>`${x.machine}: ${x.samples} örnek, ort. yük ${Number(x.avg_load||0).toFixed(1)}%, kalite sorunu ${x.quality_issues}`).join(' · ')||'Henüz geçmiş yok';
    if(sum?.ok) document.getElementById('obs-alarms').textContent=sum.alarms.map(a=>`${a.machine} ${a.alarm_code}: ${a.count}`).join(' · ')||'Alarm kaydı yok';
    const b=event.data.backup?.data; document.getElementById('obs-backup').textContent=b?.status==='healthy'?`Sağlıklı · ${b.file}`:(b?.message||'Yedek yok');
  });
  document.addEventListener('DOMContentLoaded',()=>{
    if(new URLSearchParams(location.search).get('kiosk')==='1')document.body.classList.add('kiosk');
    document.getElementById('obs-kiosk')?.addEventListener('click',()=>{const u=new URL(location.href);u.searchParams.set('kiosk','1');location.href=u.toString();});
    document.getElementById('obs-export')?.addEventListener('click',()=>parent.postMessage({type:'fanuc:export',machine:window.currentMachine||'Fanuc',since:new Date(Date.now()-30*86400000).toISOString()},'*'));
    const ask=()=>parent.postMessage({type:'fanuc:summary-request',requestId:requestId(),since:new Date(Date.now()-86400000).toISOString()},'*'); ask(); setInterval(ask,30000);
  });
})();
