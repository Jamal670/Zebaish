import { useState, useEffect } from 'react';

/**
 * Creates and manages an object URL for a File or Blob.
 * Automatically revokes the created URL when the input file changes or when the component unmounts.
 */
export function useObjectUrl(file: File | Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return url;
}

