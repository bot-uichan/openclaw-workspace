import { useCallback, useEffect, useRef, useState } from 'react';

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string>();
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setIsStarting(true);
    setError(undefined);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsActive(true);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'カメラ起動に失敗しました');
      stopCamera();
    } finally {
      setIsStarting(false);
    }
  }, [stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  return {
    videoRef,
    isStarting,
    isActive,
    error,
    startCamera,
    stopCamera,
  };
}
