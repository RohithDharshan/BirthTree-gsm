// Compress uploaded images to ≤200px JPEG so Firestore docs stay small
export const compressImage = (dataUrl, maxDim = 200) =>
  new Promise(resolve => {
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve(dataUrl);
  });
