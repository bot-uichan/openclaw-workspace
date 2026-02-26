import * as THREE from "three";
import { OrbitControls } from "https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js";

const stage = document.getElementById("stage");
const sizeInput = document.getElementById("size");
const colorInput = document.getElementById("color");
const clearBtn = document.getElementById("clear");
const downloadBtn = document.getElementById("download");

const scene = new THREE.Scene();
scene.background = new THREE.Color("#d9cdbf");

const camera = new THREE.PerspectiveCamera(45, stage.clientWidth / stage.clientHeight, 0.1, 100);
camera.position.set(0, 3.5, 6.5);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(stage.clientWidth, stage.clientHeight);
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.minDistance = 4;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI / 2.1;
controls.target.set(0, 1.2, 0);
controls.update();

scene.add(new THREE.HemisphereLight("#fff5dd", "#8f6f4a", 1.1));
const key = new THREE.DirectionalLight("#ffffff", 1.3);
key.position.set(2, 6, 5);
scene.add(key);

const table = new THREE.Mesh(
  new THREE.CylinderGeometry(7.5, 7.5, 0.4, 64),
  new THREE.MeshStandardMaterial({ color: "#e9dccf", roughness: 1 })
);
table.position.y = -0.25;
scene.add(table);

const plate = new THREE.Mesh(
  new THREE.CylinderGeometry(3.2, 3.2, 0.32, 64),
  new THREE.MeshStandardMaterial({ color: "#f4f4f4", roughness: 0.9 })
);
plate.position.y = 0.2;
scene.add(plate);

const rice = new THREE.Mesh(
  new THREE.SphereGeometry(1.55, 64, 48),
  new THREE.MeshStandardMaterial({ color: "#f6efd9", roughness: 1 })
);
rice.scale.set(1.35, 0.38, 1.02);
rice.position.set(0.12, 0.62, 0.15);
scene.add(rice);

const textureCanvas = document.createElement("canvas");
textureCanvas.width = 1024;
textureCanvas.height = 1024;
const tctx = textureCanvas.getContext("2d");

function resetOmuriceTexture() {
  const grad = tctx.createLinearGradient(0, 0, 1024, 1024);
  grad.addColorStop(0, "#ffd96d");
  grad.addColorStop(0.6, "#f7c43e");
  grad.addColorStop(1, "#e7ad2f");
  tctx.fillStyle = grad;
  tctx.fillRect(0, 0, 1024, 1024);

  tctx.fillStyle = "rgba(255,255,255,0.2)";
  tctx.beginPath();
  tctx.ellipse(410, 320, 250, 120, -0.22, 0, Math.PI * 2);
  tctx.fill();
}
resetOmuriceTexture();

const omeletteTexture = new THREE.CanvasTexture(textureCanvas);
omeletteTexture.colorSpace = THREE.SRGBColorSpace;
omeletteTexture.needsUpdate = true;

const omelette = new THREE.Mesh(
  new THREE.SphereGeometry(1.72, 128, 96),
  new THREE.MeshStandardMaterial({ map: omeletteTexture, roughness: 0.62, metalness: 0.02 })
);
omelette.scale.set(1.3, 0.48, 0.9);
omelette.position.set(0, 1, 0);
omelette.rotation.z = -0.09;
scene.add(omelette);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let isDrawing = false;
let lastUv = null;

function uvToCanvas(uv) {
  return {
    x: uv.x * textureCanvas.width,
    y: (1 - uv.y) * textureCanvas.height,
  };
}

function paintAt(uv) {
  const point = uvToCanvas(uv);
  const size = Number(sizeInput.value);
  const color = colorInput.value;

  if (!lastUv) {
    tctx.fillStyle = color;
    tctx.beginPath();
    tctx.arc(point.x, point.y, size / 2, 0, Math.PI * 2);
    tctx.fill();
  } else {
    const from = uvToCanvas(lastUv);
    tctx.strokeStyle = color;
    tctx.lineCap = "round";
    tctx.lineJoin = "round";
    tctx.lineWidth = size;
    tctx.beginPath();
    tctx.moveTo(from.x, from.y);
    tctx.lineTo(point.x, point.y);
    tctx.stroke();
  }

  omeletteTexture.needsUpdate = true;
  lastUv = uv.clone();
}

function setPointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  const clientX = touch ? touch.clientX : event.clientX;
  const clientY = touch ? touch.clientY : event.clientY;

  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function pickOmurice(event) {
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(omelette)[0];
  return hit;
}

function startDraw(event) {
  const hit = pickOmurice(event);
  if (!hit?.uv) return;
  isDrawing = true;
  controls.enabled = false;
  paintAt(hit.uv);
}

function moveDraw(event) {
  if (!isDrawing) return;
  event.preventDefault();
  const hit = pickOmurice(event);
  if (!hit?.uv) return;
  paintAt(hit.uv);
}

function endDraw() {
  isDrawing = false;
  lastUv = null;
  controls.enabled = true;
}

renderer.domElement.addEventListener("pointerdown", startDraw);
renderer.domElement.addEventListener("pointermove", moveDraw);
window.addEventListener("pointerup", endDraw);
renderer.domElement.addEventListener("touchstart", startDraw, { passive: false });
renderer.domElement.addEventListener("touchmove", moveDraw, { passive: false });
window.addEventListener("touchend", endDraw);

clearBtn.addEventListener("click", () => {
  resetOmuriceTexture();
  omeletteTexture.needsUpdate = true;
});

downloadBtn.addEventListener("click", () => {
  renderer.render(scene, camera);
  const a = document.createElement("a");
  a.href = renderer.domElement.toDataURL("image/png");
  a.download = "omurice-3d-art.png";
  a.click();
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
  camera.aspect = stage.clientWidth / stage.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(stage.clientWidth, stage.clientHeight);
});
