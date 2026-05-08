import * as THREE from "three";

let active = null;

export function focusOn({ target, distance, camera, controls, duration = 700 }) {
  const fromTarget = controls.target.clone();
  const fromPos = camera.position.clone();

  const dir = new THREE.Vector3().subVectors(camera.position, controls.target);
  if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  dir.normalize();

  const toTarget = target.clone();
  const toPos = toTarget.clone().add(dir.multiplyScalar(distance));

  active = {
    start: performance.now(),
    duration,
    fromTarget,
    fromPos,
    toTarget,
    toPos,
    camera,
    controls,
  };
}

export function tickCameraTween(now = performance.now()) {
  if (!active) return false;
  const t = Math.min(1, (now - active.start) / active.duration);
  const e = easeInOutCubic(t);

  active.camera.position.lerpVectors(active.fromPos, active.toPos, e);
  active.controls.target.lerpVectors(active.fromTarget, active.toTarget, e);
  active.controls.update();

  if (t >= 1) {
    active = null;
    return false;
  }
  return true;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
