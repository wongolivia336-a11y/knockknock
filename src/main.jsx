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
    const ctx = audi