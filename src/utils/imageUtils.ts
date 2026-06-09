/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility to cache small images in localStorage as Base64 strings.
 * Note: localStorage has a size limit (usually ~5MB), so only use this for critical small assets like icons.
 */

export const cacheImage = async (url: string, key: string): Promise<string> => {
  try {
    const storageKey = `img_cache_${key}`;
    const cached = localStorage.getItem(storageKey);
    if (cached) return cached;

    // Fetch the image
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        try {
          // Attempt to save to localStorage
          localStorage.setItem(storageKey, base64data);
        } catch (e) {
          console.warn("localStorage limit exceeded for image cache, using live URL instead.");
        }
        resolve(base64data);
      };
      reader.onerror = () => reject(new Error("Failed to convert image to Base64"));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn(`Could not cache image from ${url}:`, error);
    return url; // Fallback to original URL
  }
};

export const getCachedImage = (key: string): string | null => {
  return localStorage.getItem(`img_cache_${key}`);
};
