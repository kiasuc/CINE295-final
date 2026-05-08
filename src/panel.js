const el = {};

export function initPanel({ onJumpToNode, onClose }) {
  el.panel = document.getElementById("info-panel");
  el.kind = document.getElementById("panel-kind");
  el.title = document.getElementById("panel-title");
  el.meta = document.getElementById("panel-meta");
  el.body = document.getElementById("panel-body");
  el.links = document.getElementById("panel-links");
  el.close = document.getElementById("panel-close");

  el.close.addEventListener("click", () => {
    hidePanel();
    el.onClose?.();
  });
  el.onJumpToNode = onJumpToNode;
  el.onClose = onClose;
}

export function showNode(node) {
  el.kind.textContent = "Sphere";
  el.title.textContent = node.title;
  el.meta.textContent = `id: ${node.id}`;
  el.body.textContent = node.body || "";
  el.links.innerHTML = "";
  reveal();
}

export function showEdge(edge, source, target) {
  el.kind.textContent = "Connection";
  el.title.textContent = edge.label || `${source.title} → ${target.title}`;
  el.meta.textContent = `${source.title}  →  ${target.title}`;
  el.body.textContent = edge.body || "";

  el.links.innerHTML = "";
  appendLink(source);
  appendLink(target);

  reveal();
}

export function hidePanel() {
  el.panel.classList.add("hidden");
  el.panel.setAttribute("aria-hidden", "true");
}

function reveal() {
  el.panel.classList.remove("hidden");
  el.panel.setAttribute("aria-hidden", "false");
}

function appendLink(node) {
  const btn = document.createElement("button");
  btn.className = "panel-link";
  btn.textContent = node.title;
  btn.addEventListener("click", () => el.onJumpToNode?.(node.id));
  el.links.appendChild(btn);
}
