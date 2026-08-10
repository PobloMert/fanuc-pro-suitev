(function(global){
  'use strict';
  const KEY='mtb-notification-lifecycle-v1';
  const now=()=>new Date().toISOString();
  const load=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
  const save=value=>localStorage.setItem(KEY,JSON.stringify(value));
  const keyOf=n=>n.key||[n.level,n.title,n.machineId||'',n.location||n.sub||''].join('|').toLocaleLowerCase('tr-TR');
  function reconcile(incoming){const history=load(),seen=new Set();const result=incoming.map(n=>{const key=keyOf(n),old=history[key],stamp=now();seen.add(key);const reopened=Boolean(old?.resolved);const next={...n,key,firstSeen:old?.firstSeen||stamp,lastSeen:stamp,repeatCount:(old?.repeatCount||0)+1,acknowledged:reopened?false:Boolean(old?.acknowledged),resolved:false,reopened:(old?.reopened||0)+(reopened?1:0)};history[key]=next;return next;});Object.keys(history).forEach(k=>{if(!seen.has(k)&&!history[k].resolved)history[k]={...history[k],resolved:true,resolvedAt:now()};});save(history);return result;}
  function update(key,patch){const history=load();if(!history[key])return;history[key]={...history[key],...patch,lastSeen:history[key].lastSeen||now()};save(history);global.checkNotifications?.();}
  function acknowledge(key){update(key,{acknowledged:true,acknowledgedAt:now()});}
  function resolve(key){update(key,{resolved:true,resolvedAt:now()});}
  global.MTBNotificationLifecycle=Object.freeze({reconcile,acknowledge,resolve,load,keyOf});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-notification-action]');if(!b)return;b.dataset.notificationAction==='ack'?acknowledge(b.dataset.notificationKey):resolve(b.dataset.notificationKey);});
})(window);
