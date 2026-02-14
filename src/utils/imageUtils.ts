/**
 * Resizes an image file to a maximum width/height while maintaining aspect ratio.
 * Returns the resized image as a Data URL (base64 string).
 * 
 * @param file The image file to resize
 * @param maxWidth The maximum width in pixels (default: 800)
 * @param maxHeight The maximum height in pixels (default: 800)
 * @param quality The JPEG quality (0.0 to 1.0, default: 0.7)
 */
export const resizeImage = (
    file: File,
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.7
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate new dimensions
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Could not get canvas context'));
                    return;
                }

                // Draw image on canvas
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to Data URL (JPEG for better compression)
                // If the original was PNG with transparency, the background will be black (default canvas behavior).
                // To fix this, we can fill white background first if needed, but for photos JPEG is fine.
                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
