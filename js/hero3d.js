// 下層ページの見出し横：ゆっくり回るホイールテーブル（TOPと同じ光・素材）
// <canvas class="hero3d" data-finish="polish|black|gold" data-mode="table|wheel">
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const FIN = {
  polish: { color: 0xcfcfcf, metalness: 1, roughness: 0.36, clearcoat: 0, anisotropy: 0.45 },
  black: { color: 0x161616, metalness: 0.35, roughness: 0.52, clearcoat: 0.25, anisotropy: 0 },
  gold: { color: 0xc49a5c, metalness: 1, roughness: 0.4, clearcoat: 0, anisotropy: 0.35 },
};

export function mountHero3d(canvas) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  new RGBELoader().load(new URL('../assets/hdr/studio_small_09_1k.hdr', import.meta.url).href, (tex) => {
    tex.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
  });
  scene.add(new THREE.HemisphereLight(0xffeedd, 0x080808, 0.3));
  const key = new THREE.DirectionalLight(0xfff0e0, 1.6);
  key.position.set(2, 4, 3);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  const mode = canvas.dataset.mode || 'table';
  if (mode === 'wheel') camera.position.set(0, 0, 2.3); else camera.position.set(0, 1.25, 1.9);
  camera.lookAt(0, mode === 'wheel' ? 0 : 0.12, 0);

  const mat = new THREE.MeshPhysicalMaterial({ ...FIN[canvas.dataset.finish || 'polish'], envMapIntensity: 0.85, side: THREE.DoubleSide });
  const rose = new THREE.MeshPhysicalMaterial({ color: 0xc8916c, metalness: 1, roughness: 0.42 });

  // ホイール（TOPと同じ断面）
  const prof = [[0.255, -0.13], [0.3, -0.13], [0.306, -0.118], [0.287, -0.104], [0.279, 0.09], [0.291, 0.104], [0.306, 0.118], [0.3, 0.13], [0.256, 0.13], [0.262, 0.1], [0.262, -0.1], [0.255, -0.13]].map(([r, y]) => new THREE.Vector2(r, y));
  const wheel = new THREE.Group();
  wheel.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), mat));
  const sh = new THREE.Shape();
  sh.moveTo(0.055, -0.026); sh.lineTo(0.266, -0.013); sh.lineTo(0.266, 0.013); sh.lineTo(0.055, 0.026); sh.closePath();
  const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.034, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2 });
  sg.rotateX(-Math.PI / 2); sg.translate(0, 0.058, 0);
  for (let i = 0; i < 5; i++) for (const o of [-0.09, 0.09]) { const m = new THREE.Mesh(sg, mat); m.rotation.y = (i / 5) * Math.PI * 2 + o; wheel.add(m); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.08, 0.06, 40), mat); hub.position.y = 0.07; wheel.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 40), rose); cap.position.y = 0.104; wheel.add(cap);

  const root = new THREE.Group();
  root.add(wheel);
  if (mode === 'wheel') {
    wheel.rotation.x = Math.PI / 2;
  } else {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.016, 96),
      new THREE.MeshPhysicalMaterial({ color: 0xd6efe9, roughness: 0.05, clearcoat: 1, envMapIntensity: 1.2, transparent: true, opacity: 0.18, depthWrite: false }));
    glass.position.y = 0.175;
    root.add(glass);
    const post = new THREE.MeshPhysicalMaterial({ color: 0xcccccc, metalness: 1, roughness: 0.35 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.26;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.05, 12), post);
      p.position.set(Math.cos(a) * 0.282, 0.145, Math.sin(a) * 0.282);
      root.add(p);
    }
    root.position.y = -0.05;
  }
  scene.add(root);

  let visible = true, last = performance.now(), mx = 0, drag = 0, dragging = false, lx = 0;
  let target = { ...FIN[canvas.dataset.finish || 'polish'] };
  const tmp = new THREE.Color();
  if (canvas.dataset.drag) {
    canvas.style.cursor = 'grab';
    canvas.style.touchAction = 'pan-y';
    canvas.addEventListener('pointerdown', (e) => { dragging = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (dragging) { drag += (e.clientX - lx) * 0.01; lx = e.clientX; } });
    const up = () => (dragging = false);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  addEventListener('pointermove', (e) => (mx = (e.clientX / innerWidth) * 2 - 1), { passive: true });

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', size);
  size();

  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible) {
      if (mode === 'wheel') wheel.rotation.y += dt * (reduce ? 0.05 : 0.35);
      else root.rotation.y += dt * (reduce ? 0.05 : 0.22) * (dragging ? 0 : 1);
      root.rotation.y += drag; drag = 0;
      const k = 1 - Math.exp(-dt * 5);
      mat.color.lerp(tmp.set(target.color), k);
      for (const key of ['metalness', 'roughness', 'clearcoat', 'anisotropy']) mat[key] += (target[key] - mat[key]) * k;
      root.rotation.z += ((mx * 0.06) - root.rotation.z) * 0.05;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  })(last);

  return { root, setFinish(name) { if (FIN[name]) target = { ...FIN[name] }; } };
}
