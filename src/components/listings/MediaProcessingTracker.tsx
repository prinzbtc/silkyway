'use client';

import { useState, useEffect } from 'react';
import { MediaFile, MediaProcessingStatus } from '@/types/media';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertCircle, Clock, Loader2, XCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MediaProcessingTrackerProps {
  media: MediaFile[];
  onProcessingComplete?: () => void;
  onProcessingFailed?: (failedMedia: MediaFile[]) => void;
}

export function MediaProcessingTracker({
  media,
  onProcessingComplete,
  onProcessingFailed
}: MediaProcessingTrackerProps) {
  const [processingStatus, setProcessingStatus] = useState<{
    completed: number;
    total: number;
    failed: MediaFile[];
  }>({
    completed: 0,
    total: media.length,
    failed: []
  });

  // Calculate overall progress percentage
  const progressPercentage = processingStatus.total > 0
    ? Math.round((processingStatus.completed / processingStatus.total) * 100)
    : 0;

  // Check if all media is processed
  const isComplete = processingStatus.completed === processingStatus.total && processingStatus.failed.length === 0;
  const hasFailed = processingStatus.failed.length > 0;

  // Poll for media processing status
  useEffect(() => {
    // Debug log the current media state
    console.log('MediaProcessingTracker - Current media state:', media.map(m => ({
      id: m.id,
      status: m.status,
      serverUrl: (m as any).serverUrl,
      isComplete: m.status === MediaProcessingStatus.COMPLETED || (m as any).serverUrl
    })));
    
    // Skip if no media or all already completed
    if (media.length === 0 || isComplete) {
      return;
    }
    
    // Check if all media items have server URLs, which is a direct way to determine completion
    const allHaveServerUrls = media.every(item => !!(item as any).serverUrl);
    if (allHaveServerUrls) {
      setProcessingStatus({
        completed: media.length,
        total: media.length,
        failed: []
      });
      onProcessingComplete?.();
      return;
    }

    // Find media that needs status checking
    const pendingMedia = media.filter(m => {
      // If it has a serverUrl, it's completed regardless of status
      if ((m as any).serverUrl) {
        return false; // Not pending
      }
      
      // Otherwise check the status
      return m.status === MediaProcessingStatus.PENDING || 
             m.status === MediaProcessingStatus.PROCESSING;
    });

    if (pendingMedia.length === 0) {
      // All media is either completed or failed
      const failedMedia = media.filter(m => m.status === MediaProcessingStatus.FAILED);
      setProcessingStatus({
        completed: media.length - failedMedia.length,
        total: media.length,
        failed: failedMedia
      });

      if (failedMedia.length > 0) {
        console.log('MediaProcessingTracker - Processing failed for some media items:', failedMedia);
        onProcessingFailed?.(failedMedia);
      } else {
        console.log('MediaProcessingTracker - All media processing complete, calling completion callback');
        onProcessingComplete?.();
      }
      return;
    }

    // Set up polling for media status
    const intervalId = setInterval(async () => {
      let completedCount = 0;
      const failedMedia: MediaFile[] = [];

      // Check each media item
      for (const item of media) {
        // Consider items with serverUrl as completed
        if (item.status === MediaProcessingStatus.COMPLETED || (item as any).serverUrl) {
          completedCount++;
          continue;
        }

        if (item.status === MediaProcessingStatus.FAILED) {
          failedMedia.push(item);
          continue;
        }

        // For items with temporary IDs, check if they have a serverUrl which means they're uploaded
        if (!item.id || item.id.startsWith('temp-')) {
          // For temporary files with serverUrl, consider them as completed
          if ((item as any).serverUrl) {
            completedCount++;
            continue;
          }
          // Otherwise, they're still processing
          continue;
        }

        try {
          try {
            // Poll the API for current status
            const response = await fetch(`/api/media/process?mediaId=${item.id}`);
            if (response.ok) {
            const data = await response.json();
            
            // Update the item's status
            if (data.status === MediaProcessingStatus.COMPLETED) {
              completedCount++;
            } else if (data.status === MediaProcessingStatus.FAILED) {
              failedMedia.push({
                ...item,
                status: MediaProcessingStatus.FAILED
              });
            }
            }
          } catch (error) {
            // Silently handle 404 errors for media that doesn't exist yet
            if (error instanceof TypeError || (error instanceof Error && error.message.includes('fetch'))) {
              // Network error or fetch error, just continue
              continue;
            }
            console.error(`Error checking media status for ${item.id}:`, error);
          }
        } catch (error) {
          // Outer catch for any other errors
          console.error(`Error processing media item ${item.id}:`, error);
        }
      }

      // Update processing status
      const newStatus = {
        completed: completedCount,
        total: media.length,
        failed: failedMedia
      };
      
      console.log('MediaProcessingTracker - Updating status:', newStatus);
      setProcessingStatus(newStatus);

      // Check if processing is complete
      if (completedCount + failedMedia.length === media.length) {
        clearInterval(intervalId);
        
        if (failedMedia.length > 0) {
          onProcessingFailed?.(failedMedia);
        } else {
          onProcessingComplete?.();
        }
      }
      
      // Also check if all media items have server URLs, which is another way to determine completion
      const allHaveServerUrls = media.every(item => !!(item as any).serverUrl);
      if (allHaveServerUrls) {
        clearInterval(intervalId);
        onProcessingComplete?.();
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(intervalId);
  }, [media, onProcessingComplete, onProcessingFailed, isComplete]);

  // Don't show anything if no media or already complete
  if (media.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {!isComplete && (
        <Alert variant={hasFailed ? "destructive" : "default"}>
          <AlertDescription className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              {hasFailed ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              <span className="font-medium">
                {hasFailed 
                  ? "Some media files failed to process" 
                  : "Processing your media files"}
              </span>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>
                  {processingStatus.completed} of {processingStatus.total} files processed
                </span>
                <span>{progressPercentage}%</span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>

            {hasFailed && (
              <div className="text-sm space-y-2">
                <p>
                  Please remove the failed media files and try uploading them again.
                </p>
                
                {/* Show failed files with their error messages */}
                <div className="text-xs space-y-1">
                  {media.filter(item => item.status === MediaProcessingStatus.FAILED).map((item, index) => (
                    <div key={`error-${index}`} className="flex items-start gap-1">
                      <XCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>
                        <strong>{item.filename}</strong>: 
                        {(item as any).error || 'Failed to process'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {isComplete && (
        <Alert variant="success" className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
          <AlertDescription className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="font-medium">All media files processed successfully</span>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
