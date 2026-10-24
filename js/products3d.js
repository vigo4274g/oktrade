// COLLECTION 13品の3D（商品写真風の画像を書き出すため）。単位＝メートル・すべてコードで生成
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const FIN = {
  polish: { color: 0xcfcfcf, metalness: 1, roughness: 0.36, clearcoat: 0, anisotropy: 0.45 },
  black: { color: 0x161616, metalness: 0.35, roughness: 0.52, clearcoat: 0.25, anisotropy: 0 },
  gold: { color: 0xc49a5c, metalness: 1, roughness: 0.4, clearcoat: 0, anisotropy: 0.35 },
};
const metal = (fin) => new THREE.MeshPhysicalMaterial({ ...FIN[fin], envMapIntensity: 0.9, side: THREE.DoubleSide });
const rose = () => new THREE.MeshPhysicalMaterial({ color: 0xc8916c, metalness: 1, roughness: 0.42 });
const chrome = () => new THREE.MeshPhysicalMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.3 });
const glass = () => new THREE.MeshPhysicalMaterial({ color: 0xe6f4f0, roughness: 0.05, transmission: 1, thickness: 0.03, ior: 1.5, envMapIntensity: 1 });
const glassEdge = () => new THREE.MeshPhysicalMaterial({ color: 0x5f9d8c, roughness: 0.15, transparent: true, opacity: 0.85 });
const leather = () => new THREE.MeshPhysicalMaterial({ color: 0x1b1715, roughness: 0.62, sheen: 0.3, sheenColor: new THREE.Color(0x5a4a40) });

// カーボンの織り目（キャンバス生成）
function carbonTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = (x + y) % 2 ? 34 : 20;
    const gr = g.createLinearGradient(x * 16, y * 16, x * 16 + 16, y * 16 + 16);
    gr.addColorStop(0, `rgb(${v},${v},${v + 2})`);
    gr.addColorStop(1, `rgb(${v + 14},${v + 14},${v + 16})`);
    g.fillStyle = gr;
    g.fillRect(x * 16, y * 16, 16, 16);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ホイール（ローカル軸＝Y・外側の面＝+Y）。spokes：本数／twin：2本1組／thin：細いメッシュ
const PROF = [[0.255, -0.13], [0.3, -0.13], [0.306, -0.118], [0.287, -0.104], [0.279, 0.09], [0.291, 0.104], [0.306, 0.118], [0.3, 0.13], [0.256, 0.13], [0.262, 0.1], [0.262, -0.1], [0.255, -0.13]].map(([r, y]) => new THREE.Vector2(r, y));
export function wheel({ fin = 'polish', spokes = 10, twin = true, thin = false, barrelMat = null } = {}) {
  const g = new THREE.Group();
  const m = metal(fin);
  g.add(new THREE.Mesh(new THREE.LatheGeometry(PROF, 96), barrelMat || m));
  const w0 = thin ? 0.009 : 0.026, w1 = thin ? 0.006 : 0.013;
  const sh = new THREE.Shape();
  sh.moveTo(0.055, -w0); sh.lineTo(0.266, -w1); sh.lineTo(0.266, w1); sh.lineTo(0.055, w0); sh.closePath();
  const sg = new THREE.ExtrudeGeometry(sh, { depth: thin ? 0.02 : 0.034, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 2 });
  sg.rotateX(-Math.PI / 2); sg.translate(0, 0.058, 0);
  const n = twin ? spokes / 2 : spokes;
  for (let i = 0; i < n; i++) for (const o of twin ? [-0.09, 0.09] : [0]) {
    const s = new THREE.Mesh(sg, m); s.rotation.y = (i / n) * Math.PI * 2 + o; g.add(s);
  }
  if (spokes > 0) {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.08, 0.06, 40), m); hub.position.y = 0.07; g.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 40), rose()); cap.position.y = 0.104; g.add(cap);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function glassTop(r, y) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.016, 96), glass());
  top.position.y = y;
  const edge = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 96), glassEdge());
  edge.rotation.x = Math.PI / 2; edge.position.y = y;
  g.add(top, edge);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 12), chrome());
    p.position.set(Math.cos(a) * 0.28, y - 0.03, Math.sin(a) * 0.28);
    g.add(p);
  }
  return g;
}

// 寝かせたホイール（床に置く）
function flatWheel(opts, scale = 1) {
  const w = wheel(opts);
  w.scale.setScalar(scale);
  w.position.y = 0.13 * scale;
  return w;
}

// 13品。cam＝[カメラ位置], look＝注視点
export const BUILDERS = {
  '01': () => ({ obj: group(flatWheel({ fin: 'polish' }, 1.3), scaled(glassTop(0.37, 0.305), 1.3)), cam: [1.0, 0.95, 1.25], look: [0, 0.18, 0] }),
  '02': () => ({ obj: group(flatWheel({ fin: 'black' }, 1.3), scaled(glassTop(0.37, 0.305), 1.3)), cam: [1.0, 0.95, 1.25], look: [0, 0.18, 0] }),
  '03': () => ({ obj: group(flatWheel({ fin: 'gold' }, 1.3), scaled(glassTop(0.37, 0.305), 1.3)), cam: [1.0, 0.95, 1.25], look: [0, 0.18, 0] }),
  '04': () => {
    const carbon = new THREE.MeshPhysicalMaterial({ map: carbonTex(), metalness: 0.2, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15, side: THREE.DoubleSide });
    return { obj: group(flatWheel({ fin: 'black', spokes: 5, twin: false, barrelMat: carbon }, 1.3), scaled(glassTop(0.37, 0.305), 1.3)), cam: [1.0, 0.95, 1.25], look: [0, 0.18, 0] };
  },
  '05': () => ({ obj: group(flatWheel({ fin: 'polish', spokes: 20, twin: false, thin: true }, 1.3), scaled(glassTop(0.37, 0.305), 1.3)), cam: [1.0, 0.95, 1.25], look: [0, 0.18, 0] }),
  '06': () => {
    const w = flatWheel({ fin: 'black', spokes: 6, twin: true }, 0.9);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 24), metal('black'));
    col.position.y = 0.38;
    const top = glassTop(0.27, 0.54);
    top.children.slice(2).forEach((p) => p.removeFromParent());
    return { obj: group(w, col, top), cam: [0.85, 0.85, 1.05], look: [0, 0.3, 0] };
  },
  '07': () => {
    const base = flatWheel({ fin: 'black', spokes: 10, twin: true }, 1.0);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.82, 32), metal('black'));
    col.position.y = 0.67;
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 32), rose());
    plate.position.y = 1.07;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.018, 96), glass());
    top.position.y = 1.09;
    const edge = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.008, 8, 96), glassEdge());
    edge.rotation.x = Math.PI / 2; edge.position.y = 1.09;
    return { obj: group(base, col, plate, top, edge), cam: [1.35, 1.2, 1.7], look: [0, 0.55, 0] };
  },
  '08': () => {
    const w = flatWheel({ fin: 'black', spokes: 0 }, 0.9);
    const cushion = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.1, 0.5, 6, 0.05), leather());
    cushion.scale.set(1, 1, 1);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 64), leather());
    cyl.position.y = 0.29;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 8, 64), metal('polish'));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.24;
    // ボタン留め
    const btns = new THREE.Group();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (i * i + j * j > 1.5) continue;
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), leather());
      b.position.set(i * 0.1, 0.34, j * 0.1); btns.add(b);
    }
    return { obj: group(w, cyl, ring, btns), cam: [0.85, 0.75, 1.0], look: [0, 0.18, 0] };
  },
  '09': () => {
    const w = wheel({ fin: 'black', spokes: 10, twin: true });
    w.rotation.x = Math.PI / 2;
    const face = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const mk = new THREE.Mesh(new THREE.BoxGeometry(i % 3 ? 0.008 : 0.014, 0.03, 0.006), rose());
      mk.position.set(Math.sin(a) * 0.235, Math.cos(a) * 0.235, 0.135); mk.rotation.z = -a; face.add(mk);
    }
    const hand = (len, w, m, ang, z) => { const g = new THREE.BoxGeometry(w, len, 0.006); g.translate(0, len / 2 - 0.02, 0); const h = new THREE.Mesh(g, m); h.rotation.z = ang; h.position.z = z; return h; };
    const hm = new THREE.MeshStandardMaterial({ color: 0xf0e6dc, metalness: 0.6, roughness: 0.3 });
    face.add(hand(0.13, 0.014, hm, -2.1, 0.14), hand(0.2, 0.009, hm, -0.35, 0.146), hand(0.21, 0.004, rose(), 2.4, 0.152));
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshStandardMaterial({ color: 0x121110, roughness: 0.9 }));
    wall.position.z = -0.14; wall.receiveShadow = true;
    const o = group(w, face, wall);
    o.position.y = 0.45;
    return { obj: o, cam: [0.32, 0.55, 1.15], look: [0, 0.45, 0], noFloor: true };
  },
  '10': () => {
    const w = wheel({ fin: 'polish', spokes: 10, twin: true });
    w.rotation.x = Math.PI; // 模様（スポーク）を下に向け、見上げた時に見えるように
    w.position.y = 1.0;
    const bulbM = new THREE.MeshStandardMaterial({ color: 0xffd9a8, emissive: 0xffb15e, emissiveIntensity: 3 });
    const g = group(w);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.28, 4), metal('black'));
      wire.position.set(Math.cos(a) * 0.12, 0.83, Math.sin(a) * 0.12);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), bulbM);
      b.position.set(Math.cos(a) * 0.12, 0.66, Math.sin(a) * 0.12);
      g.add(wire, b);
    }
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 1.2, 6), metal('black'));
    cord.position.y = 1.7;
    g.add(cord);
    const light = new THREE.PointLight(0xffb37a, 2.5, 3, 1.6);
    light.position.set(0, 0.66, 0);
    g.add(light);
    return { obj: g, cam: [0.75, 0.3, 1.25], look: [0, 0.86, 0], dim: true };
  },
  '11': () => {
    const g = new THREE.Group();
    for (const x of [-0.42, 0.42]) {
      const w = wheel({ fin: 'black', spokes: 10, twin: true });
      w.rotation.z = Math.PI / 2 * Math.sign(x); w.position.set(x, 0.32, 0);
      const w2 = w.clone(); w2.position.y = 0.95;
      g.add(w, w2);
    }
    for (const y of [0.18, 0.62, 1.06, 1.26]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.014, 0.42), glass());
      sh.position.y = y; g.add(sh);
    }
    // 飾られたミニカー（汎用の箱形）
    for (const [x, y, c] of [[-0.15, 0.66, 0x8a1d1d], [0.14, 0.66, 0x1d1d1d], [0, 1.1, 0xd0d0d0]]) {
      const car = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.06, 0.09, 3, 0.025), new THREE.MeshPhysicalMaterial({ color: c, metalness: 0.5, roughness: 0.3, clearcoat: 1 }));
      car.position.set(x, y + 0.035, 0); g.add(car);
    }
    return { obj: g, cam: [1.75, 1.25, 2.55], look: [0, 0.62, 0] };
  },
  '12': () => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.42, 0.45, 4, 0.03), new THREE.MeshPhysicalMaterial({ color: 0x141414, metalness: 0.3, roughness: 0.45, clearcoat: 0.6 }));
    box.position.y = 0.27; g.add(box);
    for (const x of [-0.5, 0.5]) {
      const w = wheel({ fin: 'polish', spokes: 6, twin: true });
      w.scale.setScalar(0.62); w.rotation.x = Math.PI / 2; w.position.set(x, 0.27, 0.205);
      g.add(w);
    }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.06, 0.01), rose());
    plate.position.set(0, 0.27, 0.231); g.add(plate);
    for (const x of [-0.7, 0.7]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 12), chrome()); l.position.set(x, 0.03, 0); g.add(l); }
    return { obj: g, cam: [1.35, 0.9, 2.3], look: [0, 0.26, 0] };
  },
  '13': () => {
    const w = flatWheel({ fin: 'polish', spokes: 0 }, 0.85);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.02, 48), new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 1 }));
    soil.position.y = 0.2;
    const leafM = new THREE.MeshStandardMaterial({ color: 0x2f4a2b, roughness: 0.65, side: THREE.DoubleSide });
    const plant = new THREE.Group();
    for (let i = 0; i < 16; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), leafM);
      const a = (i / 16) * Math.PI * 2;
      const h = 0.35 + (i % 4) * 0.08;
      l.scale.set(0.45, h / 0.12, 0.9);
      l.position.set(Math.cos(a) * 0.07, 0.2 + h * 0.5, Math.sin(a) * 0.07);
      l.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
      plant.add(l);
    }
    return { obj: group(w, soil, plant), cam: [0.95, 0.9, 1.25], look: [0, 0.32, 0] };
  },
};

function group(...xs) { const g = new THREE.Group(); xs.forEach((x) => g.add(x)); g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }
function scaled(o, s) { o.scale.setScalar(s); return o; }
