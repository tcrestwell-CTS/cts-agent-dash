export const HERO_IMAGE_MIN_WIDTH = 1600;
export const HERO_IMAGE_MIN_HEIGHT = 900;
export const HERO_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export type HeroImageValidation =
  | { valid: true; width: number; height: number; warning?: string }
  | { valid: false; message: string };

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(objectUrl);
      resolve(dimensions);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The image could not be read"));
    };
    image.src = objectUrl;
  });
}

export async function validateHeroImage(file: File): Promise<HeroImageValidation> {
  if (!file.type.startsWith("image/")) {
    return { valid: false, message: "Please select an image file" };
  }

  if (file.size > HERO_IMAGE_MAX_BYTES) {
    return { valid: false, message: "Hero images must be under 10 MB" };
  }

  try {
    const { width, height } = await readImageDimensions(file);
    if (width < HERO_IMAGE_MIN_WIDTH || height < HERO_IMAGE_MIN_HEIGHT) {
      return {
        valid: true,
        width,
        height,
        warning: `This image is ${width} × ${height}. For the sharpest preview, use one at least ${HERO_IMAGE_MIN_WIDTH} × ${HERO_IMAGE_MIN_HEIGHT} pixels.`,
      };
    }
    return { valid: true, width, height };
  } catch {
    // Dimensions could not be read (e.g. unusual format) — allow the upload.
    return { valid: true, width: 0, height: 0 };
  }
}