// 1. CONFIGURACIÓN SUPABASE
const supabaseUrl = 'https://xtohtuzuprnwzpkzymmw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0b2h0dXp1cHJud3pwa3p5bW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDEwOTAsImV4cCI6MjA5MzkxNzA5MH0.WxAKCke6eBkerjluCPHGXyD6-zyx8UzyYRMHV9ZG9S0';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

let canalControl;
let html5QrCode; // Variable global para el escáner

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
const ctx = canvas ? canvas.getContext('2d') : null;
let particles = [];
let globalBrightness = 0.8;
let audioCtx;
let isAudioStarted = false;
let fireGain, windGain;

// --- LÓGICA DE INTERFAZ ---
const uiLayer = document.getElementById('ui-layer');
const expSelector = document.getElementById('experience-selector');
const controlsPanel = document.querySelector('.controls-panel');

if(document.getElementById('fachada-btn')) {
    document.getElementById('fachada-btn').onclick = () => {
        controlsPanel.style.transition = "opacity 0.5s";
        controlsPanel.style.opacity = "0";
        setTimeout(() => {
            controlsPanel.style.display = "none";
            expSelector.style.display = "block";
        }, 500);
    };
}

if(document.getElementById('cancel-selector')) {
    document.getElementById('cancel-selector').onclick = () => {
        expSelector.style.display = "none";
        controlsPanel.style.display = "block";
        controlsPanel.style.opacity = "1";
    };
}

// VINCULAR TV
function enviarEstadoInicial() {
    const estado = {
        brillo: document.getElementById('bright-slider').value / 100,
        fuego: document.getElementById('fire-slider').value / 100,
        viento: (document.getElementById('wind-slider').value / 100) * 0.5
    };
    broadcastOrder('SYNC_TOTAL', estado);
}

async function vincularConCodigo(codigo) {
    if (!codigo) return;
    if(expSelector) expSelector.style.display = "none";
    canalControl = supabaseClient.channel(`aura_${codigo}`);
    
    await canalControl.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            setTimeout(async () => {
                enviarEstadoInicial(); 
                await broadcastOrder('VINCULACION_EXITOSA', true);
                alert("¡Vinculado con éxito!");
                if (audioCtx) audioCtx.suspend(); 
                if(controlsPanel) {
                    controlsPanel.style.display = "block";
                    controlsPanel.style.opacity = "1";
                }
            }, 500);
        }
    });
}

// EVENTO DEL BOTÓN PRINCIPAL
if(document.getElementById('mode-tv-btn')) {
    document.getElementById('mode-tv-btn').onclick = () => {
        const opcion = confirm("¿Quieres escanear el código QR de la TV?");
        if (opcion) {
            iniciarEscaneoQR(); // Llamada a la función externa
        } else {
            const manual = prompt("Ingresa el código manualmente:");
            if (manual) vincularConCodigo(manual);
        }
    };
}

// --- FUNCIONES DEL ESCÁNER QR ---
async function iniciarEscaneoQR() {
    const readerContainer = document.getElementById('qr-reader-container');
    if (!readerContainer) return;

    readerContainer.style.display = 'flex';
    html5QrCode = new Html5Qrcode("qr-reader");

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    try {
        await html5QrCode.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                detenerEscaneo();
                vincularConCodigo(decodedText);
            }
        );
    } catch (err) {
        alert("Error de cámara: " + err);
        detenerEscaneo();
    }
}

function detenerEscaneo() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById('qr-reader-container').style.display = 'none';
        }).catch(() => {
            document.getElementById('qr-reader-container').style.display = 'none';
        });
    }
}

if(document.getElementById('close-qr')) {
    document.getElementById('close-qr').onclick = detenerEscaneo;
}

// ... (Resto de tu código de audio y visuales igual) ...
