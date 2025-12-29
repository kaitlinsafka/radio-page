
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';

// YAMNet model URL (TFJS compatible)
const MODEL_URL = 'https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1';

// Key classes mapped from YAMNet's 521 classes
// We will load the class map dynamically or define identifying indices
const AD_CLASSES = [
    'Speech', 'Narration', 'Conversation', 'Male speech, man speaking', 'Female speech, woman speaking',
    'Crowd', 'Hubbub, speech noise, babble', 'Applause', 'Cheering', 'Laughter',
    'Jingle (music)', 'Advertising' // "Advertising" isn't a YAMNet class usually, but "Speech" is
];

const MUSIC_CLASSES = [
    'Music', 'Musical instrument', 'Singing', 'Plucked string instrument', 'Guitar', 'Piano', 'Drum', 'Percussion'
];

interface Prediction {
    class: string;
    score: number;
}

class TensorFlowService {
    private model: tf.GraphModel | null = null;
    private audioContext: AudioContext | null = null;
    private classMap: string[] = [];
    private isLoaded = false;
    private isLoading = false;

    // YAMNet expects 16kHz audio sample rate
    private readonly MODEL_SAMPLE_RATE = 16000;

    constructor() {
        // Initialize backend (try WASM, fallback to WebGL/CPU)
        this.initBackend();
    }

    private async initBackend() {
        try {
            await tf.setBackend('wasm');
            console.log('[TensorFlow] Backend set to WASM');
        } catch (e) {
            console.log('[TensorFlow] WASM backend failed, using default (webgl/cpu)');
        }
    }

    public async loadModel(): Promise<void> {
        if (this.isLoaded || this.isLoading) return;
        this.isLoading = true;

        try {
            console.log('[TensorFlow] Loading YAMNet model...');
            this.model = await tf.loadGraphModel(MODEL_URL, { fromTFHub: true });

            // Load class map (YAMNet has 521 classes)
            // For now, we fetch a simplified list or standard YAMNet map
            // Since we can't fetch the map easily from the model graph metadata in basic TFJS, 
            // we'll fetch the official map JSON or use a local constant if needed.
            // For this implementation, we will use the model's output index logic if possible,
            // or fetch the mapping.
            await this.fetchClassMap();

            this.isLoaded = true;
            console.log('[TensorFlow] Model loaded successfully');
        } catch (error) {
            console.error('[TensorFlow] Failed to load model:', error);
        } finally {
            this.isLoading = false;
        }
    }

    private async fetchClassMap() {
        // Official YAMNet class map
        const response = await fetch('https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv');
        const text = await response.text();
        // Parse CSV to get class names (index, mid, display_name)
        // We assume the model outputs match this order (0-520)
        this.classMap = text.split('\n')
            .slice(1) // skip header
            .map(line => line.split(',')[2]) // get display_name
            .filter(Boolean); // remove empty
    }

    /**
     * Resamples audio buffer to 16kHz and fits to model input
     */
    private async preprocessAudio(audioData: Float32Array, sampleRate: number): Promise<tf.Tensor> {
        // 1. Resample to 16kHz
        const targetLength = Math.floor(audioData.length * (this.MODEL_SAMPLE_RATE / sampleRate));
        const offlineCtx = new OfflineAudioContext(1, targetLength, this.MODEL_SAMPLE_RATE);
        const buffer = offlineCtx.createBuffer(1, audioData.length, sampleRate);
        buffer.copyToChannel(audioData, 0);

        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(offlineCtx.destination);
        source.start();

        const resampled = await offlineCtx.startRendering();
        const float32 = resampled.getChannelData(0);

        // 2. YAMNet expects a specific input length? 
        // Actually YAMNet in TFHub handles variable length and returns frame-based scores.
        // We will pass the waveform directly.

        return tf.tensor(float32);
    }

    public async classify(audioData: Float32Array, sampleRate: number): Promise<{ isSpeech: boolean, isMusic: boolean, confidence: number, topClass: string }> {
        if (!this.model || !this.isLoaded) {
            await this.loadModel();
        }

        if (!this.model) return { isSpeech: false, isMusic: false, confidence: 0, topClass: 'unknown' };

        return tf.tidy(() => {
            // Preprocessing usually needs to be async for OfflineContext, 
            // but we can't do async inside tf.tidy easily. 
            // We'll move tensor creation out or handle cleanup manually.
            return { isSpeech: false, isMusic: false, confidence: 0, topClass: 'error' };
        });
    }

    // Async wrapper for classification to handle preprocessing
    public async classifyAudio(audioData: Float32Array, sampleRate: number) {
        if (!this.model || !this.isLoaded) await this.loadModel();
        if (!this.model) return null;

        try {
            const waveformTensor = await this.preprocessAudio(audioData, sampleRate);

            // YAMNet inference
            const [scores, embeddings, spectrogram] = this.model.predict(waveformTensor) as tf.Tensor[];
            // scores is [N, 521] where N is number of frames (approx 1 per 0.48s)

            // We want the mean score across all frames for the captured buffer
            const meanScores = scores.mean(0); // [521]
            const values = await meanScores.data();

            // Find top classes
            const indices = Array.from(values)
                .map((score, index) => ({ score, index }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

            const topClasses = indices.map(i => ({
                class: this.classMap[i.index],
                score: i.score
            }));

            // Check for Speech/Ad vs Music
            let speechScore = 0;
            let musicScore = 0;

            // Sum scores for known categories using identifying keywords
            for (let i = 0; i < values.length; i++) {
                const className = this.classMap[i];
                if (!className) continue;
                const score = values[i];

                if (AD_CLASSES.some(c => className.includes(c))) speechScore += score;
                if (MUSIC_CLASSES.some(c => className.includes(c))) musicScore += score;
            }

            // Clean up tensors
            waveformTensor.dispose();
            scores.dispose();
            embeddings.dispose();
            spectrogram.dispose();
            meanScores.dispose();

            return {
                speechScore,
                musicScore,
                topClasses
            };

        } catch (e) {
            console.error('[TensorFlow] Inference failed:', e);
            return null;
        }
    }
}

export const tfService = new TensorFlowService();
