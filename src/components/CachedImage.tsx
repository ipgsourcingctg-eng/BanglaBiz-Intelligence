/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { cacheImage, getCachedImage } from '../utils/imageUtils';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  cacheKey: string;
}

/**
 * A wrapper around <img> that caches the image in localStorage for offline persistence.
 */
export const CachedImage: React.FC<CachedImageProps> = ({ src, cacheKey, ...props }) => {
  const [displaySrc, setDisplaySrc] = useState<string>(getCachedImage(cacheKey) || src);

  useEffect(() => {
    // If not already using a data URL (cached), attempt to fetch and cache it
    if (!displaySrc.startsWith('data:') && src) {
      const loadCachedImg = async () => {
        const result = await cacheImage(src, cacheKey);
        // Only update if the result is different (e.g. now we have a DataURL)
        if (result !== displaySrc) {
          setDisplaySrc(result);
        }
      };
      
      loadCachedImg();
    }
  }, [src, cacheKey, displaySrc]);

  // Use referrerPolicy="no-referrer" for external images as per framework guidelines
  return <img src={displaySrc} referrerPolicy="no-referrer" {...props} alt={props.alt || "icon"} />;
};
