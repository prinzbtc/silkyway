'use client';

import { FC, useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaFile, MediaType } from '@/types/media';

interface MediaCarouselProps {
  media: MediaFile[];
  onMediaClick?: (index: number) => void;
  autoplayVideos?: boolean;
}

export const MediaCarousel: FC<MediaCarouselProps> = ({
  media,
  onMediaClick,
  autoplayVideos = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoplayVideos);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentMedia = media?.[currentIndex];
  const isVideo = currentMedia?.type === MediaType.VIDEO;
  
  // Debug: Log current media item to check thumbnail URL
  console.log('MediaCarousel current media:', {
    index: currentIndex,
    isVideo,
    url: currentMedia?.url,
    thumbnail: currentMedia?.thumbnail
  });

  useEffect(() => {
    // Handle video playback state when current media changes
    if (videoRef.current) {
      if (isVideo && isPlaying) {
        videoRef.current.play().catch(err => console.error('Video play error:', err));
      } else if (videoRef.current) {
        videoRef.current.pause();
      }
    }
  }, [currentIndex, isVideo, isPlaying]);

  const nextMedia = () => {
    if (media?.length) {
      setCurrentIndex((prev) => (prev + 1) % media.length);
    }
  };

  const previousMedia = () => {
    if (media?.length) {
      setCurrentIndex((prev) => (prev - 1 + media.length) % media.length);
    }
  };

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => console.error('Video play error:', err));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (!media?.length) {
    return (
      <div className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
        <span className="text-gray-400">No media available</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Media */}
      <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
        {isVideo ? (
          <div className="w-full h-full" onClick={() => onMediaClick?.(currentIndex)}>
            <video
              ref={videoRef}
              src={currentMedia.url}
              poster={currentMedia.thumbnail}
              className="w-full h-full object-contain"
              controls={false}
              loop
              muted={isMuted}
              playsInline
            />
            
            {/* Video Controls */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-black/50 rounded-lg p-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={togglePlayPause}
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <Image
            src={currentMedia.url || '/placeholder-image.jpg'}
            alt={`Media ${currentIndex + 1}`}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={currentIndex === 0}
            className="object-cover cursor-pointer"
            onClick={() => onMediaClick?.(currentIndex)}
          />
        )}
        
        {media.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white/90"
              onClick={(e) => {
                e.stopPropagation();
                previousMedia();
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
                nextMedia();
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {/* Media Counter */}
        {media.length > 1 && (
          <div className="absolute top-4 right-4">
            <div className="bg-black/50 text-white text-sm px-2 py-1 rounded-full">
              {currentIndex + 1} / {media.length}
            </div>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {media.length > 1 && (
        <div className="grid grid-cols-4 gap-4">
          {media.map((item, index) => (
            <button
              key={item.id}
              className={`relative aspect-square rounded-lg overflow-hidden ${
                index === currentIndex ? 'ring-2 ring-primary' : 'opacity-70'
              } hover:opacity-100 transition-opacity`}
              onClick={() => setCurrentIndex(index)}
            >
              {item.type === MediaType.VIDEO ? (
                <div className="relative w-full h-full">
                  <Image
                    src={item.thumbnail || item.url || '/placeholder-image.jpg'}
                    alt={`Thumbnail ${index + 1}`}
                    fill
                    sizes="(max-width: 768px) 25vw, 12.5vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Play className="h-6 w-6 text-white drop-shadow-md" />
                  </div>
                </div>
              ) : (
                <Image
                  src={item.url || '/placeholder-image.jpg'}
                  alt={`Thumbnail ${index + 1}`}
                  fill
                  sizes="(max-width: 768px) 25vw, 12.5vw"
                  className="object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
