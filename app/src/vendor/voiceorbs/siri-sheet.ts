// VoiceOrbs Siri Sheet by Alexis Munoz (MIT), from CyberBuddy voiceorbs-floating.
// Shader and palette preserved; the renderer lives in src/ui/voice-orb.ts.
// Source: amunozdev/voiceorbs, commit 8b2799917734f52c9293a489e08982ca5b0187e9.
export type OrbState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error" | "disabled";
export type Rgb = [number, number, number];

const toLinear = (c: number): number => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};

const toSrgb = (v: number): number => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.min(255, Math.max(0, c * 255));
};

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  toSrgb(toLinear(a[0]) + (toLinear(b[0]) - toLinear(a[0])) * t),
  toSrgb(toLinear(a[1]) + (toLinear(b[1]) - toLinear(a[1])) * t),
  toSrgb(toLinear(a[2]) + (toLinear(b[2]) - toLinear(a[2])) * t),
];


type Vec3 = [number, number, number];

export interface SheetParams extends Record<string, number> {
  speed: number;
  warp: number;
  ridge: number;
  sharp: number;
  zoom: number;
  exposure: number;
  mute: number;
  glow: number;
  rim: number;
  hear: number;
  voice: number;
  fade: number;
}

export const STATE_TABLE: Record<OrbState, SheetParams> = {
  idle: { speed: 0.3, warp: 0.52, ridge: 0.48, sharp: 0.9, zoom: 0.94, exposure: 0.68, mute: 0.4, glow: 0.12, rim: 0.55, hear: 0, voice: 0, fade: 1 },
  connecting: { speed: 0.5, warp: 0.78, ridge: 0.72, sharp: 0.95, zoom: 0.97, exposure: 0.84, mute: 0.16, glow: 0.22, rim: 0.7, hear: 0, voice: 0, fade: 1 },
  listening: { speed: 0.55, warp: 0.66, ridge: 0.7, sharp: 1, zoom: 1, exposure: 1.04, mute: 0, glow: 0.3, rim: 0.85, hear: 1, voice: 0, fade: 1 },
  thinking: { speed: 1, warp: 1, ridge: 1, sharp: 1, zoom: 1, exposure: 1, mute: 0, glow: 0.28, rim: 0.8, hear: 0, voice: 0, fade: 1 },
  speaking: { speed: 0.78, warp: 0.72, ridge: 0.9, sharp: 1, zoom: 1, exposure: 0.96, mute: 0, glow: 0.34, rim: 0.8, hear: 0, voice: 1, fade: 1 },
  error: { speed: 0.5, warp: 0.7, ridge: 0.8, sharp: 1, zoom: 0.98, exposure: 0.94, mute: 0, glow: 0.3, rim: 0.8, hear: 0, voice: 0, fade: 1 },
  disabled: { speed: 0, warp: 0.42, ridge: 0.36, sharp: 0.88, zoom: 0.93, exposure: 0.42, mute: 0.92, glow: 0, rim: 0.35, hear: 0, voice: 0, fade: 0.62 },
};

const toUnit = ([r, g, b]: Rgb): Vec3 => [r / 255, g / 255, b / 255];

const rotateHue = ([r, g, b]: Rgb, degrees: number): Rgb => {
  const a = (degrees * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = 1 / 3;
  const q = Math.sqrt(k);
  const m0 = c + (1 - c) * k;
  const m1 = k * (1 - c) - q * s;
  const m2 = k * (1 - c) + q * s;
  const clampC = (v: number) => Math.min(255, Math.max(0, v));
  return [
    clampC(r * m0 + g * m1 + b * m2),
    clampC(r * m2 + g * m0 + b * m1),
    clampC(r * m1 + g * m2 + b * m0),
  ];
};

const muteRgb = (rgb: Rgb, amount: number): Rgb => {
  const lum = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return mixRgb(rgb, [lum, lum, lum], amount);
};

const WHITE: Rgb = [255, 255, 255];

interface Palette {
  a: Vec3;
  b: Vec3;
  c: Vec3;
  d: Vec3;
  hi: Vec3;
  cool: Vec3;
  warm: Vec3;
  glow: Vec3;
}

export const buildPalette = (from: Rgb, to: Rgb, mute: number): Palette => {
  const a = muteRgb(from, mute);
  const b = muteRgb(to, mute);
  const c = muteRgb(rotateHue(mixRgb(from, to, 0.35), -38), mute);
  const d = muteRgb(rotateHue(mixRgb(from, to, 0.65), 42), mute);
  const mid = mixRgb(a, b, 0.5);
  return {
    a: toUnit(a),
    b: toUnit(b),
    c: toUnit(c),
    d: toUnit(d),
    hi: toUnit(mixRgb(mid, WHITE, 0.82)),
    cool: toUnit(mixRgb(a, WHITE, 0.15)),
    warm: toUnit(mixRgb(d, WHITE, 0.1)),
    glow: toUnit(mid),
  };
};

export const VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAG = `
precision highp float;

uniform float uSize;
uniform float uPhase;
uniform float uLevel;
uniform float uWarp;
uniform float uRidge;
uniform float uSharp;
uniform float uZoom;
uniform float uExposure;
uniform float uGlow;
uniform float uRim;
uniform float uHear;
uniform float uFade;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColC;
uniform vec3 uColD;
uniform vec3 uHi;
uniform vec3 uCool;
uniform vec3 uWarm;
uniform vec3 uGlowCol;

const float RAD = 0.86;
const float SOFT = 0.005;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * noise(p);
    p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.03;
    a *= 0.5;
  }
  return s / 0.9375;
}

vec2 band(vec2 q, float drift, float offset, float amp, float mainY, float env, float soft) {
  float y = amp * env * sin(q.x * 1.0 + drift + offset);
  float d = abs(q.y - y);
  float line = 0.018 / (sqrt(d * d + soft * soft) + 0.026);
  float bd = max(0.0, max(q.y - max(mainY, y), min(mainY, y) - q.y));
  float fillB = 0.014 / (bd * bd * 5.0 + 0.06);
  return vec2(line, fillB);
}

vec3 sheet(vec2 p, float t) {
  float scale = 0.74 + uZoom * 0.34;
  vec2 q = p / scale;
  vec2 w = vec2(fbm(q * 1.1 + vec2(0.0, t * 0.09)), fbm(q * 1.1 + vec2(7.7, -t * 0.07))) - 0.5;
  q += uWarp * 0.075 * w;
  float xn = q.x;
  float envB = cos(1.57079633 * min(abs(0.9 * xn), 1.0));
  float env = envB * envB;
  float low = 0.5 + 0.5 * cos(t * 0.37);
  float mid = 0.5 + 0.5 * sin(t * 0.51 + 1.2);
  float high = 0.5 + 0.5 * cos(t * 0.73 + 2.1);
  float drift = t * 2.4;
  float mainAmp = 0.1 + uRidge * 0.17 + low * 0.018;
  float bandAmp = mainAmp + mid * 0.025 + high * 0.018;
  float mainY = mainAmp * env * sin(q.x * 1.1 + drift);
  float sep = 1.85 + uWarp * 0.12 + mid * 0.28;
  float soft = 0.03 / max(uSharp, 0.2) + mid * 0.006;

  vec2 b0 = band(q, drift, -sep, bandAmp, mainY, env, soft);
  vec2 b1 = band(q, drift, -sep * 0.34, bandAmp, mainY, env, soft);
  vec2 b2 = band(q, drift, sep * 0.34, bandAmp, mainY, env, soft);
  vec2 b3 = band(q, drift, sep, bandAmp, mainY, env, soft);
  // Emphasise the coloured ribbons over the soft fill between them.
  float w0 = b0.x * 1.65 + b0.y * 0.6;
  float w1 = b1.x * 1.65 + b1.y * 0.6;
  float w2 = b2.x * 1.65 + b2.y * 0.6;
  float w3 = b3.x * 1.65 + b3.y * 0.6;
  float total = w0 + w1 + w2 + w3;
  float d0 = w0 * w0;
  float d1 = w1 * w1;
  float d2 = w2 * w2;
  float d3 = w3 * w3;
  vec3 spectral = (uColA * d0 + uColC * d1 + uColB * d2 + uColD * d3) / max(d0 + d1 + d2 + d3, 0.0001);
  float energy = (1.0 - exp(-max(total - 0.12, 0.0) * 0.75)) * env;
  float md = abs(q.y - mainY);
  float core = exp(-md * md / (0.0028 / max(uSharp, 0.2))) * env;

  float haze = fbm(q * 1.6 + vec2(t * 0.05, -t * 0.03));
  vec3 atmos = mix(uColD, uColB, smoothstep(-0.7, 0.7, q.y)) * (0.012 + 0.022 * haze);
  atmos += mix(uColA, uColC, haze) * 0.035 * exp(-q.y * q.y * 7.0) * haze;

  vec3 col = atmos + spectral * energy * 1.14;
  col += uHi * core * (0.09 + 0.05 * low);
  col = col / (1.0 + col * 0.18);
  col = mix(col, uHi, 0.02 * smoothstep(0.15, 1.15, dot(p, vec2(-0.32, 0.78))));
  col *= 1.0 - 0.3 * smoothstep(-0.1, 1.2, dot(p, vec2(0.45, -0.62)));
  return col;
}

float profile(float t) {
  float d = clamp(t, 0.0, 1.0);
  return 1.0 - sqrt(max(1.0 - (1.0 - d) * (1.0 - d), 0.0));
}

float lobe(vec2 n, vec2 dir, float cut, float power) {
  return pow(clamp((dot(n, dir) - cut) / max(1.0 - cut, 0.001), 0.0, 1.0), power);
}

vec3 over(vec3 dst, vec3 src, float a) {
  float k = clamp(a, 0.0, 1.0);
  return src * k + dst * (1.0 - k);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uSize) / uSize;
  float r = length(uv);
  float ang = atan(uv.y, uv.x);
  float t = uPhase;

  float contour = uHear * uLevel * (0.011 * sin(ang * 3.0 + t * 1.9) + 0.006 * sin(ang * 5.0 - t * 1.3 + 1.7));
  float rad = RAD * (1.0 + contour);
  vec3 glowCol = uGlowCol * (0.6 + 0.4 * uHear * uLevel);
  float glowAmt = uGlow * (1.0 + 0.9 * uHear * uLevel);

  if (r > rad * (1.01 + SOFT)) {
    vec3 halo = glowCol * glowAmt * exp(-(r - rad) * 11.0) * (1.0 - smoothstep(rad, 0.995, r));
    halo = clamp(halo, 0.0, 1.0);
    gl_FragColor = vec4(halo, max(halo.r, max(halo.g, halo.b))) * uFade;
    return;
  }

  vec2 p = uv / rad;
  float pd = length(p);
  vec2 n = pd > 0.0001 ? p / pd : vec2(0.0);
  float edge = max(1.0 - pd, 0.0);
  float prof = pow(profile(edge / 0.3), 0.68);
  vec2 rp = p - n * prof * 0.5;

  vec3 fcol;
  if (prof > 0.002) {
    float split = 0.12 * prof;
    fcol = vec3(sheet(rp - n * split, t).r, sheet(rp, t).g, sheet(rp + n * split, t).b);
  } else {
    fcol = sheet(p, t);
  }

  float lum = dot(fcol, vec3(0.213, 0.715, 0.072));
  vec3 col = clamp(vec3(lum) + (fcol - vec3(lum)) * 1.45, 0.0, 1.0);

  float rimReact = uRim * (1.0 + 0.45 * uHear * uLevel);
  float surfW = 0.035 + 0.03 * uHear * uLevel;
  float surf = 1.0 - smoothstep(0.0, surfW, edge);
  float optical = pow(surf, 1.8);
  col = over(col, mix(uColA, uHi, 0.5) * 0.35, optical * 0.1 * rimReact);

  float coolS = lobe(n, normalize(vec2(0.84, 0.54)), 0.05, 1.6);
  float warmS = lobe(n, normalize(vec2(-0.62, -0.78)), 0.05, 1.8);
  float disp = optical * 0.5 * rimReact;
  col = over(col, uCool, disp * coolS);
  col = over(col, uWarm, disp * warmS);

  col *= 1.0 - optical * 0.12 * (0.15 + 0.85 * max(dot(n, vec2(0.45, -0.89)), 0.0));

  float key = optical * lobe(n, normalize(vec2(-0.68, 0.73)), 0.2, 2.8) * 0.6 * rimReact;
  float fillL = optical * lobe(n, normalize(vec2(0.74, -0.67)), 0.4, 3.6) * 0.4 * rimReact;
  col = over(col, mix(uHi, vec3(1.0), 0.35), key);
  col = over(col, mix(uColC, uHi, 0.55), fillL);

  col *= 1.0 - 0.4 * smoothstep(0.95, 1.0, pd);
  col += mix(uColA, uColB, 0.3 + 0.3 * sin(ang + t * 0.6)) * optical * 0.3 * uHear * uLevel;

  float spec = exp(-dot(p - vec2(-0.38, 0.46), p - vec2(-0.38, 0.46)) * 22.0);
  col += uHi * spec * 0.07 * uRim;

  float ballA = 1.0 - smoothstep(0.99 - SOFT, 1.01 + SOFT, pd);
  // Increase light coverage without clipping each colour channel to white.
  vec3 exposed = max(col * max(uExposure, 0.0), vec3(0.0));
  float peak = max(exposed.r, max(exposed.g, exposed.b));
  float lightCoverage = 1.0 - exp(-peak * 1.8);
  col = exposed / max(peak, 0.0001) * lightCoverage * ballA;
  float outside = smoothstep(rad - SOFT, rad + SOFT, r);
  col += glowCol * glowAmt * exp(-max(r - rad, 0.0) * 11.0) * (1.0 - smoothstep(rad, 0.995, r)) * outside;
  col = clamp(col, 0.0, 1.0);
  // Only emitted light paints. The sphere has no background fill.
  // RGB remains premultiplied for correct transparent desktop compositing.
  float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
  gl_FragColor = vec4(col, a) * uFade;
}
`;

export const UNIFORMS = [
  'uSize',
  'uPhase',
  'uLevel',
  'uWarp',
  'uRidge',
  'uSharp',
  'uZoom',
  'uExposure',
  'uGlow',
  'uRim',
  'uHear',
  'uFade',
  'uColA',
  'uColB',
  'uColC',
  'uColD',
  'uHi',
  'uCool',
  'uWarm',
  'uGlowCol',
] as const;

type UniformName = (typeof UNIFORMS)[number];

