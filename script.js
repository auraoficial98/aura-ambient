/**
 * AURA - CORE SCRIPT v7.5 (Llavero de Canales Simultáneos e Independientes)
 * Respetando la regla de oro: Lógica optimizada sin alterar el diseño.
 */

// ─── 1. SUPABASE Y LLAVERO MÚLTIPLE ───────────────────
const supabaseUrl   = 'https://xtohtuzuprnwzpkzymmw.supabase.co';
const supabaseKey   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0b2h0dXp1cHJud3pwa3p5bW13Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNDEwOTAsImV4cCI6MjA5MzkxNzA5MH0.WxAKCke6eBkerjluCPHGXyD6-zyx8UzyYRMHV9ZG9S0';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// ESTRUCTURA MAESTRA MULTI-SOCKET
window.listaCanalesAbiertos = {}; 
let vinculacionEnProceso = false;
window.codigoTVActiva = null;    

// ─── CIRUGÍA AURA: MEMORIA INDIVIDUALIZADA DE SLIDERS POR TV ───
window.estadosSlidersTVs = {}; // Guarda los ajustes manuales { 'CÓDIGO': { brillo: 40, fuego: 10, viento: 10 } }

// ─── PASO 2: ESTRUCTURA DE MEMORIA PARA EL HISTORIAL DE MULTI-TVs ───
let historialTVs = [];
try {
    historialTVs = JSON.parse(localStorage.getItem('aura_historial_tvs')) || [];
} catch(e) {
    historialTVs = [];
}

function obtenerONombreSecuencial(codigoTv) {
    const tvExistente = historialTVs.find(t => t.codigo === codigoTv);
    if (tvExistente) return tvExistente.nombre;
    return `Aura TV ${historialTVs.length + 1}`;
}

// ─── 2. ESTADO SENSORIAL Y AUDIO ──────────────────────
let audioCtx  = null;
let fireGain  = null;
let windGain  = null;

window.pixelModeActivo = false;
let audioLosslessActivo  = false;
let hapticFeedbackActivo = true;

// Variables globales para el motor de temporizado
let sleepIntervalId = null;
let tiempoRestanteSegundos = 0;

const traduccionesAura = {
    es: { labelBright: 'Brillo', labelFire: 'Fuego', labelWind: 'Viento' },
    en: { labelBright: 'Brightness', labelFire: 'Fire', labelWind: 'Wind' }
};

// ─── 3. MOTOR DE AUDIO HÍBRIDO CON BUFFER MEMORY ───────────────────
let fireBuffer = null;
let fireSourceNode = null;

async function activarAudio() {
    // Si ya existe el contexto, lo reanudamos si el navegador lo suspendió
    if (audioCtx) {
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }
        return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    fireGain = audioCtx.createGain();
    windGain = audioCtx.createGain();

    fireGain.connect(audioCtx.destination);
    windGain.connect(audioCtx.destination);

    // Configurar volúmenes desde la posición actual de los sliders
    const fireSlider = document.getElementById('fire-slider');
    const windSlider = document.getElementById('wind-slider');
    fireGain.gain.value = fireSlider ? (parseFloat(fireSlider.value) / 100) : 0.5;
    windGain.gain.value = windSlider ? (parseFloat(windSlider.value) / 100) * 0.3 : 0.09;

    // Cargar el archivo local
    try {
        const response = await fetch('./assets/fire_loop.mp3');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const arrayBuffer = await response.arrayBuffer();
        fireBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        // Crear la fuente de sonido
        fireSourceNode = audioCtx.createBufferSource();
        fireSourceNode.buffer = fireBuffer;
        fireSourceNode.loop = true; // Loop continuo
        fireSourceNode.connect(fireGain);
        fireSourceNode.start(0);
        
        console.log("Audio MP3 cargado y reproduciendo correctamente.");
    } catch (e) {
        console.error("No se pudo cargar el audio MP3 local, activando respaldo sintético:", e);
        // Respaldo sintético en caso de que la ruta o el archivo falle
        const fuegoSintetico = crearNodoRuido(400);
        fuegoSintetico.filter.connect(fireGain);
        fuegoSintetico.source.start();
    }
}

function crearNodoRuido(frecuencia) {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frecuencia;

    source.connect(filter);
    return { source, filter };
}

// ─── 4. BROADCAST ORIENTADO A MULTI-CANAL SELECTIVO ───
async function broadcastOrder(tipo, valor) {
    // Apuntamos dinámicamente al canal de la TV que está seleccionada actualmente
    const canalActivo = window.listaCanalesAbiertos[window.codigoTVActiva];
    if (!canalActivo) return;

    let tipoTraducido = tipo;
    if (tipo === 'CAMBIO_BRILLO') tipoTraducido = 'BRIGHTNESS';

    await canalActivo.send({
        type:    'broadcast',
        event:   'orden',
        payload: { tipo: tipoTraducido, valor }
    });
}

function enviarEstadoInicial() {


    // ─── CIRUGÍA AURA: SELLAR MEMORIA INICIAL AL VINCULAR NUEVA TV ───
    if (window.codigoTVActiva) {
        window.estadosSlidersTVs[window.codigoTVActiva] = { brillo: 80, fuego: 50, viento: 30 };
    }
    
    // Ponemos físicamente los sliders y rellenos del móvil en su estado base 80-50-30
    const brightSlider = document.getElementById('bright-slider');
    const fireSlider   = document.getElementById('fire-slider');
    const windSlider   = document.getElementById('wind-slider');
    const fillBright   = document.getElementById('fill-bright');
    const fillFire     = document.getElementById('fill-fire');
    const fillWind     = document.getElementById('fill-wind');

    if (brightSlider) brightSlider.value = 80;
    if (fireSlider)   fireSlider.value   = 50;
    if (windSlider)   windSlider.value   = 30;

    if (fillBright) fillBright.style.height = '80%';
    if (fillFire)   fillFire.style.height   = '50%';
    if (fillWind)   fillWind.style.height   = '30%';

    // Actualizamos los textos de los porcentajes en pantalla
    const valBright = document.getElementById('bright-value') || fillBright?.parentElement?.parentElement?.querySelector('.capsule-value');
    const valFire   = document.getElementById('fire-value')   || fillFire?.parentElement?.parentElement?.querySelector('.capsule-value');
    const valWind   = document.getElementById('wind-value')   || fillWind?.parentElement?.parentElement?.querySelector('.capsule-value');

    if (valBright) valBright.textContent = '80%';
    if (valFire)   valFire.textContent   = '50%';
    if (valWind)   valWind.textContent   = '30%';
    
    // ─── CIRUGÍA AURA v8.1: REINICIO VISUAL DE BOTONES MUTE (ANTI-DOBLE TOUCH) ───
    // Forzamos a que los botones del celular se pinten de dorado por defecto al cambiar de TV
    const btnMuteFuego  = document.getElementById('btn-mute-fire');
    const btnMuteViento = document.getElementById('btn-mute-wind');
    if (btnMuteFuego)  btnMuteFuego.classList.add('active');
    if (btnMuteViento) btnMuteViento.classList.add('active');

    
    setTimeout(() => {
        const calidadActual = document.getElementById('audio-quality')?.value ?? 'standard';
        broadcastOrder('SET_AUDIO_QUALITY', calidadActual);
        
        // Transmitir el estado actual de Pixel Art
        broadcastOrder('SET_PIXEL_MODE', window.pixelModeActivo || false);

        // Transmitir la posición de color actual (Rojo = 1, Naranja = 2, Azul = 3)
        const posColor = window.colorActualPosicion || 2;
        broadcastOrder('SET_COLOR_SPECTRUM', posColor);

        const idiomaActual = document.getElementById('app-language')?.value ?? 'es';
        broadcastOrder('SET_LANGUAGE', idiomaActual);

        broadcastOrder('SYNC_TOTAL', { brillo: 0.8, fuego: 0.5, viento: 0.30 });
    }, 800);
}

// ─── FUNCIÓN MAESTRA DE APAGADO DE UNA TV ESPECÍFICA CORREGIDA ───
window.ejecutarDesvinculacionTV = async function(codigoOpcional) {
    const codigoABorrar = codigoOpcional || window.codigoTVActiva;
    if (!codigoABorrar) return;

    const canalABorrar = window.listaCanalesAbiertos[codigoABorrar];
    if (canalABorrar) {
        try { 
            await canalABorrar.send({ type: 'broadcast', event: 'orden', payload: { tipo: 'DESVINCULAR_TV', valor: true } });
            await supabaseClient.removeChannel(canalABorrar); 
        } catch(e){}
        delete window.listaCanalesAbiertos[codigoABorrar]; 
    }

    if (codigoABorrar === window.codigoTVActiva) {
        window.codigoTVActiva = null;

        // CIRUGÍA ANTI-FACHADA: Buscamos si queda alguna OTRA televisión encendida en el llavero
        const codigosVivos = Object.keys(window.listaCanalesAbiertos);
        
        if (codigosVivos.length > 0) {
            // ¡Encontramos otra TV encendida! Conectamos el control remoto a ella automáticamente
            const siguienteCodigo = codigosVivos[0];
            historialTVs.forEach(t => t.activo = (t.codigo === siguienteCodigo));
            localStorage.setItem('aura_historial_tvs', JSON.stringify(historialTVs));
            
            // Forzamos el salto síncrono al canal vivo restante con sus valores de memoria guardados
            window.conectarTVDesdeHistorial(siguienteCodigo);
            mostrarToast('Cambio automático a la TV activa restante.');
            return; // Cortamos aquí para evitar que se borre la UI del control remoto
        }

        // Si NO queda ninguna TV encendida en toda la casa, ahora sí restauramos el celular al modo local
        const rh = document.getElementById('remote-header');
        if (rh) rh.classList.remove('visible');

        const fz = document.getElementById('fire-zone');
        if (fz) fz.classList.remove('remote-mode');

        const cz = document.getElementById('controls-zone');
        if (cz) cz.classList.remove('remote-mode');

        const tvBtn = document.getElementById('tv-header-trigger');
        if (tvBtn) {
            tvBtn.style.color = 'rgba(255, 255, 255, 0.4)';
            tvBtn.title = 'Vincular TV';
        }

        revivirFuegoLocal();

        if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        document.body.classList.remove('aura-led-connected', 'aura-led-disconnected');
    }
    
    const tvHistorial = historialTVs.find(t => t.codigo === codigoABorrar);
    if (tvHistorial) tvHistorial.activo = false;
    localStorage.setItem('aura_historial_tvs', JSON.stringify(historialTVs));

    mostrarToast('Dispositivo desconectado del ecosistema.');
    window.renderizarHistorialTVs(); 
};

// ─── 5. VINCULACIÓN ADAPTATIVA MULTI-CANAL ───────────
window.procesarCodigoVinculacion = async function(codigoRaw) {
    if (!codigoRaw) return;

    let codigo = codigoRaw.trim();
    if (codigo.includes('data=')) codigo = codigo.split('data=')[1];
    else if (codigo.includes('=')) codigo = codigo.split('=').pop();
    else if (codigo.includes('/')) codigo = codigo.split('/').pop();

    codigo = codigo.replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 5);

    if (codigo.length !== 5) {
        mostrarToast('Lectura QR fallida. Intenta apuntar de nuevo.');
        if (typeof window.startQRScanner === 'function') setTimeout(window.startQRScanner, 1500);
        return;
    }

    vinculacionEnProceso = true;
    window.codigoTVActiva = codigo; // Enfocamos el control en este nuevo código

    // Si ya existía un canal abierto previo para ESTE MISMO CÓDIGO, lo refrescamos
    if (window.listaCanalesAbiertos[codigo]) {
        try { await supabaseClient.removeChannel(window.listaCanalesAbiertos[codigo]); } catch(e){}
    }

    try { if (typeof window.stopQRScanner === 'function') window.stopQRScanner(); } catch(e) {}

    const connectBtn  = document.getElementById('connect-manual-btn');
    const manualInput = document.getElementById('manual-code-input');
    const originalText = connectBtn ? connectBtn.textContent : 'CONECTAR';

    if (connectBtn) { connectBtn.textContent = 'CONECTANDO...'; connectBtn.disabled = true; }

    const manejarFalloVinculacion = () => {
        if (connectBtn) { connectBtn.textContent = originalText; connectBtn.disabled = false; }
        if (manualInput) {
            manualInput.value = ''; manualInput.style.borderColor = '#ff6b6b'; manualInput.focus();
            setTimeout(() => { manualInput.style.borderColor = 'rgba(212,175,55,0.4)'; }, 2000);
        }
        vinculacionEnProceso = false;
    };

    // Creamos y guardamos la conexión en el llavero global
    const nuevoCanal = supabaseClient.channel(`aura_${codigo}`);
    window.listaCanalesAbiertos[codigo] = nuevoCanal;

    const timeout = setTimeout(() => {
        if (window.listaCanalesAbiertos[codigo]) { 
            try{supabaseClient.removeChannel(window.listaCanalesAbiertos[codigo]);}catch(e){} 
            delete window.listaCanalesAbiertos[codigo];
        }
        mostrarToast('TV fuera de línea o código incorrecto.');
        manejarFalloVinculacion();
    }, 6000);

    let handshakeTimer = null;
    handshakeCompletado = false; 

    const abortarPorHandshake = async () => {
        if (handshakeCompletado) return;
        handshakeCompletado = true;
        clearTimeout(timeout); clearTimeout(handshakeTimer);
        if (window.listaCanalesAbiertos[codigo]) { 
            try { await supabaseClient.removeChannel(window.listaCanalesAbiertos[codigo]); } catch(e) {} 
            delete window.listaCanalesAbiertos[codigo];
        }
        mostrarToast('Error: TV no encontrada.');
        manejarFalloVinculacion();
    };

    nuevoCanal.on('broadcast', { event: 'orden' }, (msg) => {
        if (!msg?.payload) return;
        
        if (msg.payload.tipo === 'AURA_HANDSHAKE_PONG' && codigo === window.codigoTVActiva) {
            document.body.classList.remove('aura-led-disconnected');
            document.body.classList.add('aura-led-connected');
        }

        if (msg.payload.tipo === 'AURA_HANDSHAKE_PONG' && !handshakeCompletado) {
            handshakeCompletado = true;
            clearTimeout(handshakeTimer); clearTimeout(timeout);
            vinculacionEnProceso = false;

            if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();

            nuevoCanal.send({ type: 'broadcast', event: 'orden', payload: { tipo: 'VINCULACION_EXITOSA', valor: true } });
            enviarEstadoInicial();

            if (typeof window.activarModoControlRemoto === 'function') window.activarModoControlRemoto();

            const canvasLocal = document.getElementById('fireCanvas');
            if (canvasLocal) canvasLocal.style.display = 'none';

            const tvPanel = document.getElementById('tv-linking-panel');
            if (tvPanel) tvPanel.style.display = 'none';
            if (manualInput) manualInput.value = '';

            if (connectBtn) { connectBtn.textContent = originalText; connectBtn.disabled = false; }

            const tvPrevia = historialTVs.find(t => t.codigo === codigo);
            const nombreFinal = tvPrevia ? tvPrevia.nombre : obtenerONombreSecuencial(codigo);

            // Marcamos únicamente esta TV como la activa en la vista en pantalla
            historialTVs.forEach(t => t.activo = (t.codigo === codigo));

            if (!tvPrevia) { 
                historialTVs.push({ codigo: codigo, nombre: nombreFinal, activo: true }); 
            } else {
                tvPrevia.activo = true;
            }
            
            localStorage.setItem('aura_historial_tvs', JSON.stringify(historialTVs));
            window.renderizarHistorialTVs();

            mostrarToast(`Ecosistema conectado con ${nombreFinal} ✓`);
        }
    });

    nuevoCanal.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            try { nuevoCanal.send({ type: 'broadcast', event: 'orden', payload: { tipo: 'AURA_HANDSHAKE_PING', valor: Date.now() } }); } catch(e) {}
            handshakeTimer = setTimeout(abortarPorHandshake, 2000);
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (!handshakeCompletado) {
                clearTimeout(timeout); clearTimeout(handshakeTimer);
                handshakeCompletado = true;
                mostrarToast('Error: No se pudo enlazar la señal.');
                manejarFalloVinculacion();
            } else if (codigo === window.codigoTVActiva) {
                document.body.classList.remove('aura-led-connected');
                document.body.classList.add('aura-led-disconnected');
            }
        }
    });
}

// ─── 6. TOAST HUD ─────────────────────────────────────
function mostrarToast(mensaje) {
    let toast = document.getElementById('aura-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'aura-toast';
        toast.style.cssText = `
            position: fixed; bottom: 35px; left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: rgba(18, 12, 5, 0.97);
            border: 1px solid rgba(212, 175, 55, 0.25);
            color: rgba(255, 255, 255, 0.8);
            padding: 14px 22px; border-radius: 16px;
            font-family: 'Urbanist', 'Lato', sans-serif;
            font-size: 12px; letter-spacing: 0.4px;
            z-index: 99999; opacity: 0;
            transition: opacity 0.35s ease, transform 0.35s ease;
            backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); pointer-events: none;
        `;
        document.body.appendChild(toast);
    }
    toast.textContent = mensaje;
    requestAnimationFrame(() => {
        requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(-50%) translateY(0)'; });
    });
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, 4500);
}
// ─── 7. RECOVERY ENGINE (ANTI-PANTALLA NEGRA) UNIFICADO ───
function revivirFuegoLocal() {
    const oldCanvas = document.getElementById('fireCanvas');
    if (!oldCanvas) return;

    oldCanvas.style.display = 'block';
    oldCanvas.classList.remove('remote-mode');

    const newCanvas = oldCanvas.cloneNode(true);
    oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);

    const ctx = newCanvas.getContext('2d');
    let particles = [];
    let localBrightness = parseFloat(document.getElementById('bright-slider')?.value || 80) / 100;
    let isLocalFireActive = true;

    function resizeCanvas() { newCanvas.width  = window.innerWidth; newCanvas.height = window.innerHeight; }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class LocalFireParticle {
        constructor() { this.init(); }
        init() {
            const fireZoneH = window.innerHeight * 0.5;
            const baseSpread = newCanvas.width < 500 ? newCanvas.width * 0.35 : 120;
            this.x = newCanvas.width / 2 + (Math.random() * baseSpread - baseSpread / 2);
            this.y = fireZoneH + (Math.random() * 20 - 5);
            this.vx = Math.random() * 0.8 - 0.4;
            this.vy = -(Math.random() * 2.5 + 1.8);
            this.baseWidth = Math.random() * 16 + 12;
            this.baseHeight = Math.random() * 40 + 25;
            this.life = 1.0;
            this.decay = Math.random() * 0.007 + 0.005;
        }
        update() {
            const windSlider = document.getElementById('wind-slider');
            const windSliderVal = windSlider ? parseFloat(windSlider.value) / 100 : 0.3;
            const btnMuteWind = document.getElementById('btn-mute-wind');
            const isWindActive = btnMuteWind ? btnMuteWind.classList.contains('active') : true;
            this.x += this.vx + (isWindActive ? windSliderVal * 1.2 : 0);
            this.y += this.vy * (localBrightness * 0.6 + 0.5);
            this.life -= this.decay;
            if (this.life <= 0 && isLocalFireActive) this.init();
        }
        draw() {
            const fireZoneH = window.innerHeight * 0.5;
            if (this.y > fireZoneH + 30) return;
            let hue = 11 + (this.life * 26);
            const sliderColor = document.getElementById('fire-color-slider');
            const valorTonalidad = sliderColor ? parseInt(sliderColor.value) : 2;
            if (valorTonalidad === 1) hue = 0 + (this.life * 12);
            else if (valorTonalidad === 3) hue = 202 + (this.life * 18);

            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            ctx.beginPath();
            const w = this.baseWidth * this.life;
            const h = this.baseHeight * this.life * (localBrightness * 0.5 + 0.5);
            ctx.fillStyle = `hsla(${hue}, 100%, 50%, ${this.life * localBrightness * 0.75})`;
            ctx.ellipse(this.x, this.y, w, h, this.vx * 0.1, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    function animateLocalFire() {
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
        if (isLocalFireActive || particles.some(p => p.life > 0)) {
            ctx.fillStyle = 'rgba(5,5,5,0.12)';
            ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
            particles.forEach(p => { p.update(); p.draw(); });
        }
        requestAnimationFrame(animateLocalFire);
    }
    animateLocalFire();

    // Sincronizar localBrightness cuando el usuario mueve el slider de brillo
    const brightSlider = document.getElementById('bright-slider');
    if (brightSlider) {
        brightSlider.addEventListener('input', e => { localBrightness = e.target.value / 100; });
    }
}

// ─── CLASE FireParticle GLOBAL ────────────────────────
// CORRECCIÓN BUG 1: currentBrightness estaba referenciado como variable local
// del scope DOMContentLoaded. Ahora se lee desde window.currentBrightness
// (asignado por window.updateSliderFill) con fallback seguro al DOM.
// CORRECCIÓN BUG 2 (indirecta): isFireActive también se lee desde window para
// evitar cualquier ReferenceError si la clase se instancia antes del DOMContentLoaded.
class FireParticle {
    constructor() {
        const currentCanvas = document.getElementById('fireCanvasModular');
        this.canvasW = currentCanvas ? currentCanvas.width : 434;
        this.canvasH = currentCanvas ? currentCanvas.height : 216;

        const actor = Math.random();
        this.actor = "fill";
        if (actor < 0.15) this.actor = "hero";
        else if (actor < 0.40) this.actor = "support";

        const selectorCapa = Math.random();
        const esPixel = window.pixelModeActivo;
        const escalaBase = esPixel ? 0.35 : 1.0; 

        // ─── FOCALIZACIÓN DEL FUEGO SOBRE LA LEÑA ───
        // Reducimos la dispersión a un ancho del 32% central del canvas
        const centroCanvas = this.canvasW * 0.50;
        const dispersionLeña = this.canvasW * 0.32; 

        if (selectorCapa < 0.40) {
            this.rol = 'base';
            this.x = centroCanvas + (Math.random() - 0.5) * dispersionLeña; 
            this.y = this.canvasH - (esPixel ? 4 : 14); 
            this.vy = -(Math.random() * (esPixel ? 0.4 : 0.9) + (esPixel ? 0.3 : 0.6));
            this.vx = (Math.random() * 0.2 - 0.10);
            this.baseWidth = (Math.random() * 10 + 6) * escalaBase;
            this.decay = Math.random() * 0.022 + 0.016;
        } else if (selectorCapa < 0.80) {
            this.rol = 'cuerpo';
            this.x = centroCanvas + (Math.random() - 0.5) * (dispersionLeña * 0.8);
            this.y = this.canvasH - (esPixel ? 6 : 18);
            this.vy = -(Math.random() * (esPixel ? 0.6 : 1.6) + (esPixel ? 0.4 : 1.1));
            this.vx = (Math.random() * 0.4 - 0.20);
            this.baseWidth = (Math.random() * 9 + 5) * escalaBase;
            this.decay = Math.random() * 0.018 + 0.012;
        } else {
            this.rol = 'punta';
            this.x = centroCanvas + (Math.random() - 0.5) * (dispersionLeña * 0.6);
            this.y = this.canvasH - (esPixel ? 8 : 22);
            this.vy = -(Math.random() * (esPixel ? 0.8 : 1.8) + (esPixel ? 0.5 : 1.2)); 
            this.vx = (Math.random() * 0.4 - 0.20);
            this.baseWidth = (Math.random() * 6 + 3) * escalaBase;
            this.decay = Math.random() * 0.025 + 0.018;
        }

        if (this.actor === "hero") {
            this.baseWidth *= 1.2;
            this.vy *= 0.85;
            this.decay *= 0.7;
        }

        this.life = 1.0;
    }
    update() {
        const sliderViento = document.getElementById('wind-slider');
        const windPower = sliderViento ? parseFloat(sliderViento.value) / 100 : 0.3;
        const btnMuteWind = document.getElementById('btn-mute-wind');
        const isWindActive = btnMuteWind ? btnMuteWind.classList.contains('active') : true;

        const multiplicadorCaos = this.rol === 'punta' ? 1.2 : 0.4;
        const microCaos = (Math.random() * 2 - 1) * multiplicadorCaos;

        this.x += this.vx + (isWindActive ? windPower * 1.8 : 0) + microCaos;
        this.y += this.vy;

        this.life -= this.decay;
    }

    draw() {
        const currentCanvas = document.getElementById('fireCanvasModular');
        if (!currentCanvas || this.life <= 0) return;
        const canvasCtx = currentCanvas.getContext('2d');

        // LEEMOS EL COLOR INTERPOLADO Y VALORES BASE
        const posVal = window.colorInterpolado !== undefined ? window.colorInterpolado : (window.colorActualPosicion || 2);
        const b = window.currentBrightness || 0.8;

        if (window.pixelModeActivo) {
            // ─── MODO B: PIXEL ART LUMINOSO (4PX) ───
            const tamGrid = 4;
            const posX = Math.floor(this.x / tamGrid) * tamGrid;
            const posY = Math.floor(this.y / tamGrid) * tamGrid;
            
            const anchoPx = Math.max(tamGrid, Math.floor((this.baseWidth * this.life * 1.2) / tamGrid) * tamGrid);
            const altoPx  = Math.floor((anchoPx * 2.2) / tamGrid) * tamGrid;

            let colorBase, colorCuerpo, colorPunta;

            if (posVal <= 2.0) { // ROJO
                colorBase   = '#ffa3a3';
                colorCuerpo = '#ff2200';
                colorPunta  = '#880000';
            } else if (posVal >= 3.0) { // AZUL
                colorBase   = '#ffffff';
                colorCuerpo = '#00aaff';
                colorPunta  = '#002288';
            } else { // NARANJA RETRO
                colorBase   = '#fffaaa';
                colorCuerpo = '#ff6600';
                colorPunta  = '#cc1100';
            }

            canvasCtx.save();
            canvasCtx.globalCompositeOperation = 'screen';

            // Base incandescente
            canvasCtx.fillStyle = colorBase;
            canvasCtx.fillRect(posX, posY + (altoPx * 0.5), anchoPx, altoPx * 0.5);

            // Cuerpo medio
            canvasCtx.fillStyle = colorCuerpo;
            canvasCtx.fillRect(posX, posY + (altoPx * 0.25), anchoPx, altoPx * 0.5);

            // Punta de la llama
            canvasCtx.fillStyle = colorPunta;
            canvasCtx.fillRect(posX, posY, Math.max(tamGrid, anchoPx - tamGrid), altoPx * 0.3);

            // Chispas flotantes
            if (this.life > 0.5 && Math.random() < 0.2) {
                canvasCtx.fillStyle = colorBase;
                const chispaX = posX + (Math.floor((Math.random() * 3) - 1) * tamGrid);
                const chispaY = posY - (Math.floor(Math.random() * 3 + 1) * tamGrid);
                canvasCtx.fillRect(chispaX, chispaY, tamGrid, tamGrid * 1.5);
            }

            canvasCtx.restore();

        } else {
            // ─── MODO A: FUEGO SUAVE ORIGINAL (FACHADA NORMAL) ───
            canvasCtx.save();
            canvasCtx.globalCompositeOperation = 'screen';

            let colorCore, colorBody, colorEdge;

            if (posVal <= 2.0) {
                const t = posVal - 1.0;
                const rBody = Math.round(240 + (15 * t));
                const gBody = Math.round(50 + (80 * t));
                const bBody = Math.round(20 * (1 - t));

                colorCore = `rgba(255, ${Math.round(235 + 20 * t)}, ${Math.round(220 + 20 * t)}, ${this.life * b})`;
                colorBody = `rgba(${rBody}, ${gBody}, ${bBody}, ${this.life * b * 0.75})`;
                colorEdge = `rgba(${Math.round(120 + 60 * t)}, ${Math.round(30 * t)}, 0, 0)`;
            } else {
                const t = posVal - 2.0;
                const rBody = Math.round(255 * (1 - t));
                const gBody = Math.round(130);
                const bBody = Math.round(255 * t);

                colorCore = `rgba(${Math.round(255 - 35 * t)}, ${Math.round(255 - 10 * t)}, ${Math.round(240 + 15 * t)}, ${this.life * b})`;
                colorBody = `rgba(${rBody}, ${gBody}, ${bBody}, ${this.life * b * 0.8})`;
                colorEdge = `rgba(${Math.round(180 * (1 - t))}, ${Math.round(20 * (1 - t))}, ${Math.round(120 * t)}, 0)`;
            }

            let radioX = Math.max(1.0, this.baseWidth * this.life * 0.5);
            let radioY = radioX * 3.2; 

            if (this.actor === "hero") {
                radioX *= 1.15;
                radioY *= 1.35;
            }

            const gradient = canvasCtx.createRadialGradient(0, 0, 0, 0, 0, radioY);
            gradient.addColorStop(0, colorCore);
            gradient.addColorStop(0.25, colorBody);
            gradient.addColorStop(1, colorEdge);

            canvasCtx.translate(this.x, this.y);
            canvasCtx.scale(radioX / radioY, 1.0);

            canvasCtx.beginPath();
            canvasCtx.arc(0, 0, radioY, 0, Math.PI * 2);
            canvasCtx.fillStyle = gradient;
            canvasCtx.fill();

            canvasCtx.restore();
        }
    }
}

window.updateSliderFill = function(type, value) {
    const fill = document.getElementById(`fill-${type}`);
    const val  = document.getElementById(`${type}-val`);
    if (fill) fill.style.height = `${value}%`;
    if (val)  val.textContent   = `${value}%`;

    const selectorFreq = document.getElementById('sync-freq');
    if (selectorFreq && selectorFreq.value === 'eco') {
        if (type === 'bright') window.currentBrightness = value / 100;
        return;
    }

 if (type === 'bright') {
        const factorBrillo = value / 100;
        window.currentBrightness = factorBrillo;

        // Inyectamos la intensidad del slider a la variable CSS para escalar la respiración
        document.documentElement.style.setProperty('--brillo-usuario', factorBrillo);

        // Sincronización estricta de opacidad del suelo con el slider de brillo
        const reflejoSuelo = document.getElementById('reflejo-suelo-ambiental');
        if (reflejoSuelo) {
            reflejoSuelo.style.opacity = factorBrillo;
        }

        broadcastOrder('CAMBIO_BRILLO', factorBrillo);
    }

    if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'running') {
        if (type === 'fire' && typeof fireGain !== 'undefined' && fireGain) {
            const btnFire = document.getElementById('btn-mute-fire');
            if (btnFire && btnFire.classList.contains('active')) {
                fireGain.gain.setValueAtTime(value / 100, audioCtx.currentTime);
            }
        }
        if (type === 'wind' && typeof windGain !== 'undefined' && windGain) {
            const btnWind = document.getElementById('btn-mute-wind');
            if (btnWind && btnWind.classList.contains('active')) {
                windGain.gain.setValueAtTime((value / 100) * 0.3, audioCtx.currentTime);
            }
        }
    }

    if (type === 'fire') {
        const btnFire = document.getElementById('btn-mute-fire');
        const enviar = (btnFire && btnFire.classList.contains('active')) ? (value / 100) : 0;
        broadcastOrder('SET_AUDIO_FIRE', enviar);

        // AQUÍ ESTÁN LAS 4 LÍNEAS NUEVAS:
        const capaFondoNicho = document.getElementById('capa-fondo-nicho');
        if (capaFondoNicho) {
            capaFondoNicho.style.opacity = ( (value / 100) * 0.85 ).toString();
        }
    }
    if (type === 'wind') {
        const btnWind = document.getElementById('btn-mute-wind');
        const enviar = (btnWind && btnWind.classList.contains('active')) ? ((value / 100) * 0.5) : 0;
        broadcastOrder('SET_AUDIO_WIND', enviar);
        
    }
    
};


// ─── 8. DOM, REDIMENSIÓN NATIVA Y LISTENERS ───────────
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('fireCanvasModular');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    window.currentBrightness = 0.8;
    window.isFireActive = false;
    let combustionPulse = 0;
let combustionSpeed = 0.018;
    let isRemoteMode = false;

    function resizeCanvas() { 
        const modularCanvas = document.getElementById('fireCanvasModular');
        if (modularCanvas) {
            if (window.pixelModeActivo) {
                modularCanvas.width = 160;
                modularCanvas.height = 90;
            } else {
                modularCanvas.width = modularCanvas.clientWidth || 434;
                modularCanvas.height = modularCanvas.clientHeight || 216;
            }
            // Purga instantánea de partículas desfasadas al cambiar resolución
            particles = [];
        }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
// ─── ARCHITECTURA HÍBRIDA: CONFIGURACIÓN SPRINT A (LAYER 1) ───
const AURA_POCKETS_CONFIG = [
    { xPct: 0.32, rMin: 20, rMax: 34, speed: 0.035, intensity: 0.85 }, // Grieta Izquierda
    { xPct: 0.50, rMin: 30, rMax: 46, speed: 0.022, intensity: 1.00 }, // Corazón de Brasa Central
    { xPct: 0.68, rMin: 22, rMax: 36, speed: 0.041, intensity: 0.80 }  // Grieta Derecha
];

let auraBaseThermalTime = 0;

/**
 * Renderiza la masa continua de gas caliente en la base de la leña (Layer 1)
 */
function renderBaseCombustionLayer(canvasCtx, width, height, brightness) {
    canvasCtx.save();
    canvasCtx.globalCompositeOperation = 'screen';

    // Reloj interno para la tasa de respiración térmica
    auraBaseThermalTime += 0.02;

    // ──── COMPONENTE 1: GLOW BASE MACRO (Borra el fondo negro absoluto) ────
    const centroX = width / 2;
    const centroY = height;
    const radioGasesMacro = height * 0.85;

    const respiracion =
    0.92 + (Math.sin(combustionPulse) * 0.08);

const colorGasBase =
    `rgba(180,55,0,${0.15 * brightness * respiracion})`;
    const colorGasFuga = 'rgba(0, 0, 0, 0)';

    const gradienteMacro = canvasCtx.createRadialGradient(
        centroX, centroY - 5, 5,
        centroX, centroY, radioGasesMacro
    );
    gradienteMacro.addColorStop(0, colorGasBase);
    gradienteMacro.addColorStop(0.5, `rgba(140, 35, 0, ${0.04 * brightness})`);
    gradienteMacro.addColorStop(1, colorGasFuga);

    canvasCtx.fillStyle = gradienteMacro;
    canvasCtx.fillRect(0, 0, width, height);

    // ──── COMPONENTE 2 Y 3: HEAT POCKETS + MICRO-SHIMMER VERTICAL ────
    AURA_POCKETS_CONFIG.forEach((pocket, index) => {
        const x = width * pocket.xPct;
        const y = height;

        // Oscilación vertical asincrónica para evitar sincronización robótica
        const desfase = index * 1.5;
        const factorOscilacion = Math.sin(auraBaseThermalTime * pocket.speed * 80 + desfase);
        const radioDinamicoY = pocket.rMin + (factorOscilacion + 1) * 0.5 * (pocket.rMax - pocket.rMin);
        
        // Radio horizontal expandido fijo para crear la cordillera unificada
        const radioFijoX = pocket.rMin * 2.2; 

        const gradientePocket = canvasCtx.createRadialGradient(
            x, y - 2, 0,
            x, y, radioFijoX
        );
        
        const variacionPocket =
    0.96 +
    Math.sin(
        combustionPulse +
        index * 0.9
    ) * 0.10;

const coreOpacity =
    0.40 *
    pocket.intensity *
    brightness *
    variacionPocket;
        const bodyOpacity =
    0.12 *
    pocket.intensity *
    brightness *
    variacionPocket;

        gradientePocket.addColorStop(0, `rgba(255, 120, 0, ${coreOpacity})`);
        gradientePocket.addColorStop(0.3, `rgba(200, 50, 0, ${bodyOpacity})`);
        gradientePocket.addColorStop(1, 'rgba(0, 0, 0, 0)');

        // Deformación geométrica por hardware (Elipse horizontal aplastado)
        canvasCtx.save();
        canvasCtx.translate(x, y);
        canvasCtx.scale(1, radioDinamicoY / radioFijoX);
        
        canvasCtx.beginPath();
        canvasCtx.arc(0, 0, radioFijoX, 0, Math.PI * 2);
        canvasCtx.fillStyle = gradientePocket;
        canvasCtx.fill();
        canvasCtx.restore();
    });

    canvasCtx.restore();
}

    // 🔥 MOTOR DE ANIMACIÓN MODULAR INTEGRADO CON ARQUITECTURA HÍBRIDA 🔥
    function animateFire() {

        combustionPulse += combustionSpeed;

        if (combustionPulse > Math.PI * 2) {
            combustionPulse = 0;
        }

        // 1. Rastro de Seda (En lugar de clearRect puro, dibujamos una estela transparente)
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'; // Ajusta la suavidad del desvanecimiento
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        // 2. LAYER 1: Base de combustión térmica
        if (window.isFireActive) {
            let brilloSeguro = (typeof window.currentBrightness === 'number' && !isNaN(window.currentBrightness)) 
                ? window.currentBrightness 
                : 0.8;

            renderBaseCombustionLayer(
                ctx, 
                canvas.width, 
                canvas.height, 
                brilloSeguro
            );
        }

        // 3. Alimentamos las partículas
        if (window.isFireActive && particles.length < 110) { 
            particles.push(new FireParticle());
            particles.push(new FireParticle());
        }

        // 4. Actualización y renderizado
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            
            p.update(); 
            p.draw();   

            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }

        requestAnimationFrame(animateFire);
    }
    
    // Encendemos el motor gráfico por primera vez
    animateFire();

    
    // VINCULACIÓN MAESTRA DEL BOTÓN REAL DE ACCESO SENSORIAL
    const startBtnReal = document.getElementById('start-experience-btn');
    const welcomeScreen = document.getElementById('welcome-screen');
    const uiLayer = document.getElementById('ui-layer');
    document.getElementById('fireCanvas').style.display = 'none';
    // Transición del Marco: de frío a resplandor activo
            const marcoSignature = document.getElementById('capa-marco-signature');
            if (marcoSignature) {
                marcoSignature.style.opacity = '1';
                marcoSignature.style.filter = 'none'; // Quita la penumbra inicial
                marcoSignature.style.animation = 'parpadeo-fuego-naranja 3s infinite ease-in-out';
            }

            // Encendido progresivo de la leña
            const leñaMaster = document.getElementById('capa-leña-incandescente');
            if (leñaMaster) {
                leñaMaster.style.opacity = '1';
            }

    if (startBtnReal) {
        startBtnReal.addEventListener('click', async () => {
            if (typeof activarAudio === 'function') await activarAudio();
            if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            if (typeof fireGain !== 'undefined' && fireGain) {
                fireGain.gain.setValueAtTime(0, audioCtx.currentTime);
                fireGain.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 1.5);
            }
            if (typeof windGain !== 'undefined' && windGain) {
                windGain.gain.setValueAtTime(0, audioCtx.currentTime);
                windGain.gain.linearRampToValueAtTime(0.09, audioCtx.currentTime + 1.5);
            }

            const brightSlider = document.getElementById('bright-slider');
            window.currentBrightness = brightSlider ? parseFloat(brightSlider.value) / 100 : 0.8;
            window.isFireActive = true;

            // Alíneamos las partículas con el ritmo rápido de combustión
            particles = [];
            for (let i = 0; i < 120; i++) { // <-- Subimos a 120 para mayor densidad
                setTimeout(() => { 
                    if (window.isFireActive && !isRemoteMode) particles.push(new FireParticle()); 
                }, i * 8); // <-- Nacen más rápido (cada 8ms en lugar de 15ms)
            }

            // REVELADO DE FACHADA REAL
            const imgFachada = document.getElementById('img-fachada-real');
            if (imgFachada) imgFachada.style.opacity = '1';

            // ─── REVELADO DEL NICHO DE CHIMENEA ───
            const fondoNicho = document.getElementById('capa-fondo-nicho');
            if (fondoNicho) {
                fondoNicho.style.opacity = '1';
            }

            // ⚡ 🔥 INTEGRACIÓN CAPA 5: INYECTAR PARPADEO BASE AL MARCO AL ENCENDER 🔥 ⚡
            const marcoSignature = document.getElementById('capa-marco-signature');
            if (marcoSignature) {
                marcoSignature.style.animation = 'parpadeo-fuego-naranja 3s infinite ease-in-out';
            }

            if (welcomeScreen) { welcomeScreen.style.opacity = '0'; welcomeScreen.style.visibility = 'hidden'; }
            if (uiLayer) { uiLayer.style.opacity = '1'; uiLayer.style.pointerEvents = 'auto'; }

            if (typeof window.updateSliderFill === 'function') {
                const bS = document.getElementById('bright-slider');
                const fS = document.getElementById('fire-slider');
                const wS = document.getElementById('wind-slider');
                if (bS) window.updateSliderFill('bright', bS.value);
                if (fS) window.updateSliderFill('fire', fS.value);
                if (wS) window.updateSliderFill('wind', wS.value);
            }
        });
    }

// VINCULACIÓN MECÁNICA DE SLIDERS NATIVOS DE ENTORNO RECTIFICADA
    const slidersConfig = [
        { id: 'bright-slider', type: 'bright' },
        { id: 'fire-slider', type: 'fire' },
        { id: 'wind-slider', type: 'wind' }
    ];

    slidersConfig.forEach(cfg => {
        const sliderElement = document.getElementById(cfg.id);
        if (sliderElement) {
            sliderElement.addEventListener('input', (e) => {
                window.updateSliderFill(cfg.type, e.target.value);
            });
        }
    });

    window.activarModoControlRemoto = function() {
        isRemoteMode = true;
        if(canvas) canvas.classList.add('remote-mode');
        document.getElementById('fire-zone')?.classList.add('remote-mode');
        document.getElementById('controls-zone')?.classList.add('remote-mode');
        document.getElementById('remote-header')?.classList.add('visible');
        window.isFireActive = false;
    };
    
    window.desactivarModoControlRemoto = function() {
        isRemoteMode = false;
        window.isFireActive = true;
        if(canvas) canvas.classList.remove('remote-mode');
        document.getElementById('fire-zone')?.classList.remove('remote-mode');
        document.getElementById('controls-zone')?.classList.remove('remote-mode');
        document.getElementById('remote-header')?.classList.remove('visible');
        if (particles.length === 0) {
            for (let i = 0; i < 75; i++) {
                setTimeout(() => { if (window.isFireActive && !isRemoteMode) particles.push(new FireParticle()); }, i * 15);
            }
        }
    };

    window.renderizarHistorialTVs = function() {
        const container = document.getElementById('historial-tvs-container');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (historialTVs.length === 0) {
            container.innerHTML = `<span style="color:rgba(255,255,255,0.3); font-size:11px; font-style:italic; padding-top:4px;">No hay dispositivos guardados.</span>`;
            return;
        }

        historialTVs.forEach(tv => {
            const isSelected = (window.codigoTVActiva !== null && tv.codigo === window.codigoTVActiva);
            const isSocketAlive = (window.listaCanalesAbiertos[tv.codigo] !== undefined);
            
            const dotColor = isSocketAlive ? '#3ddc84' : '#555555';
            const dotShadow = isSocketAlive ? '0 0 6px rgba(61, 220, 132, 0.6)' : 'none';
            
            let actionText = 'Conectar';
            let actionCall = `window.conectarTVDesdeHistorial('${tv.codigo}')`;

            if (isSocketAlive) {
                if (isSelected) {
                    actionText = 'Desconectar';
                    actionCall = `window.ejecutarDesvinculacionTV('${tv.codigo}')`;
                } else {
                    actionText = 'Controlar';
                    actionCall = `window.conectarTVDesdeHistorial('${tv.codigo}')`;
                }
            }
            
            const activeClass = isSelected ? 'active-tv' : '';
            const htmlContent = `
                <div class="tv-list-row ${activeClass}">
                    <div class="tv-list-info" onclick="window.editarNombreTV('${tv.codigo}')" title="Editar nombre">
                        <span class="tv-list-dot" style="background:${dotColor}; box-shadow:${dotShadow};"></span>
                        <span class="tv-list-name">${tv.nombre} <span style="font-size:9px; color:var(--gold); margin-left:2px; opacity:0.7;">✏️</span></span>
                    </div>
                    <div class="tv-list-actions">
                        <button class="tv-list-btn" onclick="${actionCall}">${actionText}</button>
                        <button class="tv-list-delete" onclick="window.eliminarTVDesdeHistorial('${tv.codigo}')" title="Eliminar TV">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
            container.innerHTML += htmlContent;

            const btnAgregar = document.getElementById('btn-agregar-nueva-tv');
            if (btnAgregar) {
                btnAgregar.style.display = historialTVs.length >= 3 ? 'none' : 'flex';
            }
        });
    };

    window.conectarTVDesdeHistorial = async function(codigo) {
        vinculacionEnProceso = false; 
        handshakeCompletado = false;

        if (window.listaCanalesAbiertos[codigo]) {
            window.codigoTVActiva = codigo;
            historialTVs.forEach(t => t.activo = (t.codigo === codigo));
            localStorage.setItem('aura_historial_tvs', JSON.stringify(historialTVs));
            
            if (typeof window.activarModoControlRemoto === 'function') window.activarModoControlRemoto();
            window.renderizarHistorialTVs();
            
            const backdrop = document.getElementById('settings-backdrop');
            if (backdrop) backdrop.click();
            
            mostrarToast(`Control enfocado en: ${obtenerONombreSecuencial(codigo)} ⚡`);

            const memoriaTV = window.estadosSlidersTVs[codigo];
            const brightSlider = document.getElementById('bright-slider');
            const fireSlider   = document.getElementById('fire-slider');
            const windSlider   = document.getElementById('wind-slider');
            const fillBright = document.getElementById('fill-bright');
            const fillFire   = document.getElementById('fill-fire');
            const fillWind   = document.getElementById('fill-wind');
            const valBright = document.getElementById('bright-value') || fillBright?.parentElement?.parentElement?.querySelector('.capsule-value');
            const valFire   = document.getElementById('fire-value')   || fillFire?.parentElement?.parentElement?.querySelector('.capsule-value');
            const valWind   = document.getElementById('wind-value')   || fillWind?.parentElement?.parentElement?.querySelector('.capsule-value');

            if (memoriaTV) {
                if (brightSlider) brightSlider.value = memoriaTV.brillo;
                if (fireSlider)   fireSlider.value   = memoriaTV.fuego;
                if (windSlider)   windSlider.value   = memoriaTV.viento;
                if (fillBright) fillBright.style.height = `${memoriaTV.brillo}%`;
                if (fillFire)   fillFire.style.height   = `${memoriaTV.fuego}%`;
                if (fillWind)   fillWind.style.height   = `${memoriaTV.viento}%`;
                if (valBright) valBright.textContent = `${memoriaTV.brillo}%`;
                if (valFire)   valFire.textContent   = `${memoriaTV.fuego}%`;
                if (valWind)   valWind.textContent   = `${memoriaTV.viento}%`;
            } else {
                if (brightSlider) brightSlider.value = 80;
                if (fireSlider)   fireSlider.value   = 50;
                if (windSlider)   windSlider.value   = 30;
                if (fillBright) fillBright.style.height = '80%';
                if (fillFire)   fillFire.style.height = '50%';
                if (fillWind)   fillWind.style.height = '30%';
                if (valBright) valBright.textContent = '80%';
                if (valFire)   valFire.textContent = '50%';
                if (valWind)   valWind.textContent = '30%';
            }
            return;
        }

        const backdrop = document.getElementById('settings-backdrop');
        if (backdrop) backdrop.click();
        window.procesarCodigoVinculacion(codigo);
    };

    window.eliminarTVDesdeHistorial = function(codigo) {
        const tv = historialTVs.find(t => t.codigo === codigo);
        if(!tv) return;
        const confirmacion = confirm(`¿Estás seguro de eliminar el dispositivo "${tv.nombre}"?`);
        if(!confirmacion) return;
        if (window.listaCanalesAbiertos[codigo]) window.ejecutarDesvinculacionTV(codigo);
        historialTVs = historialTVs.filter(t => t.codigo !== codigo);
        localStorage.setItem('aura_historial_tvs', JSON.stringify(historialTVs));
        window.renderizarHistorialTVs();
        mostrarToast(`Dispositivo eliminado correctamente.`);
    };

    window.editarNombreTV = function(codigoTv) {
        const codigoBuscado = codigoTv || window.codigoTVActiva;
        if (!codigoBuscado) return;
        const tv = historialTVs.find(t => t.codigo === codigoBuscado);
        if (!tv) return;
        let nuevoNombre = prompt(`Personaliza el nombre para este espacio:`, tv.nombre);
        if (nuevoNombre === null) return;
        nuevoNombre = nuevoNombre.trim();
        if (nuevoNombre === "") {
            nuevoNombre = `Aura TV ${historialTVs.findIndex(t => t.codigo === codigoBuscado) + 1}`;
            mostrarToast(`Nombre vacío. Restaurado a ${nuevoNombre}`);
        }
        tv.nombre = nuevoNombre;
        localStorage.setItem('aura_historial_tvs', JSON.stringify(historialTVs));
        window.renderizarHistorialTVs();
        mostrarToast(`Dispositivo renombrado a: ${nuevoNombre} ✓`);
    };

    window.renderizarHistorialTVs();
    const tvActivaPreviamente = historialTVs.find(t => t.activo === true);
    if (tvActivaPreviamente && tvActivaPreviamente.codigo) {
        window.codigoTVActiva = tvActivaPreviamente.codigo;
    }

    // ─── MOTOR QR RECONSTRUIDO CON HTML5QRCODE REAL ───
    let qrScannerInstance = null;

    window.startQRScanner = function() {
        const containerQr = document.getElementById('qr-reader-v2');
        if (!containerQr) return;

        if (!qrScannerInstance) {
            qrScannerInstance = new Html5Qrcode("qr-reader-v2");
        }

        qrScannerInstance.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 180, height: 180 } },
            (textoCodigo) => {
                window.stopQRScanner();
                const panelTv = document.getElementById('tv-linking-panel');
                if (panelTv) panelTv.style.display = 'none';
                window.procesarCodigoVinculacion(textoCodigo);
            },
            (errorSilencioso) => {}
        ).catch(err => {
            console.error("Fallo de hardware de cámara:", err);
            mostrarToast("Permite el acceso a la cámara en los ajustes.");
        });
    };

    window.stopQRScanner = function() {
        if (qrScannerInstance && qrScannerInstance.isScanning) {
            qrScannerInstance.stop().catch(e => console.warn("Error al mitigar cámara:", e));
        }
    };

    const btnAgregarNuevaTV = document.getElementById('btn-agregar-nueva-tv');
    if (btnAgregarNuevaTV) {
        btnAgregarNuevaTV.addEventListener('click', (e) => {
            e.preventDefault();
            vinculacionEnProceso = false;
            handshakeCompletado = false;
            const backdrop = document.getElementById('settings-backdrop');
            const drawer   = document.getElementById('settings-drawer');
            if (backdrop && drawer) {
                backdrop.classList.remove('active'); drawer.classList.remove('active');
                setTimeout(() => { backdrop.style.display = 'none'; }, 400);
            }
            const tvPanel = document.getElementById('tv-linking-panel');
            if (tvPanel) {
                tvPanel.style.display = 'flex';
                window.startQRScanner();
            }
        });
    }

    // VINCULACIÓN MANUAL POR BOTÓN DE 5 DÍGITOS
    const btnConectarManualReal = document.getElementById('connect-manual-btn');
    if (btnConectarManualReal) {
        btnConectarManualReal.addEventListener('click', (e) => {
            e.preventDefault();
            const inputCodigo = document.getElementById('manual-code-input');
            if (inputCodigo && inputCodigo.value.trim() !== "") {
                window.procesarCodigoVinculacion(inputCodigo.value.trim());
            } else {
                mostrarToast('Por favor introduce un código de 5 dígitos.');
            }
        });
    }

    // ESCUCHADORES MAESTROS DE MUTES PARA AUDIO GENERATIVO LOCAL Y TRANSMISIÓN NATIVA
    const btnMuteFireReal = document.getElementById('btn-mute-fire');
    if (btnMuteFireReal) {
        btnMuteFireReal.addEventListener('click', (e) => {
            e.preventDefault();
            btnMuteFireReal.classList.toggle('active');
            const estaActivo = btnMuteFireReal.classList.contains('active');
            const volFuego = parseFloat(document.getElementById('fire-slider')?.value || 50) / 100;

            if (audioCtx && fireGain && audioCtx.state === 'running') {
                if (estaActivo) {
                    fireGain.gain.setValueAtTime(0, audioCtx.currentTime);
                    fireGain.gain.linearRampToValueAtTime(volFuego, audioCtx.currentTime + 0.3);
                } else {
                    fireGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
                }
            }
            if (typeof broadcastOrder === 'function') broadcastOrder('SET_AUDIO_FIRE', estaActivo ? volFuego : 0);
        });
    }

    const btnMuteWindReal = document.getElementById('btn-mute-wind');
    if (btnMuteWindReal) {
        btnMuteWindReal.addEventListener('click', (e) => {
            e.preventDefault();
            btnMuteWindReal.classList.toggle('active');
            const estaActivo = btnMuteWindReal.classList.contains('active');
            const volViento = parseFloat(document.getElementById('wind-slider')?.value || 30) / 100;

            if (audioCtx && windGain && audioCtx.state === 'running') {
                if (estaActivo) {
                    windGain.gain.setValueAtTime(0, audioCtx.currentTime);
                    windGain.gain.linearRampToValueAtTime(volViento * 0.3, audioCtx.currentTime + 0.3);
                } else {
                    windGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
                }
            }
            if (typeof broadcastOrder === 'function') broadcastOrder('SET_AUDIO_WIND', estaActivo ? volViento * 0.5 : 0);
        });
    }
    // ─── ESTILOS Y ESTRUCTURAS INYECTADOS NATIVAMENTE ───
    const style = document.createElement('style');
    style.textContent = `
        .controls-zone.remote-mode {
            position: fixed !important; top: 54px !important; left: 0 !important; width: 100vw !important;
            height: calc(100vh - 54px) !important; z-index: 90 !important; display: flex !important;
            flex-direction: column !important; justify-content: center !important; align-items: center !important;
            background: #050505 !important; padding: 0 10px !important;
        }
        .controls-zone.remote-mode .capsules-container { height: 320px !important; align-items: flex-end !important; max-width: 450px !important; width: 100% !important; }
        .controls-zone.remote-mode .slider-box { height: 220px !important; width: 44px !important; border-radius: 22px !important; }
        .controls-zone.remote-mode input[type=range].vertical-slider { width: 220px !important; height: 44px !important; top: 88px !important; left: -88px !important; }
        .controls-zone.remote-mode input[type=range].vertical-slider::-webkit-slider-thumb { width: 12px !important; height: 44px !important; border-radius: 6px !important; }
        .controls-zone.remote-mode .slider-fill { border-radius: 0 0 22px 22px !important; }
        .controls-zone.remote-mode .capsule-value { font-size: 18px !important; font-weight: 600 !important; color: var(--gold) !important; margin-bottom: 15px !important; text-shadow: 0 0 10px rgba(212,175,55,0.4) !important; letter-spacing: 2px !important; }
        .controls-zone.remote-mode .capsule-footer-btn svg, .controls-zone.remote-mode .capsule-footer-info svg { width: 24px !important; height: 24px !important; margin-bottom: 6px !important; }
        .controls-zone.remote-mode .capsule-footer-btn span, .controls-zone.remote-mode .capsule-footer-info span { font-size: 10px !important; letter-spacing: 2px !important; }
        .controls-zone.remote-mode #aura-pro-btn { padding: 16px 36px !important; font-size: 12px !important; margin-top: 45px !important; }
        
       /* ─── CIRUGÍA AURA v8.0: EFECTO IMÁN COMPACTO (MÁXIMO 3 DEVICES) ─── */
        /* Eliminamos el aire muerto para que el botón actúe como imán pegado a las filas */
        #historial-tvs-container {
            margin-top: 8px !important;
            margin-bottom: 0px !important;
            display: flex !important;
            flex-direction: column !important;
        }

        /* Distancia corta, simétrica y estética para el botón de agregar */
        #btn-agregar-nueva-tv {
            margin-top: 8px !important;
        }
    `; // Sello hermético del Template Literal de JavaScript
    document.head.appendChild(style);

    

    // UN SOLO BLOQUE DE CABECERA REMOTA (Limpio y corregido)
    const remoteHeader = document.getElementById('remote-header');
    if (remoteHeader) {
        const configRemote = document.getElementById('config-trigger-remote');
        const remoteBadge  = document.querySelector('.remote-badge');
        const h1Remote     = remoteHeader.querySelector('h1');
        if (configRemote && remoteBadge && h1Remote) { remoteHeader.innerHTML = ''; remoteHeader.appendChild(configRemote); remoteHeader.appendChild(h1Remote); remoteHeader.appendChild(remoteBadge); }
    }
   
    
    // ── MODAL CONTRASEÑA ──────────────────────────────────────────────────
    const pwdBackdrop  = document.getElementById('password-modal-backdrop');
    const pwdModal     = document.getElementById('password-modal');
    const btnCancelPwd = document.getElementById('cancel-pwd-btn');
    const btnSavePwd   = document.getElementById('save-pwd-btn');
    const btnChangePwd = document.getElementById('btn-change-password');

    const abrirModalPwdInterno = () => { if (pwdBackdrop && pwdModal) { pwdBackdrop.style.display = 'block'; setTimeout(() => { pwdBackdrop.classList.add('active'); pwdModal.classList.add('active'); }, 10); } };
    const cerrarModalPwdInterno = () => { if (pwdBackdrop && pwdModal) { pwdBackdrop.classList.remove('active'); pwdModal.classList.remove('active'); setTimeout(() => { pwdBackdrop.style.display = 'none'; }, 300); } };

    // ── CONFIGURACIÓN DE APERTURA Y CIERRE DEL MODAL ──────────────────────
    if (btnChangePwd) btnChangePwd.addEventListener('click', (e) => { e.preventDefault(); abrirModalPwdInterno(); });
    if (btnCancelPwd) btnCancelPwd.addEventListener('click', (e) => { e.preventDefault(); cerrarModalPwdInterno(); });
    if (pwdBackdrop) pwdBackdrop.addEventListener('click', (e) => { if (e.target === pwdBackdrop) cerrarModalPwdInterno(); });

    // ─── CIRUGÍA AURA v8.5: REPARACIÓN DE CONTRASEÑA REAL Y POKA-YOKE CONGRUENTE ───
    const botonGuardarContraseña = document.getElementById('save-pwd-btn'); // Vinculación directa con dashboard.html
    if (botonGuardarContraseña) {
        // Clonamos el botón para limpiar cualquier listener residual que esté duplicando eventos
        const botonLimpio = botonGuardarContraseña.cloneNode(true);
        botonGuardarContraseña.parentNode.replaceChild(botonLimpio, botonGuardarContraseña);

        botonLimpio.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Captura de los valores de entrada de tu formulario flotante
            const txtCurrent = document.getElementById('current-pwd')?.value.trim() || '';
            const txtNew     = document.getElementById('new-pwd')?.value.trim() || '';
            const txtConfirm = document.getElementById('confirm-pwd')?.value.trim() || '';
            const idiomaActual = document.getElementById('app-language')?.value ?? 'es';

            // 1. POKA-YOKE: Filtro protector de campos vacíos
            if (!txtCurrent || !txtNew || !txtConfirm) {
                mostrarToast(idiomaActual === 'en' ? 'Please fill all fields.' : 'Por favor llena todos los campos.');
                return;
            }

            // 2. POKA-YOKE: Filtro de coincidencia estricta de la contraseña nueva
            if (txtNew !== txtConfirm) {
                mostrarToast(idiomaActual === 'en' ? 'New passwords do not match.' : 'Las nuevas contraseñas no coinciden.');
                return;
            }

            // 3. POKA-YOKE: Filtro de longitud mínima de seguridad industrial
            if (txtNew.length < 6) {
                mostrarToast(idiomaActual === 'en' ? 'Password must be at least 6 characters.' : 'La contraseña debe tener al menos 6 caracteres.');
                return;
            }

            // Bloqueamos la interfaz para evitar ráfagas de clics duplicados durante la latencia de red
            botonLimpio.textContent = idiomaActual === 'en' ? 'SAVING...' : 'GUARDANDO...';
            botonLimpio.disabled = true;

            try {
                // Verificamos si existe sesión real en la nube de Supabase
                const sessionResponse = await supabaseClient.auth.getSession();
                const sessionActiva = sessionResponse?.data?.session;

                if (!sessionActiva) {
                    // ── MODO SIMULACIÓN LOCAL (Cuenta Admin de desarrollo) ──
                    // Leemos la contraseña guardada actualmente (o por defecto 1234)
                    const claveActualAdmin = localStorage.getItem('aura_admin_pwd') || '1234';

                    if (txtCurrent !== claveActualAdmin) {
                        mostrarToast(idiomaActual === 'en' ? 'Current password incorrect.' : 'La contraseña actual es incorrecta.');
                        botonLimpio.textContent = idiomaActual === 'en' ? 'Save' : 'Guardar';
                        botonLimpio.disabled = false;
                        return;
                    }

                    // Poka-yoke de congruencia: guardamos la contraseña nueva en memoria para el login.html
                    localStorage.setItem('aura_admin_pwd', txtNew);
                    
                    if (typeof cerrarModalPwd === 'function') cerrarModalPwd(e);
                    ['current-pwd', 'new-pwd', 'confirm-pwd'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    });
                    mostrarToast(idiomaActual === 'en' ? 'Local Admin password updated ✓' : 'Contraseña de Admin local actualizada ✓');
                    
                } else {
                    // ── MODO PRODUCCIÓN REAL (Autenticación en la Nube con Supabase) ──
                    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
                    if (userError || !user) throw new Error('Sesión expirada');

                    // Validamos la contraseña de fondo re-autenticando en el servidor
                    const { error: loginError } = await supabaseClient.auth.signInWithPassword({
                        email: user.email,
                        password: txtCurrent
                    });

                    if (loginError) {
                        mostrarToast(idiomaActual === 'en' ? 'Current password incorrect.' : 'La contraseña actual es incorrecta.');
                        botonLimpio.textContent = idiomaActual === 'en' ? 'Save' : 'Guardar';
                        botonLimpio.disabled = false;
                        return;
                    }

                    // Aplicamos el cambio síncrono en la nube
                    const { error: updateError } = await supabaseClient.auth.updateUser({ password: txtNew });
                    if (updateError) throw updateError;

                    if (typeof cerrarModalPwd === 'function') cerrarModalPwd(e);
                    ['current-pwd', 'new-pwd', 'confirm-pwd'].forEach(id => {
                        const el = document.getElementById(id);
                        if (el) el.value = '';
                    });
                    mostrarToast(idiomaActual === 'en' ? 'Cloud password updated securely ✓' : 'Contraseña en la nube actualizada con seguridad ✓');
                }

            } catch (err) {
                console.error('Error crítico en el proceso de Autenticación:', err);
                mostrarToast(idiomaActual === 'en' ? 'Error updating password.' : 'Error al actualizar contraseña.');
            } finally {
                botonLimpio.textContent = idiomaActual === 'en' ? 'Save' : 'Guardar';
                botonLimpio.disabled = false;
            }
        });
    }

    // ─── CIRUGÍA AURA v8.7: INTERCEPTOR REAL PARA CAMBIAR CUENTA ───
    const btnSwitchAccount = document.getElementById('btn-switch-account');
    if (btnSwitchAccount) {
        btnSwitchAccount.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation(); // Frenamos el onclick simulado que viene incrustado en el HTML
            
            const idiomaActual = document.getElementById('app-language')?.value ?? 'es';
            mostrarToast(idiomaActual === 'en' ? 'Switching profile... 👤' : 'Cambiando de cuenta... 👤');

            try {
                // 1. Limpieza de hardware: desvinculamos la TV activa del canal si existe
                if (window.codigoTVActiva && typeof window.ejecutarDesvinculacionTV === 'function') {
                    await window.ejecutarDesvinculacionTV();
                }
                
                // 2. Destrucción de sesión en la nube de Supabase
                await supabaseClient.auth.signOut();
            } catch (error) {
                console.error('Error al mitigar sesión en Supabase:', error);
            }

            // 3. Efecto visual de transición hacia la pantalla de acceso
            setTimeout(() => {
                localStorage.removeItem('aura_admin_pwd'); // Opcional: limpia la clave de prueba si deseas reiniciar a 1234
                document.body.style.opacity    = '0';
                document.body.style.transition = '0.5s ease';
                setTimeout(() => { 
                    window.location.href = 'login.html'; 
                }, 500);
            }, 400);
        });
    }
    // ── BOTONES SIMULADOS ─────────────────────────────────────────────────
    const btnManageSub = document.getElementById('btn-manage-sub');
    if (btnManageSub) btnManageSub.addEventListener('click', (e) => { e.preventDefault(); mostrarToast('Redirigiendo al portal de facturación segura...'); });
    const btnRestorePurchases = document.getElementById('btn-restore-purchases');
    if (btnRestorePurchases) btnRestorePurchases.addEventListener('click', (e) => { e.preventDefault(); mostrarToast('Buscando compras previas... Compras restauradas con éxito.'); });
    
// ─── CIRUGÍA AURA v8.6: ELIMINACIÓN REAL DE CUENTA (OPERATIVA GLOBAL) ───
    const botonEliminarCuentaReal = document.getElementById('delete-account-btn');
    if (botonEliminarCuentaReal) {
        // Clonamos para purgar cualquier listener previo colgado en paralelo
        const botonLimpioDelete = botonEliminarCuentaReal.cloneNode(true);
        botonEliminarCuentaReal.parentNode.replaceChild(botonLimpioDelete, botonEliminarCuentaReal);

        botonLimpioDelete.addEventListener('click', async (e) => {
            e.preventDefault();
            const idiomaActual = document.getElementById('app-language')?.value ?? 'es';

            // Alerta Poka-Yoke industrial para evitar destrucciones por accidente
            const mensajeConfirmar = idiomaActual === 'en' 
                ? 'CRITICAL WARNING: Are you sure you want to permanently delete your AURA account? This action cannot be undone. Remember to cancel any active subscriptions in Google Play.'
                : 'ADVERTENCIA CRÍTICA: ¿Estás seguro de que deseas eliminar permanentemente tu cuenta de AURA? Esta acción no se puede deshacer de ninguna manera. Recuerda cancelar tu suscripción en Google Play.';

            if (!confirm(mensajeConfirmar)) return;

            try {
                // Consultamos si hay un usuario logeado en Supabase Auth
                const { data: { user } } = await supabaseClient.auth.getUser();
                
                if (user) {
                    // Si la cuenta es real en la nube, la borramos mediante la API de administración
                    await supabaseClient.auth.admin.deleteUser(user.id);
                }
                
                // En cualquier caso (cuenta real o simulación 'admin'), limpiamos el entorno
                await supabaseClient.auth.signOut();
                localStorage.clear();
                window.location.href = 'login.html';

            } catch (err) {
                // Salida de emergencia limpia en desarrollo
                await supabaseClient.auth.signOut();
                localStorage.clear();
                window.location.href = 'login.html';
            }
        });
    }

    // ── SELECTORES DE CONFIGURACIÓN ───────────────────────────────────────
    const selectorIdioma = document.getElementById('app-language');
    if (selectorIdioma) {
        selectorIdioma.addEventListener('change', (e) => {
            const lang = e.target.value;
            const txtBright = document.querySelector('#fill-bright')?.parentElement?.parentElement?.querySelector('span:not(.capsule-value)');
            const txtFire   = document.getElementById('btn-mute-fire')?.querySelector('span');
            const txtWind   = document.getElementById('btn-mute-wind')?.querySelector('span');
            const txtTvLinkingTitle = document.querySelector('#tv-linking-panel h2');
            const txtOrIntroduce    = document.querySelector('#tv-linking-panel p');
            const btnConnectManual  = document.getElementById('connect-manual-btn');
            const btnCancelLinking  = document.getElementById('cancel-linking');
            const headers = document.querySelectorAll('.aura-accordion-header span');
            const btnSwitch = document.getElementById('btn-switch-account');
            const btnPass = document.getElementById('btn-change-password');
            const btnSub = document.getElementById('btn-manage-sub');
            const btnRestore = document.getElementById('btn-restore-purchases');
            const lblLang = document.querySelector('label[for="app-language"]');
            const lblAudio = document.querySelector('label[for="audio-quality"]');
            const optAudioStd = document.querySelector('#audio-quality option[value="standard"]');
            const optAudioLoss = document.querySelector('#audio-quality option[value="lossless"]');
            const lblPixel = document.querySelector('label[for="pixel-mode"]');
            const lblHaptic = document.querySelector('label[for="haptic-mode"]');
            const lblFreq = document.querySelector('label[for="sync-freq"]');
            const optFreqRt = document.querySelector('#sync-freq option[value="realtime"]');
            const optFreqEco = document.querySelector('#sync-freq option[value="eco"]');
            const deleteAccount = document.getElementById('delete-account-btn');
            const closeSettings = document.getElementById('close-settings-btn');
            const logoutInside = document.getElementById('logout-inside-btn');

            // ─── CIRUGÍA AURA v8.4: CIERRE DE SESIÓN SEGURO EN BASE DE DATOS ───
    const logoutInsideBtn = document.getElementById('logout-inside-btn');
    if (logoutInsideBtn) {
        logoutInsideBtn.addEventListener('click', async e => {
            e.preventDefault();
            
            // Si el Drawer tiene función de cierre en el HTML, la dejamos correr
            try {
                if (window.codigoTVActiva && typeof window.ejecutarDesvinculacionTV === 'function') {
                    await window.ejecutarDesvinculacionTV();
                }
                // Forzamos a Supabase a destruir el token y la sesión activa del usuario
                await supabaseClient.auth.signOut();
            } catch (error) {
                console.error('Error al destruir sesión en Supabase:', error);
            }

            setTimeout(() => {
                document.body.style.opacity    = '0';
                document.body.style.transition = '0.6s ease';
                setTimeout(() => { window.location.href = 'login.html'; }, 600);
            }, 350);
        });
    }

            const linksLegal = document.querySelectorAll('#delete-account-btn ~ a, .aura-section a');

            if (lang === 'en') {
                if (txtBright) txtBright.textContent = "Brightness";
                if (txtFire)   txtFire.textContent   = "Fire Sounds";
                if (txtWind)   txtWind.textContent   = "Wind Sounds";
                if (txtTvLinkingTitle) txtTvLinkingTitle.textContent = "LINK TV";
                if (txtOrIntroduce)    txtOrIntroduce.textContent    = "— OR ENTER THE CODE —";
                if (btnConnectManual)  btnConnectManual.textContent  = "CONNECT";
                if (btnCancelLinking)  btnCancelLinking.textContent  = "BACK TO PANEL";
                if (headers[0]) headers[0].textContent = "👤 Account & Security";
                if (headers[1]) headers[1].textContent = "⚙️ Preferences";
                if (headers[2]) headers[2].textContent = "📡 Connectivity & TV";
                if (headers[3]) headers[3].textContent = "⚖️ Support & Legal";
                if (btnSwitch) btnSwitch.textContent = "Switch Account";
                if (btnPass)   btnPass.textContent   = "Change Password";
                if (btnSub)    btnSub.textContent    = "Manage Subscription";
                if (btnRestore) btnRestore.textContent = "Restore Purchases";
                if (lblLang)   lblLang.textContent   = "Language";
                if (lblAudio)  lblAudio.textContent  = "Audio Quality";
                if (optAudioStd) optAudioStd.textContent = "Standard (Low Power)";
                if (optAudioLoss) optAudioLoss.textContent = "High Fidelity (Lossless)";
                if (lblPixel)  lblPixel.textContent  = "Pixel Art Mode";
                if (lblHaptic) lblHaptic.textContent = "Haptic Feedback";
                if (lblFreq)   lblFreq.textContent   = "Frequency";
                if (optFreqRt) optFreqRt.textContent = "Real-Time";
                if (optFreqEco) optFreqEco.textContent = "Eco Mode";
                if (linksLegal[4]) linksLegal[4].textContent = "Help Center";
                if (linksLegal[5]) linksLegal[5].textContent = "Terms of Service";
                if (linksLegal[6]) linksLegal[6].textContent = "Privacy Policy";
                if (deleteAccount) deleteAccount.textContent = "Delete Account";
                if (closeSettings) closeSettings.textContent = "Close";
                if (logoutInside) logoutInside.textContent = "Log Out";
                const lblSleep = document.getElementById('lbl-sleep-timer');
                if (lblSleep) lblSleep.textContent = "Sleep Timer";
                const lblColor = document.getElementById('lbl-fire-color');
                if (lblColor) lblColor.textContent = "Fire Color";
                const lblEnv = document.getElementById('lbl-env-title');
                if (lblEnv) lblEnv.textContent = "Environment / Theme";

            } else {
                if (txtBright) txtBright.textContent = "Brillo";
                if (txtFire)   txtFire.textContent   = "Fuego";
                if (txtWind)   txtWind.textContent   = "Viento";
                if (txtTvLinkingTitle) txtTvLinkingTitle.textContent = "VINCULAR TV";
                if (txtOrIntroduce)    txtOrIntroduce.textContent    = "— O INTRODUCE EL CÓDIGO —";
                if (btnConnectManual)  btnConnectManual.textContent  = "CONECTAR";
                if (btnCancelLinking)  btnCancelLinking.textContent  = "VOLVER AL PANEL";
                if (headers[0]) headers[0].textContent = "👤 Cuenta y Seguridad";
                if (headers[1]) headers[1].textContent = "⚙️ Preferencias";
                if (headers[2]) headers[2].textContent = "📡 Conectividad y TV";
                if (headers[3]) headers[3].textContent = "⚖️ Soporte y Legal";
                if (btnSwitch) btnSwitch.textContent = "Cambiar Cuenta";
                if (btnPass)   btnPass.textContent   = "Cambiar Contraseña";
                if (btnSub)    btnSub.textContent    = "Gestionar Suscripción";
                if (btnRestore) btnRestore.textContent = "Restaurar Compras";
                if (lblLang)   lblLang.textContent   = "Language";
                if (lblAudio)  lblAudio.textContent  = "Calidad de Audio";
                if (optAudioStd) optAudioStd.textContent = "Estándar (Bajo Consumo)";
                if (optAudioLoss) optAudioLoss.textContent = "Alta Fidelidad (Lossless)";
                if (lblPixel)  lblPixel.textContent  = "Modo Pixel Art";
                if (lblHaptic) lblHaptic.textContent = "Respuesta Háptica";
                if (lblFreq)   lblFreq.textContent   = "Frecuencia";
                if (optFreqRt) optFreqRt.textContent = "Tiempo Real";
                if (optFreqEco) optFreqEco.textContent = "Modo Ahorro";
                if (linksLegal[4]) linksLegal[4].textContent = "Centro de Ayuda";
                if (linksLegal[5]) linksLegal[5].textContent = "Términos de Servicio";
                if (linksLegal[6]) linksLegal[6].textContent = "Privacy Policy";
                if (deleteAccount) deleteAccount.textContent = "Eliminar Cuenta";
                if (closeSettings) closeSettings.textContent = "Cerrar";
                if (logoutInside) logoutInside.textContent = "Salir";
                const lblSleep = document.getElementById('lbl-sleep-timer');
                if (lblSleep) lblSleep.textContent = "Temporizador de Apagado";
                const lblColor = document.getElementById('lbl-fire-color');
                if (lblColor) lblColor.textContent = "Tonalidad del Fuego";    
                const lblEnv = document.getElementById('lbl-env-title');
                if (lblEnv) lblEnv.textContent = "Ambiente / Fachada";
            }

            if (typeof broadcastOrder === 'function') broadcastOrder('SET_LANGUAGE', lang);
        });
    }

    const selectorAudio = document.getElementById('audio-quality');
    if (selectorAudio) {
        selectorAudio.addEventListener('change', (e) => {
            audioLosslessActivo = (e.target.value === 'lossless');
            const idiomaActual = document.getElementById('app-language')?.value ?? 'es';
            mostrarToast(audioLosslessActivo ? (idiomaActual === 'en' ? 'Lossless Mode active.' : 'Modo Lossless activo.') : (idiomaActual === 'en' ? 'Standard Audio active.' : 'Audio Estándar activo.'));
            if (typeof broadcastOrder === 'function') broadcastOrder('SET_AUDIO_QUALITY', e.target.value);
        });
    }

    const switchHaptic = document.getElementById('haptic-mode');
    if (switchHaptic) switchHaptic.addEventListener('change', (e) => { hapticFeedbackActivo = e.target.checked; });

    let ultimaVibracion = 0;
    const dispararHaptica = () => {
        if (!hapticFeedbackActivo || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
        const ahora = Date.now();
        if (ahora - ultimaVibracion < 40) return;
        ultimaVibracion = ahora;
        try { navigator.vibrate(12); } catch(e) {}
    };

    ['bright-slider', 'fire-slider', 'wind-slider'].forEach(id => {
        const slider = document.getElementById(id);
        if (slider) slider.addEventListener('input', dispararHaptica, { passive: true });
    });

    function verificarEstadoRedCelular() {
        if (!navigator.onLine) {
            document.body.classList.remove('aura-led-connected');
            document.body.classList.add('aura-led-disconnected');
            mostrarToast('Control deshabilitado: Sin conexión a Internet ⚠️');
        } else {
            const canalActivo = window.listaCanalesAbiertos[window.codigoTVActiva];
            if (canalActivo && document.body.classList.contains('aura-led-disconnected')) {
                document.body.classList.remove('aura-led-disconnected', 'aura-led-connected');
                mostrarToast('Buscando señal de la TV... 📡');
                try {
                    canalActivo.send({ type: 'broadcast', event: 'orden', payload: { tipo: 'AURA_HANDSHAKE_PING', valor: Date.now() } });
                } catch(e) {}
            }
        }
    }

    window.addEventListener('online',  verificarEstadoRedCelular);
    window.addEventListener('offline', verificarEstadoRedCelular);

    // ─── CIRUGÍA AURA: CAPTURA Y REGISTRO DE MOVIMIENTOS MANUALES ───
    // Cada vez que el usuario interactúa con los sliders, registramos el valor bajo el código de la TV activa
    ['bright-slider', 'fire-slider', 'wind-slider'].forEach(id => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.addEventListener('change', () => {
                if (!window.codigoTVActiva) return;
                
                // Si la TV no tenía registro en el llavero de memoria, lo creamos
                if (!window.estadosSlidersTVs[window.codigoTVActiva]) {
                    window.estadosSlidersTVs[window.codigoTVActiva] = { brillo: 80, fuego: 50, viento: 30 };
                }
                
                // Guardamos el valor actual exacto
                const brightVal = document.getElementById('bright-slider')?.value ?? 80;
                const fireVal   = document.getElementById('fire-slider')?.value ?? 50;
                const windVal   = document.getElementById('wind-slider')?.value ?? 30;
                
                window.estadosSlidersTVs[window.codigoTVActiva] = {
                    brillo: parseFloat(brightVal),
                    fuego: parseFloat(fireVal),
                    viento: parseFloat(windVal)
                };
            });
        }
    });

    // ─── CIRUGÍA AURA v8.3: INTERCEPTOR MAESTRO PARA MODO AHORRO (ECO) ───
    // Escucha el fin del arrastre (cuando el usuario levanta el dedo del slider)
    ['bright-slider', 'fire-slider', 'wind-slider'].forEach(id => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.addEventListener('change', () => {
                // Consultamos el selector de frecuencia del HTML
                const selectorFreq = document.getElementById('sync-freq');
                const esModoEco = selectorFreq ? (selectorFreq.value === 'eco') : false;

                // Si está en Modo Eco, transmitimos los valores acumulados en este preciso instante
                if (esModoEco && typeof broadcastOrder === 'function') {
                    const type = id.replace('-slider', '');
                    const value = parseFloat(slider.value);

                    if (type === 'bright') {
                        broadcastOrder('CAMBIO_BRILLO', value / 100);
                    }
                    if (type === 'fire') {
                        const btnFire = document.getElementById('btn-mute-fire');
                        const enviar = (btnFire && btnFire.classList.contains('active')) ? (value / 100) : 0;
                        broadcastOrder('SET_AUDIO_FIRE', enviar);
                    }
                    if (type === 'wind') {
                        const btnWind = document.getElementById('btn-mute-wind');
                        const enviar = (btnWind && btnWind.classList.contains('active')) ? ((value / 100) * 0.5) : 0;
                        broadcastOrder('SET_AUDIO_WIND', enviar);
                    }
                    
                    const idiomaActual = document.getElementById('app-language')?.value ?? 'es';
                    mostrarToast(idiomaActual === 'en' ? 'Eco-Sync transmitted ✓' : 'Sincronización Eco transmitida ✓');
                }
            });
        }
    });

    // ─── CIRUGÍA AURA v9.1: MOTOR DE INGENIERÍA PARA EL SLEEP TIMER ───
    const selectorSleep = document.getElementById('sleep-timer');
    const cuentaRegresivaVisual = document.getElementById('sleep-countdown');

    if (selectorSleep) {
        selectorSleep.addEventListener('change', (e) => {
            const minutos = e.target.value;
            const idiomaActual = document.getElementById('app-language')?.value ?? 'es';

            // Limpiamos cualquier intervalo previo activo para evitar hilos duplicados
            clearInterval(sleepIntervalId);
            if (cuentaRegresivaVisual) cuentaRegresivaVisual.textContent = '';

            if (minutos === 'off') {
                mostrarToast(idiomaActual === 'en' ? 'Sleep Timer deactivated.' : 'Temporizador desactivado.');
                return;
            }

            // Convertimos los minutos a segundos reales para el motor de decremento
            tiempoRestanteSegundos = parseInt(minutos) * 60;
            mostrarToast(idiomaActual === 'en' ? `Sleep timer set to ${minutos} minutes.` : `Apagado programado en ${minutos} minutos.`);
            
            // Arrancamos el cronómetro de precisión
            actualizarInterfazCronometro();
            sleepIntervalId = setInterval(() => {
                tiempoRestanteSegundos--;
                actualizarInterfazCronometro();

                if (tiempoRestanteSegundos <= 0) {
                    clearInterval(sleepIntervalId);
                    ejecutarApagadoMaestroEcosistema();
                }
            }, 1000);
        });
    }

    function actualizarInterfazCronometro() {
        if (!cuentaRegresivaVisual) return;
        const minutosRestantes = Math.floor(tiempoRestanteSegundos / 60);
        const segundosRestantes = tiempoRestanteSegundos % 60;
        
        // Padded de ceros estilo reloj digital minimalista (00:00)
        const strMin = minutosRestantes < 10 ? `0${minutosRestantes}` : minutosRestantes;
        const strSeg = segundosRestantes < 10 ? `0${segundosRestantes}` : segundosRestantes;
        
        cuentaRegresivaVisual.textContent = `${strMin}:${strSeg}`;
    }

    async function ejecutarApagadoMaestroEcosistema() {
        const idiomaActual = document.getElementById('app-language')?.value ?? 'es';
        if (cuentaRegresivaVisual) cuentaRegresivaVisual.textContent = '';
        if (selectorSleep) selectorSleep.value = 'off';

        mostrarToast(idiomaActual === 'en' ? 'Sleep Timer reached. Shutting down... 💤' : 'Temporizador alcanzado. Apagando espacio... 💤');

        if (window.codigoTVActiva && typeof window.ejecutarDesvinculacionTV === 'function') {
            if (typeof broadcastOrder === 'function') {
                await broadcastOrder('SET_AUDIO_FIRE', 0);
                await broadcastOrder('SET_AUDIO_WIND', 0);
                await broadcastOrder('BRIGHTNESS', 0);
                await broadcastOrder('DESVINCULAR_TV', true);
            }
            setTimeout(async () => {
                await window.ejecutarDesvinculacionTV();
            }, 500);

        } else {
            // ─── DESVANECIMIENTO PROGRESIVO DE FUEGO Y AUDIO (5 SEGUNDOS) ───
            const contenedorChimenea = document.getElementById('contenedor-chimenea-modular');
            if (contenedorChimenea) {
                contenedorChimenea.style.transition = 'opacity 5s ease, filter 5s ease';
                contenedorChimenea.style.opacity = '0';
                contenedorChimenea.style.filter = 'brightness(0)';
            }

            // Rampas de audio a volumen 0 en 5s
            if (typeof audioCtx !== 'undefined' && audioCtx && audioCtx.state === 'running') {
                if (typeof fireGain !== 'undefined' && fireGain) {
                    fireGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 5.0);
                }
                if (typeof windGain !== 'undefined' && windGain) {
                    windGain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 5.0);
                }
            }

            // Tras los 5s apaga los motores y resetea UI
            setTimeout(() => {
                window.isFireActive = false;
                if (typeof audioCtx !== 'undefined' && audioCtx) audioCtx.suspend();

                // Restaurar sliders a cero en la interfaz
                if (typeof updateSliderFill === 'function') {
                    updateSliderFill('bright', 10);
                    updateSliderFill('fire', 0);
                    updateSliderFill('wind', 0);
                }

                const btnFire = document.getElementById('btn-mute-fire');
                const btnWind = document.getElementById('btn-mute-wind');
                if (btnFire) btnFire.classList.remove('active');
                if (btnWind) btnWind.classList.remove('active');

                // Restaurar opacidad del contenedor para el próximo encendido
                if (contenedorChimenea) {
                    contenedorChimenea.style.transition = '';
                    contenedorChimenea.style.opacity = '1';
                    contenedorChimenea.style.filter = '';
                }
            }, 5000);
        }
    }


    // ─── POKA-YOKE DE PROTECCIÓN: CANCELAR SI EL USUARIO INTERACTÚA ───
    // Si el usuario mueve un slider manualmente, asumimos que se arrepintió de ir a dormir
    ['bright-slider', 'fire-slider', 'wind-slider'].forEach(id => {
        const slider = document.getElementById(id);
        if (slider) {
            slider.addEventListener('change', () => {
                if (sleepIntervalId && tiempoRestanteSegundos > 0) {
                    clearInterval(sleepIntervalId);
                    sleepIntervalId = null;
                    tiempoRestanteSegundos = 0;
                    if (cuentaRegresivaVisual) cuentaRegresivaVisual.textContent = '';
                    if (selectorSleep) selectorSleep.value = 'off';
                    
                    const idiomaActual = document.getElementById('app-language')?.value ?? 'es';
                    mostrarToast(idiomaActual === 'en' ? 'Sleep Timer cancelled by user activity.' : 'Temporizador cancelado por actividad del usuario.');
                }
            });
        }
    });    
    
    // ─── LÓGICA DE TRANSICIÓN FADE INTERPOLADA ───
    const btnsColorSegment = document.querySelectorAll('.btn-color-segment');
    const pillGlow = document.getElementById('segment-glow-pill');
    window.colorActualPosicion = 2; // Estado final (1, 2 o 3)
    window.colorInterpolado = 2.0;  // Estado numérico dinámico continuo
    let animacionFadeId = null;

    if (btnsColorSegment.length > 0) {
        btnsColorSegment.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const posDestino = parseInt(btn.getAttribute('data-pos'));
                if (posDestino === window.colorActualPosicion) return;

                // 1. Desplazamiento de la cápsula UI
                if (pillGlow) {
                    if (posDestino === 1) pillGlow.style.left = '4px';
                    else if (posDestino === 2) pillGlow.style.left = '33.33%';
                    else if (posDestino === 3) pillGlow.style.left = '66.66%';
                }

                // 2. Estado de botones en UI
                btnsColorSegment.forEach(b => {
                    b.classList.remove('active');
                    b.style.color = 'rgba(255,255,255,0.4)';
                });
                btn.classList.add('active');
                btn.style.color = 'var(--gold)';

                // 3. FADE PROGRESIVO EN CANVAS (Interpolación de 0.8s)
                if (animacionFadeId) cancelAnimationFrame(animacionFadeId);
                const inicioTiempo = performance.now();
                const valorOrigen = window.colorInterpolado;
                const valorDestino = posDestino;
                const duracion = 850; // milisegundos

                function pasoFade(tiempoActual) {
                    const transcurrido = tiempoActual - inicioTiempo;
                    const progreso = Math.min(transcurrido / duracion, 1.0);

                    // Curva de aceleración suave (easeInOutCubic)
                    const factorSuave = progreso < 0.5 
                        ? 4 * progreso * progreso * progreso 
                        : 1 - Math.pow(-2 * progreso + 2, 3) / 2;

                    // Interpolación numérica continua (1.0 = Rojo, 2.0 = Naranja, 3.0 = Azul)
                    const posVal = valorOrigen + (valorDestino - valorOrigen) * factorSuave;
                    window.colorInterpolado = posVal;

                    // ─── INTERPOLACIÓN DINÁMICA DE BRASAS Y NICHO ───
                    if (capaLeña) {
                        // Limpiamos clases fijas para que el filtro sea continuo
                        capaLeña.className = '';
                        
                        if (posVal <= 2.0) {
                            // De Rojo (1.0) a Naranja (2.0): Rotación de tono de -20deg a 0deg
                            const t = posVal - 1.0; // 0 (Rojo) -> 1 (Naranja)
                            const hue = -20 * (1 - t);
                            const sat = 2.5 - (1.5 * t);
                            capaLeña.style.filter = `hue-rotate(${hue}deg) saturate(${sat}) brightness(1.0) contrast(1.15)`;
                       } else {
                            // De Naranja (2.0) a Azul (3.0): Blanqueamiento térmico para eliminar ilusión verdosa
                            const t = posVal - 2.0; // 0 (Naranja) -> 1 (Azul)
                            
                            if (t < 0.5) {
                                // Fase 1: Naranja -> Blanco Incandescente (Cero color, brillo alto)
                                const factorFase = t * 2; // 0 a 1
                                const brightness = 1.0 + (0.6 * factorFase);
                                const saturate = 1.0 - (0.95 * factorFase); // Cerca de 0% saturación (blanco)
                                capaLeña.style.filter = `brightness(${brightness}) saturate(${saturate}) contrast(1.1)`;
                            } else {
                                // Fase 2: Blanco Incandescente -> Azul Criogénico
                                const factorFase = (t - 0.5) * 2; // 0 a 1
                                const hue = 190 * factorFase;
                                const brightness = 1.6 - (0.5 * factorFase);
                                const saturate = 0.05 + (3.45 * factorFase); // Entra el azul directo desde el blanco
                                capaLeña.style.filter = `hue-rotate(${hue}deg) brightness(${brightness}) saturate(${saturate}) contrast(1.25)`;
                            }
                        }
                    }

                    if (progreso < 1.0) {
                        animacionFadeId = requestAnimationFrame(pasoFade);
                    } else {
                        window.colorInterpolado = valorDestino;
                        // Al terminar la transición, asignamos la clase fija oficial
                        if (capaLeña) {
                            capaLeña.style.filter = '';
                            if (valorDestino === 1) capaLeña.className = 'modo-rojo';
                            else if (valorDestino === 3) capaLeña.className = 'modo-azul';
                            else capaLeña.className = 'modo-naranja';
                        }
                    }
                }
                animacionFadeId = requestAnimationFrame(pasoFade);

                // 4. Actualizar capas CSS del nicho y suelo en paralelo
                const capaLeña = document.getElementById('capa-leña-incandescente');
                const capaFondoNicho = document.getElementById('capa-fondo-nicho');
                const reflejoSuelo = document.getElementById('reflejo-suelo-ambiental');
                const marcoSignature = document.getElementById('capa-marco-signature');

                if (capaFondoNicho) capaFondoNicho.style.transition = 'background 0.85s ease, opacity 0.85s ease';
                if (reflejoSuelo) reflejoSuelo.style.transition = 'background 0.85s ease, opacity 0.85s ease';

                if (posDestino === 1) { // 🔴 ROJO
                    
                    if (capaFondoNicho) {
                        capaFondoNicho.style.background = `radial-gradient(circle at 50% 100%, rgba(180, 20, 10, calc(0.45 * var(--brillo-usuario, 0.8))) 0%, rgba(60, 10, 5, calc(0.25 * var(--brillo-usuario, 0.8))) 50%, rgba(0, 0, 0, 0.95) 85%)`;
                    }
                    if (reflejoSuelo) {
                        reflejoSuelo.style.background = `radial-gradient(ellipse at top, rgba(255, 30, 0, 0.25), transparent 70%)`;
                    }
                    if (marcoSignature) {
                        marcoSignature.style.animation = 'parpadeo-fuego-rojo 3.5s infinite ease-in-out';
                    }
                } else if (posDestino === 3) { // 🔵 AZUL
                    
                    if (capaFondoNicho) {
                        capaFondoNicho.style.background = `radial-gradient(circle at 50% 100%, rgba(10, 80, 200, calc(0.45 * var(--brillo-usuario, 0.8))) 0%, rgba(5, 30, 80, calc(0.25 * var(--brillo-usuario, 0.8))) 50%, rgba(0, 0, 0, 0.95) 85%)`;
                    }
                    if (reflejoSuelo) {
                        reflejoSuelo.style.background = `radial-gradient(ellipse at top, rgba(0, 130, 255, 0.25), transparent 70%)`;
                    }
                    if (marcoSignature) {
                        marcoSignature.style.animation = 'parpadeo-fuego-azul 4s infinite ease-in-out';
                    }
                } else { // 🟠 NARANJA
                    
                    if (capaFondoNicho) {
                        capaFondoNicho.style.background = `radial-gradient(circle at 50% 100%, rgba(180, 60, 10, calc(0.45 * var(--brillo-usuario, 0.8))) 0%, rgba(60, 20, 5, calc(0.25 * var(--brillo-usuario, 0.8))) 50%, rgba(0, 0, 0, 0.95) 85%)`;
                    }
                    if (reflejoSuelo) {
                        reflejoSuelo.style.background = `radial-gradient(ellipse at top, rgba(212, 175, 55, 0.15), transparent 70%)`;
                    }
                    if (marcoSignature) {
                        marcoSignature.style.animation = 'parpadeo-fuego-naranja 3s infinite ease-in-out';
                    }
                }

                window.colorActualPosicion = posDestino;

                if (typeof broadcastOrder === 'function') {
                    broadcastOrder('SET_COLOR_SPECTRUM', posDestino);
                }
            });
        });
    }

    // ─── OPTION 1: BRASAS RESPIRANDO (ANIMACIÓN TERMAL DE LA LEÑA) ───
    // Creamos un ciclo de oscilación para que las grietas de la leña simulen calor real
    function respirarBrasasLeña() {
        const capaLeña = document.getElementById('capa-leña-incandescente');
        if (capaLeña && window.isFireActive) {
            // Generamos una onda senoidal suave basada en el tiempo de ejecución
            const tiempo = Date.now() * 0.002;
            const opacidadBase = 0.82 + Math.sin(tiempo) * 0.12;
            
            // Alteramos la opacidad de la capa de forma sutil para simular la combustión interna
            capaLeña.style.opacity = opacidadBase;
        }
        requestAnimationFrame(respirarBrasasLeña);
    }
    // Iniciamos la respiración de la madera de forma automática
    respirarBrasasLeña();
    // ─── INTERCEPTOR DE AMBIENTES Y MODO EN DESARROLLO ───
const selectorAmbiente = document.getElementById('aura-environment');

if (selectorAmbiente) {
    selectorAmbiente.addEventListener('change', (e) => {
        const opcion = e.target.value;
        const idiomaActual = document.getElementById('app-language')?.value ?? 'es';

        if (opcion === '2') {
            // 1. Notificación al usuario de que la función está en construcción
            if (typeof mostrarToast === 'function') {
                mostrarToast(idiomaActual === 'en' 
                    ? '🛠️ Traditional Fireplace style is under construction. Coming soon!' 
                    : '🛠️ El estilo Chimenea Tradicional está en desarrollo. ¡Próximamente!'
                );
            }

            // 2. Reversión automática a la fachada activa predeterminada (Estilo 1)
            setTimeout(() => {
                selectorAmbiente.value = '1';
            }, 1200);

        } else if (opcion === '1') {
            if (typeof mostrarToast === 'function') {
                mostrarToast(idiomaActual === 'en' ? 'AURA Fireplace Style active ✓' : 'Estilo Fuego AURA activo ✓');
            }
        }
    });
}
    // ─── CIRUGÍA AURA v10.1: MOTOR COMERCIAL Y RESTAURACIÓN DE COMPRAS (MVP) ───
    const btnGestionarSub = document.getElementById('btn-manage-sub');
    const btnRestaurarComp = document.getElementById('btn-restore-purchases');

    // Listener para Gestionar Suscripción
    if (btnGestionarSub) {
        btnGestionarSub.addEventListener('click', (e) => {
            e.preventDefault();
            const idiomaActual = document.getElementById('app-language')?.value ?? 'es';

            // Mensaje nativo solicitado por producción
            if (idiomaActual === 'en') {
                mostrarToast('Redirecting to the secure billing portal...');
            } else {
                mostrarToast('Redirigiendo al portal de facturación segura...');
            }

            // Simulación de pasarela: Abrimos el modal flotante comercial tras un breve delay técnico
            setTimeout(() => {
                const modalSub = document.getElementById('modal-suscripcion');
                if (modalSub) {
                    modalSub.style.display = 'flex';
                    actualizarInterfazModalSuscripcion();
                }
            }, 1200);
        });
    }

    // Listener para Restaurar Compras
    if (btnRestaurarComp) {
        btnRestaurarComp.addEventListener('click', (e) => {
            e.preventDefault();
            const idiomaActual = document.getElementById('app-language')?.value ?? 'es';

            if (idiomaActual === 'en') {
                mostrarToast('Searching for previous purchases...');
            } else {
                mostrarToast('Buscando compras previas...');
            }

            // Simulación de búsqueda en servidor: Tras 1.5 segundos activa el estatus Pro
            setTimeout(() => {
                localStorage.setItem('aura_pro_status', 'active');
                
                if (idiomaActual === 'en') {
                    mostrarToast('Purchases successfully restored.');
                } else {
                    mostrarToast('Compras restauradas con éxito');
                }
                
                actualizarInterfazModalSuscripcion();
            }, 1500);
        });
    }

    // Manejador del botón de suscripción simulada dentro del modal ($49 MXN)
    const btnComprarReal = document.getElementById('btn-comprar-real');
    if (btnComprarReal) {
        btnComprarReal.addEventListener('click', () => {
            localStorage.setItem('aura_pro_status', 'active');
            const idiomaActual = document.getElementById('app-language')?.value ?? 'es';
            
            mostrarToast(idiomaActual === 'en' ? 'Welcome to AURA Pro! 💎' : '¡Bienvenido a AURA Pro! 💎');
            actualizarInterfazModalSuscripcion();
        });
    }

    // Manejador del botón de cancelación simulada dentro del modal
    const btnCancelarReal = document.getElementById('btn-cancelar-real');
    if (btnCancelarReal) {
        btnCancelarReal.addEventListener('click', () => {
            localStorage.removeItem('aura_pro_status');
            const idiomaActual = document.getElementById('app-language')?.value ?? 'es';
            
            mostrarToast(idiomaActual === 'en' ? 'Subscription cancelled.' : 'Suscripción cancelada.');
            actualizarInterfazModalSuscripcion();
        });
    }

    // Función auxiliar para sincronizar las vistas del modal con el almacenamiento local
    function actualizarInterfazModalSuscripcion() {
        const txtStatus = document.getElementById('txt-sub-status');
        const boxCompra = document.getElementById('box-compra-pro');
        const boxCancel = document.getElementById('box-cancelar-pro');
        const isPro = localStorage.getItem('aura_pro_status') === 'active';
        const idiomaActual = document.getElementById('app-language')?.value ?? 'es';

        if (isPro) {
            if (txtStatus) txtStatus.textContent = idiomaActual === 'en' ? 'Status: AURA Pro Member 💎' : 'Estado: Miembro AURA Pro 💎';
            if (boxCompra) boxCompra.style.display = 'none';
            if (boxCancel) boxCancel.style.display = 'block';
        } else {
            if (txtStatus) txtStatus.textContent = idiomaActual === 'en' ? 'Status: Free Plan (Limited)' : 'Estado: Plan Gratuito (Limitado)';
            if (boxCompra) boxCompra.style.display = 'block';
            if (boxCancel) boxCancel.style.display = 'none';
        }
    }
    // ─── CIRUGÍA AURA v10.4: MOTOR DE VISTAS DE TEXTO LEGAL (MVP) ───
    const btnHelp = document.getElementById('btn-help-center');
    const btnTerms = document.getElementById('btn-terms');
    const btnPrivacy = document.getElementById('btn-privacy');

    // DICCIONARIO DE TEXTOS ACTUALIZADO (ACCESOS CORREGIDOS, SOPORTE Y EMPATÍA)
const documentosLegales = {
    es: {
        help: "🎯 CENTRO DE AYUDA AURA\n\n1. ¿Cómo vincular mi Smart TV?\nPresiona el botón CONECTAR TV en la barra inferior del control remoto (o en el menú de Conectividad), anota el código de 5 dígitos que aparece en tu pantalla grande e ingrésalo en la app de tu celular.\n\n2. ¿Cómo funciona el Temporizador de Apagado?\nAbre el menú del temporizador en el panel o en las preferencias, elige cuánto tiempo deseas dejar encendida la chimenea (15, 30 o 60 minutos) y el sistema apagará automáticamente el fuego y el sonido al terminar la cuenta regresiva.\n\n3. Contacto y Soporte:\nSomos un equipo independiente trabajando continuamente para mejorar tu experiencia y traer nuevos ambientes. Si tienes dudas, comentarios, ideas o encontraste algún detalle por corregir, tu mensaje nos ayuda muchísimo a seguir creciendo:\n\naura.oficial98@gmail.com",
        privacy: "🔒 POLÍTICA DE PRIVACIDAD\n\nEn AURA nos tomamos muy en serio la seguridad de tu entorno digital:\n\n1. Datos Recolectados: AURA opera de forma local utilizando el almacenamiento interno de tu dispositivo (localStorage). No almacenamos datos sensibles sin tu autorización.\n2. Sincronización en Red: Las comunicaciones entre el celular y la Smart TV viajan encriptadas a través de canales seguros de transmisión en tiempo real de Supabase.\n3. Cookies: No utilizamos rastreadores comerciales de publicidad."
    },
    en: {
        help: "🎯 AURA HELP CENTER\n\n1. How to link my Smart TV?\nTap the CONNECT TV button on the bottom control dock (or inside Connectivity settings), note the 5-digit code on the large screen, and enter it into your mobile app.\n\n2. How does the Sleep Timer work?\nOpen the timer menu on the control dock or settings, select how long you want the fireplace to stay on (15, 30, or 60 minutes), and the system will automatically turn off the fire and sound when the countdown ends.\n\n3. Contact & Support:\nWe are an independent team working continuously to enhance your experience and craft new environments. If you have questions, feedback, ideas, or found a bug, your message helps us grow immensely:\n\naura.oficial98@gmail.com",
        privacy: "🔒 PRIVACY POLICY\n\nAt AURA, we highly prioritize your digital environment security:\n\n1. Collected Data: AURA runs locally using your device's internal storage (localStorage). We do not store sensitive data without authorization.\n2. Network Sync: Cell phone and Smart TV communications are fully encrypted through secure Supabase Realtime channels.\n3. Trackers: We do not use commercial advertising cookies."
    }
};

    function abrirModalLegal(tipoDoc) {
        const idioma = document.getElementById('app-language')?.value ?? 'es';
        const modal = document.getElementById('modal-legal');
        const title = document.getElementById('txt-legal-title');
        const body = document.getElementById('txt-legal-body');

        if (!modal || !title || !body) return;

        // Mapeo de títulos según el idioma seleccionado
        const titulos = {
            es: { help: "Centro de Ayuda", terms: "Términos de Servicio", privacy: "Política de Privacidad" },
            en: { help: "Help Center", terms: "Terms of Service", privacy: "Privacy Policy" }
        };

        title.textContent = titulos[idioma][tipoDoc];
        body.textContent = documentosLegales[idioma][tipoDoc];
        modal.style.display = 'flex';
        
        // Resetea el scroll del contenedor de texto arriba
        body.scrollTop = 0;
    }

    // Vinculación de los listeners mecánicos a las etiquetas <a>
    if (btnHelp) btnHelp.addEventListener('click', (e) => { e.preventDefault(); abrirModalLegal('help'); });
    
    if (btnPrivacy) btnPrivacy.addEventListener('click', (e) => { e.preventDefault(); abrirModalLegal('privacy'); });


// ─── LÓGICA DE INTERACCIÓN DEL DOCK INFERIOR (4 BOTONES) ───
    
    // 1. TIMER: Despliegue de Pop-up interactivo e integración directa con el Sleep Timer
    const btnDockTimer = document.getElementById('btn-dock-timer');
    const timerPopup    = document.getElementById('aura-timer-popup');
    const timerOptions  = document.querySelectorAll('.btn-timer-option');
    const txtDockTimer  = document.getElementById('txt-dock-timer');

    if (btnDockTimer && timerPopup) {
        // Toggle para mostrar/ocultar el menú sobre el botón
        btnDockTimer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const estaAbierto = timerPopup.style.opacity === '1';

            if (estaAbierto) {
                timerPopup.style.opacity = '0';
                timerPopup.style.pointerEvents = 'none';
                timerPopup.style.transform = 'translateX(-50%) translateY(10px)';
            } else {
                timerPopup.style.opacity = '1';
                timerPopup.style.pointerEvents = 'auto';
                timerPopup.style.transform = 'translateX(-50%) translateY(0)';
            }
        });

        // Ejecutar selección de tiempo (15m, 30m, 60m, Off)
        timerOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const mins = opt.getAttribute('data-mins');
                const selectorSleep = document.getElementById('sleep-timer');

                // Disparamos la lógica existente del temporizador de apagado
                if (selectorSleep) {
                    selectorSleep.value = mins;
                    selectorSleep.dispatchEvent(new Event('change'));
                }

                // Ocultar menú flotante
                timerPopup.style.opacity = '0';
                timerPopup.style.pointerEvents = 'none';
                timerPopup.style.transform = 'translateX(-50%) translateY(10px)';

                // Resaltar estado en el Dock
                if (mins === 'off') {
                    if (txtDockTimer) txtDockTimer.textContent = 'TIMER';
                    btnDockTimer.style.borderColor = 'rgba(212, 175, 55, 0.15)';
                    btnDockTimer.style.background = 'rgba(255, 255, 255, 0.02)';
                } else {
                    if (txtDockTimer) txtDockTimer.textContent = `${mins}M`;
                    btnDockTimer.style.borderColor = 'var(--gold)';
                    btnDockTimer.style.background = 'rgba(212, 175, 55, 0.15)';
                }
            });
        });

        // Ocultar si el usuario hace clic fuera del pop-up
        document.body.addEventListener('click', (e) => {
            if (!timerPopup.contains(e.target) && e.target !== btnDockTimer) {
                timerPopup.style.opacity = '0';
                timerPopup.style.pointerEvents = 'none';
                timerPopup.style.transform = 'translateX(-50%) translateY(10px)';
            }
        });
    }

   // ─── 4. LÓGICA REPARADA Y COMPLETA DEL DOCK INFERIOR Y FACHADA ───

// A) RESTAURACIÓN DEL BOTÓN PIXEL ART
const btnDockPixel = document.getElementById('btn-dock-pixel');
if (btnDockPixel) {
    btnDockPixel.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        window.pixelModeActivo = !window.pixelModeActivo;
        document.body.classList.toggle('aura-pixel-mode-active', window.pixelModeActivo);

        const imgReal  = document.getElementById('img-leña-real');
        const imgPixel = document.getElementById('img-leña-pixel');

        if (window.pixelModeActivo) {
            if (imgReal)  { imgReal.style.opacity = '0'; setTimeout(() => { imgReal.style.display = 'none'; }, 300); }
            if (imgPixel) { imgPixel.style.display = 'block'; setTimeout(() => { imgPixel.style.opacity = '1'; }, 10); }
        } else {
            if (imgPixel) { imgPixel.style.opacity = '0'; setTimeout(() => { imgPixel.style.display = 'none'; }, 300); }
            if (imgReal)  { imgReal.style.display = 'block'; setTimeout(() => { imgReal.style.opacity = '1'; }, 10); }
        }

        btnDockPixel.style.borderColor = window.pixelModeActivo ? 'var(--gold)' : 'rgba(212, 175, 55, 0.15)';
        btnDockPixel.style.background  = window.pixelModeActivo ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255, 255, 255, 0.02)';

        if (typeof broadcastOrder === 'function') {
            broadcastOrder('SET_PIXEL_MODE', window.pixelModeActivo);
        }

        // Forzar recalculo de dimensiones y purga de partículas
        if (typeof resizeCanvas === 'function') resizeCanvas();

        const idiomaActual = document.getElementById('app-language')?.value ?? 'es';
        if (typeof mostrarToast === 'function') {
            mostrarToast(window.pixelModeActivo 
                ? (idiomaActual === 'en' ? 'Pixel Art Mode On 👾' : 'Modo Pixel Art Activado 👾')
                : (idiomaActual === 'en' ? 'Pixel Art Mode Off' : 'Modo Pixel Art Desactivado')
            );
        }
    };
}

// B) RESTAURACIÓN DEL BOTÓN CONECTAR TV
const btnDockTv = document.getElementById('btn-dock-tv');
if (btnDockTv) {
    btnDockTv.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const tvPanel = document.getElementById('tv-linking-panel');
        if (tvPanel) {
            tvPanel.style.display = 'flex';
            if (typeof window.startQRScanner === 'function') {
                window.startQRScanner();
            }
        }
    };
}

// C) BOTÓN EXPANDIR (TRANSICIÓN DIRECTA EN 1-CLIC)
const btnDockFS = document.getElementById('btn-dock-fullscreen');
const tipCont   = document.getElementById('fachada-tip');

if (btnDockFS) {
    btnDockFS.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        window.isFachadaMode = true;
        document.body.classList.add('modo-fachada-activo');

        const uiL = document.getElementById('ui-layer');
        if (uiL) {
            uiL.style.opacity = '0';
            uiL.style.pointerEvents = 'none';
        }

        try {
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape');
            }
        } catch (err) {
            console.log("Ajuste vía CSS adaptativo.");
        }

        if (tipCont) {
            tipCont.style.opacity = '1';
            setTimeout(() => {
                if (window.isFachadaMode) tipCont.style.opacity = '0';
            }, 3500);
        }

        setTimeout(() => {
            if (typeof resizeCanvas === 'function') resizeCanvas();
        }, 200);
    };
}

// D) TOCAR LA PANTALLA PARA RESTAURAR VISTA NORMAL
document.body.onclick = async (e) => {
    if (window.isFachadaMode) {
        window.isFachadaMode = false;
        document.body.classList.remove('modo-fachada-activo');

        try {
            if (document.fullscreenElement && document.exitFullscreen) {
                await document.exitFullscreen();
            }
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        } catch (err) {
            console.log("Restablecimiento a vertical.");
        }

        const uiL = document.getElementById('ui-layer');
        if (uiL) {
            uiL.style.opacity = '1';
            uiL.style.pointerEvents = 'auto';
        }

        if (tipCont) tipCont.style.opacity = '0';

        setTimeout(() => {
            if (typeof resizeCanvas === 'function') resizeCanvas();
        }, 200);
    }
};

}); // fin DOMContentLoaded