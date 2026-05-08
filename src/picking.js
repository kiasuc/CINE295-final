import * as THREE from "three";

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

export function eventToNdc(event, dom) {
  const rect = dom.getBoundingClientRect();
  ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  return ndc;
}

export function pick(event, dom, camera, candidates) {
  eventToNdc(event, dom);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(candidates, false);
  return hits.length ? hits[0] : null;
}
