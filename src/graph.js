import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const _noteTexCache = {};
function getNoteTexture(sym) {
  if (_noteTexCache[sym]) return _noteTexCache[sym];
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "bold 38px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "white";
  ctx.fillText(sym, 32, 36);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  _noteTexCache[sym] = tex;
  return tex;
}

const CORE_GEOM = new THREE.IcosahedronGeometry(1, 3);
const WIRE_GEOM = new THREE.IcosahedronGeometry(1.08, 2);
const CYLINDER_GEOM = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
const UP = new THREE.Vector3(0, 1, 0);
const SCALE_TMP = new THREE.Vector3();
const EDGE_RADIUS = 0.18;

const NOTE_SYMBOLS = ["♪", "♫", "♬", "♩"];

const BPM = 44;
const BEAT_HZ = BPM / 60;

export function buildGraph(data, scene, camera) {
  const nodesById = new Map();
  const nodeMeshes = [];
  const edgeMeshes = [];
  const tickers = [];
  let hoveredId = null;
  let selectedId = null;

  for (let i = 0; i < data.nodes.length; i++) {
    const node = data.nodes[i];
    const color = new THREE.Color(node.color || "#00f0ff");
    const r = node.radius ?? 1;
    const phase = (i / data.nodes.length) * Math.PI * 2;

    // Normalize emissive to full brightness so intensity is the only variable
    const emissiveColor = color.clone();
    const maxChannel = Math.max(emissiveColor.r, emissiveColor.g, emissiveColor.b);
    if (maxChannel > 0) emissiveColor.multiplyScalar(1 / maxChannel);

    const core = new THREE.Mesh(
      CORE_GEOM,
      new THREE.MeshStandardMaterial({
        color,
        emissive: emissiveColor,
        emissiveIntensity: 0.7,
        roughness: 0.11,
        metalness: 0.76,
        flatShading: true,
        transparent: true,
        opacity: 0.96,
      }),
    );
    core.castShadow = true;
    core.scale.setScalar(r);
    core.position.fromArray(node.position);
    core.userData = { kind: "node", node };
    scene.add(core);
    nodeMeshes.push(core);

    const wire = new THREE.Mesh(
      WIRE_GEOM,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        wireframe: true,
      }),
    );
    wire.position.copy(core.position);
    wire.scale.setScalar(r);
    scene.add(wire);

    const labelEl = document.createElement("div");
    labelEl.className = "node-label";
    labelEl.textContent = node.title;
    labelEl.style.setProperty("--accent", `#${color.getHexString()}`);
    const label = new CSS2DObject(labelEl);
    label.position.copy(core.position);
    label.position.y += r * 1.55;
    scene.add(label);

    nodesById.set(node.id, { node, mesh: core, wire, label });

    let currentEmissive = 0.7;
    let currentWireOpacity = 0.28;

    tickers.push((time) => {
      const beat = 0.5 + 0.5 * Math.sin(time * BEAT_HZ * Math.PI * 2 + phase);
      const isSelected = node.id === selectedId;
      const isHovered = !isSelected && node.id === hoveredId;
      const pulse = Math.sin(time * 2.4 + node.position[0]) * 0.04;

      const targetMul = isSelected ? 1.24 + pulse : isHovered ? 1.13 : 1.0;
      SCALE_TMP.setScalar(r * targetMul);
      core.scale.lerp(SCALE_TMP, 0.12);

      wire.rotation.y -= 0.008;
      const targetWireOpacity = isSelected ? 0.72 : isHovered ? 0.5 : 0.28;
      currentWireOpacity += (targetWireOpacity - currentWireOpacity) * 0.14;
      wire.material.opacity = currentWireOpacity;

      const targetEmissive = isSelected ? 1.5 + beat * 0.10 : isHovered ? 0.95 : 0.72 + beat * 0.08;
      currentEmissive += (targetEmissive - currentEmissive) * 0.10;
      core.material.emissiveIntensity = currentEmissive;

      if (camera) {
        const distance = camera.position.distanceTo(core.position);
        const labelScale = THREE.MathUtils.clamp(1.25 - distance / 42, 0.58, 1);
        const labelOpacity = THREE.MathUtils.clamp(1.15 - distance / 48, 0.42, 1);
        labelEl.style.fontSize = `${11.5 * labelScale}px`;
        labelEl.style.opacity = labelOpacity;
      }
    });
  }

  for (let ei = 0; ei < data.edges.length; ei++) {
    const edge = data.edges[ei];
    const a = nodesById.get(edge.source);
    const b = nodesById.get(edge.target);
    if (!a || !b) {
      console.warn(`Edge ${edge.id}: missing endpoint`, edge);
      continue;
    }

    const aColor = new THREE.Color(a.node.color || "#00f0ff");
    const bColor = new THREE.Color(b.node.color || "#ff2d95");
    const edgeColor = aColor.clone().lerp(bColor, 0.5);
    const edgeHex = `#${edgeColor.getHexString()}`;

    const tube = new THREE.Mesh(
      CYLINDER_GEOM,
      new THREE.MeshBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    orientCylinder(tube, a.mesh.position, b.mesh.position, EDGE_RADIUS);
    tube.userData = {
      kind: "edge",
      edge,
      source: a.node,
      target: b.node,
    };
    scene.add(tube);
    edgeMeshes.push(tube);

    const NOTE_COUNT = 3;
    const start = a.mesh.position.clone();
    const end = b.mesh.position.clone();
    const lerped = new THREE.Vector3();
    const dirVec = new THREE.Vector3().subVectors(end, start).normalize();
    const perpRaw = new THREE.Vector3().crossVectors(dirVec, UP);
    if (perpRaw.lengthSq() < 1e-4) perpRaw.set(1, 0, 0);
    perpRaw.normalize();
    const bobAxis = perpRaw.clone().cross(dirVec).normalize();

    const noteColor = new THREE.Color(edgeHex);
    const notes = [];
    for (let k = 0; k < NOTE_COUNT; k++) {
      const sym = NOTE_SYMBOLS[(ei * 2 + k) % NOTE_SYMBOLS.length];
      const mat = new THREE.SpriteMaterial({
        map: getNoteTexture(sym),
        color: noteColor,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(0.72);
      scene.add(sprite);
      const lateralSign = k % 2 === 0 ? 1 : -1;
      const lateralAmt = 0.28 * Math.ceil(k / 2) * lateralSign;
      notes.push({ sprite, mat, baseT: k / NOTE_COUNT, bobPhase: k * 1.3, lateralAmt });
    }

    tickers.push((time) => {
      const drift = time * 0.028;
      for (const n of notes) {
        const t = ((n.baseT + drift) % 1 + 1) % 1;
        lerped.lerpVectors(start, end, t);
        const bob = Math.sin(time * 0.9 + n.bobPhase) * 0.12;
        lerped.addScaledVector(bobAxis, bob);
        lerped.addScaledVector(perpRaw, n.lateralAmt);
        n.sprite.position.copy(lerped);
        const fade = Math.sin(t * Math.PI);
        n.mat.opacity = 0.18 + fade * 0.82;
      }
    });
  }

  function tick(time) {
    for (const t of tickers) t(time);
  }

  function setInteractionState(next) {
    hoveredId = next?.hoveredId ?? null;
    selectedId = next?.selectedId ?? null;
  }

  return { nodeMeshes, edgeMeshes, nodesById, tick, setInteractionState };
}

function orientCylinder(mesh, a, b, radius) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mesh.position.copy(mid);
  mesh.scale.set(radius, len, radius);
  const axis = dir.clone().normalize();
  mesh.quaternion.setFromUnitVectors(UP, axis);
}
