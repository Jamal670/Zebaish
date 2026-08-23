import React from 'react';
import { GenericModal } from './GenericModal';
import { ExternalLink } from 'lucide-react';

export interface ScreenshotPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  recordTitle?: string;
}

export const ScreenshotPreviewModal: React.FC<ScreenshotPreviewModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  recordTitle = 'Payment Receipt Screenshot',
}) => {
  if (!imageUrl) return null;

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={recordTitle}
      subtitle="Full resolution transaction screenshot submitted by seller"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="bg-stone-900 rounded-lg overflow-hidden border border-stone-800 flex items-center justify-center p-2 min-h-[300px] max-h-[65vh]">
          <img
            src={imageUrl}
            alt="Uploaded payment receipt screenshot"
            className="max-h-[60vh] max-w-full object-contain rounded"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100">
          <span>Click outside or press ESC to close</span>
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-900 font-bold hover:underline flex items-center space-x-1"
          >
            <span>Open Original Image</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </GenericModal>
  );
};
