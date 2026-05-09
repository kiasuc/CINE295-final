import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);

function makeBloomColor(colorValue, intensity = 1.55) {
  const glow = new THREE.Color(colorValue);
  const maxChannel = Math.max(glow.r, glow.g, glow.b);
  if (maxChannel > 0) glow.multiplyScalar(intensity / maxChannel);
  return glow;
}

export function createStage(scene) {
  const root = new THREE.Group();
  root.name = "stage";
  scene.add(root);

  const tickers = [];

  buildFloor(root);
  buildBackWall(root);
  const ledMat = buildLedScreen(root);
  buildSideLeds(root);
  buildTrusses(root);
  const heads = buildMovingHeads(root);
  buildTrussParCans(root);
  buildHangingSpeakers(root);
  buildSubwoofers(root);
  buildBackLamps(root);
  buildStageMonitors(root);
  buildDjBooth(root);
  buildCrowd(root);

  tickers.push((time) => {
    ledMat.uniforms.uTime.value = time;
    for (let i = 0; i < heads.length; i++) {
      const h = heads[i];
      const swayZ = Math.sin(time * 0.20 + h.phase) * 0.18;
      const swayX = Math.sin(time * 0.16 + h.phase * 1.4) * 0.10;
      h.body.rotation.z = h.baseTilt + swayZ;
      h.body.rotation.x = h.basePan + swayX;
      const pulse = 0.5 + 0.5 * Math.sin(time * 0.28 + h.phase * 1.7);
      h.beam.material.opacity = h.beamBaseOpacity + pulse * 0.18;
      h.beamHalo.material.opacity = h.haloBaseOpacity + pulse * 0.1;
    }
  });

  return { root, tick: (t) => tickers.forEach((fn) => fn(t)) };
}

function buildFloor(root) {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 90),
    new THREE.MeshStandardMaterial({
      color: 0x070910,
      roughness: 0.55,
      metalness: 0.7,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -8;
  root.add(floor);

  const grid = new THREE.GridHelper(140, 70, 0x1f4f7a, 0x10141d);
  grid.position.y = -7.985;
  grid.material.transparent = true;
  grid.material.opacity = 0.32;
  grid.material.depthWrite = false;
  root.add(grid);

  const edgeStrip = new THREE.Mesh(
    new THREE.BoxGeometry(46, 0.08, 0.18),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
  );
  edgeStrip.position.set(0, -7.85, 11);
  root.add(edgeStrip);

  const edgeStripBack = edgeStrip.clone();
  edgeStripBack.material = new THREE.MeshBasicMaterial({ color: 0xff2d95 });
  edgeStripBack.position.set(0, -7.85, -23.6);
  root.add(edgeStripBack);
}

function buildBackWall(root) {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(96, 42),
    new THREE.MeshStandardMaterial({
      color: 0x05060b,
      roughness: 0.9,
      metalness: 0.1,
    }),
  );
  wall.position.set(0, 6, -24);
  root.add(wall);
}

function buildLedScreen(root) {
  const W = 36;
  const H = 17;
  const screenMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uAspect: { value: W / H },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uAspect;

      void main() {
        vec3 top = vec3(0.04, 0.62, 0.95);
        vec3 mid = vec3(0.46, 0.10, 0.78);
        vec3 bot = vec3(0.95, 0.16, 0.52);
        float t = vUv.y;
        vec3 col = mix(top, mid, smoothstep(0.0, 0.55, t));
        col = mix(col, bot, smoothstep(0.45, 1.0, t));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), screenMat);
  screen.position.set(0, 6, -23.85);
  root.add(screen);

  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.6, H + 0.6),
    new THREE.MeshStandardMaterial({
      color: 0x0a0c14,
      roughness: 0.4,
      metalness: 0.7,
    }),
  );
  frame.position.set(0, 6, -23.92);
  root.add(frame);

  return screenMat;
}

function buildTrusses(root) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x3a4055,
    roughness: 0.35,
    metalness: 0.8,
    emissive: 0x1a2030,
    emissiveIntensity: 0.6,
  });

  const left = makeTrussSegment(28, mat);
  left.position.set(-20, 6, -22);
  root.add(left);

  const right = makeTrussSegment(28, mat);
  right.position.set(20, 6, -22);
  root.add(right);

  const top = makeTrussSegment(42, mat);
  top.rotation.z = Math.PI / 2;
  top.position.set(0, 20, -22);
  root.add(top);
}

function makeTrussSegment(length, mat) {
  const group = new THREE.Group();
  const w = 0.85;
  const r = 0.07;

  const chordGeom = new THREE.CylinderGeometry(r, r, length, 8);
  for (const [dx, dz] of [
    [-w / 2, -w / 2],
    [w / 2, -w / 2],
    [-w / 2, w / 2],
    [w / 2, w / 2],
  ]) {
    const m = new THREE.Mesh(chordGeom, mat);
    m.position.set(dx, 0, dz);
    group.add(m);
  }

  const segs = Math.max(6, Math.floor(length / 1.4));
  const segLen = length / segs;
  for (let i = 0; i <= segs; i++) {
    const y = -length / 2 + i * segLen;
    addTube(group, mat, [-w / 2, y, -w / 2], [w / 2, y, -w / 2], r * 0.65);
    addTube(group, mat, [-w / 2, y, w / 2], [w / 2, y, w / 2], r * 0.65);
    addTube(group, mat, [-w / 2, y, -w / 2], [-w / 2, y, w / 2], r * 0.65);
    addTube(group, mat, [w / 2, y, -w / 2], [w / 2, y, w / 2], r * 0.65);
  }
  for (let i = 0; i < segs; i++) {
    const y0 = -length / 2 + i * segLen;
    const y1 = y0 + segLen;
    const flip = i % 2 === 0;
    if (flip) {
      addTube(group, mat, [-w / 2, y0, -w / 2], [-w / 2, y1, w / 2], r * 0.55);
      addTube(group, mat, [w / 2, y0, w / 2], [w / 2, y1, -w / 2], r * 0.55);
    } else {
      addTube(group, mat, [-w / 2, y0, w / 2], [-w / 2, y1, -w / 2], r * 0.55);
      addTube(group, mat, [w / 2, y0, -w / 2], [w / 2, y1, w / 2], r * 0.55);
    }
  }

  return group;
}

function addTube(group, mat, fromArr, toArr, radius) {
  const a = new THREE.Vector3().fromArray(fromArr);
  const b = new THREE.Vector3().fromArray(toArr);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geom = new THREE.CylinderGeometry(radius, radius, len, 6);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
  group.add(mesh);
}

function buildMovingHeads(root) {
  const specs = [
    { x: -17, tilt: -0.34, pan: 0.06, color: 0x00f0ff },
    { x: -10.2, tilt: -0.18, pan: -0.05, color: 0xb026ff },
    { x: -3.5, tilt: -0.05, pan: 0.04, color: 0xff2d95 },
    { x: 3.5, tilt: 0.05, pan: -0.04, color: 0x6cffd0 },
    { x: 10.2, tilt: 0.18, pan: 0.05, color: 0xffb24e },
    { x: 17, tilt: 0.34, pan: -0.06, color: 0x4ed8ff },
  ];

  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x05060a,
    roughness: 0.4,
    metalness: 0.85,
  });

  const heads = [];

  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];

    const group = new THREE.Group();
    group.position.set(s.x, 17.6, -19);

    const yoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.42, 0.55),
      housingMat,
    );
    yoke.position.y = 0.42;
    group.add(yoke);

    const body = new THREE.Group();

    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.95, 18),
      housingMat,
    );
    body.add(housing);

    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 22),
      new THREE.MeshBasicMaterial({
        color: makeBloomColor(s.color, 1.45),
        transparent: true,
        opacity: 0.95,
        toneMapped: false,
      }),
    );
    lens.position.y = -0.48;
    lens.rotation.x = -Math.PI / 2;
    body.add(lens);

    const lensHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 16, 12),
      new THREE.MeshBasicMaterial({
        color: makeBloomColor(s.color, 1.8),
        transparent: true,
        opacity: 0.58,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    lensHalo.position.y = -0.45;
    body.add(lensHalo);

    const beamLength = 24;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.13, beamLength, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: makeBloomColor(s.color, 1.7),
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    beam.position.y = -beamLength / 2 - 0.5;
    body.add(beam);

    const beamHalo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.34, beamLength, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: makeBloomColor(s.color, 1.85),
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    beamHalo.position.y = -beamLength / 2 - 0.5;
    body.add(beamHalo);

    body.rotation.z = s.tilt;
    body.rotation.x = s.pan;
    group.add(body);

    root.add(group);

    heads.push({
      body,
      beam,
      beamHalo,
      baseTilt: s.tilt,
      basePan: s.pan,
      phase: i * 0.85,
      beamBaseOpacity: 0.58,
      haloBaseOpacity: 0.26,
    });
  }
  return heads;
}

function buildHangingSpeakers(root) {
  const cabMat = new THREE.MeshStandardMaterial({
    color: 0x0b0d14,
    roughness: 0.7,
    metalness: 0.3,
  });
  const grilleMat = new THREE.MeshStandardMaterial({
    color: 0x05060a,
    roughness: 0.9,
    metalness: 0.1,
  });
  const rigMat = new THREE.MeshStandardMaterial({
    color: 0x2a2e3a,
    roughness: 0.5,
    metalness: 0.85,
  });

  const COUNT = 6;
  const TOP_Y = 19.4;
  for (const sx of [-15, 15]) {
    // Suspension cables to the truss
    for (const dx of [-0.7, 0.7]) {
      const cable = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 4.2, 6),
        rigMat,
      );
      cable.position.set(sx + dx, TOP_Y - 1.6, -19);
      root.add(cable);
    }

    let y = TOP_Y - 3.6;
    for (let i = 0; i < COUNT; i++) {
      // Each cab tilts slightly more downward as we go down the array
      const tilt = 0.08 + i * 0.06;
      const h = 0.7;
      const w = 2.2 - i * 0.05;

      const cab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.4), cabMat);
      cab.position.set(sx, y, -19);
      cab.rotation.x = tilt;
      root.add(cab);

      const grille = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.92, h * 0.8, 0.04),
        grilleMat,
      );
      grille.position.set(sx, y - Math.sin(tilt) * 0.7, -19 + Math.cos(tilt) * 0.72);
      grille.rotation.x = tilt;
      root.add(grille);

      y -= h + 0.05;
    }
  }
}

function buildBackLamps(root) {
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xff7a00 });
  for (let i = 0; i < 7; i++) {
    const x = -18 + i * 6;
    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 8),
      lampMat,
    );
    lamp.position.set(x, 19.6, -22);
    root.add(lamp);
  }
}

function buildSideLeds(root) {
  const tex = makeSideLedTexture();
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: false,
    opacity: 1.0,
    toneMapped: false,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.94,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c14,
    roughness: 0.4,
    metalness: 0.7,
  });
  for (const x of [-22, 22]) {
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 17), mat);
    screen.position.set(x, 5.5, -23.85);
    if (x < 0) screen.scale.x = -1;
    root.add(screen);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 17), glowMat);
    glow.position.set(x, 5.5, -23.83);
    if (x < 0) glow.scale.x = -1;
    root.add(glow);

    const frame = new THREE.Mesh(new THREE.PlaneGeometry(5.9, 17.5), frameMat);
    frame.position.set(x, 5.5, -23.92);
    root.add(frame);
  }
}

function buildTrussParCans(root) {
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c12,
    roughness: 0.45,
    metalness: 0.7,
  });
  const lensColors = [0x00f0ff, 0xff2d95, 0xb026ff, 0xffb24e, 0x6cffd0];

  for (let i = 0; i < 11; i++) {
    const x = -19 + i * 3.8;
    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.7, 16),
      housingMat,
    );
    housing.rotation.x = Math.PI;
    housing.position.set(x, 18.4, -21.2);
    root.add(housing);

    const yoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.5, 0.7),
      housingMat,
    );
    yoke.position.set(x, 19.0, -21.2);
    root.add(yoke);

    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.26, 18),
      new THREE.MeshBasicMaterial({
        color: lensColors[i % lensColors.length],
        transparent: true,
        opacity: 0.85,
      }),
    );
    lens.position.set(x, 18.04, -21.2);
    lens.rotation.x = Math.PI / 2;
    root.add(lens);
  }
}

function buildSubwoofers(root) {
  const subMat = new THREE.MeshStandardMaterial({
    color: 0x07090f,
    roughness: 0.85,
    metalness: 0.15,
  });
  const grilleMat = new THREE.MeshStandardMaterial({
    color: 0x03040a,
    roughness: 0.95,
    metalness: 0.05,
  });
  const SUB_Z = -20.0;
  for (const sx of [-15, -9, 9, 15]) {
    const sub = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 2.4), subMat);
    // Subs face the audience (+z): grille on +z side
    sub.position.set(sx, -7.1, SUB_Z);
    root.add(sub);

    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 1.5, 0.05),
      grilleMat,
    );
    grille.position.set(sx, -7.1, SUB_Z + 1.23);
    root.add(grille);
  }

  // Crowd barrier — between back row of crowd (z ≈ -18) and the DJ stage / subs (z ≈ -19.3)
  const barrierMat = new THREE.MeshStandardMaterial({
    color: 0x14171f,
    roughness: 0.5,
    metalness: 0.6,
  });
  const railMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
  const BARRIER_Z = -18.7;
  const BARRIER_HALF_W = 22;
  const barrier = new THREE.Mesh(
    new THREE.BoxGeometry(BARRIER_HALF_W * 2, 1.0, 0.18),
    barrierMat,
  );
  barrier.position.set(0, -7.5, BARRIER_Z);
  root.add(barrier);

  const topRail = new THREE.Mesh(
    new THREE.BoxGeometry(BARRIER_HALF_W * 2, 0.06, 0.06),
    railMat,
  );
  topRail.position.set(0, -7.0, BARRIER_Z);
  root.add(topRail);

  // Vertical posts every 2.5 units
  const postMat = new THREE.MeshStandardMaterial({
    color: 0x2a2e3a,
    roughness: 0.5,
    metalness: 0.85,
  });
  for (let x = -BARRIER_HALF_W; x <= BARRIER_HALF_W; x += 2.5) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6),
      postMat,
    );
    post.position.set(x, -7.45, BARRIER_Z);
    root.add(post);
  }
}

function buildStageMonitors(root) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x0a0c14,
    roughness: 0.7,
    metalness: 0.3,
  });
  const grilleMat = new THREE.MeshStandardMaterial({
    color: 0x05060a,
    roughness: 0.95,
    metalness: 0.05,
  });
  for (const x of [-15, -8, -2.5, 2.5, 8, 15]) {
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.95, 1.4), mat);
    wedge.position.set(x, -7.45, 9.6);
    wedge.rotation.x = -0.45;
    root.add(wedge);

    const grille = new THREE.Mesh(
      new THREE.BoxGeometry(1.95, 0.7, 0.04),
      grilleMat,
    );
    grille.position.set(x, -7.05, 10.2);
    grille.rotation.x = -0.45;
    root.add(grille);
  }
}

function buildDjBooth(root) {
  const Z = -22;

  const boothMat = new THREE.MeshStandardMaterial({
    color: 0x0c0e16,
    roughness: 0.4,
    metalness: 0.55,
  });

  // Riser platform under the booth — anchors it to the stage floor
  const riserMat = new THREE.MeshStandardMaterial({
    color: 0x080a10,
    roughness: 0.55,
    metalness: 0.55,
  });
  const riser = new THREE.Mesh(
    new THREE.BoxGeometry(11, 0.6, 4.8),
    riserMat,
  );
  riser.position.set(0, -7.7, Z);
  root.add(riser);

  // Riser front lip glow strip
  const riserLip = new THREE.Mesh(
    new THREE.BoxGeometry(11.05, 0.05, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff2d95 }),
  );
  riserLip.position.set(0, -7.4, Z + 2.42);
  root.add(riserLip);

  // Booth body
  const base = new THREE.Mesh(new THREE.BoxGeometry(7.5, 1.9, 2.4), boothMat);
  base.position.set(0, -6.45, Z);
  root.add(base);

  // Front face panel — dark with thin cyan accent line, no text
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 1.55),
    new THREE.MeshStandardMaterial({
      color: 0x05070d,
      roughness: 0.6,
      metalness: 0.55,
    }),
  );
  face.position.set(0, -6.45, Z + 1.21);
  root.add(face);

  // Thin cyan light strip on the lower part of the face
  const accentStrip = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 0.05, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
  );
  accentStrip.position.set(0, -6.95, Z + 1.22);
  root.add(accentStrip);

  // Top lip glow
  const topLip = new THREE.Mesh(
    new THREE.BoxGeometry(7.6, 0.04, 0.1),
    new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
  );
  topLip.position.set(0, -5.45, Z + 1.2);
  root.add(topLip);

  // Mixer deck on top
  const deckMat = new THREE.MeshStandardMaterial({
    color: 0x101218,
    roughness: 0.45,
    metalness: 0.65,
  });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.18, 1.8), deckMat);
  deck.position.set(0, -5.4, Z);
  root.add(deck);

  // Turntable platters
  const platterMat = new THREE.MeshStandardMaterial({
    color: 0x1a1d28,
    roughness: 0.3,
    metalness: 0.85,
  });
  for (const px of [-2.0, 2.0]) {
    const platter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.08, 24),
      platterMat,
    );
    platter.position.set(px, -5.27, Z);
    root.add(platter);
  }

  // Center mixer screen
  const mixerScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 0.7),
    new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.8,
    }),
  );
  mixerScreen.position.set(0, -4.95, Z);
  mixerScreen.rotation.x = -0.3;
  root.add(mixerScreen);
}

function buildCrowd(root) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x14171f,
    roughness: 0.7,
    metalness: 0.15,
    emissive: 0x080a14,
    emissiveIntensity: 0.4,
  });
  const headGeom = new THREE.SphereGeometry(0.18, 8, 6);
  const bodyGeom = new THREE.CylinderGeometry(0.2, 0.28, 0.95, 8);
  const armGeom = new THREE.CylinderGeometry(0.045, 0.045, 0.7, 6);
  const phoneGeom = new THREE.SphereGeometry(0.055, 8, 6);
  const phoneColors = [0xffffff, 0xffe9a0, 0xa0e9ff];

  const rows = [
    { z: 10.0, density: 0.5, scale: 0.85 },
    { z: 8.0, density: 0.6, scale: 0.86 },
    { z: 6.0, density: 0.7, scale: 0.88 },
    { z: 4.0, density: 0.8, scale: 0.9 },
    { z: 2.0, density: 0.85, scale: 0.92 },
    { z: 0.0, density: 0.9, scale: 0.94 },
    { z: -2.0, density: 0.95, scale: 0.96 },
    { z: -4.0, density: 0.95, scale: 0.97 },
    { z: -6.0, density: 1.0, scale: 0.98 },
    { z: -7.5, density: 1.0, scale: 1.0 },
    { z: -9.0, density: 1.0, scale: 1.0 },
    { z: -10.5, density: 1.0, scale: 0.97 },
    { z: -12.0, density: 0.95, scale: 0.95 },
    { z: -13.5, density: 0.95, scale: 0.92 },
    { z: -15.0, density: 0.9, scale: 0.9 },
    { z: -16.5, density: 0.85, scale: 0.88 },
    { z: -18.0, density: 0.8, scale: 0.86 },
  ];

  for (const row of rows) {
    const xRange = 18;
    const spacing = 0.85;
    const count = Math.floor((xRange * 2) / spacing);
    for (let i = 0; i < count; i++) {
      if (Math.random() > row.density) continue;
      const baseX = -xRange + i * spacing;
      const x = baseX + (Math.random() - 0.5) * 0.55;
      // Carve out the DJ booth riser (x ±5.5, z ≤ -19.5)
      if (Math.abs(x) < 5.5 && row.z <= -19.4) continue;
      // Avoid overlapping the booth body itself
      if (Math.abs(x) < 4 && row.z <= -20.5) continue;
      const zJitter = (Math.random() - 0.5) * 0.6;
      const heightVar = 0.85 + Math.random() * 0.4;

      const figure = new THREE.Group();

      const body = new THREE.Mesh(bodyGeom, mat);
      body.scale.set(1, heightVar, 1);
      body.position.y = 0.475 * heightVar;
      figure.add(body);

      const head = new THREE.Mesh(headGeom, mat);
      head.position.y = 0.95 * heightVar + 0.18;
      figure.add(head);

      const armUp = Math.random() < 0.5;
      if (armUp) {
        const armL = new THREE.Mesh(armGeom, mat);
        armL.position.set(-0.18, 0.95 * heightVar - 0.05, 0);
        armL.rotation.z = 0.2 + Math.random() * 0.6;
        figure.add(armL);

        const armR = new THREE.Mesh(armGeom, mat);
        armR.position.set(0.18, 0.95 * heightVar - 0.05, 0);
        armR.rotation.z = -(0.2 + Math.random() * 0.6);
        figure.add(armR);

        if (Math.random() < 0.32) {
          const phoneCol = phoneColors[(Math.random() * phoneColors.length) | 0];
          const phone = new THREE.Mesh(
            phoneGeom,
            new THREE.MeshBasicMaterial({ color: phoneCol }),
          );
          const handX = Math.random() < 0.5 ? -0.42 : 0.42;
          phone.position.set(handX, 0.95 * heightVar + 0.55, 0);
          figure.add(phone);
        }
      }

      figure.scale.setScalar(row.scale);
      figure.position.set(x, -8, row.z + zJitter);
      figure.rotation.y = Math.PI - 0.4 + Math.random() * 0.8;
      root.add(figure);
    }
  }
}

function makeSideLedTexture() {
  const w = 256;
  const h = 768;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#1ec6ff");
  grad.addColorStop(0.5, "#a839ff");
  grad.addColorStop(1, "#ff2d95");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#000";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.globalAlpha = 1;

  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 36; i++) {
    const yh = (Math.sin(i * 0.5) * 0.5 + 0.55) * w * 0.7;
    const y = i * (h / 36);
    const g = ctx.createLinearGradient(w - yh, 0, w, 0);
    g.addColorStop(0, "rgba(120,255,255,0)");
    g.addColorStop(0.5, "rgba(120,255,255,0.55)");
    g.addColorStop(1, "rgba(255,180,220,1.0)");
    ctx.fillStyle = g;
    ctx.fillRect(w - yh, y + 4, yh, h / 36 - 8);
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
