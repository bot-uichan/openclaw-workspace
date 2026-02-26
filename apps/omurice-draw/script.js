const canvas = document.getElementById("plate");
const ctx = canvas.getContext("2d");
const sizeInput = document.getElementById("size");
const colorInput = document.getElementById("color");
const clearBtn = document.getElementById("clear");
const downloadBtn = document.getElementById("download");

let drawing = false;
let prev = null;

function drawBase() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // table
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#f8efe6");
  grad.addColorStop(1, "#efdfcf");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // plate shadow
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.beginPath();
  ctx.ellipse(450, 355, 300, 150, 0, 0, Math.PI * 2);
  ctx.fill();

  // plate
  ctx.fillStyle = "#f8f8f7";
  ctx.beginPath();
  ctx.ellipse(450, 320, 300, 170, 0, 0, Math.PI * 2);
  ctx.fill();

  // plate rim
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#e5e5e5";
  ctx.stroke();

  // rice
  ctx.fillStyle = "#fbf3de";
  ctx.beginPath();
  ctx.ellipse(455, 345, 200, 92, 0.05, 0, Math.PI * 2);
  ctx.fill();

  // omelette
  const omeGrad = ctx.createLinearGradient(250, 220, 600, 420);
  omeGrad.addColorStop(0, "#ffd96d");
  omeGrad.addColorStop(0.6, "#f7c43e");
  omeGrad.addColorStop(1, "#e7ad2f");
  ctx.fillStyle = omeGrad;
  ctx.beginPath();
  ctx.ellipse(440, 300, 210, 110, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // omelette highlight
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath();
  ctx.ellipse(400, 258, 90, 36, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // hint text
  ctx.fillStyle = "rgba(95,55,25,0.55)";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("ここにケチャップで描いてね", 300, 305);
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches?.[0] || e.changedTouches?.[0];
  const x = (touch ? touch.clientX : e.clientX) - rect.left;
  const y = (touch ? touch.clientY : e.clientY) - rect.top;
  return {
    x: (x / rect.width) * canvas.width,
    y: (y / rect.height) * canvas.height,
  };
}

function start(e) {
  drawing = true;
  prev = getPos(e);
}

function stop() {
  drawing = false;
  prev = null;
}

function move(e) {
  if (!drawing) return;
  e.preventDefault();
  const p = getPos(e);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = colorInput.value;
  ctx.lineWidth = Number(sizeInput.value);

  ctx.beginPath();
  ctx.moveTo(prev.x, prev.y);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  prev = p;
}

clearBtn.addEventListener("click", drawBase);
downloadBtn.addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "omurice-art.png";
  a.click();
});

canvas.addEventListener("mousedown", start);
canvas.addEventListener("mouseup", stop);
canvas.addEventListener("mouseleave", stop);
canvas.addEventListener("mousemove", move);

canvas.addEventListener("touchstart", start, { passive: false });
canvas.addEventListener("touchmove", move, { passive: false });
canvas.addEventListener("touchend", stop);
canvas.addEventListener("touchcancel", stop);

drawBase();
