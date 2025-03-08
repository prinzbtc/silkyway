'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { X, Upload, Image as ImageIcon, Video, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { MediaFile, MediaType, MediaProcessingStatus } from '@/types/media';
import { UPLOAD_CONFIG, isVideoFile, isImageFile, validateMediaCount } from '@/config/upload';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { VirusAlertDialog } from '@/components/security/VirusAlertDialog';

interface MediaUploaderProps {
  media: MediaFile[];
  onChange: (media: MediaFile[]) => void;
  existingMedia?: MediaFile[];
  onExistingChange?: (media: MediaFile[]) => void;
  maxFiles?: number;
  onProcessingComplete?: () => void;
}

export function MediaUploader({ 
  media = [], 
  onChange, 
  existingMedia = [], 
  onExistingChange,
  maxFiles = UPLOAD_CONFIG.MAX_TOTAL_FILES,
  onProcessingComplete
}: MediaUploaderProps) {
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // State for virus alert dialog
  const [virusAlertOpen, setVirusAlertOpen] = useState(false);
  const [infectedFileName, setInfectedFileName] = useState('');

  // Count current media by type (including existing media)
  const imageCount = media.filter(m => m.type === MediaType.IMAGE).length + 
                    existingMedia.filter(m => m.type === MediaType.IMAGE).length;
  const videoCount = media.filter(m => m.type === MediaType.VIDEO).length + 
                    existingMedia.filter(m => m.type === MediaType.VIDEO).length;

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      try {
        // Filter files based on type and count limits
        const newImages: File[] = [];
        const newVideos: File[] = [];

        acceptedFiles.forEach(file => {
          if (isImageFile(file) && imageCount + newImages.length < UPLOAD_CONFIG.IMAGE.MAX_FILES) {
            newImages.push(file);
          } else if (isVideoFile(file) && videoCount + newVideos.length < UPLOAD_CONFIG.VIDEO.MAX_FILES) {
            newVideos.push(file);
          }
        });

        // Check if we're exceeding total file count
        const totalNewFiles = newImages.length + newVideos.length;
        if (media.length + existingMedia.length + totalNewFiles > maxFiles) {
          setErrors({ 
            general: `You can only upload a maximum of ${maxFiles} files (${UPLOAD_CONFIG.IMAGE.MAX_FILES} images and ${UPLOAD_CONFIG.VIDEO.MAX_FILES} video)` 
          });
          return;
        }

        // Process each file
        const newMediaFiles: MediaFile[] = [];
        const allFiles = [...newImages, ...newVideos];

        for (let i = 0; i < allFiles.length; i++) {
          const file = allFiles[i];
          const fileId = `temp-${Date.now()}-${i}`;
          
          // Create a temporary media file
          const mediaType = isImageFile(file) ? MediaType.IMAGE : MediaType.VIDEO;
          const newMediaFile: MediaFile = {
            id: fileId,
            filename: file.name,
            type: mediaType,
            order: media.length + i,
            file,
            status: MediaProcessingStatus.PENDING,
            isMain: media.length === 0 && existingMedia.length === 0 && i === 0,
            isMainMedia: media.length === 0 && existingMedia.length === 0 && i === 0,
          };

          // Update progress state
          setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));
          
          // Create object URL for preview
          const objectUrl = URL.createObjectURL(file);
          newMediaFile.url = objectUrl;
          // Also store the blob URL separately to ensure we don't lose it
          (newMediaFile as any).blobUrl = objectUrl;
          
          // Add to new media files array
          newMediaFiles.push(newMediaFile);
          
          // We'll upload the file after updating the state
        }

        // Update media state with new files
        const updatedMedia = [...media, ...newMediaFiles];
        
        console.log('Initial media state after adding new files:', updatedMedia.map(m => ({
          id: m.id,
          url: m.url,
          blobUrl: (m as any).blobUrl,
          thumbnail: m.thumbnail,
          status: m.status
        })));
        
        // First update the state with the new files
        onChange(updatedMedia);
        
        // Then start uploading the files
        // We need to pass the updated media array directly to the upload function
        // to ensure it has access to the latest state
        for (let i = 0; i < allFiles.length; i++) {
          const file = allFiles[i];
          const fileId = newMediaFiles[i].id;
          
          // Make sure we have a valid fileId
          if (fileId) {
            // Use setTimeout to ensure the state update has been processed
            // We pass the updatedMedia directly to avoid state timing issues
            setTimeout(() => {
              processFileUpload(fileId, file, updatedMedia);
            }, 100);
          } else {
            console.error('Missing fileId for file:', file.name);
          }
        }
        
        // Clear any errors
        if (errors.general) {
          setErrors({});
        }
      } catch (error) {
        console.error('Error handling file drop:', error);
        setErrors({ general: 'An error occurred while processing the files. Please try again.' });
      }
    },
    [media, onChange, maxFiles, imageCount, videoCount, existingMedia.length, errors.general]
  );

  // Process file upload with the latest media state
  const processFileUpload = (fileId: string, file: File, currentMediaState: MediaFile[]) => {
    console.log(`Processing upload for file: ${file.name}, id: ${fileId}`);
    
    // First, make sure this media item exists in the provided media state
    const mediaItem = currentMediaState.find(item => item.id === fileId);
    if (!mediaItem) {
      console.error(`Media item with id ${fileId} not found in provided media state, aborting upload`);
      return;
    }
    
    // Call the upload function with the file
    uploadFile(fileId, file, currentMediaState);
  };
  
  // Upload file to server
  const uploadFile = async (fileId: string, file: File, currentMediaState?: MediaFile[]) => {
    console.log(`Starting upload for file: ${file.name}, id: ${fileId}`);
    
    // First, let's make sure this media item still exists in our state
    // Use the provided media state if available, otherwise use the component state
    const mediaStateToUse = currentMediaState || media;
    const mediaItem = mediaStateToUse.find(item => item.id === fileId);
    if (!mediaItem) {
      console.error(`Media item with id ${fileId} not found in state, aborting upload`);
      return;
    }
    
    // Keep track of retries
    let retryCount = 0;
    const maxRetries = 2;
    
    // Function to handle the actual upload with retry logic
    const attemptUpload = async (): Promise<any> => {
      try {
        console.log(`Uploading file (attempt ${retryCount + 1}/${maxRetries + 1}):`, { 
          id: fileId, 
          name: file.name,
          size: file.size,
          type: file.type
        });
        
        // Create form data
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', 'listings');
        
        console.log('FormData created:', { fileName: file.name, fileSize: file.size, purpose: 'listings' });
        
        // Update progress to indicate upload start
        const progressStart = retryCount > 0 ? 20 : 10;
        setUploadProgress(prev => ({ ...prev, [fileId]: progressStart }));
        
        // Upload file using the optimized route for better performance with large files
        console.log('Sending fetch request to /api/upload/optimized');
        const response = await fetch('/api/upload/optimized', {
          method: 'POST',
          body: formData,
        });
        console.log('Fetch response received:', { status: response.status, statusText: response.statusText });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Upload failed: ${response.status} ${errorText || response.statusText}`);
        }
        
        // Parse response
        const data = await response.json();
        console.log('Response data:', data);
        
        if (!data.success) {
          throw new Error('Upload failed: Server reported unsuccessful upload');
        }
        
        if (!data.file || !data.file.url) {
          throw new Error('Upload failed: Server response missing file URL');
        }
        
        // Update progress to indicate upload complete
        setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
        console.log('Upload completed successfully for file:', file.name);
        
        return data;
      } catch (error) {
        // If we haven't exceeded max retries, try again
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Upload failed, retrying (${retryCount}/${maxRetries})...`, error);
          // Wait a moment before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
          return attemptUpload(); // Recursive retry
        }
        throw error; // Re-throw if we've exhausted retries
      }
    };
    
    try {
      // Attempt the upload with retry logic
      const data = await attemptUpload();
      
      // Check if the upload failed due to virus detection
      if (data && !data.success && data.isVirusDetected) {
        console.log('Virus detected in file:', fileId);
        
        // Update the media item to indicate virus detection
        const updatedMedia = media.map(item => {
          if (item.id === fileId) {
            return { 
              ...item, 
              status: MediaProcessingStatus.FAILED,
              error: data.error,
              isVirusDetected: true
            };
          }
          return item;
        });
        
        // Update the UI
        onChange(updatedMedia);
        
        // Show the virus alert dialog
        const fileName = file.name;
        setInfectedFileName(fileName);
        
        // Small delay to ensure state updates properly
        setTimeout(() => {
          setVirusAlertOpen(true);
        }, 50);
        
        // No need to set a text error message since we're using the dialog
        // Clear any existing general errors
        setErrors(prev => ({ ...prev, general: '' }));
        
        // Clear the progress indicator
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
        
        return; // Exit early, no need to proceed with normal upload handling
      }
      
      // Use the provided media state if available, otherwise use the component state
      const mediaStateToUse = currentMediaState || media;
      
      // Verify that the media item still exists in our state before updating it
      // This is crucial to prevent race conditions where the media state might have changed
      const mediaItemExists = mediaStateToUse.some(item => item.id === fileId);
      
      if (!mediaItemExists) {
        console.error(`Media item with id ${fileId} no longer exists in state, aborting update`);
        return;
      }
      
      // Find the media item and update it with the server response
      const updatedMedia = mediaStateToUse.map(item => {
        if (item.id === fileId) {
          try {
            // Get the server URL from the response
            const serverUrl = data.file.url;
            
            // Store both the blob URL and server URL
            const blobUrl = item.url;
            const storedBlobUrl = (item as any).blobUrl;
            
            console.log('Updating media item with server URL:', {
              id: item.id,
              url: item.url,
              blobUrl: storedBlobUrl || blobUrl,
              serverUrl
            });
            
            // For the primary URL, use the server URL as it's more reliable
            // But keep the blob URL as a fallback
            console.log('Using server URL as primary:', serverUrl);
            
            // Create a new object with all the necessary properties
            const updatedItem = { 
              ...item,
              url: serverUrl,  // Use the server URL as the primary URL
              blobUrl: storedBlobUrl || blobUrl, // Keep the blob URL as a fallback
              originalUrl: blobUrl, // Store the original blob URL
              serverUrl: serverUrl,  // Store the server URL for form submission
              thumbnail: data.file.thumbnail, // Add the thumbnail URL from the server response
              status: MediaProcessingStatus.COMPLETED
            };
            
            console.log('Thumbnail URL:', data.file.thumbnail);
            
            console.log('Updated media item:', updatedItem);
            return updatedItem;
          } catch (urlError) {
            console.error('Error updating media URL:', urlError);
            return {
              ...item,
              status: MediaProcessingStatus.COMPLETED
            };
          }
        }
        return item;
      });
      
      console.log('Final media state after upload completion:', updatedMedia.map(m => ({
        id: m.id,
        url: m.url,
        blobUrl: (m as any).blobUrl,
        serverUrl: (m as any).serverUrl,
        thumbnail: m.thumbnail,
        status: m.status
      })));
      
      // Only update the state if we have media items
      if (updatedMedia.length > 0) {
        onChange(updatedMedia);
      } else {
        console.error('Attempted to update with empty media array, keeping current state');
      }
    } catch (error: unknown) {
      // Don't log errors for virus detection as they're handled gracefully above
      // Only log other types of errors
      if (!(error instanceof Error) || !error.message.toLowerCase().includes('virus')) {
        console.error('Error uploading file after all retries:', error);
        console.error('Upload failed for file:', file.name);
      }
      
      // Check if this is a virus detection error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Look for virus-related terms in the error message, including in the JSON response
      const isVirusError = errorMessage.toLowerCase().includes('virus') || 
                          errorMessage.toLowerCase().includes('malware') || 
                          errorMessage.toLowerCase().includes('infected') || 
                          errorMessage.toLowerCase().includes('eicar');
      
      console.log('Checking for virus detection:', { errorMessage, isVirusError });
      
      // Update the media item to indicate failure
      const updatedMedia = media.map(item => {
        if (item.id === fileId) {
          return { 
            ...item, 
            status: MediaProcessingStatus.FAILED,
            error: errorMessage,
            isVirusDetected: isVirusError
          };
        }
        return item;
      });
      
      console.log('Final media state after upload completion:', updatedMedia.map(m => ({
        id: m.id,
        url: m.url,
        blobUrl: (m as any).blobUrl,
        serverUrl: (m as any).serverUrl,
        thumbnail: m.thumbnail,
        status: m.status
      })));
      
      onChange(updatedMedia);
      
      // Clear the progress indicator
      setUploadProgress(prev => {
        const newProgress = { ...prev };
        delete newProgress[fileId];
        return newProgress;
      });
      
      // Set a more specific error message
      if (isVirusError) {
        // Show the virus alert dialog instead of setting an error message
        const fileName = file.name;
        setInfectedFileName(fileName);
        
        // Small delay to ensure state updates properly
        setTimeout(() => {
          setVirusAlertOpen(true);
        }, 50);
        
        // Clear any existing general errors
        setErrors(prev => ({ ...prev, general: '' }));
      } else {
        setErrors({ 
          general: `Failed to upload ${file.name}: ${errorMessage.includes('Upload failed') ? errorMessage : 'Connection error'}`
        });
      }
    }
  };

  // Cleanup object URLs when component unmounts
  useEffect(() => {
    return () => {
      // Revoke all object URLs to prevent memory leaks
      media.forEach(item => {
        if (item.url && item.url.startsWith('blob:')) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [media]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': [],
      'image/png': [],
      'image/gif': [],
      'video/mp4': [],
      'video/quicktime': [],
      'video/x-msvideo': [],
    },
    maxSize: Math.max(UPLOAD_CONFIG.IMAGE.MAX_SIZE_MB, UPLOAD_CONFIG.VIDEO.MAX_SIZE_MB) * 1024 * 1024,
    disabled: media.length + existingMedia.length >= maxFiles,
  });

  const handleRemove = (index: number) => {
    const newMedia = [...media];
    const removedItem = newMedia.splice(index, 1)[0];
    
    // Release object URL if it exists
    if (removedItem.file && removedItem.url?.startsWith('blob:')) {
      URL.revokeObjectURL(removedItem.url);
    }
    
    // Update order for remaining items
    newMedia.forEach((item, i) => {
      item.order = i;
    });
    
    onChange(newMedia);
    
    // Clear any errors
    setErrors({});
  };

  const handleRemoveExisting = (index: number) => {
    if (!onExistingChange) return;
    
    const newExistingMedia = [...existingMedia];
    newExistingMedia.splice(index, 1);
    
    // Update order for remaining items
    newExistingMedia.forEach((item, i) => {
      item.order = i;
    });
    
    onExistingChange(newExistingMedia);
    
    // Clear any errors
    setErrors({});
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(media);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order for all items
    items.forEach((item, index) => {
      item.order = index;
    });

    onChange(items);
  };

  const setMainMedia = (index: number) => {
    const updatedMedia = media.map((item, i) => ({
      ...item,
      isMain: i === index,
      isMainMedia: i === index
    }));
    onChange(updatedMedia);
    
    // Also update existing media to not be main
    if (onExistingChange && existingMedia.length > 0) {
      const updatedExistingMedia = existingMedia.map(item => ({
        ...item,
        isMain: false,
        isMainMedia: false
      }));
      onExistingChange(updatedExistingMedia);
    }
  };

  const setMainExistingMedia = (index: number) => {
    if (!onExistingChange) return;
    
    // Update existing media
    const updatedExistingMedia = existingMedia.map((item, i) => ({
      ...item,
      isMain: i === index,
      isMainMedia: i === index
    }));
    onExistingChange(updatedExistingMedia);
    
    // Update new media to not be main
    const updatedMedia = media.map(item => ({
      ...item,
      isMain: false,
      isMainMedia: false
    }));
    onChange(updatedMedia);
  };

  // We'll use a ref to track which URLs we've already created
  // This helps prevent double-cleanup issues
  const createdBlobUrls = useRef<Set<string>>(new Set());
  
  // Add blob URLs to our tracking set when they're created
  useEffect(() => {
    media.forEach(item => {
      if (item.url && item.url.startsWith('blob:') && !createdBlobUrls.current.has(item.url)) {
        createdBlobUrls.current.add(item.url);
      }
      
      // Also track other blob URLs
      const itemAny = item as any;
      ['originalUrl', 'blobUrl', 'previewUrl'].forEach(propName => {
        if (itemAny[propName]?.startsWith('blob:') && !createdBlobUrls.current.has(itemAny[propName])) {
          createdBlobUrls.current.add(itemAny[propName]);
        }
      });
    });
  }, [media]);
  
  // Clean up object URLs only on component unmount, not on media state changes
  useEffect(() => {
    // This effect doesn't depend on media, so it only runs on mount and unmount
    return () => {
      console.log('Cleaning up blob URLs on final unmount');
      
      // Clean up all tracked blob URLs
      createdBlobUrls.current.forEach((url: string) => {
        console.log('Revoking tracked blob URL:', url);
        URL.revokeObjectURL(url);
      });
      
      // Clear the set
      createdBlobUrls.current.clear();
    };
  }, []); // Empty dependency array means this only runs on mount/unmount
  
  // Check if all media items have server URLs and trigger onProcessingComplete if so
  useEffect(() => {
    if (!onProcessingComplete || media.length === 0) return;
    
    // Check if all media items have server URLs
    const allHaveServerUrls = media.every(item => !!(item as any).serverUrl);
    
    if (allHaveServerUrls) {
      onProcessingComplete();
    }
  }, [media.length, onProcessingComplete]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2">
        <h3 className="text-sm font-medium">Media Files</h3>
        <div className="text-xs text-muted-foreground">
          Upload up to {UPLOAD_CONFIG.IMAGE.MAX_FILES} images and {UPLOAD_CONFIG.VIDEO.MAX_FILES} video
        </div>
        
        {errors.general && (
          <div className="text-sm text-red-500 flex items-center gap-1">
            <AlertCircle size={16} />
            <span>{errors.general}</span>
          </div>
        )}
        
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors
            ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/20'}
            ${media.length + existingMedia.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50 hover:bg-primary/5'}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center space-y-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">
              {isDragActive ? 'Drop files here' : 'Drag & drop files here or click to browse'}
            </div>
            <div className="text-xs text-muted-foreground">
              Images: JPG, PNG, GIF (max {UPLOAD_CONFIG.IMAGE.MAX_SIZE_MB}MB)
              <br />
              Videos: MP4, MOV, AVI (max {UPLOAD_CONFIG.VIDEO.MAX_SIZE_MB}MB)
            </div>
          </div>
        </div>
      </div>

      {/* Existing Media */}
      {existingMedia.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Existing Media</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {existingMedia.map((item, index) => (
              <div
                key={`existing-${item.id}`}
                className={`relative rounded-md overflow-hidden border ${
                  (item.isMain || item.isMainMedia) ? 'ring-2 ring-primary' : ''
                }`}
              >
                <div className="relative aspect-square bg-muted">
                  {item.type === MediaType.IMAGE ? (
                    <Image
                      src={item.url || '/placeholder-image.jpg'}
                      alt={item.filename || `Image ${index}`}
                      fill
                      className="object-cover"
                      onError={(e) => {
                        console.log('Existing image failed to load:', item.url);
                        if (e.currentTarget.src !== '/placeholder-image.jpg') {
                          e.currentTarget.src = '/placeholder-image.jpg';
                        }
                      }}
                    />
                  ) : (
                    <div className="relative w-full h-full flex items-center justify-center bg-black">
                      {item.url ? (
                        <>
                          {/* If thumbnail is available, show it as a preview image */}
                          {item.thumbnail ? (
                            <div className="relative w-full h-full">
                              <Image
                                src={item.thumbnail}
                                alt={item.filename || 'Video preview'}
                                fill
                                sizes="(max-width: 768px) 100vw, 33vw"
                                className="object-cover"
                                onError={() => {
                                  console.log('Thumbnail failed to load, falling back to video icon');
                                  // If thumbnail fails, we'll just show the video player icon
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Video className="h-10 w-10 text-white opacity-80" />
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Fallback to video element if no thumbnail */}
                              <video
                                src={item.url}
                                className="max-h-full max-w-full"
                                controls={false}
                                muted
                                loop
                                playsInline
                                onError={(e) => {
                                  console.error('Existing video failed to load:', item.url);
                                  // We don't have a fallback for existing videos, but we can log the error
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Video className="h-10 w-10 text-white opacity-80" />
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <Video className="h-10 w-10 text-muted-foreground" />
                      )}
                    </div>
                  )}
                  
                  {/* Processing indicator */}
                  {item.status === MediaProcessingStatus.PENDING && (
                    <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                      <div className="text-xs font-medium mb-2">Processing...</div>
                      <Progress value={uploadProgress[item.id || ''] || 0} className="w-4/5" />
                    </div>
                  )}
                  
                  {/* Failed status indicator */}
                  {item.status === MediaProcessingStatus.FAILED && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white p-2 text-xs text-center">
                      <div className="flex flex-col items-center gap-1">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <span>{item.isVirusDetected ? 'Security threat detected!' : 'Upload failed'}</span>
                        {item.isVirusDetected && (
                          <span className="text-red-400 font-semibold mt-1">File rejected for security</span>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Type badge */}
                  <Badge 
                    variant="secondary" 
                    className="absolute top-2 left-2 text-xs"
                  >
                    {item.type === MediaType.IMAGE ? 'Image' : 'Video'}
                  </Badge>
                  
                  {/* Main indicator */}
                  {(item.isMain || item.isMainMedia) && (
                    <Badge 
                      className="absolute bottom-2 left-2 text-xs bg-primary text-primary-foreground"
                    >
                      Main
                    </Badge>
                  )}
                </div>
                
                {/* Actions */}
                <div className="absolute top-2 right-2 flex space-x-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-6 w-6 bg-background/80 hover:bg-background"
                          onClick={() => handleRemoveExisting(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Remove</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                
                {/* Set as main button */}
                {!(item.isMain || item.isMainMedia) && item.status !== MediaProcessingStatus.PENDING && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-2 right-2 text-xs"
                    onClick={() => setMainExistingMedia(index)}
                  >
                    Set as main
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* New Media */}
      {media.length > 0 && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="media-list" direction="horizontal" isDropDisabled={false} isCombineEnabled={false} ignoreContainerClipping={false}>
            {(provided) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
              >
                {media.map((item, index) => (
                  <Draggable key={item.id || `media-${index}`} draggableId={item.id || `media-${index}`} index={index} isDragDisabled={false}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className={`relative rounded-md overflow-hidden border ${
                          (item.isMain || item.isMainMedia) ? 'ring-2 ring-primary' : ''
                        }`}
                      >
                        <div className="relative aspect-square bg-muted">
                          {item.type === MediaType.IMAGE ? (
                            <>
                              <Image
                                src={(item as any).serverUrl || item.url || (item as any).blobUrl || '/placeholder-image.jpg'}
                                alt={item.filename}
                                fill
                                className="object-cover"
                                onError={(e) => {
                                  console.log('Image failed to load, trying fallbacks');
                                  console.log('Available URLs:', {
                                    url: item.url,
                                    blobUrl: (item as any).blobUrl,
                                    originalUrl: (item as any).originalUrl,
                                    serverUrl: (item as any).serverUrl
                                  });
                                  
                                  // Try server URL first if available (most reliable)
                                  if ((item as any).serverUrl && e.currentTarget.src !== (item as any).serverUrl) {
                                    console.log('Trying serverUrl:', (item as any).serverUrl);
                                    e.currentTarget.src = (item as any).serverUrl;
                                    return;
                                  }
                                  // Then try blobUrl if available
                                  else if ((item as any).blobUrl && e.currentTarget.src !== (item as any).blobUrl) {
                                    console.log('Trying blobUrl:', (item as any).blobUrl);
                                    e.currentTarget.src = (item as any).blobUrl;
                                    return;
                                  }
                                  // Then try originalUrl
                                  else if ((item as any).originalUrl && e.currentTarget.src !== (item as any).originalUrl) {
                                    console.log('Trying originalUrl:', (item as any).originalUrl);
                                    e.currentTarget.src = (item as any).originalUrl;
                                    return;
                                  }
                                  // Finally fall back to placeholder
                                  else {
                                    console.log('Using placeholder image');
                                    e.currentTarget.src = '/placeholder-image.jpg';
                                  }
                                }}
                              />
                            </>
                          ) : (
                            <div className="relative w-full h-full flex items-center justify-center bg-black">
                              {item.url ? (
                                <>
                                  {/* If thumbnail is available, show it as a preview image */}
                                  {(item as any).thumbnail ? (
                                    <div className="relative w-full h-full">
                                      <Image
                                        src={(item as any).thumbnail}
                                        alt={item.filename || 'Video preview'}
                                        fill
                                        sizes="(max-width: 768px) 100vw, 33vw"
                                        className="object-cover"
                                        onError={() => {
                                          console.log('Thumbnail failed to load, falling back to video');
                                          // If thumbnail fails, we'll just show the video player icon
                                        }}
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <Video className="h-10 w-10 text-white opacity-80" />
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {/* Fallback to video element if no thumbnail */}
                                      <video
                                        src={item.url || (item as any).blobUrl}
                                        className="max-h-full max-w-full"
                                        controls={false}
                                        muted
                                        loop
                                        playsInline
                                        onError={(e) => {
                                          console.log('Video failed to load, trying fallbacks');
                                          console.log('Available URLs:', {
                                            url: item.url,
                                            blobUrl: (item as any).blobUrl,
                                            originalUrl: (item as any).originalUrl,
                                            serverUrl: (item as any).serverUrl
                                          });
                                          
                                          // Try blobUrl first if available
                                          if ((item as any).blobUrl && e.currentTarget.src !== (item as any).blobUrl) {
                                            console.log('Trying blobUrl:', (item as any).blobUrl);
                                            e.currentTarget.src = (item as any).blobUrl;
                                          }
                                          // Then try originalUrl
                                          else if ((item as any).originalUrl && e.currentTarget.src !== (item as any).originalUrl) {
                                            console.log('Trying originalUrl:', (item as any).originalUrl);
                                            e.currentTarget.src = (item as any).originalUrl;
                                          }
                                        }}
                                      />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <Video className="h-10 w-10 text-white opacity-80" />
                                      </div>
                                    </>
                                  )}
                                </>
                              ) : (
                                <Video className="h-10 w-10 text-muted-foreground" />
                              )}
                            </div>
                          )}
                          
                          {/* Processing indicator */}
                          {item.status === MediaProcessingStatus.PENDING && (
                            <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                              <div className="text-xs font-medium mb-2">Uploading...</div>
                              <Progress value={uploadProgress[item.id || ''] || 0} className="w-4/5" />
                            </div>
                          )}
                          
                          {/* Failed status indicator */}
                          {item.status === MediaProcessingStatus.FAILED && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white p-2 text-xs text-center">
                              <div className="flex flex-col items-center gap-1">
                                <AlertCircle className="h-5 w-5 text-red-500" />
                                <span>{item.isVirusDetected ? 'Security threat detected!' : 'Upload failed'}</span>
                                {item.isVirusDetected && (
                                  <span className="text-red-400 font-semibold mt-1">File rejected for security</span>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Type badge */}
                          <Badge 
                            variant="secondary" 
                            className="absolute top-2 left-2 text-xs"
                          >
                            {item.type === MediaType.IMAGE ? 'Image' : 'Video'}
                          </Badge>
                          
                          {/* Main indicator */}
                          {(item.isMain || item.isMainMedia) && (
                            <Badge 
                              className="absolute bottom-2 left-2 text-xs bg-primary text-primary-foreground"
                            >
                              Main
                            </Badge>
                          )}
                        </div>
                        
                        {/* Actions */}
                        <div className="absolute top-2 right-2 flex space-x-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="icon"
                                  className="h-6 w-6 bg-background/80 hover:bg-background"
                                  onClick={() => handleRemove(index)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Remove</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        
                        {/* Set as main button */}
                        {!(item.isMain || item.isMainMedia) && item.status === MediaProcessingStatus.COMPLETED && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="absolute bottom-2 right-2 text-xs"
                            onClick={() => setMainMedia(index)}
                          >
                            Set as main
                          </Button>
                        )}
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}
      

      
      {/* Virus Alert Dialog */}
      <VirusAlertDialog 
        isOpen={virusAlertOpen} 
        onClose={() => setVirusAlertOpen(false)} 
        fileName={infectedFileName || 'unknown file'} 
      />
    </div>
  );
}