# Music Industry Map

**CINE 295 Final Project**

An interactive 3D visualization of the music industry ecosystem — 15 professional roles and 35 relationships mapped across creative, legal, financial, live, and distribution domains.

## Live Site

[kiasuc.github.io/CINE295-final](https://kiasuc.github.io/CINE295-final/)

## About

The music industry is hard to break into partly because its structure is invisible. This project makes that structure navigable: each sphere is a role, each line is a working relationship. Click any node or edge to learn what that role does, when they enter an artist's career, and who they collaborate with.

Built as a final project for CINE 295 at USC, informed by interviews with working artist managers, a behind-the-scenes tour of CORE Los Angeles (Insomniac × Tomorrowland), and backstage access at Beyond Wonderland SoCal and Shabang.

## Controls

| Input | Action |
|---|---|
| Drag | Orbit |
| Scroll | Zoom |
| Click sphere | View role details |
| Click line | View relationship details |

## Stack

- [Three.js](https://threejs.org/) — 3D scene, lighting, bloom post-processing
- [Vite](https://vitejs.dev/) — dev server and build
- Vanilla JS / HTML / CSS — no framework

## Project Structure

```
src/
  main.js       — entry point, render loop, input handling
  scene.js      — Three.js scene, camera, renderer, bloom
  graph.js      — node and edge meshes, hover/select state
  stage.js      — concert stage geometry
  particles.js  — background particle field
  camera.js     — focus/tween logic
  panel.js      — side panel UI
  picking.js    — raycasting
  styles.css    — all UI styles
data/
  graph.json    — nodes and edges content
```

## Development

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
```

Builds and pushes to the `gh-pages` branch via [gh-pages](https://github.com/tschaub/gh-pages).
