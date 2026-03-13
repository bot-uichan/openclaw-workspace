import type { OcrResult } from '../../types/ocr';

export type RecognizeProgress = {
  type: 'progress';
  progress: number;
};

export type RecognizeSuccess = {
  type: 'result';
  result: OcrResult;
};

export type RecognizeError = {
  type: 'error';
  error: string;
};

export type RecognizeMessage = RecognizeProgress | RecognizeSuccess | RecognizeError;

const OcrWorker = new Worker(new URL('../../workers/ocrWorker.ts', import.meta.url), {
  type: 'module',
});

export function recognizeImage(
  imageDataUrl: string,
  onProgress?: (progress: number) => void,
): Promise<OcrResult> {
  return new Promise((resolve, reject) => {
    const handleMessage = (event: MessageEvent<RecognizeMessage>) => {
      const data = event.data;
      if (data.type === 'progress') {
        onProgress?.(data.progress);
        return;
      }

      OcrWorker.removeEventListener('message', handleMessage);
      OcrWorker.removeEventListener('error', handleWorkerError);

      if (data.type === 'result') {
        resolve(data.result);
        return;
      }

      reject(new Error(data.error));
    };

    const handleWorkerError = (event: ErrorEvent) => {
      OcrWorker.removeEventListener('message', handleMessage);
      OcrWorker.removeEventListener('error', handleWorkerError);
      reject(event.error ?? new Error(event.message));
    };

    OcrWorker.addEventListener('message', handleMessage);
    OcrWorker.addEventListener('error', handleWorkerError);
    OcrWorker.postMessage({ imageDataUrl });
  });
}
