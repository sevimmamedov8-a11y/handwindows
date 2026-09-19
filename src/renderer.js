import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const video = document.getElementById('camera');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const address = document.getElementById('address');
const errorEl = document.getElementById('error');
const debugEl = document.getElementById('debug');
const keyboardEl = document.getElementById('virtual-keyboard');

let landmarker = null;
let trackingOn = false;
let lastVideoTime = -1;
let cursor = null;
let pinchDown = false;
let lastCursor = null;
let lastScrollAt = 0;
let frames = 0;
let fpsStart = performance.now();
let eyeCenter = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; eyeCenter = {x:canvas.width/2,y:canvas.height/2}; }
window.addEventListener('resize', resize); resize();

function showError(msg) { errorEl.textContent = msg; errorEl.classList.remove('hidden'); }
function status(s) { statusEl.textContent = s; }
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width:{ideal:1280}, height:{ideal:720}, frameRate:{ideal:30,max:30} }, audio:false });
    video.srcObject = stream;
    await video.play();
    status('Камера: OK');
  } catch (e) {
    showError('Не удалось открыть веб-камеру. Разреши доступ к камере Windows для HandARBrowser и запусти приложение снова.\n\n' + (e?.message || e));
    status('Камера: ошибка');
  }
}

async function createHandTracker() {
  if (landmarker) return true;
  status('Загрузка Hand tracking...');
  const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
  landmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
    },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.55,
    minHandPresenceConfidence: 0.55,
    minTrackingConfidence: 0.55
  });
  status('Hand tracking: готов');
  return true;
}

function mapToScreen(lm) {
  // Camera preview is mirrored, so mirror x here too.
  return { x: (1 - lm.x) * canvas.width, y: lm.y * canvas.height };
}

function dist(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }

async function handleHand(result) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if (!result?.landmarks?.length) { cursor = null; pinchDown = false; return; }
  const hand = result.landmarks[0];
  const pts = hand.map(mapToScreen);

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,.52)';
  const connections = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
  for (const [a,b] of connections) { ctx.beginPath(); ctx.moveTo(pts[a].x,pts[a].y); ctx.lineTo(pts[b].x,pts[b].y); ctx.stroke(); }

  const index = pts[8], thumb = pts[4];
  cursor = { x:index.x, y:index.y };
  const pinchDistance = dist(index, thumb);
  const isPinch = pinchDistance < Math.max(24, canvas.width * 0.018);

  ctx.beginPath(); ctx.arc(index.x,index.y,9,0,Math.PI*2); ctx.fillStyle = isPinch ? '#7cffb3' : '#fff'; ctx.fill();
  ctx.beginPath(); ctx.arc(index.x,index.y,18,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.stroke();

  if (lastCursor && trackingOn) {
    const dx = index.x-lastCursor.x, dy = index.y-lastCursor.y;
    if (Math.abs(dx)+Math.abs(dy) > 2) {
      const b = await window.handAR.bounds();
      if (b && index.x>=b.x && index.x<=b.x+b.width && index.y>=b.y && index.y<=b.y+b.height) {
        const p = {x:index.x-b.x, y:index.y-b.y};
        await window.handAR.move(p);
        if (pinchDown && performance.now()-lastScrollAt > 80) {
          await window.handAR.scroll(clamp(-dy*2.3,-140,140));
          lastScrollAt = performance.now();
        }
      }
    }
  }

  if (isPinch && !pinchDown) {
    const b = await window.handAR.bounds();
    if (b && index.x>=b.x && index.x<=b.x+b.width && index.y>=b.y && index.y<=b.y+b.height) {
      await window.handAR.click({x:index.x-b.x,y:index.y-b.y});
    }
  }
  pinchDown = isPinch;
  lastCursor = index;
}

async function tick() {
  frames++;
  const now = performance.now();
  if (now - fpsStart > 1000) { debugEl.textContent = frames + ' FPS'; frames=0; fpsStart=now; }
  if (trackingOn && landmarker && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    try {
      const result = landmarker.detectForVideo(video, performance.now());
      await handleHand(result);
    } catch (e) {
      trackingOn = false;
      status('Hand tracking: ошибка');
      showError('Hand tracking остановлен: ' + (e?.message || e));
    }
  }
  requestAnimationFrame(tick);
}

function normalizeUrl(v){
  const s=v.trim();
  if (!s) return 'https://www.google.com/';
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}

document.getElementById('go').onclick = async () => {
  try { await window.handAR.navigate(normalizeUrl(address.value)); status('Браузер: переход...'); } catch (e) { showError(String(e)); }
};
address.addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('go').click(); });

document.getElementById('center').onclick = () => { eyeCenter = {x:canvas.width/2,y:canvas.height/2}; status('CENTER'); };
document.getElementById('left').onclick = () => { status('Сдвиг влево'); };
document.getElementById('right').onclick = () => { status('Сдвиг вправо'); };
document.getElementById('hand').onclick = async () => {
  try { await createHandTracker(); trackingOn=!trackingOn; status(trackingOn?'Hand tracking: ВКЛ':'Hand tracking: ВЫКЛ'); } catch(e) { showError('Не удалось запустить Hand tracking. ' + (e?.message || e)); }
};
document.getElementById('keyboard').onclick = () => keyboardEl.classList.toggle('hidden');

const rows = ['1234567890','QWERTYUIOP','ASDFGHJKL','ZXCVBNM'];
for (const rowText of rows) {
  const row=document.createElement('div'); row.className='row';
  for(const ch of rowText){ const b=document.createElement('button'); b.textContent=ch; b.onclick=()=>{address.focus(); address.value+=ch;}; row.appendChild(b); }
  keyboardEl.appendChild(row);
}
{
  const row=document.createElement('div'); row.className='row';
  for(const [label,fn] of [['SPACE',()=>address.value+=' '],['⌫',()=>address.value=address.value.slice(0,-1)],['ENTER',()=>document.getElementById('go').click()]]) { const b=document.createElement('button'); b.textContent=label;b.onclick=fn;row.appendChild(b); }
  keyboardEl.appendChild(row);
}

(async () => {
  try {
    await startCamera();
    await window.handAR.createBrowser('https://www.google.com/');
    status('Готово · одно окно');
  } catch(e) {
    showError('Не удалось запустить браузер: ' + (e?.message || e));
  }
  requestAnimationFrame(tick);
})();
