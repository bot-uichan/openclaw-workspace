import cv from '@techstark/opencv-js';

let cvReadyPromise: Promise<typeof cv> | undefined;

export function loadOpenCv() {
  if (!cvReadyPromise) {
    cvReadyPromise = Promise.resolve(cv);
  }
  return cvReadyPromise;
}

export async function preprocessImageDataUrl(imageDataUrl: string): Promise<string> {
  const cvInstance = await loadOpenCv();
  const image = await loadImage(imageDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context の取得に失敗しました。');
  }

  context.drawImage(image, 0, 0);

  const src = cvInstance.imread(canvas);
  const gray = new cvInstance.Mat();
  const blurred = new cvInstance.Mat();
  const binary = new cvInstance.Mat();

  try {
    cvInstance.cvtColor(src, gray, cvInstance.COLOR_RGBA2GRAY, 0);
    cvInstance.GaussianBlur(gray, blurred, new cvInstance.Size(3, 3), 0, 0, cvInstance.BORDER_DEFAULT);
    cvInstance.adaptiveThreshold(
      blurred,
      binary,
      255,
      cvInstance.ADAPTIVE_THRESH_GAUSSIAN_C,
      cvInstance.THRESH_BINARY,
      31,
      12,
    );

    cvInstance.imshow(canvas, binary);
    return canvas.toDataURL('image/png');
  } finally {
    src.delete();
    gray.delete();
    blurred.delete();
    binary.delete();
  }
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('画像ロードに失敗しました。'));
    image.src = src;
  });
}
