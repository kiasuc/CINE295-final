import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a);
  scene.fog = new THREE.FogExp2(0x05060a, 0.012);

  const camera = new THREE.PerspectiveCamera(
    58,
    container.clientWidth / container.clientHeight,
    0.1,
    600,
  );
  camera.position.set(0, 3, 30);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  container.appendChild(renderer.domElement);

  const ambient = new THREE.AmbientLight(0x223044, 0.5);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xff77c5, 0.55);
  key.position.set(8, 14, 8);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x66c8ff, 0.55);
  fill.position.set(-9, 6, 6);
  scene.add(fill);

  const back = new THREE.DirectionalLight(0xb284ff, 0.35);
  back.position.set(0, 10, -20);
  scene.add(back);

  const stageGlow = new THREE.PointLight(0xff2d95, 1.78, 68, 1.25);
  stageGlow.position.set(0, -3, -18);
  scene.add(stageGlow);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 6;
  controls.maxDistance = 55;
  controls.maxPolarAngle = Math.PI * 0.58;
  controls.target.set(0, 1.5, 0);
  controls.rotateSpeed = 0.7;

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.setSize(container.clientWidth, container.clientHeight);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(container.clientWidth, container.clientHeight),
    0.62,
    0.52,
    0.62,
  );
  composer.addPass(bloomPass);

  composer.addPass(new OutputPass());

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.top = "0";
  labelRenderer.domElement.style.left = "0";
  labelRenderer.domElement.style.pointerEvents = "none";
  labelRenderer.domElement.style.zIndex = "2";
  container.appendChild(labelRenderer.domElement);

  window.addEventListener("resize", () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloomPass.setSize(w, h);
    labelRenderer.setSize(w, h);
  });

  return { scene, camera, renderer, controls, composer, bloomPass, labelRenderer };
}
