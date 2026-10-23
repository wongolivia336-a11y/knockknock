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
    { id: 'seed', title: '它还没有被命名', kind: 'origin', note: '未知仍然保留。', time: '刚刚' },
    { id: 'quiet', title: '安静的在场', kind: 'behavior', note: '它没有马上回答，但没有离开。', time: '今天' },
  ],
  badges: ['origin'],
  interactions: 0,
  postcards: 0,
  lastEvent: '它在等你靠近。',
};

function normalizeState(input) {
  const stored = input || {};
  return {
    ...DEFAULT_STATE,
    ...stored,
    evidence: Array.isArray(stored.evidence) ? stored.evidence : DEFAULT_STATE.evidence,
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

function awardBadge(next, badge) {
  if (next.badges.includes(badge)) return next;
  return { ...next, badges: [...next.badges, badge] };
}

function addEvidence(next, evidence) {
  return { ...next, evidence: [{ ...evidence, id: `${evidence.kind}-${Date.now()}` }, ...next.evidence] };
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
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-label={label} role={label ? 'img' : undefined} aria-hidden={label ? undefined : true} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[name] || shapes.box}</svg>;
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
    bond: Math.min(100, previous.bond + (type === 'wait' ? 5 : 2)),
    expression: Math.min(100, previous.expression + (type === 'touch' ? 3 : type === 'listen' ? 2 : 1)),
    personality: {
      ...previous.personality,
      companion: Math.min(100, previous.personality.companion + (type === 'wait' ? 3 : 1)),
      explorer: Math.min(100, previous.personality.explorer + (type === 'knock' ? 2 : 0)),
      nocturnal: Math.min(100, previous.personality.nocturnal + (type === 'listen' ? 2 : 0)),
      calm: Math.min(100, previous.personality.calm + (type === 'wait' ? 2 : 0)),
      curious: Math.min(100, previous.personality.curious + (type === 'knock' || type === 'touch' ? 2 : 0)),
      shy: Math.max(12, previous.personality.shy + (type === 'touch' ? 1 : 0)),
    },
    lastEvent: type === 'knock' ? '它收到了两下敲击，正在想要不要回答。' : type === 'wait' ? '你等了一会儿，它终于留下了一点回应。' : type === 'listen' ? '你听见了一点很轻的回声。' : '手指离开后，中心信号亮了一下。',
  };
  if (type === 'wait') {
    next.patience = Math.min(100, previous.patience + 8);
    next = awardBadge(next, 'waited');
    next = addEvidence(next, { title: '等到它回答', kind: 'behavior', note: '等待本身也被记录成了一种照料。', time: '刚刚' });
  }
  if (type === 'touch') {
    next = addEvidence(next, { title: '手指靠近过', kind: 'behavior', note: '触摸不是命令，是一次邀请。', time: '刚刚' });
  }
  if (type === 'listen') {
    next.patience = Math.min(100, previous.patience + 3);
    next = addEvidence(next, { title: '听见一段回声', kind: 'relationship', note: '没有说话，但有一个很轻的频率回来。', time: '刚刚' });
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
  return <section className="cover-wall" aria-label="六张盒群岛封面"><div className="cover-wall-heading"><span className="eyebrow">盒群岛 / SIX QUIET WORLDS</span><h2>每一次回应，都有自己的封面。</h2><p>悬停预览它的光，点击把这一种状态留给盒子。</p></div><div className="cover-grid">{COVER_WALL.map((cover, index) => <CoverCard key={cover.id} cover={cover} index={index} active={activePresetId === cover.id} previewing={previewPresetId === cover.id} onPreviewStart={onPreviewStart} onPreviewEnd={onPreviewEnd} onCommit={onCommit} pulseKey={pulseKey} />)}</div></section>;
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
      float radius = uLightRadii[i];
      float edgeNoise = softNoise(warpedPosition * 2.4 + vec3(float(i) * 3.1, uTime * 0.018, float(i) * 1.7));
      float organicDistance = max(0.0, distanceSquared + (edgeNoise - 0.5) * uEdgeDiffusion * 0.16 * radius * radius);
      float halo = exp(-organicDistance / (2.0 * radius * radius));
      float coreRadius = radius * (0.22 + uSoftness * 0.18);
      float core = exp(-organicDistance / (2.0 * coreRadius * coreRadius));
      float wrap = mix(0.55, 0.92, max(dot(normalize(-delta + vec3(0.0001)), n), 0.0) * uEdgeDiffusion);
      float contribution = (core * 0.46 + halo * 0.54) * uLightIntensities[i] * wrap;
      weightedField += uLightColors[i] * contribution;
      totalWeight += contribution;
      if (contribution > dominantContribution) {
        dominantContribution = contribution;
        dominantColor = uLightColors[i];
      }
    }

    vec3 averageColor = weightedField / max(totalWeight, 0.0001);
    float averageLuma = dot(averageColor, vec3(0.299, 0.587, 0.114));
    vec3 fieldColor = mix(vec3(averageLuma), averageColor, 0.94);
    fieldColor = mix(fieldColor, dominantColor, clamp(0.16 + dominantContribution * 0.42, 0.16, 0.58));
    float fieldAmount = min(0.98, 1.0 - exp(-totalWeight * (2.2 + uIntensity * 0.9)));
    vec3 interactionDelta = warpedPosition - uInteractionPosition;
    float interactionHalo = exp(-dot(interactionDelta, interactionDelta) / 1.12);
    float interactionCore = exp(-dot(interactionDelta, interactionDelta) / 0.22);
    float interactionAmount = (interactionHalo * 0.72 + interactionCore * 0.28) * uInteractionStrength;
    fieldColor = mix(fieldColor, uInteractionColor, clamp(interactionAmount * 0.7, 0.0, 0.8));
    fieldAmount = min(0.76, fieldAmount + interactionAmount * 0.3);

    vec3 viewDirection = normalize(vViewPosition);
    float edgeLight = pow(1.0 - max(dot(normalize(vLocalNormal), normalize(vec3(-0.1, 0.48, 0.86))), 0.0), 1.65);
    float grain = (microGrain - 0.5) * uGrain;
    vec3 atmosphere = mix(uBaseColor, uAtmosphereColor, uAtmosphereStrength * (0.5 + lowFrequency * 0.25));
    vec3 surfaceColor = atmosphere * (diffuse * 0.92 + (lowFrequency - 0.5) * 0.055 + edgeLight * 0.035);
    float fieldBlend = clamp(fieldAmount * 0.9, 0.0, 0.9);
    vec3 shell = vec3(0.86, 0.82, 0.76) * (0.88 + diffuse * 0.12);
    float opticalMix = clamp(0.36 + fieldAmount * 0.54, 0.36, 0.9);
    vec3 color = mix(surfaceColor * 1.08, fieldColor, opticalMix);
    color = mix(color, shell, 0.12 + edgeLight * 0.08);
    float sideFace = smoothstep(0.24, 0.92, max(n.x, 0.0));
    float topFace = smoothstep(0.24, 0.92, max(n.y, 0.0));
    color *= mix(vec3(1.0), vec3(0.84, 0.85, 0.86), sideFace);
    color *= mix(vec3(1.0), vec3(1.045, 1.025, 0.99), topFace);
    color += fieldColor * min(0.14, totalWeight * 0.18);
    color += fieldColor * 0.045 * mediumNoise;
    color += vec3(grain);
    color += vec3(0.012, 0.01, 0.008) * (1.0 - max(dot(viewDirection, normalize(vLocalNormal)), 0.0));
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
    },
    vertexShader: BOX_VERTEX_SHADER,
    fragmentShader: BOX_FRAGMENT_SHADER,
  });
}

function UnknownBoxScene({ feedback, onTouch, activePresetId, previewPresetId }) {
  const mountRef = useRef(null);
  const feedbackRef = useRef(feedback);
  const touchRef = useRef(onTouch);
  const [failed, setFailed] = useState(false);
  const styleRef = useRef(createLightStyle(getLightPreset(activePresetId || DEFAULT_LIGHT_PRESET_ID)));
  const transitionRef = useRef(null);

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
      const camera = new THREE.OrthographicCamera(-3.8, 3.8, 3.3, -3.3, 0.1, 100);
      camera.zoom = 1;
      camera.position.set(4.15, 1.72, 8.6);
      camera.lookAt(0, 0.16, 0);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
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
      };
      const boxOffset = new THREE.Vector3(0, 0, 0);
      const boxMaterial = createBoxMaterial('#F1EAE1', boxOffset, lightField);
      const box = new THREE.Mesh(new RoundedBoxGeometry(3.65, 3.25, 1.4, 16, 0.38), boxMaterial);
      box.position.set(0, 0.04, 0);
      box.userData.kind = 'box';
      stage.add(box);

      const shadowMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {},
        vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
        fragmentShader: `varying vec2 vUv; void main(){float d=distance(vUv,vec2(.5)); float a=smoothstep(.52,.05,d)*.16; gl_FragColor=vec4(.23,.21,.19,a);}`,
      });
      const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 1.7), shadowMaterial);
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
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.75, 1.55), glowMaterial);
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(0, -1.49, 0.08);
      stage.add(glow);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const interactionTarget = new THREE.Vector3(0.08, 0.05, 0.54);
      const interactionPosition = interactionTarget.clone();
      const interactionVelocity = new THREE.Vector3();
      const localPoint = new THREE.Vector3();
      const targetWithDrift = new THREE.Vector3();
      const rotationTarget = new THREE.Vector2(0, 0);
      const rotationPosition = new THREE.Vector2(0, 0);
      let lastPointerAt = 0;
      let leaveTimer = 0;
      let pointerPressed = false;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      const pointerToBox = event => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObject(box, false);
        if (!hits.length) return false;
        localPoint.copy(hits[0].point);
        stage.worldToLocal(localPoint);
        interactionTarget.set(
          THREE.MathUtils.clamp(localPoint.x * 0.86, -1.52, 1.52),
          THREE.MathUtils.clamp(localPoint.y * 0.86, -1.42, 1.42),
          THREE.MathUtils.clamp(localPoint.z * 0.88, -0.5, 0.66),
        );
        lastPointerAt = performance.now();
        return true;
      };
      const onPointerMove = event => {
        window.clearTimeout(leaveTimer);
        pointerToBox(event);
        if (pointerPressed && !reducedMotion) {
          const rect = renderer.domElement.getBoundingClientRect();
          rotationTarget.y = THREE.MathUtils.clamp(((event.clientX - rect.left) / rect.width - 0.5) * 0.34, -0.3, 0.3);
          rotationTarget.x = THREE.MathUtils.clamp(((event.clientY - rect.top) / rect.height - 0.5) * -0.16, -0.14, 0.14);
        }
      };
      const onPointerLeave = () => { leaveTimer = window.setTimeout(() => interactionTarget.set(0.12, 0.08, 0.42), 420); };
      const onPointerDown = event => { pointerPressed = true; renderer.domElement.setPointerCapture?.(event.pointerId); if (pointerToBox(event)) touchRef.current(); };
      const onPointerUp = event => { pointerPressed = false; renderer.domElement.releasePointerCapture?.(event.pointerId); };
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerleave', onPointerLeave);
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointerup', onPointerUp);

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
        const recentlyApproached = performance.now() - lastPointerAt < 1150;
        const knockCollapse = feedbackRef.current.type === 'knock' ? Math.max(0, 1 - Math.abs(feedbackAge - 0.28) / 0.52) : 0;
        for (let index = 0; index < 4; index += 1) {
          const blob = style.blobs[index];
          const phase = cycleTime * blob.speed + blob.phase;
          const turbulence = motion.turbulence;
          const driftX = Math.sin(phase * 1.07 + index * 0.7) * blob.driftX * (1 + turbulence * 0.4);
          const driftY = Math.cos(phase * 0.83 + index * 0.42) * blob.driftY * (1 + turbulence * 0.3);
          const flow = Math.sin(cycleTime * 0.43 + blob.phase * 1.7) * turbulence * 0.08;
          lightPositions[index].set((blob.u - 0.5) * 2.62 + driftX + flow, (blob.v - 0.5) * 2.52 + driftY, -0.08 + blob.depth * 0.84 + Math.sin(phase * 0.62) * turbulence * 0.1);
          if (index === 0 && recentlyApproached) lightPositions[index].lerp(interactionPosition, THREE.MathUtils.clamp(motion.followStrength * 0.34, 0, 0.4));
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
        const responseDelay = motion.responseDelay;
        const responseProgress = feedbackAge > responseDelay ? Math.min((feedbackAge - responseDelay) / 1.15, 1) : 0;
        const responsePulse = Math.sin(responseProgress * Math.PI);
        const approachStrength = recentlyApproached ? 0.44 : 0.16;
        lightField.uInteractionPosition.value.copy(interactionPosition);
        lightField.uInteractionColor.value.copy(style.colors[0]);
        lightField.uInteractionStrength.value = approachStrength + responsePulse * 0.42 + (feedbackRef.current.type === 'knock' ? 0.12 : 0);
        lightField.uAtmosphereColor.value.copy(style.atmosphereColor);
        lightField.uAtmosphereStrength.value = 0.055 + style.optical.intensity * 0.045;
        lightField.uIntensity.value = style.optical.intensity;
        lightField.uSoftness.value = style.optical.softness;
        lightField.uGrain.value = style.optical.grain;
        lightField.uEdgeDiffusion.value = style.optical.edgeDiffusion;
        lightField.uTime.value = elapsed;
        if (!reducedMotion) {
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
        // Keep world units square on screen; deriving both spans from aspect prevents
        // the orthographic projection from stretching the box across wide desktop stages.
        const viewHeight = aspect > 1.7 ? 4.05 : aspect < 1.45 ? 4.9 : 4.4;
        const viewWidth = viewHeight * Math.max(aspect, 0.1);
        camera.left = -viewWidth * 0.5;
        camera.right = viewWidth * 0.5;
        camera.top = viewHeight * 0.54;
        camera.bottom = -viewHeight * 0.46;
        camera.updateProjectionMatrix();
      };
      window.addEventListener('resize', onResize);
      onResize();
      return () => {
        cancelAnimationFrame(raf);
        window.clearTimeout(leaveTimer);
        window.removeEventListener('resize', onResize);
        renderer.domElement.removeEventListener('pointermove', onPointerMove);
        renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        renderer.domElement.removeEventListener('pointerup', onPointerUp);
         boxMaterial.dispose();
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
  return <div className="scene-host" ref={mountRef} />;
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
  return <svg className="mini-box-art" viewBox="0 0 220 82" role="img" aria-label="盒子的渐变碎片"><defs><linearGradient id="mini-box-gradient" x1="0" x2="1"><stop offset="0" stopColor={colorA} /><stop offset="1" stopColor={colorB} /></linearGradient></defs><path d="M45 27 112 13l65 18-67 17Z" fill="#fffaf1" stroke="#302c2b" strokeWidth="1.2" /><path d="M45 27v31l65 15V48Z" fill="url(#mini-box-gradient)" stroke="#302c2b" strokeWidth="1.2" /><path d="m177 31-67 17v25l67-18Z" fill={preset.colors.blobs[2]} opacity=".72" stroke="#302c2b" strokeWidth="1.2" /><path d="m58 31 52-11 53 14-55 14Z" fill="#fffdf8" opacity=".62" /><circle cx="127" cy="47" r="10" fill={preset.colors.blobs[3]} opacity=".78" /></svg>;
}

function IslandMap() {
  return <svg className="island-map-svg" viewBox="0 0 320 180" role="img" aria-label="盒群岛地图"><path className="map-water-line" d="M21 121c44-41 84-34 127-15s76 25 151-40" /><path className="map-water-line dashed" d="M55 48c47 28 84 15 128 30s71 11 110-13" /><path className="map-route" d="M68 105c41-16 79-35 117-29s48 24 84 17" /><path className="map-route map-route-short" d="M99 47c20 25 39 31 79 29" /><g className="map-island island-main"><path d="M45 100c-12-15 2-31 23-29 14-17 37-7 38 10 18 9 11 28-8 30-15 14-40 9-53-11Z" /><path d="M63 91c13-8 23-8 34 0" /></g><g className="map-island island-neighbor"><path d="M174 62c-8-12 3-23 17-20 12-13 31-4 30 10 14 8 8 22-7 24-11 10-31 5-40-14Z" /><circle cx="194" cy="63" r="4" /></g><g className="map-island island-quiet"><path d="M234 116c-7-11 4-20 17-18 8-12 27-5 26 8 12 7 7 20-7 21-10 9-29 5-36-11Z" /><path d="M249 113h14M256 106v14" /></g><g className="map-stamp"><circle cx="80" cy="110" r="11" /><path d="m75 110 4 4 7-9" /></g><g className="map-postcard"><path d="m137 111 19-6 11 11-19 6Z" /><path d="m145 111 4 4 6-7" /></g></svg>;
}

function App() {
  const [state, setState] = useState(loadState);
  const [activePresetId, setActivePresetId] = useState(loadLightPresetId);
  const [previewPresetId, setPreviewPresetId] = useState(null);
  const [skinPulse, setSkinPulse] = useState(0);
  const [tab, setTab] = useState('box');
  const [feedback, setFeedback] = useState({ type: 'idle', stamp: Date.now() - 2000 });
  const [hoverAction, setHoverAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [progressOpen, setProgressOpen] = useState(false);
  const [personalityOpen, setPersonalityOpen] = useState(null);
  const [unlockedBadge, setUnlockedBadge] = useState(null);
  const [evidenceFilter, setEvidenceFilter] = useState('all');
  const [message, setMessage] = useState('它在等你靠近。');
  const responseTimerRef = useRef(null);
  const badgeCountRef = useRef(state.badges.length);
  const phoneContentRef = useRef(null);

  const clearResponseTimer = useCallback(() => {
    if (responseTimerRef.current) {
      window.clearTimeout(responseTimerRef.current);
      responseTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearResponseTimer, [clearResponseTimer]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    localStorage.setItem(LIGHT_SKIN_STORAGE_KEY, activePresetId);
  }, [activePresetId]);

  useEffect(() => {
    phoneContentRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [tab]);

  useEffect(() => {
    if (state.badges.length > badgeCountRef.current) setUnlockedBadge(state.badges[state.badges.length - 1]);
    badgeCountRef.current = state.badges.length;
  }, [state.badges]);

  useEffect(() => {
    const overlayOpen = drawerOpen || Boolean(selectedEvidence) || Boolean(selectedBadge) || Boolean(progressOpen) || Boolean(personalityOpen) || Boolean(unlockedBadge);
    document.body.classList.toggle('modal-open', overlayOpen);
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return;
      setDrawerOpen(false);
      setSettingsOpen(false);
      setResetConfirm(false);
      setSelectedEvidence(null);
      setSelectedBadge(null);
      setProgressOpen(false);
      setPersonalityOpen(null);
      setUnlockedBadge(null);
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
    setMessage(type === 'wait' ? '你等到了。它终于留下了一点回应。' : '它回应了一下，很轻。');
    playTone('reply');
    responseTimerRef.current = null;
    setBusy(false);
  }, []);

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
      setMessage('两下敲击已经送进去。不要急着再敲。');
      playTone('knock');
      responseTimerRef.current = window.setTimeout(() => commitReply('knock'), 1800);
    } else if (type === 'wait') {
      setMessage('把手放下。现在轮到它。');
      responseTimerRef.current = window.setTimeout(() => commitReply('wait'), 2400);
    } else if (type === 'touch') {
      setMessage('它感到你的手靠近了。');
      responseTimerRef.current = window.setTimeout(() => commitReply('touch'), 550);
    } else {
      setMessage('先不要看，听一会儿。');
      playTone('reply');
      responseTimerRef.current = window.setTimeout(() => commitReply('listen'), 1550);
    }
  }, [busy, commitReply]);

  const touchBox = useCallback(() => doInteraction('touch'), [doInteraction]);

  const sendPostcard = () => {
    if (busy) return;
    setState(previous => {
      let next = { ...previous, social: Math.min(100, previous.social + 10), postcards: previous.postcards + 1, lastEvent: '047 号盒子晚一点回了你。', presenceState: 'responding', lastInteractionAt: Date.now() };
      next = awardBadge(next, 'postcard');
      next = addEvidence(next, { title: '寄出一段声音', kind: 'relationship', note: '分享的是气息，不是比较。', time: '刚刚' });
      const progress = deriveProgress(next);
      next.currentCycle = { ...previous.currentCycle, progress, evidenceIds: next.evidence.slice(0, 8).map(item => item.id), completed: progress >= 100 };
      return next;
    });
    playTone('postcard');
    setMessage('声音明信片已经寄出。对方可能在很晚的时候听见。');
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
  const currentTabCopy = COPY.tabs[tab];
  const [sectionLabel, sectionTitle, sectionCopy] = [currentTabCopy.label, currentTabCopy.title, currentTabCopy.copy];
  const hoveredAction = COPY.actions[hoverAction];
  const presenceCopy = COPY.state[state.presenceState] || COPY.state.idle;
  const hoverCopy = hoveredAction ? [hoveredAction.label, hoveredAction.hover] : [presenceCopy.eyebrow, presenceCopy.title];
  const visibleEvidence = state.evidence.filter(item => evidenceFilter === 'all' || (evidenceFilter === 'sound' ? item.kind === 'relationship' : evidenceFilter === 'light' ? item.kind === 'origin' : item.kind === 'behavior'));

  return <div className="app-shell">
    <header className="app-header">
      <div><div className="brand">knock knock</div></div>
       <button className="text-button top-menu-button" onClick={() => { setDrawerOpen(true); setSettingsOpen(true); }} aria-label="打开设置菜单"><Icon name="more" /></button>
    </header>

    <main className="prototype-board">
      <section className="scene-column" aria-label="独立实体互动场景">
        <div className="scene-topline"><span>{COPY.hero.label}</span><span className="status-pill"><i></i> 在</span></div>
        <h1>{COPY.hero.title[0]}<br />{COPY.hero.title[1]}</h1>
        <p className="scene-intro">{COPY.hero.intro[0]}<br />{COPY.hero.intro[1]}</p>
        <div className="scene-stage">
          <UnknownBoxScene feedback={feedback} onTouch={touchBox} activePresetId={activePresetId} previewPresetId={previewPresetId} />
        </div>
        <div className="scene-controls">
          <div className="scene-control-head"><span className="eyebrow">{hoverCopy[0]}</span><span className="signal-readout"><span className="live-dot"></span><small>{feedback.type === 'reply' || state.presenceState === 'responding' ? '有回应' : '很安静'}</small></span></div>
          <div className="scene-message"><strong>{hoverCopy[1]}</strong><small>{message}</small><div className="scene-quick-actions"><button type="button" disabled={busy} onClick={() => doInteraction('knock')} onMouseEnter={() => setHoverAction('knock')} onMouseLeave={() => setHoverAction(null)}>敲两下</button><button type="button" disabled={busy} onClick={() => doInteraction('wait')} onMouseEnter={() => setHoverAction('wait')} onMouseLeave={() => setHoverAction(null)}>等一会</button><button type="button" disabled={busy} onClick={() => doInteraction('touch')} onMouseEnter={() => setHoverAction('touch')} onMouseLeave={() => setHoverAction(null)}>轻轻碰</button><button type="button" disabled={busy} onClick={() => doInteraction('listen')} onMouseEnter={() => setHoverAction('listen')} onMouseLeave={() => setHoverAction(null)}>听听看</button></div></div>
        </div>
      </section>

      <section className="phone-column" aria-label="手机 App 原型">
        <div className="phone-frame">
          <div className="phone-speaker"></div>
          <div className="phone-screen">
             <div className="phone-status"><span>9:41</span><PhoneStatusIcons /></div>
            <div ref={phoneContentRef} className="phone-content">
              <section className="content-head phone-content-head">
                <div>{sectionLabel && <span className="eyebrow accent">{sectionLabel}</span>}<h2>{sectionTitle}</h2><p>{sectionCopy}</p></div>
                <div className="phone-head-tools"><div className="signal-readout" aria-label={feedback.type === 'reply' ? '有回应' : '很安静'}><span className="live-dot"></span></div><button className="phone-menu-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="打开贴纸抽屉"><i></i><i></i><i></i></button></div>
              </section>

              {tab === 'box' && <section className="phone-home">
                 <div className="today-note"><span className="tape-strip"></span><span className="eyebrow">今日便签</span><strong>今天，它好像<br />比昨天更愿意靠近。</strong><small>记录一段不确定的靠近</small><div className="note-sun"><StickerGlyph kind="warm" /></div><div className="note-scribble"></div></div>
                 <div className="phone-signal-row"><span className="signal-orb" style={{ '--orb-a': activePreset.colors.blobs[0], '--orb-b': activePreset.colors.blobs[1], '--orb-c': activePreset.colors.blobs[2] }}><Icon name="light" /></span><div><strong>今天的回应</strong><small>{state.lastEvent}</small></div><span className="note-arrow">↗</span></div>
                  <div className="phone-field-chip"><span className="field-chip-orb" style={{ background: `linear-gradient(135deg, ${activePreset.colors.blobs[0]}, ${activePreset.colors.blobs[1]} 48%, ${activePreset.colors.blobs[2]})` }}></span><div><small>当前光场</small><strong>{activePreset.title[0]}</strong></div><em>正在流动</em></div>
                <div className="phone-inline-stats">
                   <span><b>{state.interactions}</b><small>相处次数</small></span><span><b>{state.badges.length}</b><small>留下的章</small></span><span><b>{state.currentCycle.evidenceIds.length}</b><small>留下的线索</small></span>
                </div>
                <div className="phone-section-line"><span>今天可以</span><span>不用急</span></div>
                <div className="care-list">
                  <div><span className="list-icon">01</span><span><b>接近</b><small>手放在它旁边</small></span><em>完成</em></div>
                  <div><span className="list-icon">02</span><span><b>留白</b><small>等它自己决定</small></span><em className="pending">现在</em></div>
                  <div><span className="list-icon">03</span><span><b>记录</b><small>把回应收进证据册</small></span><em>→</em></div>
                </div>
                 <div className="box-art-strip"><MiniBoxArt preset={getLightPreset(activePresetId)} /></div>
                 <div className="sticker-asset-rail" aria-label="今天留下的贴纸"><div className="coded-sticker-card"><StickerBadge id="origin" compact /><span>有一点在场</span></div><div className="coded-sticker-card"><StickerBadge id="waited" compact /><span>它回来了</span></div><div className="coded-sticker-card"><StickerBadge id="three-visits" compact /><span>微小靠近</span></div></div>
                <div className="phone-progress-card"><div className="progress-card-head"><span>探索进度</span><b>{state.currentCycle.progress}%</b></div><div className="progress-track"><i style={{ width: `${state.currentCycle.progress}%` }}></i></div><p>多了解一点点，慢慢看见它的习惯。</p><button type="button" className="text-link-button" onClick={() => setProgressOpen(true)}>查看这一轮的路径 <span>↗</span></button></div>
                <div className="phone-personality-snapshot"><div className="phone-section-line"><span>猜猜它的性格</span><span>只是目前的猜测</span></div><div className="personality-chip-grid">{PERSONALITY_COPY.slice(0, 3).map(([id, title]) => <button type="button" className={`personality-chip personality-${id}`} key={id} onClick={() => setPersonalityOpen(id)}><StickerGlyph kind={id === 'companion' ? 'warm' : id === 'explorer' ? 'curious' : 'night'} /><span>{title}</span><b>{state.personality[id]}%</b></button>)}</div></div>
                <button type="button" className="clue-button" onClick={() => setTab('evidence')}><span>查看今天的线索</span><b>↗</b></button>
              </section>}

               {tab === 'evidence' && <section className="phone-evidence"><div className="evidence-filter-row" role="tablist" aria-label="证据筛选"><button type="button" className={evidenceFilter === 'all' ? 'active' : ''} onClick={() => setEvidenceFilter('all')}>全部</button><button type="button" className={evidenceFilter === 'light' ? 'active' : ''} onClick={() => setEvidenceFilter('light')}>光线</button><button type="button" className={evidenceFilter === 'sound' ? 'active' : ''} onClick={() => setEvidenceFilter('sound')}>声音</button><button type="button" className={evidenceFilter === 'touch' ? 'active' : ''} onClick={() => setEvidenceFilter('touch')}>靠近</button></div><div className="sticker-wall"><div className="sticker sticker-orange"><StickerGlyph kind="curious" /><span>还没<br />命名</span></div><div className="sticker sticker-yellow"><StickerGlyph kind="patient" /><span>它等了<br />一会儿</span></div><div className="sticker sticker-blue"><StickerGlyph kind="night" /><span>一段<br />声音</span></div><div className="sticker sticker-pink"><StickerGlyph kind="warm" /><span>第三次<br />来访</span></div></div><div className="evidence-scrap-row" aria-label="证据碎片"><div className="evidence-scrap signal-scrap"><span>今日信号</span><SignalWave active={feedback.type === 'reply'} /><small>02:36 / 有一点回来</small></div><div className="evidence-scrap gradient-scrap"><MiniBoxArt preset={getLightPreset(activePresetId)} /><small>光场碎片 / {getLightPreset(activePresetId).title[0]}</small></div></div><div className="phone-section-line"><span>小小的收藏</span><span>{state.badges.filter(id => BADGE_DETAILS[id]).length} 张</span></div><div className="phone-badge-list">{badges.map(([id, title, copy]) => <StickerBadge key={id} id={id} title={title} copy={copy} unlocked={state.badges.includes(id)} onOpen={setSelectedBadge} />)}</div><div className="phone-evidence-log"><span className="eyebrow">最近留下</span>{visibleEvidence.slice(0, 4).map(item => <button className="log-row log-row-button" key={item.id} type="button" onClick={() => setSelectedEvidence(item)}><span className={`log-dot ${item.kind}`}></span><span><strong>{item.title}</strong><small>{item.note}</small></span><time>{item.time}</time></button>)}{visibleEvidence.length === 0 && <p className="empty-evidence">这一类线索还没有留下来。</p>}</div></section>}

               {tab === 'island' && <section className="phone-island"><div className="island-art-card"><IslandMap /></div><div className="island-icon-grid"><button aria-label="听见声音"><span><Icon name="sound" /></span><small>听见</small></button><button aria-label="看看来访"><span><Icon name="visit" /></span><small>来访</small></button><button aria-label="看看关系"><span><Icon name="relation" /></span><small>关系</small></button></div><div className="phone-section-line"><span>邻居的回应</span><span>慢一点也没关系</span></div><div className="postcard"><SignalWave active /><small>047 号盒子 / 晚了 2.4 秒</small></div><button className="primary-button" onClick={sendPostcard}>寄出一段声音</button><div className="social-stat"><span>已寄出 <b>{state.postcards}</b> 张</span><span>偶尔共鸣 <b>{state.social}%</b></span></div></section>}

               {tab === 'profile' && <section className="phone-profile"><div className="profile-sticker">它有点像……</div><h3>一只慢热的未知物</h3><p>不是答案，只是最近留下的几个猜想。</p><div className="profile-doodle"><div className="profile-orbit orbit-a"></div><div className="profile-orbit orbit-b"></div><StickerGlyph kind="curious" /><span>靠近 / 退开 / 再回来</span></div><div className="profile-progress-card"><div><span>探索进度</span><b>{state.currentCycle.progress}%</b></div><i><em style={{ width: `${state.currentCycle.progress}%` }}></em></i><small>完成一轮也不会揭晓它是什么，只会留下更多认识。</small></div><div className="phone-section-line"><span>目前推测</span><span>会继续变化</span></div><div className="personality-chip-grid profile-personality-grid">{PERSONALITY_COPY.map(([id, title, copy]) => <button type="button" className={`personality-chip personality-${id}`} key={id} onClick={() => setPersonalityOpen(id)}><StickerGlyph kind={id === 'companion' ? 'warm' : id === 'explorer' || id === 'curious' ? 'curious' : id === 'nocturnal' ? 'night' : 'patient'} /><span>{title}</span><b>{state.personality[id]}%</b></button>)}</div><div className="phone-section-line"><span>伙伴纪念章</span><span>{state.badges.filter(id => state.badges.includes(id)).length} / {badges.length}</span></div><div className="badge-gallery">{badges.map(([id, title, copy]) => <StickerBadge key={id} id={id} title={title} copy={copy} unlocked={state.badges.includes(id)} compact onOpen={setSelectedBadge} />)}</div><button type="button" className="clue-button" onClick={() => setProgressOpen(true)}><span>查看探索阶段</span><b>↗</b></button><p className="profile-footnote">下一次回应，可能会让它变成另一种样子。</p></section>}
            </div>
            <nav className="bottom-nav"><button className={tab === 'box' ? 'active' : ''} onClick={() => setTab('box')}><span><Icon name="box" /></span><small>我的盒子</small></button><button className={tab === 'evidence' ? 'active' : ''} onClick={() => setTab('evidence')}><span><Icon name="evidence" /></span><small>证据册</small></button><button className={tab === 'island' ? 'active' : ''} onClick={() => setTab('island')}><span><Icon name="island" /></span><small>盒群岛</small></button><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><span><Icon name="profile" /></span><small>性格档案</small></button></nav>
             {drawerOpen && <div className="phone-overlay" role="presentation" onClick={() => { setDrawerOpen(false); setSettingsOpen(false); setResetConfirm(false); }}><aside className={`phone-drawer ${settingsOpen ? 'is-settings' : ''}`} role="dialog" aria-modal="true" aria-label={settingsOpen ? '设置菜单' : '贴纸抽屉'} onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => { setDrawerOpen(false); setSettingsOpen(false); setResetConfirm(false); }} aria-label="关闭菜单">×</button>{settingsOpen ? <>{resetConfirm ? <><span className="eyebrow accent">重新开始</span><h3>要重新开始吗？</h3><p>这会清除本地的证据、徽章和当前光场选择。这个动作不能撤回。</p><div className="drawer-action-row"><button className="drawer-action secondary" type="button" onClick={() => setResetConfirm(false)}>先不要</button><button className="drawer-action danger" type="button" onClick={reset}>清除并重新开始</button></div></> : <><span className="eyebrow accent">设置菜单</span><h3>留一点空间</h3><p>把声音、贴纸和重新开始都放在这里。</p><div className="settings-list"><button type="button"><span>声音回应</span><b>开启</b></button><button type="button" onClick={() => { setSettingsOpen(false); setTab('profile'); }}><span>我的性格档案</span><b>查看 ↗</b></button><button type="button" onClick={() => setResetConfirm(true)}><span>重新开始</span><b>需要确认</b></button></div></>} </> : <><span className="eyebrow accent">贴纸抽屉</span><h3>今天留下的</h3><p>一些还不能解释的东西，先放在这里。</p><div className="drawer-sticker-stack"><StickerBadge id="origin" compact /><StickerBadge id="waited" compact /><StickerBadge id="postcard" compact /><StickerBadge id="signal" compact /></div><div className="drawer-action-row"><button className="drawer-action secondary" type="button" onClick={() => { setDrawerOpen(false); setTab('evidence'); }}>收进证据册 <span>↗</span></button><button className="drawer-action" type="button" onClick={() => setSettingsOpen(true)}>设置 <span>⋯</span></button></div></>}</aside></div>}
             {selectedEvidence && <div className="phone-overlay sheet-overlay" role="presentation" onClick={() => setSelectedEvidence(null)}><section className="phone-sheet" role="dialog" aria-modal="true" aria-label="证据详情" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setSelectedEvidence(null)} aria-label="关闭证据详情">×</button><span className={`log-dot ${selectedEvidence.kind}`}></span><span className="eyebrow accent">证据 · {selectedEvidence.time}</span><h3>{selectedEvidence.title}</h3><p>{selectedEvidence.note}</p><div className="sheet-mark"><Icon name={selectedEvidence.kind === 'relationship' ? 'sound' : selectedEvidence.kind === 'touch' ? 'light' : 'evidence'} /></div><small>这不是结论，只是它曾经靠近过的地方。</small></section></div>}
             {selectedBadge && <div className="phone-overlay badge-overlay" role="presentation" onClick={() => setSelectedBadge(null)}><section className="phone-sheet badge-detail-sheet" role="dialog" aria-modal="true" aria-label="徽章详情" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setSelectedBadge(null)} aria-label="关闭徽章详情">×</button><StickerBadge id={selectedBadge} compact unlocked={state.badges.includes(selectedBadge)} /><span className="eyebrow accent">徽章 · {BADGE_DETAILS[selectedBadge]?.label || '未知'}</span><h3>{BADGE_DETAILS[selectedBadge]?.title}</h3><p>{state.badges.includes(selectedBadge) ? BADGE_DETAILS[selectedBadge]?.copy : '这枚贴纸还在远处，等一段足够具体的观察。'}</p><small>{state.badges.includes(selectedBadge) ? '已经收进你的收藏。' : '证据足够时，它会自己出现。'}</small></section></div>}
             {unlockedBadge && <div className="phone-overlay badge-overlay" role="presentation" onClick={() => setUnlockedBadge(null)}><section className="phone-sheet badge-unlock-sheet" role="dialog" aria-modal="true" aria-label="徽章解锁" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setUnlockedBadge(null)} aria-label="关闭解锁提示">×</button><span className="eyebrow accent">新的纪念章</span><StickerBadge id={unlockedBadge} compact /><h3>{BADGE_DETAILS[unlockedBadge]?.title}</h3><p>你注意到了一段具体的关系变化，为这段相处留下一枚纪念章。</p><button className="drawer-action" type="button" onClick={() => setUnlockedBadge(null)}>收好它 <span>↗</span></button></section></div>}
             {progressOpen && <div className="phone-overlay sheet-overlay" role="presentation" onClick={() => setProgressOpen(false)}><section className="phone-sheet progress-detail-sheet" role="dialog" aria-modal="true" aria-label="探索进度详情" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setProgressOpen(false)} aria-label="关闭探索进度">×</button><span className="eyebrow accent">探索进度 · {state.currentCycle.progress}%</span><h3>慢慢认识它</h3><p>完成一轮探索，不代表揭晓答案，只代表你留下了足够多的具体时刻。</p><div className="progress-stage-list"><span className={state.currentCycle.progress >= 20 ? 'is-done' : ''}><b>20%</b>发现线索</span><span className={state.currentCycle.progress >= 40 ? 'is-done' : ''}><b>40%</b>认识习惯</span><span className={state.currentCycle.progress >= 60 ? 'is-done' : ''}><b>60%</b>看见性格轮廓</span><span className={state.currentCycle.progress >= 80 ? 'is-done' : ''}><b>80%</b>建立亲密回应</span><span className={state.currentCycle.progress >= 100 ? 'is-done' : ''}><b>100%</b>获得伙伴纪念章</span></div></section></div>}
             {personalityOpen && <div className="phone-overlay sheet-overlay" role="presentation" onClick={() => setPersonalityOpen(null)}><section className="phone-sheet personality-detail-sheet" role="dialog" aria-modal="true" aria-label="性格推测详情" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setPersonalityOpen(null)} aria-label="关闭性格详情">×</button><span className="eyebrow accent">性格猜测 · 暂时理解</span><h3>{PERSONALITY_COPY.find(item => item[0] === personalityOpen)?.[1]}</h3><p>{PERSONALITY_COPY.find(item => item[0] === personalityOpen)?.[2]}</p><div className="personality-detail-score"><b>{state.personality[personalityOpen]}%</b><span>来自 {state.evidence.length} 条已留下的线索</span></div><small>这不是固定类型。下一次回应，可能会让它变成另一种样子。</small></section></div>}
          </div>
        </div>
      </section>
    </main>

    <CoverWall activePresetId={activePresetId} previewPresetId={previewPresetId} onPreviewStart={setPreviewPresetId} onPreviewEnd={() => setPreviewPresetId(null)} onCommit={commitPreset} pulseKey={skinPulse} />

  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
