import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { curveCatmullRom, line, scaleLinear } from 'd3';
import { DEFAULT_LIGHT_PRESET_ID, LIGHT_PRESETS, getLightPreset } from './lightPresets.js';
import { COPY, PERSONALITY_COPY } from './content/copy.js';
import './styles.css';

const STORAGE_KEY = 'knock-knock-state-v2';
const LIGHT_SKIN_STORAGE_KEY = 'knock-knock-light-skin-v1';

const EVIDENCE_SUPPORTS_BY_KIND = {
  origin: ['curious', 'shy'],
  behavior: ['companion', 'explorer', 'calm', 'shy'],
  relationship: ['companion', 'nocturnal', 'curious'],
};

const EXPLORATION_STAGES = [
  { id: 'encounter', threshold: 20, title: '初次相遇', description: '你开始注意到它的回应。', lockedCopy: '先留下一个具体的回应，给这段相处一个起点。', icon: 'light', evidenceKinds: ['origin', 'behavior'] },
  { id: 'habit', threshold: 40, title: '发现习惯', description: '一些行为开始重复出现。', lockedCopy: '再观察几次，重复出现的细节会慢慢显出来。', icon: 'sound', evidenceKinds: ['behavior'] },
  { id: 'outline', threshold: 60, title: '看见性格轮廓', description: '它的回应似乎有自己的节奏。', lockedCopy: '还需要更多相处片刻，才能看见一条比较稳定的线索。', icon: 'profile', evidenceKinds: ['relationship', 'behavior'] },
  { id: 'understand', threshold: 80, title: '更深的理解', description: '你们开始形成熟悉的相处方式。', lockedCopy: '这一段留给未来的回应，不必急着提前解释。', icon: 'relation', evidenceKinds: ['relationship', 'behavior'] },
  { id: 'keepsake', threshold: 100, title: '留下纪念', description: '这一轮探索告一段落，留下一枚伙伴纪念章。', lockedCopy: '当这一轮相处告一段落，再把它收进纪念里。', icon: 'refresh', evidenceKinds: ['relationship', 'behavior'] },
];

const DEFAULT_STATE = {
  bond: 24,
  patience: 16,
  expression: 12,
  social: 4,
  presenceState: 'idle',
  lastInteractionAt: null,
  interactionKinds: [],
  currentCycle: { id: 'cycle-01', progress: 18, startedAt: Date.now(), completed: false, evidenceIds: ['seed', 'quiet'] },
  personality: { companion: 42, explorer: 34, nocturnal: 22, calm: 56, curious: 38, shy: 46 },
  completedCycles: [],
  evidence: [
    { id: 'seed', title: '它还没有被命名', kind: 'origin', category: '开始', note: '未知仍然保留。', time: '刚刚', supports: ['curious', 'shy'] },
    { id: 'quiet', title: '安静的在场', kind: 'behavior', category: '停留', note: '它没有马上回答，但没有离开。', time: '今天', supports: ['companion', 'calm'] },
  ],
  badges: ['origin'],
  interactions: 0,
  postcards: 0,
  lastEvent: '盒子里很安静。',
};

function normalizeState(input) {
  const stored = input || {};
  return {
    ...DEFAULT_STATE,
    ...stored,
    evidence: (Array.isArray(stored.evidence) ? stored.evidence : DEFAULT_STATE.evidence).map(item => ({
      ...item,
      supports: Array.isArray(item.supports) ? item.supports : (EVIDENCE_SUPPORTS_BY_KIND[item.kind] || []),
      category: item.category || (item.kind === 'relationship' ? '声音 / 关系' : item.kind === 'origin' ? '开始' : '相处'),
    })),
    badges: Array.isArray(stored.badges) ? stored.badges : DEFAULT_STATE.badges,
    interactionKinds: Array.isArray(stored.interactionKinds) ? stored.interactionKinds : [],
    personality: { ...DEFAULT_STATE.personality, ...(stored.personality || {}) },
    currentCycle: { ...DEFAULT_STATE.currentCycle, ...(stored.currentCycle || {}) },
    completedCycles: Array.isArray(stored.completedCycles) ? stored.completedCycles : [],
  };
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? normalizeState(JSON.parse(stored)) : normalizeState(DEFAULT_STATE);
  } catch {
    return normalizeState(DEFAULT_STATE);
  }
}

function loadLightPresetId() {
  try {
    return localStorage.getItem(LIGHT_SKIN_STORAGE_KEY) || DEFAULT_LIGHT_PRESET_ID;
  } catch {
    return DEFAULT_LIGHT_PRESET_ID;
  }
}

let audioContext;

function playTone(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioContext ||= new AudioContext();
    const ctx = audioContext;
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    const map = {
      knock: { frequency: 138, duration: 0.12, volume: 0.06, wave: 'triangle' },
      reply: { frequency: 330, duration: 0.32, volume: 0.04, wave: 'sine' },
      postcard: { frequency: 246, duration: 0.5, volume: 0.03, wave: 'sine' },
    };
    const sound = map[type] || map.reply;
    osc.type = sound.wave;
    osc.frequency.setValueAtTime(sound.frequency, now);
    osc.frequency.exponentialRampToValueAtTime(sound.frequency * 1.35, now + sound.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(sound.volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + sound.duration + 0.03);
    osc.addEventListener('ended', () => {
      osc.disconnect();
      gain.disconnect();
    });
  } catch {
    // Audio is progressive enhancement; the prototype remains usable without it.
  }
}

function playKnockPair(soft = false) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioContext ||= new AudioContext();
    const ctx = audioContext;
    if (ctx.state === 'suspended') void ctx.resume();
    [0, 0.17].forEach((delay, index) => {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(index ? 126 : 148, start);
      osc.frequency.exponentialRampToValueAtTime(index ? 82 : 94, start + 0.11);
      gain.gain.setValueAtTime(0.0001, start);
       gain.gain.exponentialRampToValueAtTime(index ? (soft ? 0.022 : 0.038) : (soft ? 0.026 : 0.044), start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.16);
      osc.addEventListener('ended', () => { osc.disconnect(); gain.disconnect(); });
    });
  } catch {
    // Sound is progressive enhancement; interactions remain available without audio.
  }
}

function playSoftRustle() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioContext ||= new AudioContext();
    const ctx = audioContext;
    if (ctx.state === 'suspended') void ctx.resume();
    const duration = 0.34;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      const fade = Math.sin(Math.PI * index / samples.length) ** 1.6;
      samples[index] = (Math.random() * 2 - 1) * fade;
    }
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const start = ctx.currentTime;
    source.buffer = buffer;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1550, start);
    filter.frequency.exponentialRampToValueAtTime(540, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.012, start + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
    source.stop(start + duration + 0.02);
    source.addEventListener('ended', () => { source.disconnect(); filter.disconnect(); gain.disconnect(); });
  } catch {
    // Procedural ambience is optional; the interaction itself remains available.
  }
}

function playListenSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioContext ||= new AudioContext();
    const ctx = audioContext;
    if (ctx.state === 'suspended') void ctx.resume();
    [
      { frequency: 158, delay: 0, duration: 0.15, volume: 0.025, wave: 'triangle' },
      { frequency: 126, delay: 0.18, duration: 0.18, volume: 0.018, wave: 'triangle' },
      { frequency: 228, delay: 0.46, duration: 0.48, volume: 0.018, wave: 'sine' },
      { frequency: 318, delay: 0.62, duration: 0.56, volume: 0.011, wave: 'sine' },
    ].forEach(note => {
      const start = ctx.currentTime + note.delay;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = note.wave || 'sine';
      osc.frequency.setValueAtTime(note.frequency, start);
      osc.frequency.exponentialRampToValueAtTime(note.frequency * 0.82, start + note.duration);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, start);
      filter.frequency.exponentialRampToValueAtTime(420, start + note.duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(note.volume, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + note.duration);
      osc.connect(filter).connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + note.duration + 0.03);
      osc.addEventListener('ended', () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); });
    });
  } catch {
    // Sound is progressive enhancement; interactions remain available without audio.
  }
}

function awardBadge(next, badge) {
  if (next.badges.includes(badge)) return next;
  return { ...next, badges: [...next.badges, badge] };
}

function addEvidence(next, evidence) {
  const kind = evidence.kind || 'behavior';
  return {
    ...next,
    evidence: [{
      id: `${kind}-${Date.now()}`,
      category: kind === 'relationship' ? '声音 / 关系' : kind === 'origin' ? '开始' : '相处',
      supports: EVIDENCE_SUPPORTS_BY_KIND[kind] || [],
      ...evidence,
    }, ...next.evidence],
  };
}

function getPersonalityEvidence(evidence, personalityId) {
  return evidence.filter(item => Array.isArray(item.supports) && item.supports.includes(personalityId));
}

function deriveProgress(next) {
  const uniqueKinds = new Set(next.interactionKinds || []).size;
  const observedEvidence = Math.min(Math.max((next.evidence || []).length - 2, 0), 5);
  return Math.min(100, 18 + uniqueKinds * 14 + observedEvidence * 8 + Math.min(next.postcards, 2) * 8 + Math.min(next.interactions, 6) * 2);
}

function Icon({ name, label }) {
  const shapes = {
    box: <><rect x="4" y="7" width="16" height="12" rx="2" /><path d="m4 10 8-4 8 4M12 6v13" /><circle cx="12" cy="13" r="1.4" fill="currentColor" stroke="none" /></>,
    island: <><path d="M3 16c3-4 5-4 8 0s5 4 10-1" /><circle cx="7" cy="7" r="2.2" /><path d="M7 10v3M17 5v4M15 7h4" /></>,
    evidence: <><rect x="6" y="4" width="12" height="17" rx="1.5" /><path d="M9 9h6M9 13h6M9 17h4" /></>,
    profile: <><circle cx="12" cy="8" r="3" /><path d="M6 20c.5-3.2 2.5-5 6-5s5.5 1.8 6 5" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.6-3L4 10" /><path d="M4 5v5h5M4 13a8 8 0 0 0 14.6 3L20 14" /><path d="M20 19v-5h-5" /></>,
    sound: <><path d="M4 10h4l4-4v12l-4-4H4z" /><path d="M16 9c1.5 1.2 1.5 3.8 0 5M19 7c3 2.2 3 6.8 0 9" /></>,
    visit: <><path d="M5 19 19 5M11 5h8v8" /><circle cx="6" cy="6" r="2" /></>,
    relation: <><circle cx="7" cy="12" r="3" /><circle cx="17" cy="7" r="3" /><circle cx="17" cy="17" r="3" /><path d="m9.7 10.7 4.6-2.5M9.7 13.3l4.6 2.5" /></>,
    light: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
    more: <><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></>,
    knock: <><path d="M8 14.5c0-1.7 1.8-2.7 3.5-2.7s4.5 1.1 4.5 3.6-2 4.2-4.5 4.2-4.5-1.8-4.5-4.1" /><path d="M8.5 10 6.8 7M13 9V5M17.5 10 20 7" /></>,
    wait: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    touch: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="7" opacity=".55" /><circle cx="12" cy="12" r="10" opacity=".25" /></>,
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-label={label} role={label ? 'img' : undefined} aria-hidden={label ? undefined : true} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[name] || shapes.box}</svg>;
}

function BrandMark() {
  return <span className="brand-lockup">
    <img className="brand-mark" src="/assets/knock-knock-logo.svg" alt="KNOCK KNOCK 图形标记" />
    <span className="brand-wordmark"><strong>KNOCK KNOCK</strong><small>THE UNKNOWN BOX</small></span>
  </span>;
}

function PhoneStatusIcons() {
  return <span className="phone-status-icons" aria-label="网络、电量状态">
    <svg viewBox="0 0 16 12" aria-hidden="true"><path d="M1.5 4.5a7.3 7.3 0 0 1 13 0M4 7a4.5 4.5 0 0 1 8 0M6.8 9.5a1.5 1.5 0 0 1 2.4 0" /></svg>
    <svg viewBox="0 0 20 12" aria-hidden="true"><rect x="1" y="1.5" width="16" height="9" rx="2" /><path d="M19 4.5v3" /><path d="M3.5 4h7.5v4H3.5z" fill="currentColor" stroke="none" /></svg>
  </span>;
}

function updateFromInteraction(previous, type) {
  const interactionKinds = [...new Set([...(previous.interactionKinds || []), type])];
  let next = {
    ...previous,
    interactions: previous.interactions + 1,
    lastInteractionAt: Date.now(),
    presenceState: 'responding',
    interactionKinds,
    bond: Math.min(100, previous.bond + (type === 'wait' ? 5 : type === 'feed' ? 4 : 2)),
    expression: Math.min(100, previous.expression + (type === 'touch' || type === 'feed' ? 3 : type === 'listen' ? 2 : 1)),
    personality: {
      ...previous.personality,
      companion: Math.min(100, previous.personality.companion + (type === 'wait' ? 3 : type === 'feed' ? 2 : 1)),
      explorer: Math.min(100, previous.personality.explorer + (type === 'knock' ? 2 : 0)),
      nocturnal: Math.min(100, previous.personality.nocturnal + (type === 'listen' ? 2 : 0)),
      calm: Math.min(100, previous.personality.calm + (type === 'wait' ? 2 : 0)),
      curious: Math.min(100, previous.personality.curious + (type === 'knock' || type === 'touch' || type === 'feed' ? 2 : 0)),
      shy: Math.max(12, previous.personality.shy + (type === 'touch' ? 1 : 0)),
    },
    lastEvent: type === 'knock' ? '两下轻敲送到了。' : type === 'wait' ? '你等了一会儿，它回应了。' : type === 'listen' ? '你听见了一声回响。' : type === 'feed' ? '你喂了一点光，它亮了一下。' : '它朝你的手边靠近了。',
  };
  if (type === 'wait') {
    next.patience = Math.min(100, previous.patience + 8);
    next = awardBadge(next, 'waited');
    next = addEvidence(next, { title: '等到它回答', kind: 'behavior', category: '等待 / 回应', supports: ['companion', 'calm'], note: '等待也算作一次陪伴。', time: '刚刚' });
  }
  if (type === 'touch') {
    next = addEvidence(next, { title: '手指靠近过', kind: 'behavior', category: '触摸 / 靠近', supports: ['companion', 'shy'], note: '手靠近时，光往这边移了一点。', time: '刚刚' });
  }
  if (type === 'feed') {
    next.patience = Math.min(100, previous.patience + 2);
    next = addEvidence(next, { title: '喂了一点光', kind: 'behavior', category: '照料 / 喂食', supports: ['companion', 'curious'], note: '一颗光点滑进盒子里，它亮了一下。', time: '刚刚' });
  }
  if (type === 'listen') {
    next.patience = Math.min(100, previous.patience + 3);
    next = addEvidence(next, { title: '听见一声回响', kind: 'relationship', category: '声音 / 靠近', supports: ['nocturnal', 'curious'], note: '声音很轻，像是从盒子深处传来。', time: '刚刚' });
  }
  if (type === 'knock') {
    next = addEvidence(next, { title: '熟悉的敲击有了回应', kind: 'behavior', category: '敲击 / 回应', supports: ['explorer', 'curious'], note: '两下轻敲之后，光在停顿里重新靠近。', time: '刚刚' });
  }
  if (next.interactions >= 3) next = awardBadge(next, 'three-visits');
  const progress = deriveProgress(next);
  next.currentCycle = { ...previous.currentCycle, progress, evidenceIds: next.evidence.slice(0, 8).map(item => item.id), completed: progress >= 100 };
  if (progress >= 100) {
    next = awardBadge(next, 'companion');
    if (!previous.currentCycle.completed) next.completedCycles = [{ id: next.currentCycle.id, completedAt: Date.now(), progress }, ...previous.completedCycles];
  }
  return next;
}

function D3TraitPath({ values }) {
  const x = scaleLinear().domain([0, values.length - 1]).range([10, 310]);
  const y = scaleLinear().domain([0, 100]).range([84, 10]);
  const makeLine = line().x((value, index) => x(index)).y(value => y(value)).curve(curveCatmullRom.alpha(0.65));
  const points = values.map(value => value);
  return <div className="d3-trait-wrap"><svg className="d3-trait" viewBox="0 0 320 96" role="img" aria-label="盒子的变化轨迹"><path d={makeLine(points)} fill="none" stroke="#f2552e" strokeWidth="2" strokeLinecap="round" /><path d={makeLine(points.map(value => Math.max(0, value - 8)))} fill="none" stroke="#8cc8d3" strokeWidth="1" strokeDasharray="2 6" /><g>{points.map((value, index) => <circle key={`${value}-${index}`} cx={x(index)} cy={y(value)} r="3.5" fill={index % 2 ? '#f6d96b' : '#f2552e'} stroke="#2f2a27" strokeWidth="1" />)}</g></svg><div className="d3-axis-labels"><span>靠近</span><span>回来</span><span>发亮</span><span>遇见</span></div></div>;
}

const COVER_WALL = LIGHT_PRESETS;

function CoverPattern({ kind, id }) {
  if (!kind) return null;
  const maskId = `cover-mask-${id}`;
  const pattern = {
    rays: <><circle cx="150" cy="100" r="28" /><path d="M150 100 150 0M150 100 245 22M150 100 300 100M150 100 256 182M150 100 150 200M150 100 44 182M150 100 0 100M150 100 45 24" /></>,
    contours: <><path d="M-20 42c45-36 95-36 140 0s95 36 140 0 95-36 140 0" /><path d="M-20 68c45-36 95-36 140 0s95 36 140 0 95-36 140 0" /><path d="M-20 94c45-36 95-36 140 0s95 36 140 0 95-36 140 0" /><path d="M-20 120c45-36 95-36 140 0s95 36 140 0 95-36 140 0" /><path d="M-20 146c45-36 95-36 140 0s95 36 140 0 95-36 140 0" /><path d="M-20 172c45-36 95-36 140 0s95 36 140 0 95-36 140 0" /></>,
    waves: <><path d="M0 42c36-30 76-30 112 0s76 30 112 0 76-30 112 0" /><path d="M0 74c36-30 76-30 112 0s76 30 112 0 76-30 112 0" /><path d="M0 106c36-30 76-30 112 0s76 30 112 0 76-30 112 0" /><path d="M0 138c36-30 76-30 112 0s76 30 112 0 76-30 112 0" /><path d="M0 170c36-30 76-30 112 0s76 30 112 0 76-30 112 0" /></>,
    dots: <><path d="M0 0h300v200H0z" stroke="none" /><g>{Array.from({ length: 48 }, (_, index) => <circle key={index} cx={(index % 8) * 43 + 20} cy={Math.floor(index / 8) * 31 + 18} r="2.2" />)}</g></>,
    lens: <><ellipse cx="150" cy="100" rx="140" ry="45" /><ellipse cx="150" cy="100" rx="112" ry="36" /><ellipse cx="150" cy="100" rx="82" ry="27" /><ellipse cx="150" cy="100" rx="51" ry="17" /></>,
  }[kind];
  return <svg className="cover-pattern" viewBox="0 0 300 200" aria-hidden="true"><defs><radialGradient id={maskId} cx="50%" cy="50%" r="68%"><stop offset="0%" stopColor="black" /><stop offset="48%" stopColor="black" stopOpacity=".35" /><stop offset="82%" stopColor="white" /><stop offset="100%" stopColor="white" /></radialGradient><mask id={`${maskId}-mask`}><rect width="300" height="200" fill={`url(#${maskId})`} /></mask></defs><g mask={`url(#${maskId}-mask)`} fill="none" stroke="white" strokeWidth=".8" strokeOpacity=".34" strokeLinecap="round">{pattern}</g></svg>;
}

function CoverNoise({ cardRef }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const host = cardRef.current;
    if (!canvas || !host) return undefined;
    const draw = () => {
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width * dpr));
      const height = Math.max(1, Math.ceil(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;
      const tile = document.createElement('canvas');
      tile.width = 128 * dpr;
      tile.height = 128 * dpr;
      const tileContext = tile.getContext('2d');
      const noise = tileContext.createImageData(tile.width, tile.height);
      for (let index = 0; index < noise.data.length; index += 4) {
        const value = Math.floor(Math.random() * 255);
        noise.data[index] = value;
        noise.data[index + 1] = value;
        noise.data[index + 2] = value;
        noise.data[index + 3] = 104;
      }
      tileContext.putImageData(noise, 0, 0);
      const context = canvas.getContext('2d');
      for (let x = 0; x < width; x += tile.width) {
        for (let y = 0; y < height; y += tile.height) context.drawImage(tile, x, y);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [cardRef]);
  return <canvas className="cover-noise" ref={canvasRef} aria-hidden="true" />;
}

function CoverCard({ cover, index, active, previewing, onPreviewStart, onPreviewEnd, onCommit, pulseKey }) {
  const cardRef = useRef(null);
  const motionRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, targetX: 0, targetY: 0 });
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    let frame = 0;
    let previous = performance.now();
    const tick = now => {
      const motion = motionRef.current;
      const dt = Math.min((now - previous) / 1000, 0.04);
      previous = now;
      const stiffness = 70;
      const damping = 2 * 0.86 * Math.sqrt(stiffness);
      motion.vx += (motion.targetX - motion.x) * stiffness * dt;
      motion.vy += (motion.targetY - motion.y) * stiffness * dt;
      motion.vx -= motion.vx * damping * dt;
      motion.vy -= motion.vy * damping * dt;
      motion.x += motion.vx * dt;
      motion.y += motion.vy * dt;
      if (cardRef.current) {
        cardRef.current.style.setProperty('--pointer-x', `${motion.x.toFixed(2)}px`);
        cardRef.current.style.setProperty('--pointer-y', `${motion.y.toFixed(2)}px`);
        cardRef.current.style.setProperty('--pattern-x', `${(-motion.x * 0.5).toFixed(2)}px`);
        cardRef.current.style.setProperty('--pattern-y', `${(-motion.y * 0.5).toFixed(2)}px`);
        cardRef.current.style.setProperty('--glow-x', `${50 + motion.x * 1.5}%`);
        cardRef.current.style.setProperty('--glow-y', `${50 + motion.y * 1.5}%`);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  const onPointerMove = event => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = cardRef.current.getBoundingClientRect();
    motionRef.current.targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 20;
    motionRef.current.targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 20;
  };
  const onPointerLeave = () => {
    motionRef.current.targetX = 0;
    motionRef.current.targetY = 0;
    setHovered(false);
    onPreviewEnd();
  };
  const commit = () => onCommit(cover.id);
  return <article ref={cardRef} className={`cover-card ${hovered ? 'is-hovered' : ''} ${active ? 'is-active' : ''} ${previewing ? 'is-previewing' : ''} ${pulseKey ? 'is-responding' : ''}`} style={{ '--cover-top': cover.colors.top, '--cover-bottom': cover.colors.bottom, '--blob-a': cover.colors.blobs[0], '--blob-b': cover.colors.blobs[1], '--blob-c': cover.colors.blobs[2], '--blob-d': cover.colors.blobs[3], '--delay': `${index * -2.4}s`, '--motion-duration': `${cover.motion.cycle}s` }} onPointerEnter={() => { setHovered(true); onPreviewStart(cover.id); }} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} onClick={commit} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); commit(); } }} role="button" tabIndex={0} aria-pressed={active} aria-label={`${cover.title[0]} ${cover.title[1]}`}>
    <div className="cover-blob blob-a"></div><div className="cover-blob blob-b"></div><div className="cover-blob blob-c"></div><div className="cover-blob blob-d"></div>
    <CoverNoise cardRef={cardRef} />
    <CoverPattern kind={cover.pattern} id={cover.id} />
    <span className="cover-title">{cover.title[0]}<br />{cover.title[1]}</span><span className="cover-subtitle">{cover.subtitle}</span>
    <span className="cover-index">0{index + 1}</span>
    <span className="cover-state-dot" aria-hidden="true"></span>
    <span className="cover-cursor-glow"></span>
  </article>;
}

function CoverWall({ activePresetId, previewPresetId, onPreviewStart, onPreviewEnd, onCommit, pulseKey }) {
  return <section className="cover-wall" id="light-scenes" aria-label="六种光场"><div className="cover-wall-heading"><span className="eyebrow">六种光场 · 任选一种</span><h2>给盒子选一种此刻的光。</h2><p>悬停可以预览，点击后会缓慢过渡。它们是光的氛围，不是伙伴性格。</p></div><div className="cover-grid">{COVER_WALL.map((cover, index) => <CoverCard key={cover.id} cover={cover} index={index} active={activePresetId === cover.id} previewing={previewPresetId === cover.id} onPreviewStart={onPreviewStart} onPreviewEnd={onPreviewEnd} onCommit={onCommit} pulseKey={pulseKey} />)}</div></section>;
}

const BOX_VERTEX_SHADER = `
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  varying vec3 vViewPosition;
  void main() {
    vLocalPosition = position;
    vLocalNormal = normal;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -viewPosition.xyz;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const BOX_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec3 uBaseColor;
  uniform vec3 uAtmosphereColor;
  uniform float uAtmosphereStrength;
  uniform float uTime;
  uniform vec3 uObjectOffset;
  uniform vec3 uLightPositions[4];
  uniform vec3 uLightColors[4];
  uniform float uLightIntensities[4];
  uniform float uLightRadii[4];
  uniform float uIntensity;
  uniform float uSoftness;
  uniform float uGrain;
  uniform float uEdgeDiffusion;
  uniform vec3 uInteractionPosition;
  uniform vec3 uInteractionColor;
  uniform float uInteractionStrength;
  uniform float uDebugReveal;
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  varying vec3 vViewPosition;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.7, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float softNoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = smoothstep(0.0, 1.0, fract(p));
    return mix(mix(mix(hash(i), hash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y), mix(mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
  }

  float fineNoise(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += softNoise(p) * amplitude;
      p = p * 2.03 + vec3(4.1, 1.7, 3.6);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 p = vLocalPosition + uObjectOffset;
    vec3 n = normalize(vLocalNormal);
    vec3 key = normalize(vec3(-0.42, 0.86, 0.66));
    float diffuse = 0.74 + max(dot(n, key), 0.0) * 0.45;
    float lowFrequency = fineNoise(p * 1.18 + vec3(uTime * 0.018, -uTime * 0.011, uTime * 0.014));
    float mediumNoise = fineNoise(p * 3.4 + vec3(-uTime * 0.025, uTime * 0.018, uTime * 0.014));
    float microGrain = fineNoise(p * 13.0 + vec3(0.15, 0.45, 0.3));
    float surfaceWarp = (lowFrequency - 0.5) * 0.12 + (mediumNoise - 0.5) * 0.045;
    vec3 warpedPosition = p + vec3(surfaceWarp, surfaceWarp * 0.55, -surfaceWarp * 0.72);
    vec3 weightedField = vec3(0.0);
    float totalWeight = 0.0;
    vec3 dominantColor = vec3(1.0);
    float dominantContribution = 0.0;

    for (int i = 0; i < 4; i++) {
      vec3 delta = warpedPosition - uLightPositions[i];
      float distanceSquared = dot(delta, delta);
      float radius = uLightRadii[i] * 0.64;
      float edgeNoise = softNoise(warpedPosition * 2.4 + vec3(float(i) * 3.1, uTime * 0.018, float(i) * 1.7));
      float organicDistance = max(0.0, distanceSquared + (edgeNoise - 0.5) * uEdgeDiffusion * 0.075 * radius * radius);
      float halo = exp(-organicDistance / (2.0 * (radius * 1.28) * (radius * 1.28)));
      float coreRadius = radius * (0.34 + uSoftness * 0.16);
      float core = exp(-organicDistance / (2.0 * coreRadius * coreRadius));
      float wrap = mix(0.55, 0.92, max(dot(normalize(-delta + vec3(0.0001)), n), 0.0) * uEdgeDiffusion);
      float contribution = (core * 0.72 + halo * 0.52) * uLightIntensities[i] * wrap;
      weightedField += uLightColors[i] * contribution;
      totalWeight += contribution;
      if (contribution > dominantContribution) {
        dominantContribution = contribution;
        dominantColor = uLightColors[i];
      }
    }

    vec3 averageColor = weightedField / max(totalWeight, 0.0001);
    float averageLuma = dot(averageColor, vec3(0.299, 0.587, 0.114));
    vec3 fieldColor = clamp(mix(vec3(averageLuma), averageColor, 1.35), 0.0, 1.0);
    fieldColor = mix(fieldColor, dominantColor, clamp(0.28 + dominantContribution * 0.46, 0.28, 0.68));
    float fieldAmount = min(0.92, 1.0 - exp(-totalWeight * (1.9 + uIntensity * 0.58)));
    vec3 interactionDelta = warpedPosition - uInteractionPosition;
    float interactionDistance = dot(interactionDelta, interactionDelta);
    float closeness = smoothstep(0.18, 0.82, uInteractionStrength);
    float interactionCoreRadius = mix(0.68, 0.3, closeness);
    float interactionHaloRadius = mix(1.46, 0.86, closeness);
    float interactionHalo = exp(-interactionDistance / (2.0 * interactionHaloRadius * interactionHaloRadius));
    float interactionCore = exp(-interactionDistance / (2.0 * interactionCoreRadius * interactionCoreRadius));
    float interactionAmount = (interactionHalo * mix(0.23, 0.34, closeness) + interactionCore * mix(0.32, 0.62, closeness)) * uInteractionStrength;
    float interactionMix = clamp(interactionAmount * (0.88 + uIntensity * 0.32), 0.0, 0.86);
    fieldColor = mix(fieldColor, uInteractionColor, interactionMix);
    fieldAmount = min(0.98, fieldAmount + interactionAmount * 0.42);

    vec3 viewDirection = normalize(vViewPosition);
    float edgeLight = pow(1.0 - max(dot(normalize(vLocalNormal), normalize(vec3(-0.1, 0.48, 0.86))), 0.0), 1.65);
    float grain = (microGrain - 0.5) * uGrain;
    vec3 atmosphere = mix(uBaseColor, uAtmosphereColor, uAtmosphereStrength * (0.5 + lowFrequency * 0.25));
    vec3 surfaceColor = atmosphere * (diffuse * 0.92 + (lowFrequency - 0.5) * 0.055 + edgeLight * 0.035);
    float fieldBlend = clamp(fieldAmount * (0.9 + uIntensity * 0.2), 0.0, 0.94);
    vec3 shell = vec3(0.86, 0.82, 0.76) * (0.88 + diffuse * 0.12);
    float opticalMix = clamp(0.42 + fieldAmount * 0.55, 0.42, 0.96);
    vec3 localFieldColor = clamp(weightedField * (0.9 + uIntensity * 0.4) + fieldColor * 0.5 + uInteractionColor * interactionAmount * 0.5, 0.0, 1.0);
    vec3 color = mix(surfaceColor * 1.04, localFieldColor, opticalMix);
    color = mix(color, mix(surfaceColor * 0.96, fieldColor, fieldBlend), 0.1 + fieldAmount * 0.08);
    color = mix(color, shell, 0.055 + edgeLight * 0.055);
    float sideFace = smoothstep(0.24, 0.92, max(n.x, 0.0));
    float topFace = smoothstep(0.24, 0.92, max(n.y, 0.0));
    color *= mix(vec3(1.0), vec3(0.84, 0.85, 0.86), sideFace);
    color *= mix(vec3(1.0), vec3(1.045, 1.025, 0.99), topFace);
    color += fieldColor * min(0.11, totalWeight * 0.15);
    color += clamp(weightedField * (0.14 + uIntensity * 0.1), 0.0, 0.28);
    color += fieldColor * 0.065 * mediumNoise;
    color += uInteractionColor * (interactionCore * 0.32 + interactionHalo * 0.065) * uInteractionStrength;
    color += vec3(grain);
    color += vec3(0.012, 0.01, 0.008) * (1.0 - max(dot(viewDirection, normalize(vLocalNormal)), 0.0));
    if (uDebugReveal > 0.5) {
      vec3 debugField = clamp(weightedField * (0.55 + uIntensity * 0.3) + fieldColor * (0.38 + fieldAmount * 0.8) + uInteractionColor * interactionAmount * 1.35, 0.0, 1.0);
      color = debugField;
    }
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createLightStyle(preset) {
  return {
    id: preset.id,
    atmosphereColor: new THREE.Color(preset.colors.core),
    colors: preset.colors.blobs.map(color => new THREE.Color(color)),
    intensities: preset.blobMotions.map((blob, index) => preset.optical.intensity * (0.76 + blob.scale * 0.16) * (index === 0 ? 1 : 0.9)),
    radii: preset.blobMotions.map(blob => preset.optical.radius * (0.68 + blob.scale * 0.18)),
    motion: { ...preset.motion },
    optical: { ...preset.optical },
    blobs: preset.blobMotions.map(blob => ({ ...blob })),
  };
}

function cloneLightStyle(style) {
  return {
    id: style.id,
    atmosphereColor: style.atmosphereColor.clone(),
    colors: style.colors.map(color => color.clone()),
    intensities: [...style.intensities],
    radii: [...style.radii],
    motion: { ...style.motion },
    optical: { ...style.optical },
    blobs: style.blobs.map(blob => ({ ...blob })),
  };
}

function blendLightStyle(from, to, amount, target) {
  target.id = to.id;
  target.atmosphereColor.copy(from.atmosphereColor).lerp(to.atmosphereColor, amount);
  for (let index = 0; index < 4; index += 1) {
    target.colors[index].copy(from.colors[index]).lerp(to.colors[index], amount);
    target.intensities[index] = THREE.MathUtils.lerp(from.intensities[index], to.intensities[index], amount);
    target.radii[index] = THREE.MathUtils.lerp(from.radii[index], to.radii[index], amount);
    target.blobs[index].u = THREE.MathUtils.lerp(from.blobs[index].u, to.blobs[index].u, amount);
    target.blobs[index].v = THREE.MathUtils.lerp(from.blobs[index].v, to.blobs[index].v, amount);
    target.blobs[index].depth = THREE.MathUtils.lerp(from.blobs[index].depth, to.blobs[index].depth, amount);
    target.blobs[index].driftX = THREE.MathUtils.lerp(from.blobs[index].driftX, to.blobs[index].driftX, amount);
    target.blobs[index].driftY = THREE.MathUtils.lerp(from.blobs[index].driftY, to.blobs[index].driftY, amount);
    target.blobs[index].scale = THREE.MathUtils.lerp(from.blobs[index].scale, to.blobs[index].scale, amount);
    target.blobs[index].speed = THREE.MathUtils.lerp(from.blobs[index].speed, to.blobs[index].speed, amount);
  }
  Object.keys(target.motion).forEach(key => { target.motion[key] = THREE.MathUtils.lerp(from.motion[key], to.motion[key], amount); });
  Object.keys(target.optical).forEach(key => { target.optical[key] = THREE.MathUtils.lerp(from.optical[key], to.optical[key], amount); });
}

function createBoxMaterial(baseColor, objectOffset, lightField) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(baseColor) },
      uAtmosphereColor: lightField.uAtmosphereColor,
      uAtmosphereStrength: lightField.uAtmosphereStrength,
      uObjectOffset: { value: objectOffset },
      uTime: lightField.uTime,
      uLightPositions: lightField.uLightPositions,
      uLightColors: lightField.uLightColors,
      uLightIntensities: lightField.uLightIntensities,
      uLightRadii: lightField.uLightRadii,
      uIntensity: lightField.uIntensity,
      uSoftness: lightField.uSoftness,
      uGrain: lightField.uGrain,
      uEdgeDiffusion: lightField.uEdgeDiffusion,
      uInteractionPosition: lightField.uInteractionPosition,
      uInteractionColor: lightField.uInteractionColor,
      uInteractionStrength: lightField.uInteractionStrength,
      uDebugReveal: lightField.uDebugReveal,
    },
    vertexShader: BOX_VERTEX_SHADER,
    fragmentShader: BOX_FRAGMENT_SHADER,
  });
}

function UnknownBoxScene({ feedback, onTouch, activePresetId, previewPresetId }) {
  const mountRef = useRef(null);
  const debugPanelRef = useRef(null);
  const feedbackRef = useRef(feedback);
  const touchRef = useRef(onTouch);
  const [failed, setFailed] = useState(false);
  const styleRef = useRef(createLightStyle(getLightPreset(activePresetId || DEFAULT_LIGHT_PRESET_ID)));
  const transitionRef = useRef(null);
  const debugEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).get('lightDebug') === '1';
  const debugFieldOnly = debugEnabled && new URLSearchParams(window.location.search).get('lightDebugField') === '1';

  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);
  useEffect(() => { touchRef.current = onTouch; }, [onTouch]);
  useEffect(() => {
    const target = createLightStyle(getLightPreset(previewPresetId || activePresetId || DEFAULT_LIGHT_PRESET_ID));
    const from = cloneLightStyle(styleRef.current);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    transitionRef.current = { from, to: target, elapsed: 0, duration: reduced ? 0 : 1.55 };
  }, [activePresetId, previewPresetId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let renderer;
    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      const cameraTarget = new THREE.Vector3(0, 0.16, 0);
      // Keep the broad interactive face nearly frontal, with only a slight top view.
      const cameraDirection = new THREE.Vector3(0.65, 1.42, 8.3).normalize();
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      renderer.debug.checkShaderErrors = import.meta.env.DEV;
      mount.appendChild(renderer.domElement);

      const stage = new THREE.Group();
      scene.add(stage);
      const lightPositions = Array.from({ length: 4 }, () => new THREE.Vector3());
      const lightColors = Array.from({ length: 4 }, () => new THREE.Vector3());
      const lightField = {
        uTime: { value: 0 },
        uAtmosphereColor: { value: new THREE.Color() },
        uAtmosphereStrength: { value: 0.12 },
        uLightPositions: { value: lightPositions },
        uLightColors: { value: lightColors },
        uLightIntensities: { value: [0, 0, 0, 0] },
        uLightRadii: { value: [1, 1, 1, 1] },
        uIntensity: { value: 0.7 },
        uSoftness: { value: 0.8 },
        uGrain: { value: 0.018 },
        uEdgeDiffusion: { value: 0.46 },
        uInteractionPosition: { value: new THREE.Vector3(0.08, 0.05, 0.54) },
        uInteractionColor: { value: new THREE.Color('#e5b8bc') },
        uInteractionStrength: { value: 0.2 },
        uDebugReveal: { value: debugFieldOnly ? 1 : 0 },
      };
      const boxOffset = new THREE.Vector3(0, 0, 0);
      const boxMaterial = createBoxMaterial('#F1EAE1', boxOffset, lightField);
      const box = new THREE.Mesh(new RoundedBoxGeometry(3.8, 3.35, 2.45, 18, 0.4), boxMaterial);
      box.position.set(0, 0.04, 0);
      // Keep the approved geometry; give the hero object a little more visual presence.
      box.scale.setScalar(1.12);
      box.userData.kind = 'box';
      stage.add(box);
      stage.updateMatrixWorld(true);

      const debugCoreMarker = debugEnabled ? new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 16, 10),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthTest: false, depthWrite: false }),
      ) : null;
      const debugHaloMarker = debugEnabled ? new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, depthTest: false, depthWrite: false, wireframe: true }),
      ) : null;
      const debugHitMarker = debugEnabled ? new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 14, 8),
        new THREE.MeshBasicMaterial({ color: 0x62b48c, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }),
      ) : null;
      if (debugCoreMarker && debugHaloMarker && debugHitMarker) {
        debugCoreMarker.renderOrder = 100;
        debugHaloMarker.renderOrder = 99;
        debugHitMarker.renderOrder = 101;
        debugCoreMarker.visible = false;
        debugHaloMarker.visible = false;
        debugHitMarker.visible = false;
        stage.add(debugCoreMarker, debugHaloMarker, debugHitMarker);
      }

      const shadowMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {},
        vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec2 vUv; void main(){float d=distance(vUv,vec2(.5)); float a=smoothstep(.52,.05,d)*.16; gl_FragColor=vec4(.23,.21,.19,a);}`,
      });
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.15, 1.7), shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.set(0, -1.5, 0.1);
      stage.add(shadow);

      const glowMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color('#e7aa88') }, uStrength: { value: 0.12 } },
        vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `uniform vec3 uColor; uniform float uStrength; varying vec2 vUv; void main(){float d=distance(vUv,vec2(.5)); float a=smoothstep(.5,.02,d)*uStrength; gl_FragColor=vec4(uColor,a);}`,
      });
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.95, 1.55), glowMaterial);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(0, -1.49, 0.08);
      stage.add(glow);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const interactionTarget = new THREE.Vector3(0.08, 0.05, 0.54);
      const interactionPosition = interactionTarget.clone();
      const interactionVelocity = new THREE.Vector3();
      let observedFeedbackStamp = feedbackRef.current.stamp;
      const localPoint = new THREE.Vector3();
      const localNormal = new THREE.Vector3(0, 0, 1);
      const boxHalfExtents = new THREE.Vector3(1.9, 1.675, 1.225);
      const pointerState = {
        isOverBox: false,
        isPressed: false,
        isDragging: false,
        pressedOnBox: false,
        inputKind: 'mouse',
        gestureMode: 'idle',
        pointerId: null,
        hasRaycastHit: false,
        lastHitPoint: new THREE.Vector3(0.08, 0.05, 0.54),
        lastMoveAt: 0,
      };
      const targetWithDrift = new THREE.Vector3();
      const rotationTarget = new THREE.Vector2(0, 0);
      const rotationPosition = new THREE.Vector2(0, 0);
      const dragStartClient = new THREE.Vector2();
      const dragStartRotation = new THREE.Vector2();
      let leaveTimer = 0;
      let pointerProximity = 0;
      let hoverAmount = 0;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const pointerToBox = event => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObject(box, false);
        pointerState.lastMoveAt = performance.now();
        pointerState.hasRaycastHit = hits.length > 0;
        if (!hits.length) {
          pointerProximity = 0;
          if (pointerState.isOverBox) {
            window.clearTimeout(leaveTimer);
            leaveTimer = window.setTimeout(() => { pointerState.isOverBox = false; }, 420);
          }
          return false;
        }

        window.clearTimeout(leaveTimer);
        const hit = hits[0];
        box.worldToLocal(localPoint.copy(hit.point));
        if (hit.face?.normal) localNormal.copy(hit.face.normal).normalize();
        else localNormal.copy(localPoint).normalize();
        // Keep the virtual source just inside the surface that was actually hit.
        // All five consumers now share box-local coordinates: raycast, target,
        // animated blobs, and the fragment shader's vLocalPosition.
        interactionTarget.copy(localPoint).addScaledVector(localNormal, -0.14);
        interactionTarget.x = THREE.MathUtils.clamp(interactionTarget.x, -boxHalfExtents.x + 0.08, boxHalfExtents.x - 0.08);
        interactionTarget.y = THREE.MathUtils.clamp(interactionTarget.y, -boxHalfExtents.y + 0.08, boxHalfExtents.y - 0.08);
        interactionTarget.z = THREE.MathUtils.clamp(interactionTarget.z, -boxHalfExtents.z + 0.08, boxHalfExtents.z - 0.08);
        pointerState.lastHitPoint.copy(localPoint);
        pointerState.isOverBox = true;
        pointerProximity = 1;
        return true;
      };
      const onPointerEnter = event => {
        if (event.pointerType !== 'touch') pointerToBox(event);
      };
      const onPointerMove = event => {
        if (event.pointerType === 'touch' && !pointerState.isPressed) return;
        window.clearTimeout(leaveTimer);
        if (pointerState.isPressed) {
          const rect = renderer.domElement.getBoundingClientRect();
          const deltaX = event.clientX - dragStartClient.x;
          const deltaY = event.clientY - dragStartClient.y;
          if (pointerState.inputKind === 'touch' && pointerState.gestureMode === 'pending' && Math.hypot(deltaX, deltaY) > 7) {
            if (Math.abs(deltaY) >= Math.abs(deltaX)) {
              pointerState.gestureMode = 'scroll';
              pointerState.isPressed = false;
              pointerState.pressedOnBox = false;
              onPointerLeave();
              return;
            }
            pointerState.gestureMode = pointerState.pressedOnBox ? 'drag' : 'other';
            if (pointerState.gestureMode === 'drag') {
              pointerState.isDragging = true;
              renderer.domElement.setPointerCapture?.(event.pointerId);
            }
          } else if (pointerState.inputKind !== 'touch' && !pointerState.isDragging && Math.hypot(deltaX, deltaY) > 5) {
            pointerState.isDragging = true;
          }
          if (pointerState.gestureMode === 'scroll') return;
          pointerToBox(event);
          if (pointerState.isDragging && pointerState.pressedOnBox) {
            rotationTarget.y = THREE.MathUtils.clamp(dragStartRotation.y + (deltaX / rect.width) * 1.25, -0.72, 0.72);
            rotationTarget.x = THREE.MathUtils.clamp(dragStartRotation.x - (deltaY / rect.height) * 0.58, -0.32, 0.32);
          }
          return;
        }
        pointerToBox(event);
      };
      const onPointerLeave = () => {
        pointerProximity = 0;
        pointerState.hasRaycastHit = false;
        window.clearTimeout(leaveTimer);
        leaveTimer = window.setTimeout(() => { pointerState.isOverBox = false; }, 420);
      };
      const onPointerDown = event => {
        if (event.button !== undefined && event.button !== 0) return;
        pointerState.isPressed = true;
        pointerState.isDragging = false;
        pointerState.inputKind = event.pointerType === 'touch' ? 'touch' : 'mouse';
        pointerState.gestureMode = pointerState.inputKind === 'touch' ? 'pending' : 'mouse';
        pointerState.pointerId = event.pointerId;
        pointerState.pressedOnBox = pointerToBox(event);
        dragStartClient.set(event.clientX, event.clientY);
        dragStartRotation.copy(rotationTarget);
        if (pointerState.inputKind !== 'touch') renderer.domElement.setPointerCapture?.(event.pointerId);
      };
      const onPointerUp = event => {
        const touchMoved = pointerState.inputKind === 'touch'
          && Math.hypot(event.clientX - dragStartClient.x, event.clientY - dragStartClient.y) > 7;
        const wasTap = pointerState.gestureMode !== 'scroll'
          && !touchMoved
          && pointerState.pressedOnBox
          && !pointerState.isDragging
          && pointerToBox(event);
        const capturedPointerId = pointerState.pointerId;
        pointerState.isPressed = false;
        pointerState.isDragging = false;
        pointerState.pressedOnBox = false;
        pointerState.gestureMode = 'idle';
        pointerState.pointerId = null;
        if (capturedPointerId !== null && renderer.domElement.hasPointerCapture?.(capturedPointerId)) {
          renderer.domElement.releasePointerCapture(capturedPointerId);
        }
        if (touchMoved && pointerState.inputKind === 'touch') onPointerLeave();
        if (wasTap) touchRef.current();
      };
      const onPointerCancel = event => {
        const wasTouch = pointerState.inputKind === 'touch';
        const capturedPointerId = pointerState.pointerId;
        pointerState.isPressed = false;
        pointerState.isDragging = false;
        pointerState.pressedOnBox = false;
        pointerState.gestureMode = 'idle';
        pointerState.pointerId = null;
        if (capturedPointerId !== null && renderer.domElement.hasPointerCapture?.(capturedPointerId)) {
          renderer.domElement.releasePointerCapture(capturedPointerId);
        }
        if (wasTouch) onPointerLeave();
      };
      renderer.domElement.addEventListener('pointerenter', onPointerEnter);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerleave', onPointerLeave);
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('pointercancel', onPointerCancel);

      let raf = 0;
      const timer = new THREE.Timer();
      const animate = () => {
        timer.update();
        const delta = Math.min(timer.getDelta(), 0.04);
        const elapsed = timer.getElapsed();
        const styleTransition = transitionRef.current;
        if (styleTransition) {
          styleTransition.elapsed += delta;
          const raw = styleTransition.duration === 0 ? 1 : Math.min(styleTransition.elapsed / styleTransition.duration, 1);
          const eased = raw * raw * (3 - 2 * raw);
          blendLightStyle(styleTransition.from, styleTransition.to, eased, styleRef.current);
          if (raw >= 1) transitionRef.current = null;
        }
        const style = styleRef.current;
        const motion = style.motion;
        const cycleTime = elapsed * ((Math.PI * 2) / Math.max(motion.cycle, 1)) * (reducedMotion ? 0 : motion.speed);
        const feedbackAge = (Date.now() - feedbackRef.current.stamp) / 1000;
        const interactionType = feedbackRef.current.type;
        if (feedbackRef.current.stamp !== observedFeedbackStamp) {
          observedFeedbackStamp = feedbackRef.current.stamp;
          if (!pointerState.hasRaycastHit) {
            const focus = {
              knock: [0, 0, 0.62], wait: [-0.42, 0.34, 0.52], touch: [0.4, -0.2, 0.66],
              listen: [0.02, 0.42, 0.46], feed: [0, -0.28, 0.68], reply: [0, 0.04, 0.58],
            }[interactionType];
            if (focus) interactionTarget.set(...focus);
            pointerProximity = Math.max(pointerProximity, 0.56);
          }
        }
        const recentlyApproached = pointerState.isOverBox;
        const hoverTarget = recentlyApproached ? 1 : 0;
        hoverAmount = THREE.MathUtils.damp(hoverAmount, hoverTarget, recentlyApproached ? 8 : 4.5, delta);
        const knockCollapse = feedbackRef.current.type === 'knock' ? Math.max(0, 1 - Math.abs(feedbackAge - 0.28) / 0.52) : 0;
        for (let index = 0; index < 4; index += 1) {
          const blob = style.blobs[index];
          const phase = cycleTime * blob.speed + blob.phase;
          const turbulence = motion.turbulence;
          const driftX = Math.sin(phase * 1.07 + index * 0.7) * blob.driftX * (1 + turbulence * 0.4);
          const driftY = Math.cos(phase * 0.83 + index * 0.42) * blob.driftY * (1 + turbulence * 0.3);
          const flow = Math.sin(cycleTime * 0.43 + blob.phase * 1.7) * turbulence * 0.08;
          lightPositions[index].set((blob.u - 0.5) * 2.62 + driftX + flow, (blob.v - 0.5) * 2.52 + driftY, -0.08 + blob.depth * 0.84 + Math.sin(phase * 0.62) * turbulence * 0.1);
          if (index === 0) lightPositions[index].lerp(interactionPosition, THREE.MathUtils.clamp(motion.followStrength * (0.3 + hoverAmount * 0.32), 0, 0.62));
          if (feedbackRef.current.type === 'knock' && feedbackAge > 0.78) lightPositions[index].x += (index === 0 ? -1 : 0.35) * Math.min((feedbackAge - 0.78) * 0.38, 0.36);
          lightColors[index].set(style.colors[index].r, style.colors[index].g, style.colors[index].b);
          lightField.uLightIntensities.value[index] = style.intensities[index] * (0.94 + Math.sin(phase * 0.5) * motion.breathing * 0.08) * (1 - knockCollapse * 0.72);
          lightField.uLightRadii.value[index] = style.radii[index] * (1 + Math.sin(phase * 0.38) * motion.breathing * 0.08) * (1 - knockCollapse * 0.3);
        }

        targetWithDrift.copy(interactionTarget);
        if (!recentlyApproached) {
          if (!reducedMotion) {
            targetWithDrift.x += Math.sin(elapsed * 0.34 * motion.speed) * motion.drift * 0.45;
            targetWithDrift.y += Math.cos(elapsed * 0.26 * motion.speed) * motion.drift * 0.28;
            targetWithDrift.z += Math.sin(elapsed * 0.2 * motion.speed) * motion.drift * 0.2;
          }
        }
        const stiffness = 70 * Math.max(0.42, motion.followStrength);
        const damping = 2 * 0.86 * Math.sqrt(stiffness);
        interactionVelocity.addScaledVector(targetWithDrift.sub(interactionPosition), stiffness * delta);
        interactionVelocity.multiplyScalar(Math.exp(-damping * delta));
        interactionPosition.addScaledVector(interactionVelocity, delta);
        const responseShape = {
          knock: [0.68, 1.02, 0.88], wait: [0.16, 1.38, 0.62], touch: [0.1, 0.82, 0.96],
          listen: [0.14, 1.28, 0.76], feed: [0.08, 1.12, 0.92], reply: [motion.responseDelay, 1.08, 0.58],
        }[interactionType] || [motion.responseDelay, 1.15, 0.48];
        const responseProgress = feedbackAge > responseShape[0] ? Math.min((feedbackAge - responseShape[0]) / responseShape[1], 1) : 0;
        const responsePulse = Math.sin(responseProgress * Math.PI);
        const approachStrength = hoverAmount * (0.32 + pointerProximity * 0.42);
        lightField.uInteractionPosition.value.copy(interactionPosition);
        lightField.uInteractionColor.value.copy(style.colors[0]);
        lightField.uInteractionStrength.value = THREE.MathUtils.clamp(approachStrength + responsePulse * responseShape[2] + (interactionType === 'knock' ? 0.08 : 0), 0, 1.35);
        lightField.uAtmosphereColor.value.copy(style.atmosphereColor);
        lightField.uAtmosphereStrength.value = 0.055 + style.optical.intensity * 0.045;
        lightField.uIntensity.value = style.optical.intensity;
        lightField.uSoftness.value = style.optical.softness;
        lightField.uGrain.value = style.optical.grain;
        lightField.uEdgeDiffusion.value = style.optical.edgeDiffusion;
        lightField.uTime.value = reducedMotion ? 0 : elapsed;
        if (debugEnabled) {
          debugCoreMarker.position.copy(interactionPosition);
          debugHaloMarker.position.copy(interactionPosition);
          debugHitMarker.position.copy(pointerState.lastHitPoint);
          debugCoreMarker.visible = true;
          debugHaloMarker.visible = true;
          debugHitMarker.visible = pointerState.hasRaycastHit;
          if (debugPanelRef.current && elapsed - (debugPanelRef.current.dataset.lastPaint || 0) > 0.08) {
            debugPanelRef.current.dataset.lastPaint = String(elapsed);
            debugPanelRef.current.textContent = [
              `Raycast Hit: ${pointerState.hasRaycastHit}`,
              `Pointer Local: ${pointerState.lastHitPoint.x.toFixed(3)} / ${pointerState.lastHitPoint.y.toFixed(3)} / ${pointerState.lastHitPoint.z.toFixed(3)}`,
              `Light Target: ${interactionTarget.x.toFixed(3)} / ${interactionTarget.y.toFixed(3)} / ${interactionTarget.z.toFixed(3)}`,
              `Light Current: ${interactionPosition.x.toFixed(3)} / ${interactionPosition.y.toFixed(3)} / ${interactionPosition.z.toFixed(3)}`,
              `Interaction Strength: ${lightField.uInteractionStrength.value.toFixed(3)}`,
              `Light Radius: ${lightField.uLightRadii.value[0].toFixed(3)}`,
              `Light Intensity: ${lightField.uLightIntensities.value[0].toFixed(3)}`,
              `Animation Time: ${lightField.uTime.value.toFixed(2)}`,
              `WebGL: ${renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1'} / programs ${renderer.info.programs.length}`,
            ].join('\n');
          }
        }
        if (reducedMotion) {
          // Direct manipulation remains available when decorative motion is reduced.
          rotationPosition.copy(rotationTarget);
        } else {
          rotationPosition.x = THREE.MathUtils.lerp(rotationPosition.x, rotationTarget.x, 1 - Math.exp(-4.8 * delta));
          rotationPosition.y = THREE.MathUtils.lerp(rotationPosition.y, rotationTarget.y, 1 - Math.exp(-4.8 * delta));
        }
        stage.rotation.x = rotationPosition.x;
        stage.rotation.y = rotationPosition.y;
        glowMaterial.uniforms.uColor.value.copy(style.colors[0]);
        glowMaterial.uniforms.uStrength.value = 0.06 + style.optical.intensity * 0.06;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      const onResize = () => {
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
        camera.aspect = Math.max(aspect, 0.1);
        const compactDesktopColumn = window.innerWidth > 700 && window.innerWidth <= 1100 && aspect < 1.45;
        const compactMobileStage = window.innerWidth <= 700 && aspect < 1.45;
        cameraTarget.x = compactMobileStage ? 0.18 : 0;
        cameraTarget.y = compactDesktopColumn ? -0.82 : 0.16;
        // Keep a consistent world-space framing while allowing the near face to
        // read slightly larger than the far edges, as it would in a real view.
        const viewHeight = compactDesktopColumn ? 6.2 : compactMobileStage ? 6.2 : aspect > 1.7 ? 4.7 : aspect < 1.45 ? 5.1 : 4.7;
        const distance = viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)));
        camera.position.copy(cameraTarget).addScaledVector(cameraDirection, distance);
        camera.lookAt(cameraTarget);
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);
      onResize();
      return () => {
        cancelAnimationFrame(raf);
        window.clearTimeout(leaveTimer);
        window.removeEventListener('resize', onResize);
        renderer.domElement.removeEventListener('pointerenter', onPointerEnter);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
        boxMaterial.dispose();
        debugCoreMarker?.geometry.dispose();
        debugCoreMarker?.material.dispose();
        debugHaloMarker?.geometry.dispose();
        debugHaloMarker?.material.dispose();
        debugHitMarker?.geometry.dispose();
        debugHitMarker?.material.dispose();
        shadowMaterial.dispose();
        glowMaterial.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      };
    } catch (error) {
      console.warn('Three.js scene unavailable', error);
      setFailed(true);
      return undefined;
    }
  }, []);

  if (failed) {
    return <div className="scene-fallback"><div className="fallback-box" aria-hidden="true"></div><span>当前设备不支持 WebGL，已切换为纯 CSS 盒体预览</span></div>;
  }
  return <div className="scene-host" ref={mountRef}>{debugEnabled && <pre className="light-debug-panel" ref={debugPanelRef} />}</div>;
}

function StickerGlyph({ kind }) {
  if (kind === 'warm') return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="7" /><path d="M20 3v7M20 30v7M3 20h7M30 20h7M8 8l5 5M27 27l5 5M32 8l-5 5M13 27l-5 5" /></svg>;
  if (kind === 'night') return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M27 8c-7 1-11 6-11 13 0 7 5 12 12 12 3 0 6-1 8-3-8 0-13-5-13-12 0-4 1-7 4-10Z" /></svg>;
  if (kind === 'patient') return <svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="14" /><circle cx="20" cy="20" r="7" /><path d="M20 1v5M20 34v5" /></svg>;
  if (kind === 'shy') return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M9 11 28 8l4 22-19 3Z" /><path d="m26 8 2 6 4-6" /></svg>;
  return <svg viewBox="0 0 40 40" aria-hidden="true"><path d="m20 4 4.4 10.4L36 20l-11.6 5.6L20 36l-4.4-10.4L4 20l11.6-5.6Z" /><circle cx="20" cy="20" r="2.2" /></svg>;
}

const BADGE_DETAILS = {
  origin: { shape: 'seal', tone: 'sun', kind: 'curious', label: 'CURIOUS', title: '未知的开始', copy: '你没有急着给它命名。' },
  waited: { shape: 'paper', tone: 'lilac', kind: 'patient', label: 'PATIENT', title: '等到它回答', copy: '你把等待当成照料。' },
  'three-visits': { shape: 'star', tone: 'coral', kind: 'warm', label: 'WARM', title: '第三次来访', copy: '关系开始有自己的节奏。' },
  postcard: { shape: 'polaroid', tone: 'blue', kind: 'night', label: 'NIGHT', title: '声音寄出去了', copy: '一个盒子把回应寄给另一个盒子。' },
  companion: { shape: 'seal', tone: 'sun', kind: 'warm', label: 'COMPANION', title: '陪伴型伙伴', copy: '一轮探索结束后，留下的纪念章。' },
  explorer: { shape: 'puffy', tone: 'mint', kind: 'curious', label: 'EXPLORER', title: '探索型伙伴', copy: '你们一起走过了几条新的路径。' },
  nocturnal: { shape: 'circle', tone: 'blue', kind: 'night', label: 'NIGHT', title: '夜行型伙伴', copy: '夜晚的线索开始变得清楚。' },
  calm: { shape: 'paper', tone: 'lilac', kind: 'patient', label: 'CALM', title: '安静型伙伴', copy: '它不急着回答，也没有离开。' },
  curious: { shape: 'washi', tone: 'yellow', kind: 'curious', label: 'CURIOUS', title: '好奇', copy: '它对新的靠近保持一点兴趣。' },
};

function StickerBadge({ id, title, copy, unlocked = true, compact = false, onOpen }) {
  const meta = BADGE_DETAILS[id] || { shape: 'puffy', tone: 'sun', kind: 'curious', label: 'CURIOUS', title: '未知贴纸', copy: '还没有足够的线索。' };
  const badgeTitle = title || meta.title;
  const badgeCopy = copy || meta.copy;
  const handleKeyDown = event => {
    if (onOpen && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onOpen(id);
    }
  };
  return <div className={`sticker-badge ${meta.shape} ${meta.tone} ${unlocked ? 'unlocked' : 'locked'} ${compact ? 'compact' : ''} ${onOpen ? 'is-interactive' : ''}`} title={badgeTitle} onClick={() => onOpen?.(id)} onKeyDown={handleKeyDown} role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}>
    <div className="sticker-badge-mark"><StickerGlyph kind={meta.kind} /></div>
    {!compact && <div className="sticker-badge-copy"><strong>{badgeTitle}</strong><small>{unlocked ? badgeCopy : '还没有被它留下。'}</small><em>{meta.label}</em></div>}
  </div>;
}

function SignalWave({ active = false }) {
  return <div className={`signal-wave ${active ? 'is-active' : ''}`} aria-label="今日信号波形">{[11, 19, 8, 24, 15, 28, 10, 20, 13, 23, 9, 16].map((height, index) => <i key={index} style={{ '--bar-height': `${height}px`, '--bar-delay': `${index * 55}ms` }} />)}</div>;
}

function MiniBoxArt({ preset }) {
  const colorA = preset.colors.blobs[0];
  const colorB = preset.colors.blobs[1];
  return <svg className="mini-box-art" viewBox="0 0 220 82" role="img" aria-label="一体成型的柔光盒子"><defs><linearGradient id="mini-box-gradient" x1=".12" y1=".2" x2=".94" y2=".9"><stop offset="0" stopColor={colorA} stopOpacity=".8" /><stop offset=".55" stopColor={colorB} stopOpacity=".72" /><stop offset="1" stopColor={preset.colors.blobs[2]} stopOpacity=".62" /></linearGradient><linearGradient id="mini-box-face" x1=".1" y1="0" x2=".9" y2="1"><stop stopColor="#fffaf3" stopOpacity=".82" /><stop offset="1" stopColor="#eadfd5" stopOpacity=".52" /></linearGradient></defs><path d="M57 23q0-4 4-5l49-10q3-.6 6 0l52 13q4 1 4 5v34q0 4-4 5l-49 10q-3 .6-6 0L61 62q-4-1-4-5Z" fill="url(#mini-box-gradient)" stroke="#8f837b" strokeOpacity=".45" strokeWidth="1" /><path d="m61 20 50-10q3-.6 6 0l52 13-54 12Z" fill="url(#mini-box-face)" opacity=".8" /><path d="m115 35 54-12v34q0 4-4 5l-50 10Z" fill={preset.colors.blobs[2]} opacity=".24" /><path d="M69 28c17-6 27-7 42-3 13 4 24 3 38-3" fill="none" stroke="#fffaf3" strokeOpacity=".42" strokeWidth="4" strokeLinecap="round" /></svg>;
}

function StickerArtworkLayer() {
  return <div className="sticker-art-layer" aria-hidden="true">
    <div className="island-composition island-composition-home">
      <img src="/assets/stickers/island-marker-sticker.png" alt="" />
      <img src="/assets/stickers/unknown-presence-sticker.png" alt="" />
      <span className="sticker-spark sticker-spark-one"></span>
      <span className="sticker-spark sticker-spark-two"></span>
    </div>
    <div className="island-composition island-composition-visitor">
      <img src="/assets/stickers/island-postcard-sticker.png" alt="" />
      <img src="/assets/stickers/listening-ear-sticker.png" alt="" />
    </div>
    <div className="island-composition island-composition-relation">
      <img src="/assets/stickers/island-reply-trace-sticker.png" alt="" />
      <img src="/assets/stickers/unknown-presence-sticker.png" alt="" />
      <span className="sticker-spark sticker-spark-three"></span>
    </div>
  </div>;
}

function IslandHotspotLayer({ onOpenHearing, onOpenVisitors, onOpenRelations }) {
  return <div className="island-hotspot-layer" aria-label="盒群岛入口">
    <button className="island-hotspot island-hotspot-home" type="button" onClick={onOpenHearing} aria-label="听见我的盒子附近的声音"><span className="hotspot-ring" /></button>
    <button className="island-hotspot island-hotspot-visitor" type="button" onClick={onOpenVisitors} aria-label="查看今天的匿名来访"><span className="hotspot-ring" /></button>
    <button className="island-hotspot island-hotspot-relation" type="button" onClick={onOpenRelations} aria-label="查看关系光痕"><span className="hotspot-ring" /></button>
  </div>;
}

function IslandLabels() {
  return <div className="island-labels" aria-hidden="true">
    <div className="island-label island-label-home"><span>我的盒子</span><strong>听见</strong></div>
    <div className="island-label island-label-visitor"><span>今日来访</span><strong>来访</strong></div>
    <div className="island-label island-label-relation"><span>关系</span><strong>相遇记录</strong></div>
  </div>;
}

function IslandCollage({ onOpenHearing, onOpenVisitors, onOpenRelations }) {
  return <div className="island-collage" role="group" aria-label="由纸质贴纸组成的盒群岛">
    <div className="collage-paper-grain" aria-hidden="true" />
    <div className="collage-routes" aria-hidden="true"><i className="collage-route collage-route-one" /><i className="collage-route collage-route-two" /></div>
    <StickerArtworkLayer />
    <IslandHotspotLayer onOpenHearing={onOpenHearing} onOpenVisitors={onOpenVisitors} onOpenRelations={onOpenRelations} />
    <IslandLabels />
  </div>;
}

const ISLAND_VISITORS = [
  {
    id: '047',
    place: '雾岸岛',
    time: '今天 · 20:14',
    ownerNote: '听见第二下敲击后，它安静了很久，才把光慢慢移到窗边。',
    trace: '晚到的暖光',
    sticker: '/assets/stickers/unknown-presence-sticker.png',
  },
  {
    id: '012',
    place: '浅湾',
    time: '今天 · 18:42',
    ownerNote: '安静了一会儿，光还停在刚才触碰过的地方。',
    trace: '停在原处的光',
    sticker: '/assets/stickers/listening-ear-sticker.png',
  },
];

const MY_ISLAND_DECOR = [
  { id: 'shell', title: '回声贝', note: '收住一声轻响，等它慢慢回来。', sticker: '/assets/stickers/listening-ear-sticker.png' },
  { id: 'lamp', title: '潮汐小灯', note: '天色暗下来时，亮一会儿就好。', sticker: '/assets/stickers/unknown-presence-sticker.png' },
  { id: 'boat', title: '等船的小码头', note: '小船停在这里，准备去邻岛看看。', sticker: '/assets/stickers/island-postcard-sticker.png' },
];

function App() {
  const [state, setState] = useState(loadState);
  const [activePresetId, setActivePresetId] = useState(loadLightPresetId);
  const [previewPresetId, setPreviewPresetId] = useState(null);
  const [skinPulse, setSkinPulse] = useState(0);
  const previewMode = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('preview') : null;
  const previewTab = previewMode === 'island' || previewMode === 'my-island' ? 'island' : previewMode === 'profile' ? 'profile' : 'box';
  const [tab, setTab] = useState(previewTab);
  const [islandView, setIslandView] = useState(previewMode === 'my-island' ? 'my-island' : 'map');
  const [selectedIslandDecor, setSelectedIslandDecor] = useState('shell');
  const [selectedVisitorId, setSelectedVisitorId] = useState(null);
  const [savedVisits, setSavedVisits] = useState(() => {
    try { return JSON.parse(localStorage.getItem('knockknock.saved-visits.v1') || '[]'); } catch { return []; }
  });
  const [feedback, setFeedback] = useState({ type: 'idle', stamp: Date.now() - 2000 });
  const [hoverAction, setHoverAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState(null);
  const [personalityOpen, setPersonalityOpen] = useState(null);
  const [unlockedBadge, setUnlockedBadge] = useState(null);
  const [evidenceFilter, setEvidenceFilter] = useState('all');
  const [islandHearingOpen, setIslandHearingOpen] = useState(false);
  const [postcardOpen, setPostcardOpen] = useState(false);
  const [postcardDraft, setPostcardDraft] = useState('soft-knock');
  const [postcardStatus, setPostcardStatus] = useState('idle');
  const [postcardReply, setPostcardReply] = useState(false);
  const [hearingPlaying, setHearingPlaying] = useState(false);
  const [message, setMessage] = useState('盒子里很安静。敲两下试试。');
  const soundEnabled = state.soundEnabled !== false;
  const responseTimerRef = useRef(null);
  const postcardReplyTimerRef = useRef(null);
  const hearingTimerRef = useRef(null);
  const badgeCountRef = useRef(state.badges.length);
  const phoneContentRef = useRef(null);

  const playHearingReply = () => {
    if (soundEnabled) playListenSound();
    setHearingPlaying(true);
    window.clearTimeout(hearingTimerRef.current);
    hearingTimerRef.current = window.setTimeout(() => {
      setHearingPlaying(false);
      hearingTimerRef.current = null;
    }, 1500);
    setMessage('你听见雾岸岛传来的一声回响。');
  };

  const clearResponseTimer = useCallback(() => {
    if (responseTimerRef.current) {
      window.clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearResponseTimer, [clearResponseTimer]);

  useEffect(() => () => {
    if (postcardReplyTimerRef.current) window.clearTimeout(postcardReplyTimerRef.current);
    if (hearingTimerRef.current) window.clearTimeout(hearingTimerRef.current);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(LIGHT_SKIN_STORAGE_KEY, activePresetId);
  }, [activePresetId]);

  useEffect(() => {
    localStorage.setItem('knockknock.saved-visits.v1', JSON.stringify(savedVisits));
  }, [savedVisits]);

  useEffect(() => {
    phoneContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [tab, islandView]);

  useEffect(() => {
    if (state.badges.length > badgeCountRef.current) setUnlockedBadge(state.badges[state.badges.length - 1]);
    badgeCountRef.current = state.badges.length;
  }, [state.badges]);

  useEffect(() => {
    const overlayOpen = drawerOpen || Boolean(selectedEvidence) || Boolean(selectedBadge) || Boolean(progressOpen) || Boolean(personalityOpen) || Boolean(unlockedBadge) || postcardOpen || islandHearingOpen;
    document.body.classList.toggle('modal-open', overlayOpen);
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return;
      setDrawerOpen(false);
      setSettingsOpen(false);
      setResetConfirm(false);
      setSelectedEvidence(null);
      setSelectedBadge(null);
      setProgressOpen(false);
      setSelectedStage(null);
      setPersonalityOpen(null);
      setUnlockedBadge(null);
      setPostcardOpen(false);
      setIslandHearingOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('modal-open');
    };
  }, [drawerOpen, selectedEvidence, selectedBadge, progressOpen, personalityOpen, unlockedBadge]);

  const commitReply = useCallback((type) => {
    setState(previous => updateFromInteraction(previous, type));
    setSkinPulse(Date.now());
    setFeedback({ type: 'reply', stamp: Date.now() });
    setMessage(type === 'wait' ? '光慢慢靠近，又停住了。' : type === 'feed' ? '它亮了一下，像是吃到了。' : '它停了一下，回应了。');
    if (soundEnabled) playTone('reply');
    responseTimerRef.current = null;
    setBusy(false);
  }, [soundEnabled]);

  const doInteraction = useCallback((type) => {
    if (busy) return;
    setBusy(true);
    setFeedback({ type, stamp: Date.now() });
    setState(previous => ({
      ...previous,
      presenceState: type === 'knock' ? 'hesitating' : type === 'listen' ? 'listening' : type === 'wait' ? 'aware' : 'approaching',
      lastInteractionAt: Date.now(),
    }));
    if (type === 'knock') {
      setMessage('两下轻敲，送到了。');
      if (soundEnabled) playKnockPair();
      responseTimerRef.current = window.setTimeout(() => commitReply('knock'), 1800);
    } else if (type === 'wait') {
      setMessage('先陪它等一会儿。');
      if (soundEnabled) playSoftRustle();
      responseTimerRef.current = window.setTimeout(() => commitReply('wait'), 2400);
    } else if (type === 'touch') {
      setMessage('光朝你的手边靠近了。');
      if (soundEnabled) playKnockPair(true);
      responseTimerRef.current = window.setTimeout(() => commitReply('touch'), 550);
    } else if (type === 'feed') {
      setMessage('一点光滑进盒子里了。');
      if (soundEnabled) playTone('reply');
      responseTimerRef.current = window.setTimeout(() => commitReply('feed'), 850);
    } else {
      setMessage('听见一声回响。');
      if (soundEnabled) playListenSound();
      responseTimerRef.current = window.setTimeout(() => commitReply('listen'), 1550);
    }
  }, [busy, commitReply, soundEnabled]);

  const touchBox = useCallback(() => doInteraction('touch'), [doInteraction]);

  const sendPostcard = () => {
    if (busy) return;
    if (postcardReplyTimerRef.current) window.clearTimeout(postcardReplyTimerRef.current);
    setState(previous => {
      let next = { ...previous, social: Math.min(100, previous.social + 10), postcards: previous.postcards + 1, lastEvent: '047 号盒子晚一点回了你。', presenceState: 'responding', lastInteractionAt: Date.now() };
      next = awardBadge(next, 'postcard');
      next = addEvidence(next, { title: '寄出一段声音', kind: 'relationship', category: '声音明信片', supports: ['companion', 'nocturnal'], note: '分享的是气息，不是比较。', time: '刚刚' });
      const progress = deriveProgress(next);
      next.currentCycle = { ...previous.currentCycle, progress, evidenceIds: next.evidence.slice(0, 8).map(item => item.id), completed: progress >= 100 };
      return next;
    });
    if (soundEnabled) playTone('postcard');
    setPostcardOpen(false);
    setPostcardStatus('sent');
    setPostcardReply(false);
    setMessage('回应寄出了。它可能晚一点听见。');
    postcardReplyTimerRef.current = window.setTimeout(() => {
      setPostcardStatus('replied');
      setPostcardReply(true);
      setMessage('047 号盒子回了一点更轻的回应。');
      if (soundEnabled) playTone('reply');
    }, 3200);
  };

  const reset = () => {
    clearResponseTimer();
    localStorage.removeItem(STORAGE_KEY);
    setState(normalizeState({ ...DEFAULT_STATE, currentCycle: { ...DEFAULT_STATE.currentCycle, id: `cycle-${Date.now()}`, startedAt: Date.now() } }));
    setActivePresetId(DEFAULT_LIGHT_PRESET_ID);
    setPreviewPresetId(null);
    localStorage.removeItem(LIGHT_SKIN_STORAGE_KEY);
    setBusy(false);
    setMessage('重新从一个未知盒开始。');
    setResetConfirm(false);
    setSettingsOpen(false);
    setDrawerOpen(false);
  };

  const commitPreset = useCallback((id) => {
    setActivePresetId(id);
    setPreviewPresetId(null);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => document.querySelector('.scene-stage')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }));
  }, []);

  const badges = [
    ['origin', '未知的开始', '你没有急着给它命名。'],
    ['waited', '等到它回答', '你把等待当成照料。'],
    ['three-visits', '第三次来访', '关系开始有自己的节奏。'],
    ['postcard', '声音寄出去了', '一个盒子把回应寄给另一个盒子。'],
    ['companion', '陪伴型伙伴', '一轮探索结束后的纪念章。'],
    ['explorer', '探索型伙伴', '一起走过了几条新的路径。'],
    ['nocturnal', '夜行型伙伴', '夜晚的线索开始变得清楚。'],
    ['calm', '安静型伙伴', '它不急着回答，也没有离开。'],
    ['curious', '好奇', '目前的猜测，还会继续变化。'],
  ];

  const activePreset = getLightPreset(activePresetId);
  const selectedIslandDecorItem = MY_ISLAND_DECOR.find(item => item.id === selectedIslandDecor) || MY_ISLAND_DECOR[0];
  const phoneHeaderTitle = tab === 'island'
    ? islandView === 'my-island' ? '我的小岛'
      : islandView === 'visitors' || islandView === 'visitor-detail' ? '来访'
        : islandView === 'relations' ? '关系' : '盒群岛'
    : COPY.tabs[tab];
  const hoveredAction = COPY.actions[hoverAction];
  const presenceCopy = COPY.state[state.presenceState] || COPY.state.idle;
  const hoverCopy = hoveredAction ? [hoveredAction.label, hoveredAction.hover] : [presenceCopy.eyebrow, presenceCopy.title];
  const interactionClasses = { knock: 'is-knocking', wait: 'is-waiting', touch: 'is-touching', listen: 'is-listening', feed: 'is-feeding' };
  const reactionSticker = {
    wait: '/assets/stickers/wait-hourglass-sticker.png',
    touch: '/assets/stickers/gentle-touch-sticker.png',
    listen: '/assets/stickers/listening-ear-sticker.png',
  }[feedback.type];
  const todayNote = state.interactions > 0 ? state.lastEvent : '还没有新的片刻。敲两下试试。';
  const visibleEvidence = state.evidence.filter(item => evidenceFilter === 'all' || (evidenceFilter === 'sound' ? item.kind === 'relationship' : evidenceFilter === 'light' ? item.kind === 'origin' : item.kind === 'behavior'));
  const selectedStageData = EXPLORATION_STAGES.find(stage => stage.id === selectedStage);
  const selectedStageEvidence = selectedStageData ? state.evidence.filter(item => selectedStageData.evidenceKinds.includes(item.kind)).slice(0, 2) : [];
  const currentStage = EXPLORATION_STAGES.find(stage => state.currentCycle.progress < stage.threshold) || EXPLORATION_STAGES[EXPLORATION_STAGES.length - 1];
  const selectedVisitor = ISLAND_VISITORS.find(visitor => visitor.id === selectedVisitorId) || ISLAND_VISITORS[0];
  const relatedPersonalityEvidence = personalityOpen ? getPersonalityEvidence(state.evidence, personalityOpen) : [];
  const closeProgress = () => { setProgressOpen(false); setSelectedStage(null); };

  return <div className="app-shell">
    <header className="app-header">
      <a className="brand" href="#experience" aria-label="KNOCK KNOCK 首页"><BrandMark /></a>
      <nav className="site-nav" aria-label="网页导航"><a href="#experience">体验</a><a href="#light-scenes">六种光场</a><a href="#product-idea">产品理念</a></nav>
      <button className="text-button top-menu-button" onClick={() => { setDrawerOpen(true); setSettingsOpen(true); }}><Icon name="more" /><span>设置</span></button>
    </header>

    <main className="prototype-board" id="experience">
      <section className="scene-column" aria-label="独立实体互动场景">
        <div className="scene-topline"><span>{COPY.hero.label}</span></div>
        <h1>{COPY.hero.title[0]}<br />{COPY.hero.title[1]}</h1>
        <p className="scene-intro">{COPY.hero.intro[0]}<br />{COPY.hero.intro[1]}</p>
        <div className={`scene-stage ${interactionClasses[feedback.type] || ''}`}>
          <UnknownBoxScene feedback={feedback} onTouch={touchBox} activePresetId={activePresetId} previewPresetId={previewPresetId} />
          <img className="knock-hand-sticker" src="/assets/stickers/knock-hand-sticker.png" alt="" aria-hidden="true" />
          {reactionSticker && <img className="reaction-sticker" src={reactionSticker} alt="" aria-hidden="true" />}
        </div>
        <div className="scene-controls">
          <div className="scene-control-head"><span className="eyebrow">{hoverCopy[0]}</span><small className="scene-touch-hint">靠近有光 · 轻点回应 · 按住拖动转向</small></div>
          <div className="scene-message"><strong>{hoverCopy[1]}</strong><small>{message}</small><div className="scene-quick-actions">
            <button type="button" className={busy && feedback.type === 'knock' ? 'is-current-action' : ''} disabled={busy} onClick={() => doInteraction('knock')} onMouseEnter={() => setHoverAction('knock')} onMouseLeave={() => setHoverAction(null)} onFocus={() => setHoverAction('knock')} onBlur={() => setHoverAction(null)}><img className="action-sticker action-sticker--knock" src="/assets/stickers/knock-hand-sticker.png" alt="" aria-hidden="true" /><span>敲两下</span></button>
            <button type="button" className={busy && feedback.type === 'wait' ? 'is-current-action' : ''} disabled={busy} onClick={() => doInteraction('wait')} onMouseEnter={() => setHoverAction('wait')} onMouseLeave={() => setHoverAction(null)} onFocus={() => setHoverAction('wait')} onBlur={() => setHoverAction(null)}><img className="action-sticker" src="/assets/stickers/wait-hourglass-sticker.png" alt="" aria-hidden="true" /><span>等一会儿</span></button>
            <button type="button" className={busy && feedback.type === 'touch' ? 'is-current-action' : ''} disabled={busy} onClick={() => doInteraction('touch')} onMouseEnter={() => setHoverAction('touch')} onMouseLeave={() => setHoverAction(null)} onFocus={() => setHoverAction('touch')} onBlur={() => setHoverAction(null)}><img className="action-sticker" src="/assets/stickers/gentle-touch-sticker.png" alt="" aria-hidden="true" /><span>轻轻碰</span></button>
            <button type="button" className={busy && feedback.type === 'listen' ? 'is-current-action' : ''} disabled={busy} onClick={() => doInteraction('listen')} onMouseEnter={() => setHoverAction('listen')} onMouseLeave={() => setHoverAction(null)} onFocus={() => setHoverAction('listen')} onBlur={() => setHoverAction(null)}><img className="action-sticker" src="/assets/stickers/listening-ear-sticker.png" alt="" aria-hidden="true" /><span>听听看</span></button>
          </div></div>
        </div>
      </section>

      <section className="phone-column" aria-label="手机 App 原型">
        <div className="phone-frame">
          <div className="phone-speaker"></div>
          <div className="phone-screen">
             <div className="phone-status"><span>9:41</span><PhoneStatusIcons /></div>
            <div ref={phoneContentRef} className="phone-content">
              <section className={`content-head phone-content-head ${tab === 'island' && islandView !== 'map' ? 'is-secondary-head' : ''}`}>
                <div><h2>{phoneHeaderTitle}</h2></div>
                <div className="phone-head-tools"><button className="phone-menu-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="打开贴纸抽屉"><i></i><i></i><i></i></button></div>
              </section>

              {tab === 'box' && <section className="phone-home">
                 <div className="today-note"><span className="tape-strip"></span><span className="eyebrow">今天的便签</span><strong>{todayNote}</strong><img className="note-presence-sticker" src="/assets/stickers/unknown-presence-sticker.png" alt="" aria-hidden="true" /><span className="note-preset-chip"><i style={{ background: `linear-gradient(135deg, ${activePreset.colors.blobs[0]}, ${activePreset.colors.blobs[1]}, ${activePreset.colors.blobs[2]})` }}></i>{activePreset.subtitle}</span></div>
                <div className="care-social-card"><div className="care-social-card__sticker"><img src="/assets/stickers/unknown-presence-sticker.png" alt="" aria-hidden="true" /></div><div className="care-social-card__copy"><strong>我的小岛</strong><div className="care-social-card__actions"><button type="button" className="care-feed-button" disabled={busy} onClick={() => doInteraction('feed')}><Icon name="light" />喂一点光</button><button type="button" className="text-link-button" onClick={() => { setIslandView('my-island'); setTab('island'); }}>看看布置 <span>↗</span></button></div></div></div>
                <div className="phone-progress-card"><div className="progress-card-head"><span>探索进度</span><b>{state.currentCycle.progress}%</b></div><div className="progress-track" role="progressbar" aria-label="探索进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.currentCycle.progress}><i style={{ width: `${state.currentCycle.progress}%` }}></i></div><button type="button" className="text-link-button" onClick={() => setProgressOpen(true)}>查看阶段 <span>↗</span></button></div>
                <div className="phone-personality-snapshot"><div className="phone-section-line"><span>性格线索</span></div><div className="personality-chip-grid">{PERSONALITY_COPY.slice(0, 3).map(([id, title]) => <button type="button" className={`personality-chip personality-${id}`} key={id} onClick={() => setPersonalityOpen(id)}><StickerGlyph kind={id === 'companion' ? 'warm' : id === 'explorer' ? 'curious' : 'night'} /><span>{title}</span><b>{state.personality[id]}%</b></button>)}</div></div>
                <div className="phone-recent-evidence"><div className="phone-section-line"><span>最近的线索</span><span>{state.evidence.length} 条</span></div>{state.evidence.slice(0, 2).map(item => <button className="log-row log-row-button" key={item.id} type="button" onClick={() => setSelectedEvidence(item)}><span className={`log-dot ${item.kind}`}></span><span><strong>{item.title}</strong><small>{item.note}</small></span><time>{item.time}</time></button>)}<button type="button" className="text-link-button" onClick={() => setTab('evidence')}>查看全部记录 <span>↗</span></button></div>
              </section>}

               {tab === 'evidence' && <section className="phone-evidence"><div className="evidence-filter-row" role="tablist" aria-label="证据筛选"><button type="button" className={evidenceFilter === 'all' ? 'active' : ''} onClick={() => setEvidenceFilter('all')}>全部</button><button type="button" className={evidenceFilter === 'light' ? 'active' : ''} onClick={() => setEvidenceFilter('light')}>光线</button><button type="button" className={evidenceFilter === 'sound' ? 'active' : ''} onClick={() => setEvidenceFilter('sound')}>声音</button><button type="button" className={evidenceFilter === 'touch' ? 'active' : ''} onClick={() => setEvidenceFilter('touch')}>靠近</button></div><div className="sticker-wall"><div className="sticker sticker-orange"><StickerGlyph kind="curious" /><span><strong>名字还空着</strong><small>慢慢想就好</small></span></div><div className="sticker sticker-yellow"><StickerGlyph kind="patient" /><span><strong>等到回应</strong><small>光靠近了一点</small></span></div><div className="sticker sticker-blue"><StickerGlyph kind="night" /><span><strong>一声轻响</strong><small>从盒子深处来</small></span></div><div className="sticker sticker-pink"><StickerGlyph kind="warm" /><span><strong>又见面了</strong><small>熟悉的光回来</small></span></div></div><div className="evidence-scrap-row" aria-label="证据碎片"><div className="evidence-scrap signal-scrap"><span>今日信号</span><SignalWave active={feedback.type === 'reply'} /><small>02:36 / 有一点回来</small></div><div className="evidence-scrap gradient-scrap"><MiniBoxArt preset={getLightPreset(activePresetId)} /><small>光场碎片 / {getLightPreset(activePresetId).title[0]}</small></div></div><div className="phone-section-line"><span>小小的收藏</span><span>{state.badges.filter(id => BADGE_DETAILS[id]).length} 张</span></div><div className="phone-badge-list">{badges.map(([id, title, copy]) => <StickerBadge key={id} id={id} title={title} copy={copy} unlocked={state.badges.includes(id)} onOpen={setSelectedBadge} />)}</div><div className="phone-evidence-log"><span className="eyebrow">最近留下</span>{visibleEvidence.slice(0, 4).map(item => <button className="log-row log-row-button" key={item.id} type="button" onClick={() => setSelectedEvidence(item)}><span className={`log-dot ${item.kind}`}></span><span><strong>{item.title}</strong><small>{item.note}</small></span><time>{item.time}</time></button>)}{visibleEvidence.length === 0 && <p className="empty-evidence">这一类线索还没有留下来。</p>}</div></section>}

                {tab === 'island' && (islandView === 'my-island' ? <section className="phone-island my-island-page">
                 <button className="island-back-button" type="button" onClick={() => setIslandView('map')}><span aria-hidden="true">←</span> 回到盒群岛</button>
                 <div className="my-island-scene" role="img" aria-label="盒子的小岛布置：小屋、回声贝、潮汐小灯和停靠的小船">
                   <span className="my-island-sun" aria-hidden="true">✳</span>
                   <span className="my-island-route my-island-route--one" aria-hidden="true"></span>
                   <span className="my-island-route my-island-route--two" aria-hidden="true"></span>
                   <div className="my-island-home-sticker"><img src="/assets/stickers/unknown-presence-sticker.png" alt="盒子的家" /><small>盒子的小屋</small></div>
                   <div className="my-island-item my-island-item--shell"><img src="/assets/stickers/listening-ear-sticker.png" alt="回声贝装置" /><small>回声贝</small></div>
                   <div className="my-island-item my-island-item--lamp"><span aria-hidden="true">✦</span><small>潮汐小灯</small></div>
                   <div className="my-island-item my-island-item--boat"><img src="/assets/stickers/island-postcard-sticker.png" alt="停靠的小船" /><small>小船停靠处</small></div>
                 </div>
                 <div className="phone-section-line"><span>岛上装置</span><span>已摆好 · 3 件</span></div>
                 <div className="my-island-decor-shelf">{MY_ISLAND_DECOR.map(item => <button type="button" key={item.id} className={`my-island-decor ${selectedIslandDecor === item.id ? 'is-selected' : ''}`} onClick={() => setSelectedIslandDecor(item.id)}><img src={item.sticker} alt="" aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.note}</small></span><i aria-hidden="true">{selectedIslandDecor === item.id ? '✓' : '·'}</i></button>)}</div>
                 <div className="my-island-detail-note"><strong>{selectedIslandDecorItem.title}</strong><p>{selectedIslandDecorItem.note}</p></div>
                 <button className="island-visitors-link" type="button" onClick={() => setIslandView('visitors')}><span>让小船去看看别的盒子</span><b aria-hidden="true">↗</b></button>
                </section> : islandView === 'visitor-detail' ? <section className="phone-island island-visitor-detail-page">
                 <button className="island-back-button" type="button" onClick={() => { setIslandView('visitors'); setSelectedVisitorId(null); }}><span aria-hidden="true">←</span> 回到来访</button>
                 <div className="visitor-detail-hero"><div><span className="eyebrow accent">{selectedVisitor.time}</span><h3>{selectedVisitor.id} 号盒子</h3></div><img src="/assets/stickers/island-postcard-sticker.png" alt="声音明信片贴纸" /></div>
                 <div className="visitor-detail-card"><div className="visitor-detail-meta"><span>它留下了</span><b>2.4 秒 · 轻响</b></div><SignalWave active /><p>{selectedVisitor.trace}</p><small>{selectedVisitor.ownerNote}</small></div>
                 <div className="visitor-detail-origin"><img src="/assets/stickers/island-marker-sticker.png" alt="来访小岛标记" /><div><span className="eyebrow">来自</span><strong>{selectedVisitor.place}</strong></div></div>
                 <div className="visitor-detail-actions"><button className="primary-button" type="button" onClick={() => setIslandHearingOpen(true)}>听听回应</button><button className="island-visitors-link" type="button" onClick={() => { setSavedVisits(previous => previous.includes(selectedVisitor.id) ? previous : [...previous, selectedVisitor.id]); setMessage('已收进记录。'); }}><span>{savedVisits.includes(selectedVisitor.id) ? '已收进记录' : '收进记录'}</span><b aria-hidden="true">↗</b></button><button className="visitor-quiet-button" type="button" onClick={() => { setIslandView('visitors'); setSelectedVisitorId(null); }}>暂时不回应</button></div>
                </section> : islandView === 'visitors' ? <section className="phone-island island-visitors-page">
                 <button className="island-back-button" type="button" onClick={() => setIslandView('map')}><span aria-hidden="true">←</span> 回到群岛</button>
                 <div className="island-visitors-heading"><span className="eyebrow accent">{ISLAND_VISITORS.length} 个来访</span><img src="/assets/stickers/island-postcard-sticker.png" alt="一枚声音明信片贴纸" /></div>
                 <div className="visitor-card-list">{ISLAND_VISITORS.map(visitor => {
                   const saved = savedVisits.includes(visitor.id);
                   return <article className="visitor-card" key={visitor.id}>
                     <div className="visitor-card-meta"><span>{visitor.id} 号盒子 · {visitor.place}</span><time>{visitor.time}</time></div>
                     <div className="visitor-owner-note"><img src={visitor.sticker} alt="" aria-hidden="true" /><blockquote>“{visitor.ownerNote}”</blockquote></div>
                     <div className="visitor-card-actions"><button type="button" onClick={() => { setSelectedVisitorId(visitor.id); setIslandView('visitor-detail'); }}>查看详情 ↗</button><button type="button" onClick={() => { if (soundEnabled) playListenSound(); setMessage(`听见了 ${visitor.id} 号盒子寄来的轻响。`); }}>听听回声</button><button type="button" className={saved ? 'is-saved' : ''} onClick={() => setSavedVisits(current => saved ? current.filter(id => id !== visitor.id) : [...current, visitor.id])}>{saved ? '已收进' : '收进记录'}</button></div>
                   </article>;
                 })}</div>
                </section> : islandView === 'relations' ? <section className="phone-island island-relations-page">
                  <button className="island-back-button" type="button" onClick={() => setIslandView('map')}><span aria-hidden="true">←</span> 回到群岛</button>
                  <div className="island-relations-heading"><div><h3>盒子之间</h3></div><img src="/assets/stickers/island-reply-trace-sticker.png" alt="一枚延迟回信的光痕贴纸" /></div>
                  <div className="relation-summary-grid"><div><b>{ISLAND_VISITORS.length}</b><span>来访</span></div><div><b>{state.postcards}</b><span>寄出</span></div><div><b>{savedVisits.length}</b><span>已收进</span></div></div>
                  <div className="relation-timeline">
                    <article><span className="relation-dot relation-dot--peach"></span><div><small>最近来访 · {ISLAND_VISITORS[0].time}</small><strong>047 号盒子留下了一段轻响。</strong></div></article>
                    <article><span className="relation-dot relation-dot--blue"></span><div><small>你寄出的回应 · {postcardStatus === 'replied' ? '刚刚有了回信' : postcardStatus === 'sent' ? '正在等待抵达' : '还没有寄出'}</small><strong>{postcardStatus === 'replied' ? '047 号盒子回了一点更轻的回应。' : postcardStatus === 'sent' ? '回应正在去往另一座岛。' : '给另一座岛留一句回应。'}</strong></div></article>
                  </div>
                  {postcardReply && <button className="island-visitors-link" type="button" onClick={() => setIslandHearingOpen(true)}><span>打开 047 号盒子的回信</span><b aria-hidden="true">↗</b></button>}
                  <button className="primary-button" type="button" onClick={() => setPostcardOpen(true)}>寄出回应</button>
               </section> : <section className="phone-island">
                 <div className="island-art-card"><IslandCollage onOpenHearing={() => setIslandHearingOpen(true)} onOpenVisitors={() => setIslandView('visitors')} onOpenRelations={() => setIslandView('relations')} /></div>
                 <div className="island-hub-cards">
                   <button className="island-hub-card island-hub-card--home" type="button" onClick={() => setIslandView('my-island')} aria-label="看看我的小岛布置"><strong>我的小岛</strong><span className="island-hub-stickers" aria-hidden="true"><img src="/assets/stickers/unknown-presence-sticker.png" /><img src="/assets/stickers/listening-ear-sticker.png" /><img src="/assets/stickers/island-postcard-sticker.png" /></span><b>看看布置 ↗</b></button>
                   <button className="island-hub-card island-hub-card--visitors" type="button" onClick={() => setIslandView('visitors')} aria-label="看看盒子之间的来访"><strong>盒子来访</strong><span className="island-hub-stickers" aria-hidden="true"><img src="/assets/stickers/island-marker-sticker.png" /><img src="/assets/stickers/island-reply-trace-sticker.png" /></span><b>看看来访 ↗</b></button>
                 </div>
                 <div className="phone-section-line"><span>小船抵达</span><span>{ISLAND_VISITORS.length} 个匿名来访</span></div>
                 <div className="postcard island-postcard-preview"><SignalWave active /><small>047 号盒子 · 留下一段晚归后的观察</small></div>
                  <button className="primary-button" type="button" onClick={() => setPostcardOpen(true)}>寄出一段回应</button>
               </section>)}

               {tab === 'profile' && <section className="phone-profile"><h3>它有点慢热</h3><div className="profile-doodle profile-sticker-wall" role="img" aria-label="性格想象贴纸：像猫、像狗，也可能都不像"><figure className="animal-sticker animal-sticker--cat"><svg viewBox="0 0 44 44" aria-hidden="true"><path d="M10 19 9 7l9 6c3-1 6-1 9 0l9-6-1 13c3 7 1 14-4 17-5 4-14 4-19 0-5-4-6-11-2-18Z" /><path d="M16 24h.1M28 24h.1M18 29c2 2 6 2 8 0" /><circle cx="35" cy="9" r="6" className="animal-question" /><text x="35" y="12">?</text></svg><figcaption>像猫？</figcaption></figure><figure className="animal-sticker animal-sticker--presence"><span className="presence-image-wrap"><img className="profile-presence-sticker" src="/assets/stickers/unknown-presence-sticker.png" alt="" aria-hidden="true" /><i>?</i></span><figcaption>还没决定</figcaption></figure><figure className="animal-sticker animal-sticker--dog"><svg viewBox="0 0 44 44" aria-hidden="true"><path d="M13 15C6 8 5 22 11 27M31 15c7-7 8 7 2 12M12 18c0-6 4-9 10-9s10 3 10 9v11c0 6-4 9-10 9s-10-3-10-9Z" /><path d="M17 23h.1M27 23h.1M19 29c1 2 5 2 6 0" /><circle cx="35" cy="9" r="6" className="animal-question" /><text x="35" y="12">?</text></svg><figcaption>像狗？</figcaption></figure></div><div className="profile-progress-card"><div><span>探索进度</span><b>{state.currentCycle.progress}%</b></div><i role="progressbar" aria-label="探索进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={state.currentCycle.progress}><em style={{ width: `${state.currentCycle.progress}%` }}></em></i></div><div className="phone-section-line"><span>性格线索</span></div><div className="personality-chip-grid profile-personality-grid">{PERSONALITY_COPY.map(([id, title, copy]) => <button type="button" className={`personality-chip personality-${id}`} key={id} onClick={() => setPersonalityOpen(id)}><StickerGlyph kind={id === 'companion' ? 'warm' : id === 'explorer' || id === 'curious' ? 'curious' : id === 'nocturnal' ? 'night' : 'patient'} /><span>{title}</span><b>{state.personality[id]}%</b></button>)}</div><div className="phone-section-line"><span>纪念贴纸</span><span>{state.badges.filter(id => state.badges.includes(id)).length} / {badges.length}</span></div><div className="badge-gallery">{badges.map(([id, title, copy]) => <StickerBadge key={id} id={id} title={title} copy={copy} unlocked={state.badges.includes(id)} compact onOpen={setSelectedBadge} />)}</div><button type="button" className="clue-button" onClick={() => setProgressOpen(true)}><span>查看阶段</span><b>↗</b></button></section>}
            </div>
            <nav className="bottom-nav" aria-label="App 主导航"><button aria-current={tab === 'box' ? 'page' : undefined} className={tab === 'box' ? 'active' : ''} onClick={() => setTab('box')}><span><Icon name="box" /></span><small>今天</small></button><button aria-current={tab === 'evidence' ? 'page' : undefined} className={tab === 'evidence' ? 'active' : ''} onClick={() => setTab('evidence')}><span><Icon name="evidence" /></span><small>记录</small></button><button aria-current={tab === 'island' ? 'page' : undefined} className={tab === 'island' ? 'active' : ''} onClick={() => { setIslandView('map'); setTab('island'); }}><span><Icon name="island" /></span><small>群岛</small></button><button aria-current={tab === 'profile' ? 'page' : undefined} className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><span><Icon name="profile" /></span><small>性格</small></button></nav>
            {drawerOpen && <div className="phone-overlay" role="presentation" onClick={() => { setDrawerOpen(false); setSettingsOpen(false); setResetConfirm(false); }}>
              <aside className={`phone-drawer ${settingsOpen ? 'is-settings' : ''}`} role="dialog" aria-modal="true" aria-label={settingsOpen ? '设置菜单' : '贴纸抽屉'} onClick={event => event.stopPropagation()}>
                <button className="overlay-close" type="button" onClick={() => { setDrawerOpen(false); setSettingsOpen(false); setResetConfirm(false); }} aria-label="关闭菜单">×</button>
                {settingsOpen ? resetConfirm ? <>
                  <span className="eyebrow accent">重新开始</span><h3>要重新开始吗？</h3>
                  <p>会清除记录、贴纸和光场选择。不能撤回。</p>
                  <div className="drawer-action-row"><button className="drawer-action secondary" type="button" onClick={() => setResetConfirm(false)}>先不要</button><button className="drawer-action danger" type="button" onClick={reset}>清除并重新开始</button></div>
                </> : <>
                  <h3>设置</h3>
                  <div className="settings-list"><button type="button" onClick={() => setState(previous => ({ ...previous, soundEnabled: previous.soundEnabled === false }))}><span>声音</span><b>{soundEnabled ? '开启' : '关闭'}</b></button><button type="button" onClick={() => { setSettingsOpen(false); setTab('profile'); }}><span>性格</span><b>查看 ↗</b></button><button type="button" onClick={() => setResetConfirm(true)}><span>重新开始</span><b>确认</b></button></div>
                </> : <>
                  <h3>贴纸</h3>
                  <div className="drawer-sticker-stack"><StickerBadge id="origin" compact /><StickerBadge id="waited" compact /><StickerBadge id="postcard" compact /><StickerBadge id="signal" compact /></div>
                  <div className="drawer-action-row"><button className="drawer-action secondary" type="button" onClick={() => { setDrawerOpen(false); setTab('evidence'); }}>打开记录 <span>↗</span></button><button className="drawer-action" type="button" onClick={() => setSettingsOpen(true)}>设置 <span>⋯</span></button></div>
                </>}
              </aside>
            </div>}
              {selectedEvidence && <div className="phone-overlay sheet-overlay" role="presentation" onClick={() => setSelectedEvidence(null)}>
                <section className="phone-sheet evidence-detail-sheet" role="dialog" aria-modal="true" aria-label="证据详情" onClick={event => event.stopPropagation()}>
                  <button className="overlay-close" type="button" onClick={() => setSelectedEvidence(null)} aria-label="关闭证据详情">×</button>
                  <div className="evidence-detail-kicker"><span className={`log-dot ${selectedEvidence.kind}`}></span><span className="eyebrow accent">{selectedEvidence.time}</span></div>
                  <h3>{selectedEvidence.title}</h3>
                  <div className="evidence-detail-meta"><span>{selectedEvidence.category || '相处'}</span></div>
                  <p className="evidence-detail-copy">{selectedEvidence.note}</p>
                  <div className="evidence-detail-section"><span className="eyebrow">可能的性格线索</span>{getPersonalityEvidence(state.evidence, selectedEvidence.supports?.[0] || '').length > 0 ? <div className="evidence-support-chips">{(selectedEvidence.supports || []).map(id => { const item = PERSONALITY_COPY.find(entry => entry[0] === id); return item ? <span key={id}>{item[1]}</span> : null; })}</div> : <p>线索不足</p>}</div>
                  <div className="sheet-mark"><Icon name={selectedEvidence.kind === 'relationship' ? 'sound' : selectedEvidence.kind === 'touch' ? 'light' : 'evidence'} /></div>
                </section>
              </div>}
             {selectedBadge && <div className="phone-overlay badge-overlay" role="presentation" onClick={() => setSelectedBadge(null)}><section className="phone-sheet badge-detail-sheet" role="dialog" aria-modal="true" aria-label="徽章详情" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setSelectedBadge(null)} aria-label="关闭徽章详情">×</button><StickerBadge id={selectedBadge} compact unlocked={state.badges.includes(selectedBadge)} /><span className="eyebrow accent">徽章 · {BADGE_DETAILS[selectedBadge]?.label || '未知'}</span><h3>{BADGE_DETAILS[selectedBadge]?.title}</h3><p>{state.badges.includes(selectedBadge) ? BADGE_DETAILS[selectedBadge]?.copy : '这枚贴纸还在远处，等一段足够具体的观察。'}</p><small>{state.badges.includes(selectedBadge) ? '已经收进你的收藏。' : '证据足够时，它会自己出现。'}</small></section></div>}
              {unlockedBadge && <div className="phone-overlay badge-overlay" role="presentation" onClick={() => setUnlockedBadge(null)}><section className="phone-sheet badge-unlock-sheet" role="dialog" aria-modal="true" aria-label="徽章解锁" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setUnlockedBadge(null)} aria-label="关闭解锁提示">×</button><span className="eyebrow accent">新的纪念章</span><StickerBadge id={unlockedBadge} compact /><h3>{BADGE_DETAILS[unlockedBadge]?.title}</h3><button className="drawer-action" type="button" onClick={() => setUnlockedBadge(null)}>收好它 <span>↗</span></button></section></div>}
              {progressOpen && <div className="phone-overlay sheet-overlay" role="presentation" onClick={closeProgress}><section className="phone-sheet progress-detail-sheet" role="dialog" aria-modal="true" aria-label="探索进度详情" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={closeProgress} aria-label="关闭探索进度">×</button><span className="eyebrow accent">探索进度 · {state.currentCycle.progress}%</span><h3>探索阶段</h3><div className="progress-stage-list">{EXPLORATION_STAGES.map(stage => { const unlocked = state.currentCycle.progress >= stage.threshold; const current = currentStage.id === stage.id; const accessible = unlocked || current; return <button type="button" key={stage.id} className={`progress-stage ${unlocked ? 'is-done' : ''} ${current ? 'is-current' : ''} ${!accessible ? 'is-locked' : ''}`} onClick={() => setSelectedStage(stage.id)}><span className="progress-stage-icon"><Icon name={stage.icon} /></span><span className="progress-stage-copy"><b>{stage.threshold}%</b><strong>{stage.title}</strong><small>{accessible ? stage.description : '还没到 · 点开看看'}</small></span><em>{unlocked ? '已留下' : current ? '现在' : '未到'}</em></button>; })}</div>{selectedStageData && <div className={`stage-detail-card ${state.currentCycle.progress >= selectedStageData.threshold || currentStage.id === selectedStageData.id ? '' : 'is-locked'}`}><span className="eyebrow accent">{selectedStageData.threshold}% · {state.currentCycle.progress >= selectedStageData.threshold ? '已解锁' : currentStage.id === selectedStageData.id ? '正在靠近' : '还未到达'}</span><h4>{selectedStageData.title}</h4>{state.currentCycle.progress >= selectedStageData.threshold || currentStage.id === selectedStageData.id ? <><p>{selectedStageData.description}</p><span className="eyebrow">留下的线索</span>{selectedStageEvidence.length ? <ul>{selectedStageEvidence.map(item => <li key={item.id}>{item.title}<small>{item.note}</small></li>)}</ul> : <p className="stage-empty">还没有线索。</p>}</> : <p>{selectedStageData.lockedCopy}</p>}</div>}</section></div>}
              {personalityOpen && <div className="phone-overlay sheet-overlay" role="presentation" onClick={() => setPersonalityOpen(null)}><section className="phone-sheet personality-detail-sheet" role="dialog" aria-modal="true" aria-label="性格推测详情" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setPersonalityOpen(null)} aria-label="关闭性格详情">×</button><span className="eyebrow accent">性格猜测</span><h3>{PERSONALITY_COPY.find(item => item[0] === personalityOpen)?.[1]}</h3><p>{PERSONALITY_COPY.find(item => item[0] === personalityOpen)?.[2]}</p><div className="personality-detail-score"><b>{state.personality[personalityOpen]}%</b><span>{relatedPersonalityEvidence.length ? `由 ${relatedPersonalityEvidence.length} 条线索支持` : '线索还不够'}</span></div><div className="personality-evidence-block"><span className="eyebrow">相关线索</span>{relatedPersonalityEvidence.length ? <ul>{relatedPersonalityEvidence.slice(0, 3).map(item => <li key={item.id}><strong>{item.title}</strong><small>{item.note}</small></li>)}</ul> : <p>还没有足够线索，先留在猜测里。</p>}</div><small>它不是固定类型，下一次回应可能会改变它。</small></section></div>}
              {islandHearingOpen && <div className="phone-overlay sheet-overlay" role="presentation" onClick={() => setIslandHearingOpen(false)}><section className="phone-sheet hearing-detail-sheet" role="dialog" aria-modal="true" aria-label="远处的回声" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setIslandHearingOpen(false)} aria-label="关闭回应">×</button><span className="eyebrow accent">雾岸岛 · 来访盒子</span><h3>一声回响</h3><div className="hearing-postcard"><div><span>雾岸岛 · 远处的一只盒子</span><small>刚刚 · 一声轻敲，随后有回声</small></div><SignalWave active={hearingPlaying || postcardReply} /><button type="button" className="hearing-play-button" onClick={playHearingReply}>{hearingPlaying ? '正在回响…' : '听听回应'}</button></div>{postcardReply && <div className="reply-note"><span className="eyebrow">迟来的回信</span><button type="button" onClick={() => { if (soundEnabled) playTone('reply'); setMessage('回信又轻轻响了一次。'); }}>再听一次</button></div>}</section></div>}
              {postcardOpen && <div className="phone-overlay sheet-overlay" role="presentation" onClick={() => setPostcardOpen(false)}><section className="phone-sheet postcard-composer-sheet" role="dialog" aria-modal="true" aria-label="回应编辑器" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setPostcardOpen(false)} aria-label="关闭回应编辑器">×</button><span className="eyebrow accent">寄出回应 · 1 / 2</span><h3>选一段回应</h3><div className="postcard-choice-list">{[['soft-knock', '两下轻敲', '轻轻邀请'], ['low-hum', '一声低鸣', '留一点温暖'], ['night-note', '深夜短音', '等它慢慢抵达']].map(([id, title, copy]) => <button type="button" key={id} className={postcardDraft === id ? 'is-selected' : ''} onClick={() => setPostcardDraft(id)}><span>{title}</span><small>{copy}</small><b>{postcardDraft === id ? '已选' : '选择'}</b></button>)}</div><div className="postcard-preview-card"><img src="/assets/stickers/island-postcard-sticker.png" alt="声音明信片贴纸" /><span>寄给 · 雾岸岛</span><SignalWave active /><small>{postcardDraft === 'soft-knock' ? '两下轻敲，已经装好。' : postcardDraft === 'low-hum' ? '一声低鸣，正在回响。' : '深夜短音，等它听见。'}</small></div><button className="drawer-action" type="button" onClick={sendPostcard}>寄出回应 <span>↗</span></button></section></div>}
          </div>
        </div>
      </section>
    </main>

    <CoverWall activePresetId={activePresetId} previewPresetId={previewPresetId} onPreviewStart={setPreviewPresetId} onPreviewEnd={() => setPreviewPresetId(null)} onCommit={commitPreset} pulseKey={skinPulse} />
    <section className="product-idea" id="product-idea">
      <span className="eyebrow">KNOCK KNOCK · ROBOT WITH CARE</span>
      <div className="product-idea-copy"><h2>照料、回应与想象，<br />能不能建立一段关系？</h2><p>敲击是邀请，触摸是靠近，等待也是照料。它以光、声音和细微动作回应；你不需要知道盒子里是什么，只需从这些片刻里，慢慢形成自己的理解。我们验证的不是它像哪一种动物，而是“被回应”的感受能否让陪伴发生。</p></div>
      <div className="idea-sequence" aria-label="照料、回应、相处习惯、暂时理解"><span>照料</span><i>→</i><span>回应</span><i>→</i><span>相处习惯</span><i>→</i><span>暂时理解</span></div>
    </section>

  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
