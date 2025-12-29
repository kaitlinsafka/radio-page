import type * as tf from '@tensorflow/tfjs';

let tfInstance: typeof tf | null = null;
let model: any = null;
let isInitializing = false;

/**
 * Smart Skip AI Service
 * Handles TensorFlow.js lifecycle and audio classification
 */
class SmartSkipAIService {
    /**
     * Lazy load TensorFlow.js and the WASM backend
     */
    async initialize() {
        if (tfInstance && model) return;
        if (isInitializing) {
            while (isInitializing) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }

        isInitializing = true;
        console.log('[SmartSkipAI] Initializing TensorFlow.js and WASM backend...');

        try {
            // Lazy import TF.js and WASM backend
            const tfjs = await import('@tensorflow/tfjs');
            await import('@tensorflow/tfjs-backend-wasm');

            tfInstance = tfjs;

            // Set backend to WASM
            await tfInstance.setBackend('wasm');
            await tfInstance.ready();

            console.log('[SmartSkipAI] TensorFlow.js ready with WASM backend');

            // Load the model
            // Using YAMNet from TFHub as it's ~3.7MB and excellent for Speech vs Music
            // URL: https://tfhub.dev/google/tfjs-model/yamnet/1/default/1
            const modelUrl = 'https://tfhub.dev/google/tfjs-model/yamnet/1/default/1';
            model = await tfInstance.loadGraphModel(modelUrl, { fromTFHub: true });

            console.log('[SmartSkipAI] YAMNet model loaded successfully');
        } catch (error) {
            console.error('[SmartSkipAI] Initialization failed:', error);
            throw error;
        } finally {
            isInitializing = false;
        }
    }

    /**
     * Preprocess raw audio data into the format expected by the model
     * YAMNet expects a 1D tensor of 16kHz mono audio
     */
    async preprocess(audioBuffer: Float32Array, originalSampleRate: number): Promise<tf.Tensor> {
        if (!tfInstance) throw new Error('AI Service not initialized');

        // Resample to 16kHz if necessary
        let samples = audioBuffer;
        if (originalSampleRate !== 16000) {
            try {
                const targetSampleRate = 16000;
                const targetLength = Math.ceil(audioBuffer.length * targetSampleRate / originalSampleRate);
                const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);

                const buffer = offlineCtx.createBuffer(1, audioBuffer.length, originalSampleRate);
                buffer.getChannelData(0).set(audioBuffer);

                const source = offlineCtx.createBufferSource();
                source.buffer = buffer;
                source.connect(offlineCtx.destination);
                source.start();

                const renderedBuffer = await offlineCtx.startRendering();
                samples = renderedBuffer.getChannelData(0);
            } catch (e) {
                console.warn('[SmartSkipAI] Resampling failed, falling back to raw samples:', e);
            }
        }

        return tfInstance.tidy(() => {
            return tfInstance.tensor1d(samples);
        });
    }

    /**
     * Run inference on the audio buffer
     * Returns a probability map or specific class scores
     */
    async classify(audioBuffer: Float32Array, sampleRate: number): Promise<{ speech: number; music: number; other: number }> {
        await this.initialize();
        if (!tfInstance || !model) throw new Error('AI Service failed to initialize');

        if (!audioBuffer || audioBuffer.length === 0) {
            return { speech: 0, music: 0, other: 1 };
        }

        const input = await this.preprocess(audioBuffer, sampleRate);
        const results: any[] = [];
        let meanPredictions: any = null;

        try {
            // YAMNet output: Usually [predictions, embeddings, log_mel_spectrogram]
            // or an object with these as keys.
            const predictionResult = model.predict(input);

            let predictions: any = null;
            if (Array.isArray(predictionResult)) {
                predictions = predictionResult[0];
                results.push(...predictionResult);
            } else if (predictionResult instanceof tfInstance.Tensor) {
                predictions = predictionResult;
                results.push(predictionResult);
            } else if (predictionResult && typeof predictionResult === 'object') {
                // Named outputs
                predictions = predictionResult['activations'] || Object.values(predictionResult)[0];
                Object.values(predictionResult).forEach(t => {
                    if (t instanceof tfInstance!.Tensor) results.push(t);
                });
            }

            if (!predictions || !(predictions instanceof tfInstance.Tensor)) {
                throw new Error('Could not extract predictions from model output');
            }

            // predictions shape: [num_frames, 521] or [1, num_frames, 521]
            let processedPredictions = predictions;
            if (predictions.rank === 3) {
                processedPredictions = predictions.squeeze([0]);
                results.push(processedPredictions);
            }

            if (processedPredictions.shape[0] === 0) {
                throw new Error('No frames detected in audio capture');
            }

            // Average predictions over the frames
            meanPredictions = processedPredictions.mean(0);
            const scores = await meanPredictions.data();

            // YAMNet class indices: 0: Speech, 132: Music
            const speechScore = scores[0] || 0;
            const musicScore = scores[132] || 0;

            return {
                speech: speechScore,
                music: musicScore,
                other: 1 - (speechScore + musicScore)
            };
        } catch (error) {
            console.error('[SmartSkipAI] Inference error:', error);
            return { speech: 0, music: 0, other: 1 };
        } finally {
            // Safe disposal of all involved tensors
            if (tfInstance) {
                const tensorsToDispose = [input, meanPredictions, ...results];
                tensorsToDispose.forEach(t => {
                    if (t && t instanceof tfInstance!.Tensor && !t.isDisposed) {
                        try { t.dispose(); } catch (e) { }
                    }
                });
            }
        }
    }
}

export const smartSkipAI = new SmartSkipAIService();
