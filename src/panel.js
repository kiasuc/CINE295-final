const el = {};

export function initPanel({ onJumpToNode, onJumpToEdge, onClose }) {
  el.panel = document.getElementById("info-panel");
  el.kind = document.getElementById("panel-kind");
  el.title = document.getElementById("panel-title");
  el.meta = document.getElementById("panel-meta");
  el.body = document.getElementById("panel-body");
  el.close = document.getElementById("panel-close");

  el.close.addEventListener("click", () => {
    hidePanel();
    el.onClose?.();
  });
  el.onJumpToNode = onJumpToNode;
  el.onJumpToEdge = onJumpToEdge;
  el.onClose = onClose;
}

export function showNode(node, relationships = []) {
  el.kind.textContent = "Role";
  el.title.textContent = node.title;
  el.meta.textContent = "Music business role";
  renderNodeBody(node, relationships);
  reveal();
}

export function showEdge(edge, source, target) {
  el.kind.textContent = "Industry Relationship";
  el.title.textContent = edge.label || `${source.title} to ${target.title}`;
  el.meta.textContent = "Connection between roles";
  renderEdgeBody(edge, source, target);

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

function renderNodeBody(node, relationships) {
  el.body.innerHTML = "";

  if (node.body) {
    const summary = document.createElement("p");
    summary.className = "panel-summary";
    summary.textContent = node.body;
    el.body.appendChild(summary);
  }

  const details = node.details;
  if (!details) return;

  const sections = [
    ["What they do", details.whatTheyDo],
    ["Why the artist needs them", details.whyArtistNeedsThem],
    ["When they get involved", details.whenTheyGetInvolved],
    ["Example decision", details.exampleDecision],
  ];

  const list = document.createElement("div");
  list.className = "panel-detail-list";

  for (const [label, value] of sections) {
    if (!value) continue;

    const item = document.createElement("section");
    item.className = "panel-detail";

    const heading = document.createElement("h2");
    heading.className = "panel-detail-label";
    heading.textContent = label;

    const text = document.createElement("p");
    text.textContent = value;

    item.append(heading, text);
    list.appendChild(item);
  }

  el.body.appendChild(list);
  appendRelationshipLinks(node, relationships);
}

function renderEdgeBody(edge, source, target) {
  el.body.innerHTML = "";

  const context = document.createElement("p");
  context.className = "panel-relationship-context";

  const sourceBtn = createInlineRoleButton(source);
  const targetBtn = createInlineRoleButton(target);
  const connector = document.createElement("span");
  connector.textContent = " connected to ";

  context.append(sourceBtn, connector, targetBtn);
  el.body.appendChild(context);

  if (edge.body) {
    const summary = document.createElement("p");
    summary.className = "panel-summary";
    summary.textContent = edge.body;
    el.body.appendChild(summary);
  }
}

function appendRelationshipLinks(node, relationships = []) {
  if (!relationships.length) return;

  const section = document.createElement("section");
  section.className = "panel-relationships";

  const heading = document.createElement("h2");
  heading.className = "panel-detail-label";
  heading.textContent = "Connected relationships";

  const list = document.createElement("div");
  list.className = "panel-relationship-list";

  for (const relationship of relationships) {
    const button = document.createElement("button");
    button.className = "panel-relationship-link";
    button.type = "button";
    button.setAttribute(
      "aria-label",
      `Open ${node.title} connected to ${relationship.other.title}: ${relationship.edge.label}`,
    );
    button.addEventListener("click", () => el.onJumpToEdge?.(relationship.edge.id));

    const title = document.createElement("span");
    title.className = "panel-relationship-title";
    title.textContent = `${node.title} connected to ${relationship.other.title}`;

    const label = document.createElement("span");
    label.className = "panel-relationship-label";
    label.textContent = relationship.edge.label || "relationship";

    button.append(title, label);
    list.appendChild(button);
  }

  section.append(heading, list);
  el.body.appendChild(section);
}

function createInlineRoleButton(node) {
  const btn = document.createElement("button");
  btn.className = "panel-inline-role";
  btn.type = "button";
  btn.textContent = node.title;
  btn.addEventListener("click", () => el.onJumpToNode?.(node.id));
  return btn;
}
