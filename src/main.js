import * as THREE from "three";
import { createScene } from "./scene.js";
import { createStage } from "./stage.js";
import { buildGraph } from "./graph.js";
import { createParticleField } from "./particles.js";
import { pick } from "./picking.js";
import { focusOn, resetCamera, tickCameraTween } from "./camera.js";
import { initPanel, showNode, showEdge, hidePanel } from "./panel.js";
import data from "../data/graph.json";

const container = document.getElementById("canvas-root");
const { scene, camera, renderer, controls, composer, bloomPass, labelRenderer } =
  createScene(container);

const BLOOM_STRENGTH = bloomPass.strength;
const BLOOM_MOVING = BLOOM_STRENGTH * 0.35;
let bloomTarget = BLOOM_STRENGTH;
let bloomSettleTimer = null;
controls.addEventListener("start", () => {
  bloomTarget = BLOOM_MOVING;
  clearTimeout(bloomSettleTimer);
});
controls.addEventListener("end", () => {
  clearTimeout(bloomSettleTimer);
  bloomSettleTimer = setTimeout(() => {
    bloomTarget = BLOOM_STRENGTH;
  }, 120);
});

const stage = createStage(scene);
const graphAPI = buildGraph(data, scene, camera);
const { nodeMeshes, edgeMeshes, nodesById } = graphAPI;
const relationshipsByNodeId = createRelationshipIndex(data, nodesById);
const relationshipsById = createRelationshipLookup(data, nodesById);

const particles = createParticleField(scene, { count: 250, radius: 45 });

initPanel({ onJumpToNode: jumpToNode, onJumpToEdge: jumpToEdge, onClose: resetView });

// Influences overlay
const influencesOverlay = document.getElementById("influences-overlay");
const influencesClose = document.getElementById("influences-close");
const influencesOpen = document.getElementById("influences-open");
const introInfluences = document.getElementById("intro-influences");

function openInfluences() {
  influencesOverlay.classList.remove("hidden");
  influencesOverlay.removeAttribute("aria-hidden");
}
function closeInfluences() {
  influencesOverlay.classList.add("hidden");
  influencesOverlay.setAttribute("aria-hidden", "true");
}

influencesOpen.addEventListener("click", openInfluences);
introInfluences.addEventListener("click", openInfluences);
influencesClose.addEventListener("click", closeInfluences);
influencesOverlay.addEventListener("click", (e) => {
  if (e.target === influencesOverlay) closeInfluences();
});
initIntroOverlay();
initCatalogOverlay();

const dom = renderer.domElement;
let pointerDown = null;
let hoveredId = null;
let hoveredEdgeId = null;
let selectedId = null;
let selectedEdgeId = null;
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

let lastPickTime = 0;
dom.addEventListener("pointermove", (e) => {
  const now = performance.now();
  if (now - lastPickTime < 16) return;
  lastPickTime = now;
  const nodeHit = pick(e, dom, camera, nodeMeshes);
  hoveredId = nodeHit ? nodeHit.object.userData.node.id : null;
  const edgeHit = nodeHit ? null : pick(e, dom, camera, edgeMeshes);
  hoveredEdgeId = edgeHit ? edgeHit.object.userData.edge.id : null;
  const hit = nodeHit || edgeHit;
  dom.style.cursor = hit ? "pointer" : "grab";
});

function handleClick(e) {
  const nodeHit = pick(e, dom, camera, nodeMeshes);
  if (nodeHit) {
    const { node } = nodeHit.object.userData;
    selectedId = node.id;
    selectedEdgeId = null;
    focusNode(node);
    showNode(node, relationshipsByNodeId.get(node.id));
    return;
  }
  const edgeHit = pick(e, dom, camera, edgeMeshes);
  if (edgeHit) {
    const { edge, source, target } = edgeHit.object.userData;
    selectedId = null;
    selectedEdgeId = edge.id;
    focusEdge(source, target);
    showEdge(edge, source, target);
    return;
  }
  selectedId = null;
  selectedEdgeId = null;
  hidePanel();
  resetView();
}

function focusNode(node) {
  const distance = (node.radius ?? 1) * 5;
  focusOn({
    target: new THREE.Vector3().fromArray(node.position),
    distance,
    camera,
    controls,
    compositionOffset: getOpenSidebarCompositionOffset(distance),
  });
}

function focusEdge(source, target) {
  const a = new THREE.Vector3().fromArray(source.position);
  const b = new THREE.Vector3().fromArray(target.position);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const len = a.distanceTo(b);
  const distance = Math.max(len * 1.2, 4);
  focusOn({
    target: mid,
    distance,
    camera,
    controls,
    compositionOffset: getOpenSidebarCompositionOffset(distance),
  });
}

function jumpToNode(id) {
  const entry = nodesById.get(id);
  if (!entry) return;
  selectedId = id;
  selectedEdgeId = null;
  focusNode(entry.node);
  showNode(entry.node, relationshipsByNodeId.get(id));
}

function jumpToEdge(id) {
  const relationship = relationshipsById.get(id);
  if (!relationship) return;
  selectedId = null;
  selectedEdgeId = id;
  focusEdge(relationship.source, relationship.target);
  showEdge(relationship.edge, relationship.source, relationship.target);
}

function resetView() {
  selectedId = null;
  selectedEdgeId = null;
  resetCamera({ camera, controls });
}

function getOpenSidebarCompositionOffset(distance) {
  const panel = document.getElementById("info-panel");
  if (!panel) return new THREE.Vector3();

  const panelWidth = panel.getBoundingClientRect().width;
  const viewportWidth = window.innerWidth || container.clientWidth;
  if (!panelWidth || !viewportWidth) return new THREE.Vector3();

  const halfViewWidth =
    Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5)) * distance * camera.aspect;
  const offsetAmount = (panelWidth / viewportWidth) * halfViewWidth;
  return new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(offsetAmount);
}

function initIntroOverlay() {
  const overlay = document.getElementById("intro-overlay");
  const start = document.getElementById("intro-start");
  const counts = document.getElementById("intro-counts");
  if (!overlay || !start) return;

  if (counts) {
    counts.textContent = `${data.nodes.length} roles and ${data.edges.length} relationships covered`;
  }

  start.addEventListener("click", () => {
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
  });
}

function initCatalogOverlay() {
  const overlay = document.getElementById("catalog-overlay");
  const open = document.getElementById("catalog-open");
  const close = document.getElementById("catalog-close");
  const summary = document.getElementById("catalog-summary");
  const nodeList = document.getElementById("catalog-nodes");
  const relationshipList = document.getElementById("catalog-relationships");
  if (!overlay || !open || !close || !summary || !nodeList || !relationshipList) return;

  summary.textContent = `${data.nodes.length} roles and ${data.edges.length} relationships are represented in this map. Select any item to open it in the sidebar.`;
  renderCatalogNodes(nodeList);
  renderCatalogRelationships(relationshipList);

  open.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
  });

  close.addEventListener("click", () => hideCatalogOverlay());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) hideCatalogOverlay();
  });
}

function hideCatalogOverlay() {
  const overlay = document.getElementById("catalog-overlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
}

function renderCatalogNodes(containerEl) {
  for (const node of [...data.nodes].sort((a, b) => a.title.localeCompare(b.title))) {
    const button = document.createElement("button");
    button.className = "catalog-item";
    button.type = "button";
    button.addEventListener("click", () => {
      hideCatalogOverlay();
      jumpToNode(node.id);
    });

    const title = document.createElement("span");
    title.className = "catalog-item-title";
    title.textContent = node.title;

    const body = document.createElement("span");
    body.className = "catalog-item-body";
    body.textContent = node.body;

    button.append(title, body);
    containerEl.appendChild(button);
  }
}

function renderCatalogRelationships(containerEl) {
  const relationships = [...relationshipsById.values()].sort((a, b) => {
    const aLabel = `${a.source.title} ${a.target.title}`;
    const bLabel = `${b.source.title} ${b.target.title}`;
    return aLabel.localeCompare(bLabel);
  });

  for (const { edge, source, target } of relationships) {
    const button = document.createElement("button");
    button.className = "catalog-item";
    button.type = "button";
    button.addEventListener("click", () => {
      hideCatalogOverlay();
      jumpToEdge(edge.id);
    });

    const title = document.createElement("span");
    title.className = "catalog-item-title";
    title.textContent = `${source.title} connected to ${target.title}`;

    const label = document.createElement("span");
    label.className = "catalog-item-kicker";
    label.textContent = edge.label;

    const body = document.createElement("span");
    body.className = "catalog-item-body";
    body.textContent = edge.body;

    button.append(title, label, body);
    containerEl.appendChild(button);
  }
}

function createRelationshipIndex(graphData, nodeLookup) {
  const byNodeId = new Map();

  for (const edge of graphData.edges) {
    const source = nodeLookup.get(edge.source)?.node;
    const target = nodeLookup.get(edge.target)?.node;
    if (!source || !target) continue;

    const sourceRelationship = { edge, source, target, other: target };
    const targetRelationship = { edge, source, target, other: source };

    if (!byNodeId.has(source.id)) byNodeId.set(source.id, []);
    if (!byNodeId.has(target.id)) byNodeId.set(target.id, []);

    byNodeId.get(source.id).push(sourceRelationship);
    byNodeId.get(target.id).push(targetRelationship);
  }

  for (const relationships of byNodeId.values()) {
    relationships.sort((a, b) => a.other.title.localeCompare(b.other.title));
  }

  return byNodeId;
}

function createRelationshipLookup(graphData, nodeLookup) {
  const byId = new Map();

  for (const edge of graphData.edges) {
    const source = nodeLookup.get(edge.source)?.node;
    const target = nodeLookup.get(edge.target)?.node;
    if (!source || !target) continue;
    byId.set(edge.id, { edge, source, target });
  }

  return byId;
}

const clock = new THREE.Clock();
let elapsed = 0;

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  elapsed += dt;

  const tweening = tickCameraTween();
  if (!tweening) controls.update();

  stage.tick(elapsed);
  graphAPI.setInteractionState({ hoveredId, hoveredEdgeId, selectedId, selectedEdgeId });
  graphAPI.tick(elapsed);
  particles.tick(elapsed);

  bloomPass.strength += (bloomTarget - bloomPass.strength) * 0.14;
  composer.render();
  labelRenderer.render(scene, camera);
});
