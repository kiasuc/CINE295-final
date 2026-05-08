import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";

const CORE_GEOM = new THREE.IcosahedronGeometry(1, 3);
const WIRE_GEOM = new THREE.IcosahedronGeometry(1.08, 2);
const CYLINDER_GEOM = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true);
const UP = new THREE.Vector3(0, 1, 0);
const SCALE_TMP = new THREE.Vector3();

const NOTE_SYMBOLS = ["♪", "♫", "♬", "♩"];

const BPM = 44;
const BEAT_HZ = BPM / 60;

export function buildGraph(data, scene) {
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

    const core = new THREE.Mesh(
      CORE_GEOM,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
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

    tickers.push((time) => {
      const beat = 0.5 + 0.5 * Math.sin(time * BEAT_HZ * Math.PI * 2 + phase);
      const isSelected = node.id === selectedId;
      const isHovered = !isSelected && node.id === hoveredId;
      const pulse = Math.sin(time * 2.4 + node.position[0]) * 0.04;

      const targetMul = isSelected ? 1.24 + pulse : isHovered ? 1.13 : 1.0;
      SCALE_TMP.setScalar(r * targetMul);
      core.scale.lerp(SCALE_TMP, 0.12);

      wire.rotation.y -= 0.008;
      wire.material.opacity = isSelected ? 0.72 : isHovered ? 0.5 : 0.28;

      const baseEmissive = isSelected ? 1.75 : isHovered ? 1.18 : 0.7;
      core.material.emissiveIntensity = baseEmissive + beat * 0.12;
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
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    orientCylinder(tube, a.mesh.position, b.mesh.position, 0.035);
    tube.userData = {
      kind: "edge",
      edge,
      source: a.node,
      target: b.node,
    };
    scene.add(tube);
    edgeMeshes.push(tube);

    const NOTE_COUNT = 5;
    const start = a.mesh.position.clone();
    const end = b.mesh.position.clone();
    const lerped = new THREE.Vector3();
    const dirVec = new THREE.Vector3().subVectors(end, start).normalize();
    const perpRaw = new THREE.Vector3().crossVectors(dirVec, UP);
    if (perpRaw.lengthSq() < 1e-4) perpRaw.set(1, 0, 0);
    const bobAxis = perpRaw.clone().cross(dirVec).normalize();

    const notes = [];
    for (let k = 0; k < NOTE_COUNT; k++) {
      const sym = NOTE_SYMBOLS[(ei * 2 + k) % NOTE_SYMBOLS.length];
      const el = document.createElement("div");
      el.className = "edge-note";
      el.textContent = sym;
      el.style.color = edgeHex;
      const obj = new CSS2DObject(el);
      scene.add(obj);
      notes.push({ obj, el, baseT: k / NOTE_COUNT, bobPhase: k * 1.3 });
    }

    tickers.push((time) => {
      const drift = time * 0.028;
      for (const n of notes) {
        const t = ((n.baseT + drift) % 1 + 1) % 1;
        lerped.lerpVectors(start, end, t);
        const bob = Math.sin(time * 0.9 + n.bobPhase) * 0.14;
        lerped.addScaledVector(bobAxis, bob);
        n.obj.position.copy(lerped);
        const fade = Math.sin(t * Math.PI);
        n.el.style.opacity = (0.18 + fade * 0.82).toFixed(2);
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
