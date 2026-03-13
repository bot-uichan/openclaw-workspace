import { forwardRef } from 'react';
import type { DetectionStability } from '../types/ocr';

type CameraPanelProps = {
  isActive: boolean;
  isStarting: boolean;
  isLoopActive: boolean;
  stability: DetectionStability;
  error?: string;
  onStart: () => void;
  onStop: () => void;
  onCapture: () => void;
  onToggleLoop: () => void;
  canCapture: boolean;
};

export const CameraPanel = forwardRef<HTMLVideoElement, CameraPanelProps>(function CameraPanel(
  { isActive, isStarting, isLoopActive, stability, error, onStart, onStop, onCapture, onToggleLoop, canCapture },
  ref,
) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>2. カメラ PoC</h2>
        <p>カメラ起動、手動キャプチャ、定期OCRループまで入った段階です。</p>
      </div>

      <div className="camera-frame">
        <video ref={ref} className="camera-video" playsInline muted />
        <div className="camera-roi">
          <span>この枠に値札を入れる</span>
        </div>
        <div className={`stability-badge is-${stability}`}>{labelForStability(stability)}</div>
        {!isActive ? <div className="camera-placeholder">カメラを開始してください</div> : null}
      </div>

      <div className="camera-actions">
        <button className="secondary-button" onClick={isActive ? onStop : onStart} disabled={isStarting}>
          {isActive ? 'カメラ停止' : isStarting ? '起動中…' : 'カメラ開始'}
        </button>
        <button className="primary-button" onClick={onCapture} disabled={!canCapture}>
          フレームをOCR
        </button>
        <button className="secondary-button" onClick={onToggleLoop} disabled={!isActive}>
          {isLoopActive ? '定期OCR停止' : '定期OCR開始'}
        </button>
      </div>

      {error ? <div className="error-box">{error}</div> : null}
    </section>
  );
});

function labelForStability(stability: DetectionStability) {
  if (stability === 'confirmed') return 'confirmed';
  if (stability === 'candidate') return 'candidate';
  return 'reading';
}
