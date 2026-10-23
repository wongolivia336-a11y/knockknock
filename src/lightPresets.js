export const DEFAULT_LIGHT_PRESET_ID = 'soft-signal';

export const LIGHT_PRESETS = [
  {
    id: 'soft-signal',
    title: ['SOFT SIGNAL', 'WARM ARRIVAL'], subtitle: '暖光靠近',
    colors: { top: '#b6afd9', bottom: '#bf773f', blobs: ['#d784aa', '#f0b45f', '#8e84bf', '#8dbbc2'], core: '#e5b8bc' },
    motion: { speed: 0.72, drift: 0.16, turbulence: 0.24, breathing: 0.34, followStrength: 0.86, responseDelay: 0.34, cycle: 24 },
    optical: { intensity: 0.72, radius: 1.12, softness: 0.78, grain: 0.018, edgeDiffusion: 0.46 },
    pattern: 'rays',
    blobMotions: [
      { u: 0.22, v: 0.56, depth: 0.47, phase: 0.4, driftX: 0.18, driftY: 0.1, scale: 1.16, speed: 0.8 },
      { u: 0.48, v: 0.62, depth: 0.2, phase: 2.1, driftX: 0.14, driftY: 0.12, scale: 0.9, speed: 0.62 },
      { u: 0.7, v: 0.35, depth: 0.28, phase: 4.2, driftX: 0.12, driftY: 0.18, scale: 0.82, speed: 0.54 },
      { u: 0.86, v: 0.46, depth: 0.08, phase: 5.1, driftX: 0.13, driftY: 0.09, scale: 0.72, speed: 0.9 },
    ],
  },
  {
    id: 'indie-builders',
    title: ['STILL & WARM', 'SLOW GLOW'], subtitle: '缓慢沉落',
    colors: { top: '#98a8b1', bottom: '#342622', blobs: ['#d1b37b', '#bc6344', '#6c8495', '#3a2a2a'], core: '#d8b48c' },
    motion: { speed: 0.52, drift: 0.11, turbulence: 0.13, breathing: 0.2, followStrength: 0.62, responseDelay: 0.48, cycle: 28 },
    optical: { intensity: 0.62, radius: 1.02, softness: 0.86, grain: 0.016, edgeDiffusion: 0.38 },
    pattern: 'contours',
    blobMotions: [
      { u: 0.48, v: 0.28, depth: 0.38, phase: 0.9, driftX: 0.08, driftY: 0.17, scale: 1.04, speed: 0.55 },
      { u: 0.3, v: 0.68, depth: 0.2, phase: 2.7, driftX: 0.11, driftY: 0.08, scale: 0.86, speed: 0.42 },
      { u: 0.7, v: 0.54, depth: 0.32, phase: 4.5, driftX: 0.09, driftY: 0.11, scale: 0.76, speed: 0.64 },
      { u: 0.54, v: 0.78, depth: 0.02, phase: 5.8, driftX: 0.07, driftY: 0.06, scale: 0.66, speed: 0.36 },
    ],
  },
  {
    id: 'quiet-current',
    title: ['QUIET CURRENT', 'DEEP BLUE'], subtitle: '安静流动',
    colors: { top: '#a8c0cb', bottom: '#123849', blobs: ['#d9d5c2', '#3f7990', '#1c506d', '#7eaeb5'], core: '#b9d4d5' },
    motion: { speed: 0.82, drift: 0.2, turbulence: 0.36, breathing: 0.22, followStrength: 0.7, responseDelay: 0.56, cycle: 22 },
    optical: { intensity: 0.66, radius: 1.26, softness: 0.9, grain: 0.014, edgeDiffusion: 0.52 },
    pattern: 'waves',
    blobMotions: [
      { u: 0.28, v: 0.54, depth: 0.42, phase: 1.3, driftX: 0.23, driftY: 0.08, scale: 1.18, speed: 0.82 },
      { u: 0.55, v: 0.66, depth: 0.14, phase: 3.4, driftX: 0.2, driftY: 0.1, scale: 0.96, speed: 0.74 },
      { u: 0.72, v: 0.35, depth: 0.3, phase: 5.2, driftX: 0.16, driftY: 0.16, scale: 0.84, speed: 0.64 },
      { u: 0.42, v: 0.28, depth: 0.04, phase: 6.1, driftX: 0.18, driftY: 0.09, scale: 0.72, speed: 0.98 },
    ],
  },
  {
    id: 'green-room',
    title: ['GREEN ROOM', 'SLOW RETURN'], subtitle: '慢慢回来',
    colors: { top: '#b7c6c8', bottom: '#183d35', blobs: ['#a9cfd1', '#7da697', '#365c55', '#b0bd96'], core: '#b7cfb5' },
    motion: { speed: 0.64, drift: 0.13, turbulence: 0.18, breathing: 0.46, followStrength: 0.68, responseDelay: 0.42, cycle: 26 },
    optical: { intensity: 0.64, radius: 1.2, softness: 0.86, grain: 0.015, edgeDiffusion: 0.5 },
    pattern: 'dots',
    blobMotions: [
      { u: 0.5, v: 0.53, depth: 0.43, phase: 0.2, driftX: 0.12, driftY: 0.12, scale: 1.1, speed: 0.68 },
      { u: 0.33, v: 0.33, depth: 0.12, phase: 2.6, driftX: 0.1, driftY: 0.1, scale: 0.9, speed: 0.52 },
      { u: 0.68, v: 0.7, depth: 0.28, phase: 4.1, driftX: 0.09, driftY: 0.14, scale: 0.84, speed: 0.48 },
      { u: 0.73, v: 0.34, depth: 0.02, phase: 5.6, driftX: 0.08, driftY: 0.1, scale: 0.66, speed: 0.76 },
    ],
  },
  {
    id: 'late-night',
    title: ['LATE NIGHT', 'SOFT SIGNAL'], subtitle: '夜里的讯号',
    colors: { top: '#b9b0d8', bottom: '#1f1236', blobs: ['#d59ac5', '#8f6ab6', '#312050', '#e4b1c2'], core: '#c7add8' },
    motion: { speed: 0.46, drift: 0.19, turbulence: 0.2, breathing: 0.26, followStrength: 0.52, responseDelay: 0.66, cycle: 28 },
    optical: { intensity: 0.6, radius: 1.04, softness: 0.92, grain: 0.017, edgeDiffusion: 0.42 },
    pattern: 'lens',
    blobMotions: [
      { u: 0.36, v: 0.4, depth: 0.38, phase: 1.6, driftX: 0.16, driftY: 0.2, scale: 0.94, speed: 0.45 },
      { u: 0.73, v: 0.26, depth: 0.16, phase: 3.1, driftX: 0.12, driftY: 0.13, scale: 0.76, speed: 0.34 },
      { u: 0.64, v: 0.7, depth: 0.25, phase: 4.6, driftX: 0.14, driftY: 0.17, scale: 0.82, speed: 0.42 },
      { u: 0.28, v: 0.7, depth: 0.02, phase: 5.8, driftX: 0.11, driftY: 0.11, scale: 0.68, speed: 0.6 },
    ],
  },
  {
    id: 'public-fire',
    title: ['RUST & GLOW', 'NEAR AGAIN'], subtitle: '再次靠近',
    colors: { top: '#b6c0c2', bottom: '#9a4337', blobs: ['#d9d7ca', '#df8d65', '#ad4e45', '#e2b38a'], core: '#e0ae8f' },
    motion: { speed: 0.98, drift: 0.23, turbulence: 0.3, breathing: 0.3, followStrength: 0.94, responseDelay: 0.24, cycle: 20 },
    optical: { intensity: 0.74, radius: 1.14, softness: 0.76, grain: 0.019, edgeDiffusion: 0.5 },
    pattern: null,
    blobMotions: [
      { u: 0.32, v: 0.56, depth: 0.46, phase: 0.5, driftX: 0.24, driftY: 0.12, scale: 1.1, speed: 1.05 },
      { u: 0.7, v: 0.62, depth: 0.18, phase: 2.3, driftX: 0.2, driftY: 0.16, scale: 0.9, speed: 0.92 },
      { u: 0.45, v: 0.25, depth: 0.3, phase: 4.4, driftX: 0.18, driftY: 0.14, scale: 0.78, speed: 1.1 },
      { u: 0.75, v: 0.32, depth: 0.04, phase: 5.3, driftX: 0.2, driftY: 0.1, scale: 0.72, speed: 0.8 },
    ],
  },
];

export function getLightPreset(id) {
  return LIGHT_PRESETS.find(preset => preset.id === id) || LIGHT_PRESETS[0];
}

