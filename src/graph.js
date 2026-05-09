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
const EDGE_HIT_RADIUS = 0.58;

const NOTE_SYMBOLS = ["♪", "♫", "♬", "♩"];

const BPM = 44;
const BEAT_HZ = BPM / 60;

function makeBloomColor(color, intensity = 1.45) {
  const glow = color.clone();
  const maxChannel = Math.max(glow.r, glow.g, glow.b);
  if (maxChannel > 0) glow.multiplyScalar(intensity / maxChannel);
  return glow;
}

export function buildGraph(data, scene, camera) {
  const nodesById = new Map();
  const nodeMeshes = [];
  const edgeMeshes = [];
  const tickers = [];
  let hoveredId = null;
  let hoveredEdgeId = null;
  let selectedId = null;
  let selectedEdgeId = null;

  for (let i = 0; i < data.nodes.length; i++) {
    const node = data.nodes[i];
    const color = new THREE.Color(node.color || "#00f0ff");
    const r = node.radius ?? 1;
    const phase = (i / data.nodes.length) * Math.PI * 2;

    // Normalize emissive to full brightness so intensity is the only variable
    const emissiveColor = makeBloomColor(color, 1);

    const core = new THREE.Mesh(
      CORE_GEOM,
      new THREE.MeshStandardMaterial({
        color,
        emissive: emissiveColor,
        emissiveIntensity: 0.74,
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
        color: makeBloomColor(color, 1.2),
        transparent: true,
        opacity: 0.36,
        blending: THREE.NormalBlending,
        depthWrite: false,
        wireframe: true,
        toneMapped: false,
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

    let currentEmissive = 0.74;
    let currentWireOpacity = 0.36;

    tickers.push((time) => {
      const beat = 0.5 + 0.5 * Math.sin(time * BEAT_HZ * Math.PI * 2 + phase);
      const isSelected = node.id === selectedId;
      const isHovered = !isSelected && node.id === hoveredId;
      const pulse = Math.sin(time * 2.4 + node.position[0]) * 0.04;

      const targetMul = isSelected ? 1.24 + pulse : isHovered ? 1.13 : 1.0;
      SCALE_TMP.setScalar(r * targetMul);
      core.scale.lerp(SCALE_TMP, 0.12);

      wire.rotation.y -= 0.008;
      const targetWireOpacity = isSelected ? 0.72 : isHovered ? 0.52 : 0.36;
      currentWireOpacity += (targetWireOpacity - currentWireOpacity) * 0.14;
      wire.material.opacity = currentWireOpacity;

      const targetEmissive = isSelected ? 1.45 + beat * 0.12 : isHovered ? 1.0 : 0.76 + beat * 0.08;
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
    const edgeGlowColor = makeBloomColor(edgeColor, 1.45);
    const edgeHex = `#${edgeColor.getHexString()}`;

    const tube = new THREE.Mesh(
      CYLINDER_GEOM,
      new THREE.MeshBasicMaterial({
        color: edgeGlowColor,
        transparent: true,
        opacity: 0.36,
        blending: THREE.NormalBlending,
        depthWrite: false,
        toneMapped: false,
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

    const hitTube = new THREE.Mesh(
      CYLINDER_GEOM,
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    orientCylinder(hitTube, a.mesh.position, b.mesh.position, EDGE_HIT_RADIUS);
    hitTube.userData = tube.userData;
    scene.add(hitTube);
    edgeMeshes.push(hitTube);

    let currentEdgeOpacity = 0.36;
    let currentEdgeRadius = EDGE_RADIUS;

    const NOTE_COUNT = 3;
    const start = a.mesh.position.clone();
    const end = b.mesh.position.clone();
    const lerped = new THREE.Vector3();
    const dirVec = new THREE.Vector3().subVectors(end, start).normalize();
    const perpRaw = new THREE.Vector3().crossVectors(dirVec, UP);
    if (perpRaw.lengthSq() < 1e-4) perpRaw.set(1, 0, 0);
    perpRaw.normalize();
    const bobAxis = perpRaw.clone().cross(dirVec).normalize();

    const noteColor = makeBloomColor(new THREE.Color(edgeHex), 1.55);
    const notes = [];
    for (let k = 0; k < NOTE_COUNT; k++) {
      const sym = NOTE_SYMBOLS[(ei * 2 + k) % NOTE_SYMBOLS.length];
      const mat = new THREE.SpriteMaterial({
        map: getNoteTexture(sym),
        color: noteColor,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        sizeAttenuation: true,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(0.72);
      scene.add(sprite);
      const lateralSign = k % 2 === 0 ? 1 : -1;
      const lateralAmt = 0.28 * Math.ceil(k / 2) * lateralSign;
      notes.push({ sprite, mat, baseT: k / NOTE_COUNT, bobPhase: k * 1.3, lateralAmt });
    }

    tickers.push((time) => {
      const isSelected = edge.id === selectedEdgeId;
      const isHovered = !isSelected && edge.id === hoveredEdgeId;
      const targetOpacity = isSelected ? 0.92 : isHovered ? 0.72 : 0.34;
      const targetRadius = EDGE_RADIUS * (isSelected ? 2.35 : isHovered ? 1.8 : 1);
      currentEdgeOpacity += (targetOpacity - currentEdgeOpacity) * 0.38;
      currentEdgeRadius += (targetRadius - currentEdgeRadius) * 0.38;
      tube.material.opacity = currentEdgeOpacity;
      tube.scale.x = currentEdgeRadius;
      tube.scale.z = currentEdgeRadius;

      const drift = time * 0.028;
      for (const n of notes) {
        const t = ((n.baseT + drift) % 1 + 1) % 1;
        lerped.lerpVectors(start, end, t);
        const bob = Math.sin(time * 0.9 + n.bobPhase) * 0.12;
        lerped.addScaledVector(bobAxis, bob);
        lerped.addScaledVector(perpRaw, n.lateralAmt);
        n.sprite.position.copy(lerped);
        const fade = Math.sin(t * Math.PI);
        const highlightBoost = isSelected ? 0.26 : isHovered ? 0.16 : 0;
        n.mat.opacity = Math.min(0.94, 0.2 + fade * 0.7 + highlightBoost);
        n.sprite.scale.setScalar(isSelected ? 0.95 : isHovered ? 0.92 : 0.72);
      }
    });
  }

  function tick(time) {
    for (const t of tickers) t(time);
  }

  function setInteractionState(next) {
    hoveredId = next?.hoveredId ?? null;
    hoveredEdgeId = next?.hoveredEdgeId ?? null;
    selectedId = next?.selectedId ?? null;
    selectedEdgeId = next?.selectedEdgeId ?? null;
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
