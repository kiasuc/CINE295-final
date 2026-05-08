import * as THREE from "three";

const PALETTE = [
  new THREE.Color("#6ce0ff"),
  new THREE.Color("#ff7ab8"),
  new THREE.Color("#c79bff"),
  new THREE.Color("#ffd28a"),
  new THREE.Color("#ffffff"),
];

export function createParticleField(scene, { count = 500, radius = 45 } = {}) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = radius * (0.4 + 0.6 * Math.random());
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.2 + 0.8 * Math.random());
    positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.max(-6, r * Math.cos(phi));
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 4;

    const c = PALETTE[(Math.random() * PALETTE.length) | 0];
    const tint = 0.5 + Math.random() * 0.5;
    colors[i * 3 + 0] = c.r * tint;
    colors[i * 3 + 1] = c.g * tint;
    colors[i * 3 + 2] = c.b * tint;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const sprite = makeDiscTexture();
  const material = new THREE.PointsMaterial({
    size: 0.18,
    map: sprite,
    alphaMap: sprite,
    vertexColors: true,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geom, material);
  scene.add(points);

  function tick(time) {
    points.rotation.y = time * 0.005;
  }

  return { points, tick };
}

function makeDiscTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.4, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
