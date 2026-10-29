class AuraAudioEngine {
    constructor() {
        this.ctx = null;
        this.isInitialized = false;

        // Fuentes de Audio Buffer
        this.windSource = null;
        this.fireSource = null;

        // Buffers decodificados
        this.windBuffer = null;
        this.fireBuffer = null;

        // Nodos de Ganancia
        this.windGain = null;
        this.fireGain = null;
        this.masterGain = null;

        // Rutas de archivos MP3 de prueba (puedes reemplazar por tus propios archivos localmente)
        this.windUrl = 'https://actions.google.com/sounds/v1/weather/wind_heavy_loop.ogg'; // (Temporal mientras bajas el viento)
    this.fireUrl = './assets/audio/fire_loop.mp3'; // <- TU ARCHIVO LOCAL
    }

    // Inicializar Contexto
    async init() {
        if (this.isInitialized) {
            if (this.ctx && this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }
            return;
        }

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        // Master Gain para control de Mute / Modo Remoto TV
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;
        this.masterGain.connect(this.ctx.destination);

        // Nodos de Ganancia Individuales
        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0.0;
        this.windGain.connect(this.masterGain);

        this.fireGain = this.ctx.createGain();
        this.fireGain.gain.value = 0.0;
        this.fireGain.connect(this.masterGain);

        // Cargar los archivos MP3/OGG
        await this.loadAudioFiles();

        this.isInitialized = true;
    }

    // Cargar y decodificar los MP3 en buffers
    async loadAudioFiles() {
        try {
            const [windData, fireData] = await Promise.all([
                fetch(this.windUrl).then(res => res.arrayBuffer()),
                fetch(this.fireUrl).then(res => res.arrayBuffer())
            ]);

            this.windBuffer = await this.ctx.decodeAudioData(windData);
            this.fireBuffer = await this.ctx.decodeAudioData(fireData);

            this.startLoops();
        } catch (error) {
            console.error('Error al cargar o decodificar los archivos de audio MP3:', error);
        }
    }

    // Iniciar la reproducción en bucle continuo
    startLoops() {
        // Viento
        this.windSource = this.ctx.createBufferSource();
        this.windSource.buffer = this.windBuffer;
        this.windSource.loop = true;
        this.windSource.connect(this.windGain);
        this.windSource.start(0);

        // Fuego
        this.fireSource = this.ctx.createBufferSource();
        this.fireSource.buffer = this.fireBuffer;
        this.fireSource.loop = true;
        this.fireSource.connect(this.fireGain);
        this.fireSource.start(0);
    }

    // --- CONTROLES DE VOLUMEN (Compatibles con tus Sliders) ---
    setWindVolume(val) { // Espera de 0.0 a 1.0
        if (!this.isInitialized || !this.windGain) return;
        this.windGain.gain.setTargetAtTime(val * 0.8, this.ctx.currentTime, 0.05);
    }

    setFireVolume(val) { // Espera de 0.0 a 1.0
        if (!this.isInitialized || !this.fireGain) return;
        this.fireGain.gain.setTargetAtTime(val * 0.9, this.ctx.currentTime, 0.05);
    }

    // --- MUTE GLOBAL (Para conmutación Local / TV Remoto) ---
    muteAll() {
        if (!this.isInitialized || !this.masterGain) return;
        this.masterGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.05);
    }

    unmuteAll() {
        if (!this.isInitialized || !this.masterGain) return;
        this.masterGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.05);
    }
}

const auraAudio = new AuraAudioEngine();