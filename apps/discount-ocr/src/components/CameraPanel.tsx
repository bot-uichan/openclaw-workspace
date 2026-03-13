import { forwardRef } from 'react';

type CameraPanelProps = {
  isActive: boolean;
  isStarting: boolean;
  error?: string;
  onStart: () => void;
  onStop: () => void;
  onCapture: () => void;
  canCapture: boolean;
};

export const CameraPanel = forwardRef<HTMLVideoElement, CameraPanelProps>(function CameraPanel(
  { isActive, isStarting, error, onStart, onStop, onCapture, canCapture },
  ref,
) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>2. カメラ PoC</h2>
        <p>次フェーズ用の最小実装です。まずは起動して、手動キャプチャでOCRに流します。</p>
      </div>

      <div className="camera-frame">
        <video ref={ref} className="camera-video" playsInline muted />
        <div className="camera-roi">
          <span>この枠に値札を入れる</span>
        </div>
        {!isActive ? <div className="camera-placeholder">カメラを開始してください</div> : null}
      </div>

      <div className="camera-actions">
        <button className="secondary-button" onClick={isActive ? onStop : onStart} disabled={isStarting}>
          {isActive ? 'カメラ停止' : isStarting ? '起動中…' : 'カメラ開始'}
        </button>
        <button className="primary-button" onClick={onCapture} disabled={!canCapture}>
          フレームをOCR
        </button>
      </div>

      {error ? <div className="error-box">{error}</div> : null}
    </section>
  );
});
