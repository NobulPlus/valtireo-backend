import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

/** Normalize camera-library formats and avoid uploading multi-megabyte originals. */
export async function prepareProfilePhoto(asset: { uri: string; width: number; height: number }) {
  const context = ImageManipulator.manipulate(asset.uri);
  try {
    if (Math.max(asset.width, asset.height) > 1024) {
      context.resize(asset.width >= asset.height ? { width: 1024 } : { height: 1024 });
    }
    const image = await context.renderAsync();
    try {
      const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      const file = new File(result.uri);
      if (!file.exists || file.size > 2 * 1024 * 1024) {
        if (file.exists) file.delete();
        throw new Error('Choose a smaller photo. The upload limit is 2 MB.');
      }
      return { uri: result.uri, name: 'profile-photo.jpg', type: 'image/jpeg' };
    } finally {
      image.release();
    }
  } finally {
    context.release();
  }
}

export function discardProfilePhoto(uri: string) {
  try { const file = new File(uri); if (file.exists) file.delete(); } catch { /* Cache cleanup must not interrupt editing. */ }
}
