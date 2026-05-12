// 1. CONFIGURACIÓN SUPABASE
const supabaseUrl = 'https://xtohtuzuprnwzpkzymmw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0b2h0dXp1cHJud3pwa3p5bW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDEwOTAsImV4cCI6MjA5MzkxNzA5MH0.WxAKCke6eBkerjluCPHGXyD6-zyx8UzyYRMHV9ZG9S0';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let canalControl;

// --- MOTOR DE COMUNICACIÓN ---
async function broadcastOrder(tipo, valor) {
    if (!canalControl) return;

    await canalControl.send({
        type: 'broadcast',
        event: 'orden',
        payload: { tipo, valor }
    });
}

// --- VARIABLES GLOBALES ---
const canvas = document.getElementById('fireCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let globalBrightness = 0.8;
let audioCtx;
let isAudioStarted = false;
let fireGain, windGain;

// --- LÓGICA DE INTERFAZ ---
const uiLayer = document.getElementById('ui-layer');
const expSelector = document.getElementById('experience-selector');
const controlsPanel = document.querySelector('.controls-panel');

document.getElementById('fachada-btn').onclick = () => {
    controlsPanel.style.transition = "opacity 0.5s";
    controlsPanel.style.opacity = "0";
    setTimeout(() => {
        controlsPanel.style.display = "none";
        expSelector.style.display = "block";
    }, 500);
};

document.getElementById('cancel-selector').onclick = () => {
    expSelector.style.display = "none";
    controlsPanel.style.display = "block";
    controlsPanel.style.opacity = "1";
};

document.getElementById('mode-zen-btn').onclick = () => {
    expSelector.style.display = "none";
    uiLayer.classList.add('hidden-ui');
    const restore = () => {
        uiLayer.classList.remove('hidden-ui');
        window.removeEventListener('click', restore);
    };
    setTimeout(() => window.addEventListener('click', restore), 500);
};

// VINCULAR TV
// --- NUEVA FUNCIÓN DE SINCRONIZACIÓN ---
function enviarEstadoInicial() {
    const estado = {
        brillo: document.getElementById('bright-slider').value / 100,
        fuego: document.getElementById('fire-slider').value / 100,
        viento: (document.getElementById('wind-slider').value / 100) * 0.5
    };
    
    console.log("Enviando sincronización inicial...", estado);
    broadcastOrder('SYNC_TOTAL', estado);
}

// Función central de vinculación
async function vincularConCodigo(codigo) {
    if (!codigo) return;
    
    expSelector.style.display = "none";
    canalControl = supabaseClient.channel(`aura_${codigo}`);
    
    await canalControl.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            setTimeout(async () => {
                enviarEstadoInicial(); // Lo que hicimos en el paso anterior
                await broadcastOrder('VINCULACION_EXITOSA', true);
                alert("¡Vinculado con éxito!");
                if (audioCtx) audioCtx.suspend(); 
                controlsPanel.style.display = "block";
                controlsPanel.style.opacity = "1";
            }, 500);
        }
    });
}

// Evento del botón principal
document.getElementById('mode-tv-btn').onclick = () => {
    const opcion = confirm("¿Quieres escanear el código QR de la TV?");
    if (opcion) {
       async function iniciarEscaneoQR() {
    console.log("Iniciando proceso de escaneo...");
    const readerContainer = document.getElementById('qr-reader-container');
    
    if (!readerContainer) {
        alert("ERROR: No encontré el div 'qr-reader-container' en este HTML.");
        return;
    }

    readerContainer.style.display = 'flex';
    
    try {
        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        alert("Solicitando acceso a la cámara..."); // Esto nos dirá si llegó a este punto

        await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                detenerEscaneo();
                vincularConCodigo(decodedText);
            }
        );
    } catch (err) {
        alert("ERROR DE CÁMARA: " + err);
        console.error(err);
        detenerEscaneo();
    }
}
    } else {
        const manual = prompt("Ingresa el código manualmente:");
        if (manual) vincularConCodigo(manual);
    }
};

// --- AUDIO (CORREGIDO CON BLOQUEO LOCAL) ---
function initAudio() {
    // Si ya estamos en modo TV, NO permitimos que el celular inicie audio
    if (canalControl) return; 

    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const windFilter = audioCtx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 400;

    const windLFO = audioCtx.createOscillator();
    const windLFOGain = audioCtx.createGain();
    windLFO.frequency.value = 0.25; 
    windLFOGain.gain.value = 150;
    windLFO.connect(windLFOGain);
    windLFOGain.connect(windFilter.frequency);
    windLFO.start();

    windGain = audioCtx.createGain();
    windGain.gain.value = document.getElementById('wind-slider').value / 100;

    const windSource = audioCtx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(audioCtx.destination);
    windSource.start();

    const fireBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const fireData = fireBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) fireData[i] = Math.random() * 2 - 1;

    const fireSource = audioCtx.createBufferSource();
    fireSource.buffer = fireBuffer;
    fireSource.loop = true;

    const crackleFilter = audioCtx.createBiquadFilter();
    crackleFilter.type = 'highpass';
    crackleFilter.frequency.value = 4500;

    fireGain = audioCtx.createGain();
    fireGain.gain.value = document.getElementById('fire-slider').value / 100;

    const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
    scriptNode.onaudioprocess = function(e) {
        const output = e.outputBuffer.getChannelData(0);
        const input = e.inputBuffer.getChannelData(0);
        for (let i = 0; i < output.length; i++) {
            output[i] = Math.random() > 0.9992 ? input[i] * 15 : 0;
        }
    };

    fireSource.connect(scriptNode);
    scriptNode.connect(crackleFilter);
    crackleFilter.connect(fireGain);
    fireGain.connect(audioCtx.destination);
    fireSource.start();
}

// --- VISUALES ---
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

class Particle {
    constructor() { this.init(); }
    init() {
        this.x = canvas.width / 2 + (Math.random() * 100 - 50);
        this.y = canvas.height + 20;
        this.vx = Math.random() * 2 - 1;
        this.vy = -(Math.random() * 3 + 1.5);
        this.size = Math.random() * 50 + 25;
        this.life = 1;
        this.decay = Math.random() * 0.008 + 0.004;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy * (globalBrightness + 0.3);
        this.life -= this.decay;
        if (this.life <= 0) this.init();
    }
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
        const h = 5 + (this.life * 25);
        ctx.fillStyle = `hsla(${h}, 100%, 50%, ${this.life * globalBrightness})`;
        ctx.fill();
    }
}

for (let i = 0; i < 70; i++) particles.push(new Particle());

function animate() {
    ctx.fillStyle = 'rgba(5, 5, 5, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
}
animate();

// --- CONTROLES (CORREGIDOS) ---
const audioBtn = document.getElementById('audio-toggle');
audioBtn.onclick = () => {
    if (canalControl) {
        broadcastOrder('VINCULACION_EXITOSA', true);
        audioBtn.innerText = "Controlando TV";
        audioBtn.classList.add('btn-active');
        // Aseguramos que el celular esté mudo
        if (audioCtx) audioCtx.suspend();
    } else {
        if (!isAudioStarted) {
            initAudio();
            isAudioStarted = true;
            audioBtn.innerText = "Audio Local Activo";
            audioBtn.classList.add('btn-active');
        } else {
            if (audioCtx.state === 'running') {
                audioCtx.suspend();
                audioBtn.innerText = "Reanudar Local";
                audioBtn.classList.remove('btn-active');
            } else {
                audioCtx.resume();
                audioBtn.innerText = "Audio Local Activo";
                audioBtn.classList.add('btn-active');
            }
        }
    }
};

document.getElementById('bright-slider').oninput = (e) => {
    globalBrightness = e.target.value / 100;
    document.getElementById('bright-val').innerText = e.target.value + '%';
    canvas.style.filter = `blur(${2.5 - globalBrightness * 1.5}px) contrast(${100 + e.target.value / 3}%) brightness(${0.5 + globalBrightness})`;
    broadcastOrder('CAMBIO_BRILLO', globalBrightness);
};

document.getElementById('fire-slider').oninput = (e) => {
    const vol = e.target.value / 100;
    document.getElementById('fire-val').innerText = e.target.value + '%';
    
    if (canalControl) {
        broadcastOrder('SET_AUDIO_FIRE', vol);
        // Apagamos el volumen local por si acaso quedó encendido
        if (fireGain) fireGain.gain.value = 0; 
    } else {
        if (fireGain) fireGain.gain.value = vol;
    }
};

document.getElementById('wind-slider').oninput = (e) => {
    const vol = (e.target.value / 100) * 0.5;
    document.getElementById('wind-val').innerText = e.target.value + '%';
    
    if (canalControl) {
        broadcastOrder('SET_AUDIO_WIND', vol);
        // Apagamos el volumen local
        if (windGain) windGain.gain.value = 0;
    } else {
        if (windGain) windGain.gain.value = vol;
    }
};

document.getElementById('logout-trigger').onclick = () => {
    if(confirm("¿Deseas finalizar tu sesión en Aura?")) {
        location.reload();
    }
};
let html5QrCode;

async function iniciarEscaneoQR() {
    const readerContainer = document.getElementById('qr-reader-container');
    readerContainer.style.display = 'flex';
    html5QrCode = new Html5Qrcode("qr-reader");

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
        detenerEscaneo();
        vincularConCodigo(decodedText); // Vincula automáticamente al leer el QR
    }).catch((err) => {
        alert("Error de cámara: " + err);
        detenerEscaneo();
    });
}

function detenerEscaneo() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('qr-reader-container').style.display = 'none';
        });
    }
}

document.getElementById('close-qr').onclick = detenerEscaneo;
