/**
 * MTB Elektrik Bakım — FANUC Parameter Diff & Comparison Engine
 */

import { State } from '../state.js';

export function parseRawParamFile(textData) {
  if (!textData) return [];
  const lines = textData.split(/[\r\n]+/);
  const params = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    // Match N1815 P 00110000 or N1815 Q 12345 or 1815,00110000
    const match = trimmed.match(/^N?(\d+)\s+[PQ]\s+([0-9a-zA-B\s]+)/i) || trimmed.match(/^(\d+)[,\s\t]+([0-9a-zA-B]+)/);
    if (match) {
      const pNo = parseInt(match[1], 10);
      const val = match[2].trim();
      params.push({
        no: pNo,
        value: val,
        raw: trimmed
      });
    }
  });

  return params;
}

export function compareParameterSources(paramsA = [], paramsB = [], nameA = 'Kaynak A', nameB = 'Kaynak B') {
  const mapA = new Map();
  const mapB = new Map();

  paramsA.forEach(p => {
    const key = p.no || p.number;
    if (key) mapA.set(String(key), p);
  });

  paramsB.forEach(p => {
    const key = p.no || p.number;
    if (key) mapB.set(String(key), p);
  });

  const allKeys = new Set([...mapA.keys(), ...mapB.keys()]);
  const mismatched = [];
  const identical = [];
  const onlyInA = [];
  const onlyInB = [];

  allKeys.forEach(k => {
    const itemA = mapA.get(k);
    const itemB = mapB.get(k);

    if (itemA && itemB) {
      const valA = itemA.value || itemA.default || itemA.val || '';
      const valB = itemB.value || itemB.default || itemB.val || '';
      const name = itemA.name || itemB.name || itemA.description || itemB.description || `Parametre #${k}`;

      if (String(valA).trim() !== String(valB).trim()) {
        mismatched.push({
          no: k,
          name,
          valA: String(valA).trim(),
          valB: String(valB).trim(),
          itemA,
          itemB,
          type: 'diff'
        });
      } else {
        identical.push({
          no: k,
          name,
          valA: String(valA).trim(),
          valB: String(valB).trim(),
          itemA,
          itemB,
          type: 'same'
        });
      }
    } else if (itemA) {
      const name = itemA.name || itemA.description || `Parametre #${k}`;
      const valA = itemA.value || itemA.default || itemA.val || '';
      onlyInA.push({
        no: k,
        name,
        valA: String(valA).trim(),
        valB: '—',
        itemA,
        type: 'onlyA'
      });
    } else if (itemB) {
      const name = itemB.name || itemB.description || `Parametre #${k}`;
      const valB = itemB.value || itemB.default || itemB.val || '';
      onlyInB.push({
        no: k,
        name,
        valA: '—',
        valB: String(valB).trim(),
        itemB,
        type: 'onlyB'
      });
    }
  });

  // Sort by parameter number
  const numSort = (a, b) => parseInt(a.no) - parseInt(b.no);
  mismatched.sort(numSort);
  identical.sort(numSort);
  onlyInA.sort(numSort);
  onlyInB.sort(numSort);

  return {
    nameA,
    nameB,
    mismatched,
    identical,
    onlyInA,
    onlyInB,
    totalCount: allKeys.size,
    diffCount: mismatched.length + onlyInA.length + onlyInB.length
  };
}

if (typeof window !== 'undefined') {
  window.parseRawParamFile = parseRawParamFile;
  window.compareParameterSources = compareParameterSources;
}
