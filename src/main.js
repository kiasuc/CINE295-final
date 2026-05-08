import * as THREE from "three";
import { createScene } from "./scene.js";
import { createStage } from "./stage.js";
import { buildGraph } from "./graph.js";
import { createParticleField } from "./particles.js";
import { pick } from "./picking.js";
import { focusOn, tickCameraTween } from "./camera.js";
import { initPanel, showNode, showEdge, hidePanel } from "./panel.js";
import data from "../data/graph.json";

const container = document.getElementById("canvas-root");
const { scene, camera, renderer, controls, composer, labelRenderer } =
  createScene(container);

const stage = createStage(scene);
const graphAPI = buildGraph(data, scene);
const { nodeMeshes, edgeMeshes, nodesById } = graphAPI;

const particles = createParticleField(scene, { count: 500, radius: 45 });

initPanel({ onJumpToNode: jumpToNode });

const dom = renderer.domElement;
let pointerDown = null;
let hoveredId = null;
let selectedId = null;
const DRAG_THRESHOLD = 5;

dom.addEventListener("pointerdown", (e) => {
  pointerDown = { x: e.clientX, y: e.clientY };
});

dom.addEventListener("pointerup", (e) => {
  if (!pointerDown) return;
  const dx = e.clientX - pointerDown.x;
  const dy = e.clientY - pointerDown.y;
  pointerDown = null;
  if (Math.hypot(dx, dy) > DRAG_THRESHOLD) return;
  handleClick(e);
});

dom.addEventListener("pointermove", (e) => {
  const nodeHit = pick(e, dom, camera, nodeMeshes);
  hoveredId = nodeHit ? nodeHit.object.userData.node.id : null;
  const hit = nodeHit || pick(e, dom, camera, edgeMeshes);
  dom.style.cursor = hit ? "pointer" : "grab";
});

function handleClick(e) {
  const nodeHit = pick(e, dom, camera, nodeMeshes);
  if (nodeHit) {
    const { node } = nodeHit.object.userData;
    selectedId = node.id;
    focusNode(node);
    showNode(node);
    return;
  }
  const edgeHit = pick(e, dom, camera, edgeMeshes);
  if (edgeHit) {
    const { edge, source, target } = edgeHit.object.userData;
    selectedId = null;
    focusEdge(source, target);
    showEdge(edge, source, target);
    return;
  }
  selectedId = null;
  hidePanel();
}

function focusNode(node) {
  focusOn({
    target: new THREE.Vector3().fromArray(node.position),
    distance: (node.radius ?? 1) * 5,
    camera,
    controls,
  });
}

function focusEdge(source, target) {
  const a = new THREE.Vector3().fromArray(source.position);
  const b = new THREE.Vector3().fromArray(target.position);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  focusOn({
    target: mid,
    distance: Math.max(len * 1.2, 4),
    camera,
    controls,
  });
}

function jumpToNode(id) {
  const entry = nodesById.get(id);
  if (!entry) return;
  selectedId = id;
  focusNode(entry.node);
  showNode(entry.node);
}

const clock = new THREE.Clock();
let elapsed = 0;

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  elapsed += dt;

  const tweening = tickCameraTween();
  if (!tweening) controls.update();

  stage.tick(elapsed);
  graphAPI.setInteractionState({ hoveredId, selectedId });
  graphAPI.tick(elapsed);
  particles.tick(elapsed);

  composer.render();
  labelRenderer.render(scene, camera);
});
