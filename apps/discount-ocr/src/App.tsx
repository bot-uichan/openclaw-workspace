import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { CameraPanel } from './components/CameraPanel';
import { DebugPanel } from './components/DebugPanel';
import { ImageUploadPanel } from './components/ImageUploadPanel';
import { PreprocessPanel } from './components/PreprocessPanel';
import { ResultPanel } from './components/ResultPanel';
import { useCamera } from './hooks/useCamera';
import { useOcrLoop } from './hooks/useOcrLoop';
import { useStableDetection } from './hooks/useStableDetection';
import { recognizeImage } from './lib/ocr/recognizeImage';
import { buildDetectionSummary } from './lib/parser/pairDetection';
import { preprocessImageDataUrl } from './lib/preprocess/opencv';
import type { DetectionSummary, OcrResult } from './types/ocr';

export default function App() {
  const [imageFile, setImageFile] = useState<File>();
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>();
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState<string>();
  const [ocrResult, setOcrResult] = useState<OcrResult>();
  const [latestSummary, setLatestSummary] = useState<DetectionSummary>();
  const [status, setStatus] = useState('画像を選ぶかカメラを起動してください');
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [usePreprocess, setUsePreprocess] = useState(true);
  const [isPreprocessLoading, setIsPreprocessLoading] = useState(false);
  const { videoRef, isActive, isStarting, error: cameraError, startCamera, stopCamera } = useCamera();
  const { stableSummary, stability, pushSummary, reset } = useStableDetection();

  useEffect(() => {
    if (!imageFile) return undefined;
    const nextUrl = URL.createObjectURL(imageFile);
    setImagePreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [imageFile]);

  const canRun = Boolean(imageFile) && !isRunning;
  const canCapture = isActive && !isRunning;

  const selectedHints = useMemo(
    () => [
      '対応予定: 10% / 30%OFF / 1割引 / 半額',
      '静止画PoC + カメラ手動キャプチャ + 定期OCRループ',
      'OpenCV.js 前処理を切替可能',
    ],
    [],
  );

  const runOcrFromDataUrl = useCallback(
    async (sourceImageDataUrl: string, sourceLabel = 'OCR') => {
      setIsRunning(true);
      setError(undefined);
      setProgress(0);
      setStatus(`${sourceLabel} 準備中…`);

      try {
        let targetImageDataUrl = sourceImageDataUrl;
        if (usePreprocess) {
          setIsPreprocessLoading(true);
          setStatus(`${sourceLabel} 前処理中…`);
          targetImageDataUrl = await preprocessImageDataUrl(sourceImageDataUrl);
          setProcessedPreviewUrl(targetImageDataUrl);
        } else {
          setProcessedPreviewUrl(undefined);
        }

        const nextOcrResult = await recognizeImage(targetImageDataUrl, (nextProgress) => {
          setProgress(nextProgress);
          setStatus(`${sourceLabel} 実行中… ${Math.round(nextProgress * 100)}%`);
        });

        const nextSummary = buildDetectionSummary(nextOcrResult.text);
        setOcrResult(nextOcrResult);
        setLatestSummary(nextSummary);
        pushSummary(nextSummary);
        setProgress(1);
        setStatus(stability === 'confirmed' ? '解析完了 / confirmed' : '解析完了');
      } catch (nextError) {
        setStatus(`${sourceLabel} 失敗`);
        setError(nextError instanceof Error ? nextError.message : 'Unknown error');
      } finally {
        setIsRunning(false);
        setIsPreprocessLoading(false);
      }
    },
    [pushSummary, stability, usePreprocess],
  );

  async function handleRunOcr() {
    if (!imageFile || isRunning) return;
    reset();
    const imageDataUrl = await fileToDataUrl(imageFile);
    await runOcrFromDataUrl(imageDataUrl, '画像OCR');
  }

  const handleCaptureFromCamera = useCallback(async () => {
    if (!videoRef.current || isRunning) return;
    const imageDataUrl = captureVideoFrame(videoRef.current);
    setImagePreviewUrl(imageDataUrl);
    await runOcrFromDataUrl(imageDataUrl, 'カメラOCR');
  }, [isRunning, runOcrFromDataUrl, videoRef]);

  const { isLoopActive, toggleLoop, stopLoop } = useOcrLoop({
    enabled: isActive,
    busy: isRunning,
    intervalMs: 1500,
    onTick: handleCaptureFromCamera,
  });

  useEffect(() => {
    if (!isActive && isLoopActive) {
      stopLoop();
    }
  }, [isActive, isLoopActive, stopLoop]);

  function handleStopCamera() {
    stopLoop();
    stopCamera();
  }

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Discount OCR PoC</p>
          <h1>値札 + 割引認識アプリ</h1>
          <p className="hero-copy">
            Tesseract.js を Web Worker で回し、OCR前に OpenCV.js で前処理を挟める PoC です。
          </p>
        </div>
        <ul className="hero-hints">
          {selectedHints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      </header>

      <div className="action-row">
        <button className="primary-button" disabled={!canRun} onClick={handleRunOcr}>
          {isRunning ? 'OCR実行中…' : '画像でOCRを実行'}
        </button>
      </div>

      <div className="layout-grid">
        <ImageUploadPanel disabled={isRunning} imagePreviewUrl={imagePreviewUrl} onSelectFile={setImageFile} />
        <CameraPanel
          ref={videoRef}
          isActive={isActive}
          isStarting={isStarting}
          isLoopActive={isLoopActive}
          stability={stability}
          error={cameraError}
          onStart={startCamera}
          onStop={handleStopCamera}
          onCapture={handleCaptureFromCamera}
          onToggleLoop={toggleLoop}
          canCapture={canCapture}
        />
        <PreprocessPanel
          enabled={usePreprocess}
          isLoading={isPreprocessLoading}
          processedPreviewUrl={processedPreviewUrl}
          onToggle={() => setUsePreprocess((current) => !current)}
        />
        <ResultPanel status={status} progress={progress} stability={stability} summary={stableSummary ?? latestSummary} />
        <DebugPanel ocrResult={ocrResult} summary={latestSummary} error={error} />
      </div>
    </main>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('画像データの読み込みに失敗しました。'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

function captureVideoFrame(video: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context の取得に失敗しました。');
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}
