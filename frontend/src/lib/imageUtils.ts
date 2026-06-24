/**
 * Converts a File object to a base64 data URL.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Validates an image file before upload.
 */
export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'Image must be under 10MB' };
  }
  return { valid: true };
}

/**
 * Compresses an image if needed to reduce size for API upload.
 */
export function compressImage(dataUrl: string, maxWidth: number = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Extracts base64 data from a data URL.
 */
export function extractBase64FromDataUrl(dataUrl: string): string {
  return dataUrl.split(',')[1] || '';
}

/**
 * Gets the MIME type from a data URL.
 */
export function getMimeTypeFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  return match?.[1] || 'image/png';
}

/**
 * Loads an image, detects background color from the top-left pixel,
 * keys it out to transparent using a canvas, and returns a data URL.
 */
export function makeLogoTransparent(imgUrl: string, callback: (transparentUrl: string) => void) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      callback(imgUrl);
      return;
    }
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    if (data.length < 4) {
      callback(imgUrl);
      return;
    }

    // Read top-left pixel color as background color reference
    const bgR = data[0];
    const bgG = data[1];
    const bgB = data[2];
    const bgA = data[3];

    // If it's already transparent, skip keying
    if (bgA < 50) {
      callback(imgUrl);
      return;
    }

    // Replace pixels that are very close to the background color with transparent
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      const dist = Math.sqrt(
        Math.pow(r - bgR, 2) +
        Math.pow(g - bgG, 2) +
        Math.pow(b - bgB, 2)
      );

      if (dist < 40) {
        data[i + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    callback(canvas.toDataURL('image/png'));
  };
  img.onerror = () => {
    callback(imgUrl);
  };
  img.src = imgUrl;
}

