// O&K TRADE — TOP 3D story
// 車 → 分解 → ホイールをピックアップ → 家具に変化 → 空間デザイン
// 3Dはすべてコードで生成（モデル・画像ファイル不使用／実在メーカーの形やロゴは出さない）
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDERS as PRODUCTS } from './products3d.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => x * x * (3 - 2 * x);
const seg = (p, a, b) => ease(clamp((p - a) / (b - a)));
const lerp = (a, b, t) => a + (b - a) * t;

const isMobile = matchMedia('(max-width: 768px)').matches && !location.search.includes('hq'); // ?hq＝コマ書き出し用に高画質固定

export function createStory(canvas) {
  // ---------- renderer / scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.25 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = isMobile ? 1.18 : 1.0;
  renderer.shadowMap.enabled = !isMobile;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); document.body.classList.add('no-webgl'); console.warn('WebGLの描画が失われたので3Dを外しました'); });
  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x070707);
  scene.background = BG;
  scene.fog = new THREE.Fog(0x070707, 10, 24);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  // 本物のスタジオの光（Poly Haven studio_small_09・CC0）
  new RGBELoader().load(new URL('../assets/hdr/studio_small_09_1k.hdr', import.meta.url).href, (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
  });
  const HQ = !isMobile; // 仕上げ処理と屈折ガラスはPCだけ（スマホは重さを優先）

  const camera = new THREE.PerspectiveCamera(34, 1, 0.05, 60);

  // ---------- materials ----------
  const FINISHES = {
    polish: { color: 0xcfcfcf, metalness: 1, roughness: 0.36, clearcoat: 0, anisotropy: 0.45 },
    black: { color: 0x161616, metalness: 0.35, roughness: 0.52, clearcoat: 0.25, anisotropy: 0 },
    gold: { color: 0xc49a5c, metalness: 1, roughness: 0.4, clearcoat: 0, anisotropy: 0.35 },
  };
  const rimMat = new THREE.MeshPhysicalMaterial({ ...FINISHES.polish, clearcoatRoughness: 0.3, envMapIntensity: 0.85, side: THREE.DoubleSide });
  const roseMat = new THREE.MeshPhysicalMaterial({ color: 0xc8916c, metalness: 1, roughness: 0.42, envMapIntensity: 0.85 });
  const darkMetal = new THREE.MeshPhysicalMaterial({ color: 0x1a1a1a, metalness: 0.5, roughness: 0.5, clearcoat: 0.15, envMapIntensity: 0.7, side: THREE.DoubleSide });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.82, metalness: 0 });
  const paintMat = new THREE.MeshPhysicalMaterial({ color: 0x26282c, metalness: 0.45, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.28, envMapIntensity: 0.75, transparent: true });
  const glassCabin = new THREE.MeshPhysicalMaterial({ color: 0x07090b, metalness: 0.2, roughness: 0.12, clearcoat: 0.5, envMapIntensity: 0.9, transparent: true, opacity: 0.94 });
  const chassisMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.9, transparent: true });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3e2, emissiveIntensity: 3, transparent: true });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x300000, emissive: 0xff1a12, emissiveIntensity: 2.2, transparent: true });
  const discMat = new THREE.MeshStandardMaterial({ color: 0x6d6d6d, metalness: 0.9, roughness: 0.45, transparent: true });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0xb3121a, metalness: 0.3, roughness: 0.4, transparent: true });

  const fade = (m) => { const c = m.clone(); c.transparent = true; return c; };

  // ---------- wheel builder (local axis = Y, outer face = +Y) ----------
  const rimProfile = [
    [0.255, -0.13], [0.3, -0.13], [0.306, -0.118], [0.287, -0.104], [0.279, 0.09],
    [0.291, 0.104], [0.306, 0.118], [0.3, 0.13], [0.256, 0.13], [0.262, 0.1], [0.262, -0.1], [0.255, -0.13],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const rimGeo = new THREE.LatheGeometry(rimProfile, 72);

  const spokeShape = new THREE.Shape();
  spokeShape.moveTo(0.055, -0.026);
  spokeShape.lineTo(0.266, -0.013);
  spokeShape.lineTo(0.266, 0.013);
  spokeShape.lineTo(0.055, 0.026);
  spokeShape.closePath();
  const spokeGeo = new THREE.ExtrudeGeometry(spokeShape, { depth: 0.034, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
  spokeGeo.rotateX(-Math.PI / 2);
  spokeGeo.translate(0, 0.058, 0);

  const hubGeo = new THREE.CylinderGeometry(0.072, 0.08, 0.06, 40);
  const capGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.012, 40);
  const nutGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.02, 10);
  const tireGeo = new THREE.TorusGeometry(0.335, 0.076, 22, 72);
  tireGeo.rotateX(Math.PI / 2);
  tireGeo.scale(1, 1.6, 1);

  function buildWheel({ mat = rimMat, cap = roseMat, spokes = 10, twin = true, tire = false, tMat = tireMat } = {}) {
    const orient = new THREE.Group();
    const spin = new THREE.Group();
    orient.add(spin);
    const rim = new THREE.Mesh(rimGeo, mat);
    rim.castShadow = true;
    spin.add(rim);
    const n = twin ? spokes / 2 : spokes;
    for (let i = 0; i < n; i++) {
      const base = (i / n) * Math.PI * 2;
      const offs = twin ? [-0.09, 0.09] : [0];
      for (const o of offs) {
        const s = new THREE.Mesh(spokeGeo, mat);
        s.rotation.y = base + o;
        s.castShadow = true;
        spin.add(s);
      }
    }
    const hub = new THREE.Mesh(hubGeo, mat);
    hub.position.y = 0.07;
    spin.add(hub);
    const c = new THREE.Mesh(capGeo, cap);
    c.position.y = 0.104;
    spin.add(c);
    for (let i = 0; i < 5; i++) {
      const nut = new THREE.Mesh(nutGeo, darkMetal);
      const a = (i / 5) * Math.PI * 2;
      nut.position.set(Math.cos(a) * 0.056, 0.104, Math.sin(a) * 0.056);
      spin.add(nut);
    }
    let tireMesh = null;
    if (tire) {
      tireMesh = new THREE.Mesh(tireGeo, tMat);
      tireMesh.castShadow = true;
      orient.add(tireMesh);
    }
    return { orient, spin, tire: tireMesh };
  }

  // ---------- floor / garage atmosphere ----------
  // 床は鏡にしない（くっきり映る床はCGに見える）＝つや消しのコンクリートの床
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.88, metalness: 0.0, envMapIntensity: 0.15 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const poolTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,200,160,0.35)');
    gr.addColorStop(0.45, 'rgba(210,150,110,0.18)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.3 }));
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.004;
  scene.add(pool);

  // ロゴの「縦の軸線」を、ガレージ奥の光の柱として置く
  const barMat = new THREE.MeshBasicMaterial({ color: 0xe9b48c, transparent: true });
  const bars = new THREE.Group();
  for (const x of [-4.4, 4.4]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 3.6, 0.035), barMat);
    b.position.set(x, 1.8, -4.2);
    bars.add(b);
  }
  // scene.add(bars); // 車に刺さって見えるため外す（ロゴの軸線はHTML側で使う）

  // 接地の影：車とテーブルの足元に、ぼかした影を敷く（宙に浮いて見えないように）
  const shadowTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,0.95)');
    gr.addColorStop(0.5, 'rgba(0,0,0,0.6)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const mkShadow = (sx, sz) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.scale.set(sx, sz, 1);
    m.position.y = 0.006;
    m.renderOrder = 1;
    scene.add(m);
    return m;
  };
  const carShadow = mkShadow(5.4, 2.6);
  const tableShadow = mkShadow(1.3, 1.3);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0xffeedd, 0x080808, 0.22));
  const fill = new THREE.DirectionalLight(0xffe2c8, 0.9);
  fill.position.set(6, 2, 4);
  scene.add(fill);
  const key = new THREE.SpotLight(0xfff0e0, 48, 22, 0.5, 0.75, 1.6);
  key.position.set(2.5, 6.5, 3.5);
  key.castShadow = !isMobile;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  const rimLight = new THREE.DirectionalLight(0xdfe6f0, 1.6);
  rimLight.position.set(-5, 3, -5);
  scene.add(rimLight);
  const warm = new THREE.PointLight(0xffb37a, 0, 7, 1.8);
  warm.position.set(-1.4, 1.9, -0.9);
  scene.add(warm);

  // ---------- car (架空の流線形クーペ) ----------
  const car = new THREE.Group();
  scene.add(car);
  const AR = 0.45, WY = 0.4, FX = 1.35, RX = -1.35, A0 = Math.asin(0.08 / AR);

  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-2.2, 0.32);
  bodyShape.lineTo(RX - AR * Math.cos(A0), 0.32);
  bodyShape.absarc(RX, WY, AR, Math.PI + A0, -A0, true);
  bodyShape.lineTo(FX - AR * Math.cos(A0), 0.32);
  bodyShape.absarc(FX, WY, AR, Math.PI + A0, -A0, true);
  bodyShape.lineTo(2.2, 0.32);
  bodyShape.lineTo(2.28, 0.46);
  bodyShape.quadraticCurveTo(2.31, 0.74, 2.12, 0.84);
  bodyShape.quadraticCurveTo(1.45, 0.96, 0.85, 1.01);
  bodyShape.lineTo(-1.55, 1.05);
  bodyShape.quadraticCurveTo(-2.15, 1.03, -2.23, 0.86);
  bodyShape.lineTo(-2.26, 0.5);
  bodyShape.quadraticCurveTo(-2.26, 0.32, -2.2, 0.32);
  const BD = 1.72;
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth: BD, bevelEnabled: true, bevelThickness: 0.11, bevelSize: 0.08, bevelSegments: 6, curveSegments: 32 });
  bodyGeo.translate(0, 0, -BD / 2);
  // 押し出しの「板」感を消す：上へ行くほど内側へ（タンブルホーム）、前後の端ほど細く（平面の丸み）
  // 面を細かく割ってから曲げる（大きな三角形のまま曲げると折れ目が出る）
  function sculpt(src, yFrom, k, ends) {
    let geo = new TessellateModifier(0.09, 8).modify(src);
    geo.deleteAttribute('normal');
    geo.deleteAttribute('uv');
    geo = mergeVertices(geo, 1e-4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const up = clamp((y - yFrom) / 0.6);
      const end = Math.pow(Math.abs(x) / 2.3, 4);
      const low = clamp((0.55 - y) / 0.3);
      pos.setZ(i, z * (1 - k * up * up - ends * end - 0.06 * low));
    }
    geo.computeVertexNormals();
    return geo;
  }
  const body = new THREE.Mesh(sculpt(bodyGeo, 0.55, 0.13, 0.2), paintMat);
  body.castShadow = true;
  car.add(body);

  const cabShape = new THREE.Shape();
  cabShape.moveTo(0.95, 0.98);
  cabShape.quadraticCurveTo(0.45, 1.29, 0.02, 1.37);
  cabShape.lineTo(-0.72, 1.37);
  cabShape.quadraticCurveTo(-1.45, 1.31, -1.86, 1.04);
  cabShape.lineTo(0.95, 0.98);
  const CD = 1.3;
  const cabGeo = new THREE.ExtrudeGeometry(cabShape, { depth: CD, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.09, bevelSegments: 6, curveSegments: 28 });
  cabGeo.translate(0, 0, -CD / 2);
  const cabin = new THREE.Mesh(sculpt(cabGeo, 0.95, 0.5, 0.1), glassCabin);
  cabin.castShadow = true;
  car.add(cabin);

  // ---------- 分解図の5層（参考：源斗さん提示の分解図。形・ロゴはまねず「分かれ方」だけ）----------
  // ①車体（body＋cabin＋lights）②内装 ③エンジンと変速機 ④足回り（フレーム・サス・ホイール）⑤床下パネル
  const partMat = new THREE.MeshPhysicalMaterial({ color: 0x232427, metalness: 0.6, roughness: 0.45, envMapIntensity: 0.8, transparent: true });
  const aluMat = new THREE.MeshPhysicalMaterial({ color: 0x9a9da3, metalness: 0.9, roughness: 0.38, envMapIntensity: 0.9, transparent: true });
  const seatMat = new THREE.MeshPhysicalMaterial({ color: 0x1d1d1f, roughness: 0.7, sheen: 0.3, sheenColor: new THREE.Color(0x55555a), transparent: true });
  const springMat = new THREE.MeshPhysicalMaterial({ color: 0x141414, metalness: 0.7, roughness: 0.35, transparent: true });
  const rb = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), m);

  // ⑤床下パネル（凹凸のある板）
  const floorLayer = new THREE.Group();
  const pan = rb(4.0, 0.05, 1.6, 0.02, chassisMat);
  pan.position.y = 0.2;
  floorLayer.add(pan);
  for (const [x, z, w, d] of [[-1.2, 0, 0.9, 1.1], [0.1, -0.4, 1.2, 0.45], [0.1, 0.4, 1.2, 0.45], [1.3, 0, 0.7, 1.0]]) {
    const rib = rb(w, 0.04, d, 0.015, partMat);
    rib.position.set(x, 0.24, z);
    floorLayer.add(rib);
  }
  car.add(floorLayer);

  // ④足回り：フレーム2本・横の補強・車軸・4本のサスペンション（コイルばね）
  const chassis = new THREE.Group();
  for (const z of [-0.45, 0.45]) {
    const rail = rb(3.7, 0.09, 0.12, 0.03, partMat);
    rail.position.set(0, 0.36, z);
    chassis.add(rail);
  }
  for (const x of [-1.6, -0.6, 0.5, 1.6]) {
    const cross = rb(0.1, 0.07, 1.0, 0.02, partMat);
    cross.position.set(x, 0.36, 0);
    chassis.add(cross);
  }
  for (const x of [FX, RX]) {
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.62, 16), aluMat);
    axle.rotation.x = Math.PI / 2;
    axle.position.set(x, WY, 0);
    chassis.add(axle);
  }
  const helix = new (class extends THREE.Curve {
    getPoint(t, out = new THREE.Vector3()) { const a = t * Math.PI * 2 * 6; return out.set(Math.cos(a) * 0.055, t * 0.32, Math.sin(a) * 0.055); }
  })();
  const springGeo = new THREE.TubeGeometry(helix, 160, 0.008, 6, false);
  for (const x of [FX, RX]) for (const z of [-0.6, 0.6]) {
    const strut = new THREE.Group();
    const spring = new THREE.Mesh(springGeo, springMat);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 10), aluMat);
    rod.position.y = 0.2;
    const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 20), partMat);
    capTop.position.y = 0.34;
    strut.add(spring, rod, capTop);
    strut.position.set(x, WY + 0.04, z);
    chassis.add(strut);
  }
  car.add(chassis);

  // ③エンジンと変速機
  const power = new THREE.Group();
  const block = rb(0.62, 0.36, 0.7, 0.04, aluMat);
  block.position.set(1.42, 0.62, 0);
  const head = rb(0.55, 0.12, 0.62, 0.04, partMat);
  head.position.set(1.42, 0.86, 0);
  const cover = rb(0.42, 0.06, 0.48, 0.03, seatMat);
  cover.position.set(1.42, 0.95, 0);
  power.add(block, head, cover);
  for (let i = 0; i < 4; i++) {
    const runner = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 12), aluMat);
    runner.rotation.x = Math.PI / 2;
    runner.position.set(1.25 + i * 0.11, 0.8, 0.42);
    power.add(runner);
  }
  for (const [y, z, r] of [[0.52, -0.38, 0.09], [0.7, -0.38, 0.06], [0.45, -0.38, 0.05]]) {
    const pulley = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.04, 24), partMat);
    pulley.rotation.x = Math.PI / 2;
    pulley.position.set(1.62, y, z);
    power.add(pulley);
  }
  const trans = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.13, 0.7, 24), aluMat);
  trans.rotation.z = Math.PI / 2;
  trans.position.set(0.78, 0.58, 0);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 10), partMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(-0.3, 0.5, 0);
  power.add(trans, shaft);
  car.add(power);

  // ②内装：座席4つ（前2・後ろはベンチ）・ダッシュボード・ハンドル・センターコンソール
  const interior = new THREE.Group();
  const seat = (x, z, w) => {
    const g = new THREE.Group();
    const base = rb(0.5, 0.12, w, 0.05, seatMat); base.position.set(0, 0, 0);
    const back = rb(0.13, 0.55, w, 0.05, seatMat); back.position.set(-0.26, 0.3, 0); back.rotation.z = 0.15;
    const head = rb(0.1, 0.14, w * 0.55, 0.04, seatMat); head.position.set(-0.32, 0.63, 0); head.rotation.z = 0.15;
    const rail = rb(0.46, 0.05, w * 0.8, 0.015, partMat); rail.position.y = -0.09;
    g.add(base, back, head, rail);
    g.position.set(x, 0.46, z);
    return g;
  };
  interior.add(seat(0.05, -0.36, 0.46), seat(0.05, 0.36, 0.46), seat(-0.95, 0, 1.2));
  const dash = rb(0.32, 0.22, 1.5, 0.06, seatMat);
  dash.position.set(0.72, 0.78, 0);
  const console_ = rb(0.7, 0.16, 0.2, 0.04, partMat);
  console_.position.set(0.35, 0.5, 0);
  const steer = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 10, 36), partMat);
  steer.position.set(0.5, 0.86, 0.36);
  steer.rotation.set(0.35, Math.PI / 2, 0);
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), partMat);
  column.rotation.z = Math.PI / 2 - 0.5;
  column.position.set(0.62, 0.82, 0.36);
  interior.add(dash, console_, steer, column);
  car.add(interior);

  [floorLayer, chassis, power, interior].forEach((g) => g.traverse((m) => { if (m.isMesh) m.castShadow = true; }));

  const lights = new THREE.Group();
  for (const z of [-0.62, 0.62]) {
    const h = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.05, 0.42, 2, 0.02), headMat);
    h.position.set(2.2, 0.77, z);
    h.rotation.z = -0.35;
    lights.add(h);
  }
  const tail = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.035, 1.7, 2, 0.015), tailMat);
  tail.position.set(-2.27, 0.9, 0);
  lights.add(tail);
  car.add(lights);

  // 車体の細部（車体と一緒に動く）：ミラー・ドアの合わせ目とハンドル・窓の縁取り・グリル・サイドスカート・ディフューザー
  // ※どのメーカーにも似せない。エンブレム・ロゴは入れない
  const trim = new THREE.Group();
  const trimDark = new THREE.MeshStandardMaterial({ color: 0x060606, roughness: 0.55, metalness: 0.2, transparent: true });
  const trimChrome = new THREE.MeshPhysicalMaterial({ color: 0xc9c9c9, metalness: 1, roughness: 0.28, envMapIntensity: 0.9, transparent: true });
  const tb = (w, h, d, r, m, x, y, z, rz = 0) => { const o = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), m); o.position.set(x, y, z); o.rotation.z = rz; trim.add(o); return o; };
  for (const sd of [-1, 1]) {
    // サイドミラー（腕＋本体）
    tb(0.06, 0.03, 0.14, 0.01, trimDark, 0.86, 1.03, sd * 0.9);
    tb(0.17, 0.09, 0.11, 0.035, paintMat, 0.82, 1.07, sd * 1.0, 0.08);
    tb(0.012, 0.075, 0.095, 0.005, trimDark, 0.735, 1.07, sd * 1.0);
    // ドアの合わせ目（前・後ろ）と下端
    tb(0.008, 0.52, 0.006, 0.002, trimDark, 0.84, 0.66, sd * 0.968, -0.06);
    tb(0.008, 0.5, 0.006, 0.002, trimDark, -0.72, 0.66, sd * 0.968, 0.05);
    // ドアハンドル
    tb(0.15, 0.024, 0.018, 0.009, trimChrome, -0.42, 0.84, sd * 0.972);
    // 窓の縁取り（車体と窓の境目）
    tb(2.55, 0.014, 0.014, 0.006, trimChrome, -0.45, 1.015, sd * 0.79);
    // サイドスカート
    tb(1.72, 0.05, 0.035, 0.015, trimDark, 0, 0.33, sd * 0.955);
  }
  // フロントグリル（横長の開口）＋その下の取り入れ口
  tb(0.06, 0.13, 0.92, 0.03, trimDark, 2.33, 0.56, 0, -0.25);
  tb(0.05, 0.06, 1.3, 0.025, trimDark, 2.31, 0.36, 0);
  // リアディフューザー（縦のひれ付き）
  tb(0.06, 0.1, 1.25, 0.02, trimDark, -2.31, 0.36, 0);
  for (const z of [-0.3, 0, 0.3]) tb(0.12, 0.08, 0.012, 0.004, trimDark, -2.3, 0.33, z);
  trim.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  car.add(trim);

  // ---------- AIで作った車（Krea／Rodin 2.5・エンブレム無しの汎用クーペ）----------
  // 最初の場面はこの車を見せ、分解が始まると浮き上がりながら消えて、同じ位置で5層の分解図（コードの車）に切り替わる。
  // 読み込みに失敗した時はコードの車のまま動く。
  const aiCar = new THREE.Group();
  let aiReady = false;
  const aiMats = [];
  scene.add(aiCar);
  new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(new URL(isMobile ? '../assets/models/ai/car-m.glb' : '../assets/models/ai/car.glb', import.meta.url).href, (gltf) => {
    const m = gltf.scene;
    m.rotation.y = Math.PI / 2; // 長い向き（z）をコードの車と同じx向きに
    m.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const k = 4.55 / size.x; // 全長をコードの車（約4.55m）にそろえる
    m.scale.setScalar(k);
    m.updateMatrixWorld(true);
    box.setFromObject(m);
    const c = box.getCenter(new THREE.Vector3());
    m.position.set(-c.x, -box.min.y, -c.z);
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true;
      o.material.envMapIntensity = 0.9;
      aiMats.push(o.material);
    });
    aiCar.add(m);
    aiReady = true;
  }, undefined, (e) => console.warn('AIの車を読めないのでコードの車で表示', e));

  // 4本のホイール＋ブレーキ（ヒーローは右前＝カメラ側）
  const wheelSlots = [
    { x: FX, z: 0.86, side: 1, hero: true },
    { x: RX, z: 0.86, side: 1 },
    { x: FX, z: -0.86, side: -1 },
    { x: RX, z: -0.86, side: -1 },
  ];
  const others = [];
  let hero = null;
  const brakes = [];
  for (const s of wheelSlots) {
    const mats = s.hero ? { mat: rimMat, tMat: fade(tireMat) } : { mat: fade(rimMat), tMat: fade(tireMat), cap: fade(roseMat) };
    const w = buildWheel({ ...mats, tire: true });
    w.orient.rotation.x = (Math.PI / 2) * s.side;
    const holder = new THREE.Group();
    holder.position.set(s.x, WY, s.z);
    holder.add(w.orient);
    scene.add(holder);
    const entry = { ...w, holder, slot: s };
    if (s.hero) hero = entry; else others.push(entry);

    const br = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.026, 48), discMat);
    br.add(disc);
    const cal = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.07, 0.07, 2, 0.015), caliperMat);
    cal.position.set(0.12, 0.03, -0.13);
    br.add(cal);
    br.rotation.x = (Math.PI / 2) * s.side;
    br.position.set(s.x, WY, s.z - 0.07 * s.side);
    scene.add(br);
    brakes.push(br);
  }

  // ---------- table top (ヒーローの子として天板・支柱) ----------
  const top = new THREE.Group();
  const glassMat = HQ
    ? new THREE.MeshPhysicalMaterial({ color: 0xeef8f5, metalness: 0, roughness: 0.05, transmission: 1, thickness: 0.04, ior: 1.5, envMapIntensity: 1.0, transparent: true, opacity: 0 })
    : new THREE.MeshPhysicalMaterial({ color: 0xd6efe9, metalness: 0, roughness: 0.03, clearcoat: 1, envMapIntensity: 2.2, transparent: true, opacity: 0.0, depthWrite: false });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.016, 96), glassMat);
  const edgeMat = new THREE.MeshPhysicalMaterial({ color: 0x5f9d8c, roughness: 0.1, transparent: true, opacity: 0, envMapIntensity: 1.5 });
  const edge = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.008, 8, 96), edgeMat);
  edge.rotation.x = Math.PI / 2;
  top.add(glass, edge);
  const postMat = fade(new THREE.MeshPhysicalMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.35 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.26;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 12), postMat);
    p.position.set(Math.cos(a) * 0.282, -0.03, Math.sin(a) * 0.282);
    top.add(p);
  }
  hero.holder.add(top);
  top.visible = false;

  // ---------- room (空間デザイン) ----------
  const room = new THREE.Group();
  scene.add(room);
  const rise = []; // { obj, base, from, a, b }
  const addRise = (obj, a, b, from = -3.6) => { rise.push({ obj, base: obj.position.y, from, a, b }); room.add(obj); };

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 0.85 });
  const wall = new THREE.Group();
  const wallPlane = new THREE.Mesh(new THREE.PlaneGeometry(10, 3.4), wallMat);
  wallPlane.position.set(0, 1.7, 0);
  wallPlane.receiveShadow = true;
  wall.add(wallPlane);
  const slatGeo = new THREE.BoxGeometry(0.045, 3.4, 0.05);
  const slatMat = new THREE.MeshStandardMaterial({ color: 0x1e1712, roughness: 0.6 });
  const slats = new THREE.InstancedMesh(slatGeo, slatMat, 46);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 46; i++) { m4.makeTranslation(-4.5 + i * 0.2, 1.7, 0.03); slats.setMatrixAt(i, m4); }
  wall.add(slats);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0xf2b98e });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(10, 0.018, 0.02), stripMat);
  strip.position.set(0, 0.03, 0.12);
  wall.add(strip);
  wall.position.set(0, 0, -2.7);

  // 壁のホイール時計（「時を刻む」）
  const clock = buildWheel({ mat: darkMetal, cap: roseMat, spokes: 10, twin: true });
  clock.orient.rotation.x = Math.PI / 2;
  clock.orient.scale.setScalar(0.62);
  clock.orient.position.set(1.65, 1.85, 0.2);
  wall.add(clock.orient);
  const handMat = new THREE.MeshStandardMaterial({ color: 0xf0e6dc, metalness: 0.6, roughness: 0.3 });
  const mkHand = (len, w, mat) => { const g = new THREE.BoxGeometry(w, len, 0.006); g.translate(0, len / 2 - 0.02, 0); return new THREE.Mesh(g, mat); };
  const hHour = mkHand(0.1, 0.012, handMat), hMin = mkHand(0.155, 0.008, handMat), hSec = mkHand(0.17, 0.004, roseMat);
  [hHour, hMin, hSec].forEach((h, i) => { h.position.set(1.65, 1.85, 0.3 + i * 0.008); wall.add(h); });
  addRise(wall, 0.66, 0.76, -3.6);

  const grain = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 128 + (Math.random() - 0.5) * 90;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    g.globalAlpha = 0.5;
    g.filter = 'blur(1.2px)';
    g.drawImage(c, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(5, 5);
    return t;
  })();
  const leather = new THREE.MeshPhysicalMaterial({ color: 0x2a1c15, roughness: 0.78, bumpMap: grain, bumpScale: 0.6, sheen: 0.2, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x7a5644), envMapIntensity: 0.28 });
  const sofa = new THREE.Group();
  // L字ソファ：土台＋座面クッション3つ＋背もたれクッション3つ＋肘掛け＋寝椅子部分＋細い金属の脚
  const legMat = new THREE.MeshPhysicalMaterial({ color: 0x8c8c8c, metalness: 1, roughness: 0.35 });
  const sb = (w, h, d, x, y, z, r = 0.06, rx = 0, rz = 0) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, r), leather); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; sofa.add(m); };
  sb(2.6, 0.16, 0.95, -0.3, 0.19, -1.55, 0.04);                       // 土台
  for (const x of [-1.15, -0.3, 0.55]) {
    sb(0.84, 0.15, 0.8, x, 0.34, -1.48, 0.07);                        // 座面
    sb(0.84, 0.44, 0.2, x, 0.6, -1.9, 0.09, -0.14);                   // 背もたれ
  }
  sb(0.18, 0.46, 0.95, 1.0, 0.33, -1.55, 0.07);                       // 右の肘掛け
  sb(0.95, 0.16, 1.7, -2.05, 0.19, -0.85, 0.04);                      // 寝椅子の土台
  sb(0.86, 0.15, 1.6, -2.03, 0.34, -0.8, 0.07);                       // 寝椅子の座面
  sb(0.2, 0.44, 1.5, -2.43, 0.6, -0.8, 0.09, 0, 0.14);                // 寝椅子の背もたれ
  for (const [x, z] of [[-1.55, -1.1], [1.0, -1.1], [-1.55, -2.0], [1.0, -2.0], [-2.48, 0.0], [-1.62, 0.0]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.11, 10), legMat);
    leg.position.set(x, 0.055, z);
    sofa.add(leg);
  }
  sofa.position.z = -0.35;
  addRise(sofa, 0.69, 0.79, -1.2);

  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.55, 72), new THREE.MeshStandardMaterial({ color: 0x1d1a17, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = 0.006;
  rug.receiveShadow = true;
  addRise(rug, 0.66, 0.72, -0.5);

  // ペンダントライト（製品10）
  const pend = new THREE.Group();
  const pw = buildWheel({ mat: rimMat, cap: roseMat, spokes: 10 });
  pw.orient.scale.setScalar(0.58);
  pend.add(pw.orient);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffd9a8, emissive: 0xffb15e, emissiveIntensity: 2.6 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 4), darkMetal);
    wire.position.set(Math.cos(a) * 0.1, -0.15, Math.sin(a) * 0.1);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), bulbMat);
    bulb.position.set(Math.cos(a) * 0.1, -0.32, Math.sin(a) * 0.1);
    pend.add(wire, bulb);
  }
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.2, 4), darkMetal);
  cord.position.y = 0.66;
  pend.add(cord);
  pend.position.set(-1.4, 2.3, -0.9);
  addRise(pend, 0.72, 0.82, 3.2);

  // プランター（製品13）
  const plant = new THREE.Group();
  const pw2 = buildWheel({ mat: darkMetal, cap: roseMat, spokes: 10 });
  pw2.orient.scale.setScalar(0.62);
  pw2.orient.position.y = 0.08;
  plant.add(pw2.orient);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2b4429, roughness: 0.7 });
  for (let i = 0; i < 9; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), leafMat);
    const a = (i / 9) * Math.PI * 2;
    l.scale.set(0.5, 3.4, 0.9);
    l.position.set(Math.cos(a) * 0.08, 0.42 + (i % 3) * 0.05, Math.sin(a) * 0.08);
    l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    plant.add(l);
  }
  plant.position.set(2.55, 0, -2.3);
  addRise(plant, 0.74, 0.84, -1.2);

  // COLLECTIONの家具を部屋に置く（サイドテーブル・スツール・飾り棚）＝「家具で空間をつくる」をそのまま見せる
  const placeProduct = (no, x, z, ry, a, b) => {
    const g = new THREE.Group();
    g.add(PRODUCTS[no]().obj);
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const lite = new THREE.MeshPhysicalMaterial({ color: 0xd6efe9, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.6, transparent: true, opacity: 0.2, depthWrite: false });
    g.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true;
      // スマホは屈折ガラスをやめる（画面全体をもう一度描く分だけ重くなり、カクつきの原因になる）
      if (!HQ && m.material.transmission > 0) m.material = lite;
    });
    addRise(g, a, b, -1.7);
  };
  placeProduct('06', 1.45, -1.85, 0.3, 0.71, 0.81);   // サイドテーブル（ソファの右）
  placeProduct('08', 0.95, 0.4, -0.5, 0.73, 0.83);    // スツール（テーブルの手前）
  placeProduct('11', -3.05, -2.3, 0.5, 0.75, 0.86);  // 飾り棚（左奥の壁ぎわ・文字と重ならない側）

  // ---------- finish ----------
  let finishTarget = FINISHES.polish;
  const tmpCol = new THREE.Color();
  function setFinish(name) { if (FINISHES[name]) finishTarget = FINISHES[name]; }

  // ---------- camera path ----------
  const KEYS = [
    { p: 0.0, pos: [5.3, 1.35, 7.1], look: [-0.75, 0.45, 0.5], lookP: [0.05, 0.55, 0] },
    { p: 0.13, pos: [3.8, 1.1, 7.6], look: [-0.8, 0.45, 0.5], lookP: [0, 0.55, 0] },
    { p: 0.3, pos: [6.6, 2.75, 8.6], look: [0.1, 2.1, 0], pf: 0.78 },
    { p: 0.45, pos: [0.0, 1.0, 2.75], look: [0, 0.95, 0.3] },
    { p: 0.6, pos: [0.0, 1.75, 2.3], look: [0, 0.2, 0] },
    { p: 0.82, pos: [3.5, 2.35, 4.5], look: [-0.25, 0.75, -1.0] },
    { p: 1.0, pos: [1.45, 1.55, 1.95], look: [0, 0.22, 0] },
  ];
  const vPos = new THREE.Vector3(), vLook = new THREE.Vector3(), tA = new THREE.Vector3(), tB = new THREE.Vector3();
  let keyPF = 1;
  function cameraAt(p) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = seg(p, a.p, b.p);
    vPos.set(...a.pos).lerp(tA.set(...b.pos), t);
    const portrait = width < height;
    vLook.set(...((portrait && a.lookP) || a.look)).lerp(tB.set(...((portrait && b.lookP) || b.look)), t);
    keyPF = lerp(a.pf ?? 1, b.pf ?? 1, t); // 縦長画面での「引き」の強さ（縦に長い場面は引きを弱める）
  }

  // ---------- update ----------
  const setOpacity = (m, o) => { m.opacity = o; m.visible = o > 0.003; };
  let spinAngle = 0, tableYaw = 0, dragYaw = 0;
  const pointer = { x: 0, y: 0 };
  let width = 1, height = 1;

  let composer = null, grainPass = null;
  if (HQ) {
    const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.1, 0.4, 0.95));
    composer.addPass(new OutputPass());
    grainPass = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec4 c = texture2D(tDiffuse, vUv);
          c.rgb += (h(vUv * 1000.0 + uTime) - 0.5) * 0.028;
          float d = distance(vUv, vec2(0.5));
          c.rgb *= 1.0 - 0.42 * smoothstep(0.35, 0.85, d);
          gl_FragColor = c;
        }`,
    });
    composer.addPass(grainPass);
  }

  function resize(w, h) {
    width = w; height = h;
    renderer.setSize(w, h, false);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h); }
    camera.aspect = w / h;
    // 縦長画面では下に文字が来るので、絵を上へ寄せる
    if (w < h) camera.setViewOffset(w, h, 0, h * 0.13, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  function update(p, dt, time) {
    // S1 車：ライトの点灯
    const lightOn = seg(p, -0.02, 0.04);
    headMat.emissiveIntensity = 3 * lightOn;

    // S2 分解
    const ex = seg(p, 0.14, 0.3);
    // 縦に5層へ分かれる（上の層から順に、少しずつ遅れて浮く）。床下パネルはその場に残る
    const L1 = seg(p, 0.14, 0.27), L2 = seg(p, 0.155, 0.28), L3 = seg(p, 0.17, 0.29), L4 = seg(p, 0.185, 0.3);
    body.position.y = L1 * 3.05;
    lights.position.y = L1 * 3.05;
    trim.position.y = L1 * 3.05;
    cabin.position.y = L1 * 3.05;
    interior.position.y = L2 * 2.05;
    power.position.y = L3 * 1.3;
    chassis.position.y = L4 * 0.6;
    const lift = L4 * 0.6; // ホイールとブレーキは足回りと一緒に上がる
    const carFade0 = 1 - seg(p, 0.3, 0.4);
    // AIの車 → コードの分解図への切り替え（L1＝車体が浮く量）
    const procIn = aiReady ? clamp(L1 / 0.16) : 1;
    const carFade = carFade0 * procIn;
    if (aiReady) {
      const aiO = 1 - clamp(L1 / 0.18);
      aiCar.position.y = L1 * 3.05;
      aiCar.visible = aiO > 0.003;
      // 半透明は切り替えの間だけ（常に半透明だとスマホで重くなる）
      aiMats.forEach((m) => { const t = aiO < 0.999; if (m.transparent !== t) { m.transparent = t; m.needsUpdate = true; } m.opacity = aiO; m.depthWrite = !t; });
    }
    rimMat.transparent = procIn < 1;
    rimMat.opacity = procIn;
    setOpacity(paintMat, carFade);
    setOpacity(glassCabin, carFade * 0.94);
    setOpacity(chassisMat, carFade);
    setOpacity(partMat, carFade);
    setOpacity(seatMat, carFade);
    setOpacity(aluMat, carFade);
    setOpacity(trimDark, carFade);
    setOpacity(trimChrome, carFade);
    setOpacity(springMat, carFade);
    brakes.forEach((br, i) => (br.position.y = WY + lift));
    setOpacity(headMat, carFade);
    setOpacity(tailMat, carFade);
    setOpacity(discMat, carFade);
    setOpacity(caliperMat, carFade);
    bars.children.forEach((b) => (b.visible = true));
    setOpacity(barMat, 0.9 * (1 - seg(p, 0.6, 0.7)));

    const pick = seg(p, 0.33, 0.46);
    const othersFade = 1 - seg(p, 0.32, 0.42);
    for (const w of others) {
      const s = w.slot;
      w.holder.position.set(s.x, WY + lift, s.z); // 足回りに付いたまま上がる（タイヤも付いたまま）
      w.spin.children.forEach((c) => c.material && c.material !== darkMetal && setOpacity(c.material, othersFade * procIn));
      if (w.tire) setOpacity(w.tire.material, othersFade * procIn);
    }

    // S3 ピックアップ（ヒーロー）
    const hs = hero.slot;
    const exPos = tA.set(hs.x, WY + lift, hs.z);
    const pickPos = tB.set(0, 0.95, 0.3);
    hero.holder.position.copy(exPos).lerp(pickPos, pick);
    if (hero.tire) {
      hero.tire.position.y = pick * 0.55; // 選んだ1本だけ、ここでタイヤを外す
      setOpacity(hero.tire.material, (1 - seg(p, 0.33, 0.42)) * procIn);
    }

    setOpacity(carShadow.material, 0.9 * (1 - ex * 0.6) * carFade);
    // S4 家具に変化
    const tf = seg(p, 0.5, 0.62);
    const flat = seg(p, 0.5, 0.58);
    hero.orient.rotation.x = (Math.PI / 2) * (1 - flat);
    const tableY = 0.13 * 1.35;
    hero.holder.position.y = lerp(hero.holder.position.y, tableY, flat);
    hero.holder.position.z = lerp(hero.holder.position.z, 0, flat);
    hero.holder.scale.setScalar(lerp(1, 1.35, flat));

    setOpacity(tableShadow.material, 0.85 * flat);
    tableShadow.position.x = hero.holder.position.x;
    tableShadow.position.z = hero.holder.position.z;
    const glassIn = seg(p, 0.555, 0.63);
    top.visible = glassIn > 0.001;
    top.position.y = lerp(2.2, 0.175, glassIn);
    setOpacity(glassMat, (HQ ? 1 : 0.2) * glassIn);
    setOpacity(edgeMat, 0.9 * glassIn);
    setOpacity(postMat, glassIn);

    // spin：ピックアップ中は回り、テーブルになったら止まる
    const spinSpeed = (1 - seg(p, 0.5, 0.58)) * (0.35 + pick * 1.4);
    spinAngle += dt * spinSpeed;
    hero.spin.rotation.y = spinAngle;
    others.forEach((w) => (w.spin.rotation.y = spinAngle * 0.4));

    // S5 空間
    for (const r of rise) {
      const e = seg(p, r.a, r.b);
      r.obj.position.y = r.base + (1 - e) * r.from;
      r.obj.visible = e > 0.001;
    }
    const roomOn = seg(p, 0.7, 0.84);
    warm.intensity = 9 * roomOn;
    pool.material.opacity = lerp(0.3, 0.22, roomOn);
    key.intensity = lerp(48, 34, roomOn);

    // 時計：実際の時刻で秒を刻む
    const now = new Date();
    const sec = now.getSeconds() + Math.floor(now.getMilliseconds() / 1000);
    const min = now.getMinutes() + sec / 60;
    const hr = (now.getHours() % 12) + min / 60;
    hSec.rotation.z = -(sec / 60) * Math.PI * 2;
    hMin.rotation.z = -(min / 60) * Math.PI * 2;
    hHour.rotation.z = -(hr / 12) * Math.PI * 2;

    // S6 仕上げ：テーブルをゆっくり回す
    const fin = seg(p, 0.84, 0.95);
    tableYaw += dt * 0.25 * fin;
    hero.holder.rotation.y = tableYaw + dragYaw;

    // 仕上げの切替（なめらかに）
    const k = 1 - Math.exp(-dt * 5);
    rimMat.color.lerp(tmpCol.set(finishTarget.color), k);
    rimMat.metalness = lerp(rimMat.metalness, finishTarget.metalness, k);
    rimMat.roughness = lerp(rimMat.roughness, finishTarget.roughness, k);
    rimMat.clearcoat = lerp(rimMat.clearcoat, finishTarget.clearcoat, k);
    rimMat.anisotropy = lerp(rimMat.anisotropy, finishTarget.anisotropy, k);

    // camera
    cameraAt(p);
    const aspect = width / height;
    let f = 1;
    if (aspect < 1) {
      f = 1 + (lerp(1, 2.4, clamp((1 - aspect) / 0.55)) - 1) * keyPF;
      vPos.sub(vLook).multiplyScalar(f).add(vLook);
    }
    scene.fog.near = 10 * f;
    scene.fog.far = 24 * f;
    camera.position.copy(vPos);
    camera.position.x += pointer.x * 0.18;
    camera.position.y += pointer.y * 0.1;
    camera.lookAt(vLook);

    if (composer) { grainPass.uniforms.uTime.value = time % 100; composer.render(); }
    else renderer.render(scene, camera);
  }

  return {
    resize,
    update,
    setFinish,
    setPointer(x, y) { pointer.x = x; pointer.y = y; },
    addDrag(dx) { dragYaw += dx; },
    renderer,
  };
}
