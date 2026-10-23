import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import p5 from 'p5';
import { curveCatmullRom, line, scaleLinear } from 'd3';
import './styles.css';

const STORAGE_KEY = 'knock-knock-state-v2';

const DEFAULT_STATE = {
  bond: 24,
  patience: 16,
  expression: 12,
  social: 4,
  evidence: [
    { id: 'seed', title: '它还没有被命名', kind: 'origin', note: '未知仍然保留。', time: '刚刚' },
    { id: 'quiet', title: '安静的在场', kind: 'behavior', note: '它没有马上回答，但没有离开。', time: '今天' },
  ],
  badges: ['origin'],
  interactions: 0,
  postcards: 0,
  lastEvent: '它在等你靠近。',
};

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
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
  };
  return <svg className="ui-icon" viewBox="0 0 24 24" aria-label={label} role={label ? 'img' : undefined} aria-hidden={label ? undefined : true} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[name] || shapes.box}</svg>;
}

function updateFromInteraction(previous, type) {
  let next = {
    ...previous,
    interactions: previous.interactions + 1,
    bond: Math.min(100, previous.bond + (type === 'wait' ? 5 : 2)),
    expression: Math.min(100, previous.expression + (type === 'touch' ? 3 : 1)),
    lastEvent: type === 'knock' ? '它收到了两下敲击，正在想要不要回答。' : type === 'wait' ? '你等了一会儿，它终于留下了一点回应。' : '手指离开后，中心信号亮了一下。',
  };
  if (type === 'wait') {
    next.patience = Math.min(100, previous.patience + 8);
    next = awardBadge(next, 'waited');
    next = addEvidence(next, { title: '等到它回答', kind: 'behavior', note: '等待本身也被记录成了一种照料。', time: '刚刚' });
  }
  if (type === 'touch') {
    next = addEvidence(next, { title: '手指靠近过', kind: 'behavior', note: '触摸不是命令，是一次邀请。', time: '刚刚' });
  }
  if (next.interactions >= 3) next = awardBadge(next, 'three-visits');
  return next;
}

function ScribbleLayer() {
  const hostRef = useRef(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const sketch = (p) => {
      const drawWobblyFrame = (x, y, w, h, color, offset) => {
        p.noFill();
        p.stroke(color);
        p.strokeWeight(1.2);
        p.beginShape();
        const points = [[x, y], [x + w, y + 1], [x + w - 1, y + h], [x + 2, y + h - 1], [x, y]];
        points.forEach(([px, py], index) => p.vertex(px + Math.sin(index + offset) * 1.2, py + Math.cos(index * 1.3 + offset) * 1.1));
        p.endShape();
      };
      p.setup = () => {
        const canvas = p.createCanvas(Math.max(host.clientWidth, 10), Math.max(host.clientHeight, 10));
        canvas.parent(host);
        p.pixelDensity(1);
        p.clear();
        drawWobblyFrame(14, 14, p.width - 28, p.height - 28, '#f2552e', 0.4);
        drawWobblyFrame(17, 17, p.width - 34, p.height - 34, '#c96b50', 1.7);
        p.stroke('#f2552e');
        p.strokeWeight(1.2);
        p.noFill();
        p.beginShape();
        for (let i = 0; i < 7; i += 1) {
          const x = p.width * 0.47 + i * 8;
          const y = p.height * 0.45 + (i % 2 ? -5 : 5);
          p.vertex(x, y);
        }
        p.endShape();
        p.noLoop();
      };
    };
    const instance = new p5(sketch);
    return () => instance.remove();
  }, []);
  return <div className="scribble-layer" ref={hostRef} aria-hidden="true" />;
}

function D3TraitPath({ values }) {
  const x = scaleLinear().domain([0, values.length - 1]).range([10, 310]);
  const y = scaleLinear().domain([0, 100]).range([84, 10]);
  const makeLine = line().x((value, index) => x(index)).y(value => y(value)).curve(curveCatmullRom.alpha(0.65));
  const points = values.map(value => value);
  return <div className="d3-trait-wrap"><svg className="d3-trait" viewBox="0 0 320 96" role="img" aria-label="盒子的变化轨迹"><path d={makeLine(points)} fill="none" stroke="#f2552e" strokeWidth="2" strokeLinecap="round" /><path d={makeLine(points.map(value => Math.max(0, value - 8)))} fill="none" stroke="#8cc8d3" strokeWidth="1" strokeDasharray="2 6" /><g>{points.map((value, index) => <circle key={`${value}-${index}`} cx={x(index)} cy={y(value)} r="3.5" fill={index % 2 ? '#f6d96b' : '#f2552e'} stroke="#2f2a27" strokeWidth="1" />)}</g></svg><div className="d3-axis-labels"><span>靠近</span><span>回来</span><span>发亮</span><span>遇见</span></div></div>;
}

const COVER_WALL = [
  { id: 'soft-signal', lines: ['SOFT SIGNAL', 'WARM ARRIVAL'], top: '#b6afd9', bottom: '#bf773f', blobs: ['#d694ae', '#e4a854', '#8f91c4', '#c66d4f'], pattern: 'rays' },
  { id: 'indie-builders', lines: ['INDIE BUILDERS', 'WEEKLY NOTE'], top: '#98a8b1', bottom: '#342622', blobs: ['#d1b37b', '#bc6344', '#6c8495', '#3a2a2a'], pattern: 'contours' },
  { id: 'quiet-current', lines: ['QUIET CURRENT', 'DEEP BLUE'], top: '#a8c0cb', bottom: '#123849', blobs: ['#d9d5c2', '#3f7990', '#1c506d', '#7eaeb5'], pattern: 'waves' },
  { id: 'green-room', lines: ['GREEN ROOM', 'SLOW RETURN'], top: '#b7c6c8', bottom: '#183d35', blobs: ['#a9cfd1', '#7da697', '#365c55', '#b0bd96'], pattern: 'dots' },
  { id: 'late-night', lines: ['LATE NIGHT', 'SOFT SIGNAL'], top: '#b9b0d8', bottom: '#1f1236', blobs: ['#d59ac5', '#8f6ab6', '#312050', '#e4b1c2'], pattern: 'lens' },
  { id: 'public-fire', lines: ['BUILD IN', 'PUBLIC'], top: '#b6c0c2', bottom: '#9a4337', blobs: ['#d9d7ca', '#df8d65', '#ad4e45', '#e2b38a'], pattern: null },
];

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

function CoverCard({ cover, index }) {
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
  };
  return <article ref={cardRef} className={`cover-card ${hovered ? 'is-hovered' : ''}`} style={{ '--cover-top': cover.top, '--cover-bottom': cover.bottom, '--blob-a': cover.blobs[0], '--blob-b': cover.blobs[1], '--blob-c': cover.blobs[2], '--blob-d': cover.blobs[3], '--delay': `${index * -2.4}s` }} onPointerEnter={() => setHovered(true)} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} aria-label={`${cover.lines[0]} ${cover.lines[1]}`}>
    <div className="cover-blob blob-a"></div><div className="cover-blob blob-b"></div><div className="cover-blob blob-c"></div><div className="cover-blob blob-d"></div>
    <CoverNoise cardRef={cardRef} />
    <CoverPattern kind={cover.pattern} id={cover.id} />
    <span className="cover-title">{cover.lines[0]}<br />{cover.lines[1]}</span>
    <span className="cover-index">0{index + 1}</span>
    <span className="cover-cursor-glow"></span>
  </article>;
}

function CoverWall() {
  return <section className="cover-wall" aria-label="六张盒群岛封面"><div className="cover-wall-heading"><span className="eyebrow">盒群岛 / SIX QUIET WORLDS</span><h2>每一次回应，都有自己的封面。</h2><p>把光标放上去，色团会靠近你，纹样会往后退一点。</p></div><div className="cover-grid">{COVER_WALL.map((cover, index) => <CoverCard key={cover.id} cover={cover} index={index} />)}</div></section>;
}

const BOX_VERTEX_SHADER = `
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;
  void main() {
    vLocalPosition = position;
    vLocalNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BOX_FRAGMENT_SHADER = `
  precision highp float;
  uniform vec3 uBaseColor;
  uniform float uTime;
  uniform vec3 uObjectOffset;
  uniform vec3 uLightPositions[3];
  uniform vec3 uLightColors[3];
  uniform float uLightIntensities[3];
  uniform float uLightRadii[3];
  varying vec3 vLocalPosition;
  varying vec3 vLocalNormal;

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

  void main() {
    vec3 p = vLocalPosition + uObjectOffset;
    vec3 n = normalize(vLocalNormal);
    vec3 key = normalize(vec3(-0.42, 0.86, 0.66));
    float diffuse = 0.72 + max(dot(n, key), 0.0) * 0.22;
    vec3 field = vec3(0.0);

    for (int i = 0; i < 3; i++) {
      vec3 delta = p - uLightPositions[i];
      float distanceSquared = dot(delta, delta);
      float radius = uLightRadii[i];
      float halo = exp(-distanceSquared / (2.0 * radius * radius));
      float coreRadius = radius * 0.42;
      float core = exp(-distanceSquared / (2.0 * coreRadius * coreRadius));
      float wrap = 0.62 + 0.38 * max(dot(normalize(-delta + vec3(0.0001)), n), 0.0);
      field += uLightColors[i] * (halo * 0.72 + core * 0.28) * uLightIntensities[i] * wrap;
    }

    float grain = (softNoise(p * 8.0 + uTime * 0.035) - 0.5) * 0.014;
    vec3 color = uBaseColor * diffuse + field * 0.62 + vec3(grain);
    color += field * 0.055 * softNoise(p * 3.0 + uTime * 0.08);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function createBoxMaterial(baseColor, objectOffset, lightField) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseColor: { value: new THREE.Color(baseColor) },
      uObjectOffset: { value: objectOffset },
      uTime: lightField.uTime,
      uLightPositions: lightField.uLightPositions,
      uLightColors: lightField.uLightColors,
      uLightIntensities: lightField.uLightIntensities,
      uLightRadii: lightField.uLightRadii,
    },
    vertexShader: BOX_VERTEX_SHADER,
    fragmentShader: BOX_FRAGMENT_SHADER,
  });
}

function UnknownBoxScene({ feedback, onTouch }) {
  const mountRef = useRef(null);
  const feedbackRef = useRef(feedback);
  const touchRef = useRef(onTouch);
  const [failed, setFailed] = useState(false);

  useEffect(() => { feedbackRef.current = feedback; }, [feedback]);
  useEffect(() => { touchRef.current = onTouch; }, [onTouch]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let renderer;
    try {
      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-3.6, 3.6, 2.7, -2.7, 0.1, 100);
      camera.position.set(3.65, 2.45, 6.4);
      camera.lookAt(0, 0.04, 0);
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      mount.appendChild(renderer.domElement);

      const stage = new THREE.Group();
      scene.add(stage);
      const lightField = {
        uTime: { value: 0 },
        uLightPositions: { value: [new THREE.Vector3(0.08, 0.05, 0.68), new THREE.Vector3(-0.3, 0.2, 0.12), new THREE.Vector3(0.25, 0.35, -0.5)] },
        uLightColors: { value: [new THREE.Color('#E8B46B'), new THREE.Color('#D98E7B'), new THREE.Color('#9EBBC5')] },
        uLightIntensities: { value: [1.08, 0.48, 0.28] },
        uLightRadii: { value: [1.06, 1.46, 0.84] },
      };
      const boxOffset = new THREE.Vector3(0, -0.03, 0);
      const lidOffset = new THREE.Vector3(0, 0.98, 0.02);
      const boxMaterial = createBoxMaterial('#c7d0d1', boxOffset, lightField);
      const lidMaterial = createBoxMaterial('#e5ebea', lidOffset, lightField);
      const box = new THREE.Mesh(new RoundedBoxGeometry(2.52, 1.74, 2.18, 6, 0.14), boxMaterial);
      box.position.copy(boxOffset);
      box.userData.kind = 'box';
      stage.add(box);
      const lid = new THREE.Mesh(new RoundedBoxGeometry(2.28, 0.25, 1.92, 6, 0.1), lidMaterial);
      lid.position.copy(lidOffset);
      lid.userData.kind = 'box';
      stage.add(lid);

      const seam = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.024, 0.035), new THREE.MeshBasicMaterial({ color: '#66757a', transparent: true, opacity: 0.72 }));
      seam.position.set(0, 0.65, 1.105);
      stage.add(seam);
      const signalMaterial = new THREE.MeshBasicMaterial({ color: '#edb66b', transparent: true, opacity: 0.92 });
      const signal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16), signalMaterial);
      signal.position.set(0, -0.05, 1.15);
      stage.add(signal);
      const ringMaterial = new THREE.MeshBasicMaterial({ color: '#df846d', transparent: true, opacity: 0.28 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.012, 12, 32), ringMaterial);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, -0.05, 1.155);
      stage.add(ring);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      const interactionTarget = new THREE.Vector3(0.08, 0.05, 0.68);
      const lightPosition = interactionTarget.clone();
      const lightVelocity = new THREE.Vector3();
      const localPoint = new THREE.Vector3();
      const targetWithDrift = new THREE.Vector3();
      let lastPointerAt = 0;
      let leaveTimer = 0;

      const pointerToBox = event => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects([box, lid], false);
        if (!hits.length) return false;
        localPoint.copy(hits[0].point);
        stage.worldToLocal(localPoint);
        interactionTarget.set(
          THREE.MathUtils.clamp(localPoint.x * 0.74, -0.94, 0.94),
          THREE.MathUtils.clamp(localPoint.y * 0.74, -0.54, 0.66),
          THREE.MathUtils.clamp(localPoint.z * 0.68, -0.62, 0.8),
        );
        lastPointerAt = performance.now();
        return true;
      };
      const onPointerMove = event => {
        window.clearTimeout(leaveTimer);
        pointerToBox(event);
      };
      const onPointerLeave = () => {
        leaveTimer = window.setTimeout(() => interactionTarget.set(0.12, 0.08, 0.52), 420);
      };
      const onPointerDown = event => {
        if (pointerToBox(event)) touchRef.current();
      };
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerleave', onPointerLeave);
      renderer.domElement.addEventListener('pointerdown', onPointerDown);

      let raf = 0;
      const timer = new THREE.Timer();
      const animate = () => {
        timer.update();
        const elapsed = timer.getElapsed();
        const currentFeedback = feedbackRef.current;
        const age = Date.now() - currentFeedback.stamp;
        const pulse = age >= 0 && age < 1250 ? Math.sin((age / 1250) * Math.PI) : 0;
        const recentlyApproached = performance.now() - lastPointerAt < 900;
        targetWithDrift.copy(interactionTarget);
        if (!recentlyApproached) {
          targetWithDrift.x += Math.sin(elapsed * 0.34) * 0.12;
          targetWithDrift.y += Math.cos(elapsed * 0.26) * 0.08;
          targetWithDrift.z += Math.sin(elapsed * 0.2) * 0.06;
        }
        lightVelocity.addScaledVector(targetWithDrift.sub(lightPosition), Math.min(timer.getDelta() * 3.8, 0.08));
        lightVelocity.multiplyScalar(Math.exp(-5.2 * Math.min(timer.getDelta(), 0.04)));
        lightPosition.addScaledVector(lightVelocity, Math.min(timer.getDelta(), 0.04));
        const primary = lightField.uLightPositions.value[0];
        primary.copy(lightPosition).multiplyScalar(1 - pulse * 0.28);
        lightField.uLightPositions.value[1].copy(lightPosition).multiplyScalar(0.56).add(new THREE.Vector3(-0.28, 0.18, -0.08));
        lightField.uLightPositions.value[2].copy(lightPosition).multiplyScalar(0.32).add(new THREE.Vector3(0.15, -0.2, -0.54));
        lightField.uTime.value = elapsed;
        signalMaterial.opacity = 0.82 + pulse * 0.16;
        signal.scale.setScalar(1 + pulse * 0.04);
        ring.scale.setScalar(1 + pulse * 0.12);
        ringMaterial.opacity = 0.2 + pulse * 0.15;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(animate);
      };
      animate();

      const onResize = () => {
        renderer.setSize(mount.clientWidth, mount.clientHeight);
        const aspect = mount.clientWidth / Math.max(mount.clientHeight, 1);
        camera.left = -3.6 * aspect;
        camera.right = 3.6 * aspect;
        camera.top = 2.7;
        camera.bottom = -2.7;
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
        boxMaterial.dispose();
        lidMaterial.dispose();
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
    return <div className="scene-fallback"><div className="fallback-box" aria-hidden="true"><div className="fallback-lid"></div><div className="fallback-signal"></div></div><span>当前设备不支持 WebGL，已切换为纯 CSS 盒体预览</span></div>;
  }
  return <div className="scene-host" ref={mountRef} />;
}

function Badge({ id, title, copy, unlocked }) {
  return <div className={`badge ${unlocked ? 'unlocked' : 'locked'}`}>
    <div className="badge-mark">{unlocked ? '✦' : '·'}</div>
    <div><strong>{title}</strong><small>{unlocked ? copy : '还没有被它留下。'}</small></div>
  </div>;
}

function App() {
  const [state, setState] = useState(loadState);
  const [tab, setTab] = useState('box');
  const [feedback, setFeedback] = useState({ type: 'idle', stamp: Date.now() - 2000 });
  const [hoverAction, setHoverAction] = useState(null);
  const [busy, setBusy] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState(null);
  const [message, setMessage] = useState('它在等你靠近。');
  const responseTimerRef = useRef(null);

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

  const commitReply = useCallback((type) => {
    setState(previous => updateFromInteraction(previous, type));
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
    if (type === 'knock') {
      setMessage('两下敲击已经送进去。不要急着再敲。');
      playTone('knock');
      responseTimerRef.current = window.setTimeout(() => commitReply('knock'), 1800);
    } else if (type === 'wait') {
      setMessage('把手放下。现在轮到它。');
      responseTimerRef.current = window.setTimeout(() => commitReply('wait'), 2400);
    } else {
      setMessage('它感到你的手靠近了。');
      responseTimerRef.current = window.setTimeout(() => commitReply('touch'), 550);
    }
  }, [busy, commitReply]);

  const touchBox = useCallback(() => doInteraction('touch'), [doInteraction]);

  const sendPostcard = () => {
    if (busy) return;
    setState(previous => {
      let next = { ...previous, social: Math.min(100, previous.social + 10), postcards: previous.postcards + 1, lastEvent: '047 号盒子晚一点回了你。' };
      next = awardBadge(next, 'postcard');
      return addEvidence(next, { title: '寄出一段声音', kind: 'relationship', note: '分享的是气息，不是比较。', time: '刚刚' });
    });
    playTone('postcard');
    setMessage('声音明信片已经寄出。对方可能在很晚的时候听见。');
  };

  const reset = () => {
    clearResponseTimer();
    localStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_STATE);
    setBusy(false);
    setMessage('重新从一个未知盒开始。');
  };

  const badges = [
    ['origin', '未知的开始', '你没有急着给它命名。'],
    ['waited', '等到它回答', '你把等待当成照料。'],
    ['three-visits', '第三次来访', '关系开始有自己的节奏。'],
    ['postcard', '声音寄出去了', '一个盒子把回应寄给另一个盒子。'],
  ];

  const phoneTitles = {
    box: ['', '今天的盒子', '它还在。'],
    evidence: ['', '留下来的', '每一次回应，都会变成一小块证据。'],
    island: ['', '邻居', '有些回应会绕远路回来。'],
    profile: ['', '它最近的样子', '不是答案，只是一些靠近过的痕迹。'],
  };
  const [sectionLabel, sectionTitle, sectionCopy] = phoneTitles[tab];
  const hoverCopy = {
    knock: ['敲两下', '轻轻邀请它回答'],
    wait: ['等一会', '把决定留给它'],
    touch: ['摸一下', '只靠近，不催促'],
  }[hoverAction] || ['把光标放到插画上', '从靠近开始'];

  return <div className="app-shell">
    <header className="app-header">
      <div><div className="brand">knock knock</div></div>
      <button className="text-button" onClick={reset} aria-label="重新开始"><Icon name="refresh" /></button>
    </header>

    <main className="prototype-board">
      <section className="scene-column" aria-label="独立实体互动场景">
        <div className="scene-topline"><span>今天的盒子</span><span className="status-pill"><i></i> 在</span></div>
        <h1>今天，<br />它也在这里。</h1>
        <div className="scene-stage">
          <UnknownBoxScene feedback={feedback} onTouch={touchBox} />
        </div>
        <div className="scene-controls">
          <div className="scene-control-head"><span className="eyebrow">{hoverCopy[0]}</span><span className="signal-readout"><span className="live-dot"></span><small>{feedback.type === 'reply' ? '有回应' : '很安静'}</small></span></div>
          <div className="scene-message"><strong>{hoverCopy[1]}</strong><small>{message}</small><div className="scene-quick-actions"><button type="button" disabled={busy} onClick={() => doInteraction('knock')} onMouseEnter={() => setHoverAction('knock')} onMouseLeave={() => setHoverAction(null)}>敲两下</button><button type="button" disabled={busy} onClick={() => doInteraction('wait')} onMouseEnter={() => setHoverAction('wait')} onMouseLeave={() => setHoverAction(null)}>等一会</button><button type="button" disabled={busy} onClick={() => doInteraction('touch')} onMouseEnter={() => setHoverAction('touch')} onMouseLeave={() => setHoverAction(null)}>摸一下</button></div></div>
        </div>
      </section>

      <section className="phone-column" aria-label="手机 App 原型">
        <div className="phone-frame">
          <div className="phone-speaker"></div>
          <div className="phone-screen">
            <div className="phone-status"><span>9:41</span><span>◌ ◌ ▰</span></div>
            <div className="phone-content">
              <section className="content-head phone-content-head">
                <div>{sectionLabel && <span className="eyebrow accent">{sectionLabel}</span>}<h2>{sectionTitle}</h2><p>{sectionCopy}</p></div>
                <div className="phone-head-tools"><div className="signal-readout" aria-label={feedback.type === 'reply' ? '有回应' : '很安静'}><span className="live-dot"></span></div><button className="phone-menu-button" type="button" onClick={() => setDrawerOpen(true)} aria-label="打开贴纸抽屉"><i></i><i></i><i></i></button></div>
              </section>

              {tab === 'box' && <section className="phone-home">
                <div className="phone-signal-row"><span className="signal-orb"><Icon name="light" /></span><div><strong>今天的回应</strong><small>{state.lastEvent}</small></div><span className="note-arrow">↗</span></div>
                <div className="phone-inline-stats">
                  <span><b>{state.interactions}</b><small>相处次数</small></span><span><b>{state.badges.length}</b><small>留下的章</small></span><span><b>{Math.max(18, state.expression)}%</b><small>今天的光</small></span>
                </div>
                <div className="phone-section-line"><span>今天可以</span><span>不用急</span></div>
                <div className="care-list">
                  <div><span className="list-icon">01</span><span><b>接近</b><small>手放在它旁边</small></span><em>完成</em></div>
                  <div><span className="list-icon">02</span><span><b>留白</b><small>等它自己决定</small></span><em className="pending">现在</em></div>
                  <div><span className="list-icon">03</span><span><b>记录</b><small>把回应收进证据册</small></span><em>→</em></div>
                </div>
                <div className="box-art-strip"><img src="/assets/unknown-box-home.png" alt="未知盒的手绘插画" /></div>
                <div className="sticker-asset-rail" aria-label="今天留下的贴纸"><figure><img src="/assets/presence-stickers.png" alt="手绘的存在感贴纸" /><figcaption>有一点在场</figcaption></figure><figure><img src="/assets/unknown-box-response.png" alt="手绘的回应贴纸" /><figcaption>它回来了</figcaption></figure></div>
                <div className="phone-response-meter"><div><span>今天的光</span><b>{Math.max(18, state.expression)}%</b></div><i><em style={{ width: `${Math.max(18, state.expression)}%` }}></em></i></div>
              </section>}

              {tab === 'evidence' && <section className="phone-evidence"><div className="sticker-wall"><div className="sticker sticker-orange">还没<br />命名</div><div className="sticker sticker-yellow">它等了<br />一会儿</div><div className="sticker sticker-blue">一段<br />声音</div><div className="sticker sticker-pink">第三次<br />来访</div></div><div className="sticker-asset-rail evidence-asset-rail" aria-label="贴纸素材"><figure><img src="/assets/evidence-scraps.png" alt="证据碎片贴纸" /><figcaption>碎片也算</figcaption></figure><figure><img src="/assets/personality-stickers.png" alt="性格线索贴纸" /><figcaption>还在猜</figcaption></figure></div><div className="phone-section-line"><span>小小的收藏</span><span>{state.badges.length} 张</span></div><div className="phone-badge-list">{badges.map(([id, title, copy]) => <Badge key={id} id={id} title={id === 'origin' ? '还没命名' : id === 'waited' ? '它等了一会儿' : id === 'three-visits' ? '第三次来访' : '一段声音'} copy={copy} unlocked={state.badges.includes(id)} />)}</div><div className="phone-evidence-log"><span className="eyebrow">最近留下</span>{state.evidence.slice(0, 4).map(item => <button className="log-row log-row-button" key={item.id} type="button" onClick={() => setSelectedEvidence(item)}><span className={`log-dot ${item.kind}`}></span><span><strong>{item.title}</strong><small>{item.note}</small></span><time>{item.time}</time></button>)}</div></section>}

              {tab === 'island' && <section className="phone-island"><div className="island-art-card"><img src="/assets/box-island.png" alt="贴纸式盒群岛插画" /></div><div className="island-icon-grid"><button aria-label="听见声音"><span><Icon name="sound" /></span><small>听见</small></button><button aria-label="看看来访"><span><Icon name="visit" /></span><small>来访</small></button><button aria-label="看看关系"><span><Icon name="relation" /></span><small>关系</small></button></div><div className="phone-section-line"><span>邻居的回应</span><span>慢一点也没关系</span></div><div className="postcard"><span>♪　·　·　·　♪</span><small>047 号盒子 / 晚了 2.4 秒</small></div><button className="primary-button" onClick={sendPostcard}>寄出一段声音</button><div className="social-stat"><span>已寄出 <b>{state.postcards}</b> 张</span><span>偶尔共鸣 <b>{state.social}%</b></span></div></section>}

              {tab === 'profile' && <section className="phone-profile"><div className="profile-sticker">它有点像……</div><h3>一只慢热的小动物</h3><p>不是答案，只是最近留下的几个猜想。</p><div className="profile-doodle"><img src="/assets/presence-stickers.png" alt="手绘的耳朵、眼睛和小动物线索" /></div><div className="axis"><span>靠近</span><i><em style={{ width: `${Math.max(14, state.bond)}%` }}></em></i><span>绕一圈</span></div><div className="axis"><span>回来</span><i className="yellow"><em style={{ width: `${Math.max(14, 100 - state.patience)}%` }}></em></i><span>等一等</span></div><div className="axis"><span>发亮</span><i className="blue"><em style={{ width: `${Math.max(14, state.expression)}%` }}></em></i><span>很细微</span></div><div className="axis"><span>遇见</span><i className="pink"><em style={{ width: `${Math.max(14, state.social)}%` }}></em></i><span>偶尔</span></div><D3TraitPath values={[state.bond, 100 - state.patience, state.expression, state.social]} /><div className="profile-chip-row"><span>像猫一样绕开</span><span>像兔子一样突然</span><span>小鼠似的细听</span></div><p className="profile-footnote">下一次回应，可能会让它变成另一种样子。</p></section>}
            </div>
            <nav className="bottom-nav"><button className={tab === 'box' ? 'active' : ''} onClick={() => setTab('box')}><span><Icon name="box" /></span><small>我的盒子</small></button><button className={tab === 'island' ? 'active' : ''} onClick={() => setTab('island')}><span><Icon name="island" /></span><small>盒群岛</small></button><button className={tab === 'evidence' ? 'active' : ''} onClick={() => setTab('evidence')}><span><Icon name="evidence" /></span><small>证据册</small></button><button className={tab === 'profile' ? 'active' : ''} onClick={() => setTab('profile')}><span><Icon name="profile" /></span><small>性格档案</small></button></nav>
            {drawerOpen && <div className="phone-overlay" role="presentation" onClick={() => setDrawerOpen(false)}><aside className="phone-drawer" role="dialog" aria-modal="true" aria-label="贴纸抽屉" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setDrawerOpen(false)} aria-label="关闭贴纸抽屉">×</button><span className="eyebrow accent">STICKER DRAWER</span><h3>今天留下的</h3><p>一些还不能解释的东西，先放在这里。</p><div className="drawer-sticker-stack"><img src="/assets/presence-stickers.png" alt="存在感贴纸" /><img src="/assets/evidence-scraps.png" alt="证据碎片贴纸" /><img src="/assets/personality-stickers.png" alt="性格贴纸" /></div><button className="drawer-action" type="button" onClick={() => { setDrawerOpen(false); setTab('evidence'); }}>收进证据册 <span>↗</span></button></aside></div>}
            {selectedEvidence && <div className="phone-overlay sheet-overlay" role="presentation" onClick={() => setSelectedEvidence(null)}><section className="phone-sheet" role="dialog" aria-modal="true" aria-label="证据详情" onClick={event => event.stopPropagation()}><button className="overlay-close" type="button" onClick={() => setSelectedEvidence(null)} aria-label="关闭证据详情">×</button><span className={`log-dot ${selectedEvidence.kind}`}></span><span className="eyebrow accent">EVIDENCE / {selectedEvidence.time}</span><h3>{selectedEvidence.title}</h3><p>{selectedEvidence.note}</p><div className="sheet-mark">{selectedEvidence.kind === 'relationship' ? '♪' : selectedEvidence.kind === 'touch' ? '◌' : '· · ·'}</div><small>这不是结论，只是它曾经靠近过的地方。</small></section></div>}
          </div>
        </div>
      </section>
    </main>

    <CoverWall />

  </div>;
}

createRoot(document.getElementById('root')).render(<App />);

