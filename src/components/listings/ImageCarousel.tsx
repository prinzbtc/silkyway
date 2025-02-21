'use client';

import { FC, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageCarouselProps {
  images: { id: string; url: string }[];
  onImageClick?: (index: number) => void;
}

export const ImageCarousel: FC<ImageCarouselProps> = ({
  images,
  onImageClick,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextImage = () => {
    if (images?.length) {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }
  };

  const previousImage = () => {
    if (images?.length) {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  if (!images?.length) {
    return (
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
        <span className="text-gray-400">No images available</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
        <Image
          src={images[currentIndex].url}
          alt={`Image ${currentIndex + 1}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          priority={currentIndex === 0}
          className="object-cover cursor-pointer"
          onClick={() => onImageClick?.(currentIndex)}
        />
        
        {images.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white/90"
              onClick={(e) => {
                e.stopPropagation();
                previousImage();
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white/90"
              onClick={(e) => {
                e.stopPropagation();
                nextImage();
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <div className="bg-black/50 text-white text-sm px-2 py-1 rounded-full">
              {currentIndex + 1} / {images.length}
            </div>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-4">
          {images.map((image, index) => (
            <button
              key={image.id}
              className={`relative aspect-square rounded-lg overflow-hidden ${index === currentIndex
                ? ''
                : 'opacity-50'
              } hover:opacity-100 transition-opacity`}
              onClick={() => setCurrentIndex(index)}
            >
              <Image
                src={image.url}
                alt={`Thumbnail ${index + 1}`}
                fill
                sizes="(max-width: 768px) 25vw, 12.5vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
