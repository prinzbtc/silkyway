'use client';

import { FC, useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { DragDropContext, Droppable, Draggable, DroppableProvided, DraggableProvided, DropResult } from 'react-beautiful-dnd';
import { X } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

interface ImageUploaderProps {
  images: File[];
  existingImages?: { id: string; url: string }[];
  onChange: (files: File[]) => void;
  onExistingChange?: (images: { id: string; url: string }[]) => void;
  maxImages?: number;
  maxSize?: number;
}

export const ImageUploader: FC<ImageUploaderProps> = ({
  images,
  existingImages = [],
  onChange,
  onExistingChange,
  maxImages = 3,
  maxSize = 3 * 1024 * 1024, // 3MB
}) => {
  const { toast } = useToast();
  const [previews, setPreviews] = useState<string[]>([]);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    rejectedFiles.forEach(({ file, errors }) => {
      if (errors[0]?.code === 'file-too-large') {
        toast({
          title: 'File too large',
          description: `${file.name} is larger than ${maxSize / 1024 / 1024}MB`,
          variant: 'destructive',
        });
      } else if (errors[0]?.code === 'file-invalid-type') {
        toast({
          title: 'Invalid file type',
          description: `${file.name} is not a supported image type`,
          variant: 'destructive',
        });
      }
    });

    // Handle accepted files
    const totalImages = images.length + existingImages.length + acceptedFiles.length;
    if (totalImages > maxImages) {
      toast({
        title: 'Too many images',
        description: `You can only upload up to ${maxImages} images`,
        variant: 'destructive',
      });
      return;
    }

    // Create previews
    const newPreviews = acceptedFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);

    // Update images
    onChange([...images, ...acceptedFiles]);
  }, [images, existingImages, maxImages, maxSize, onChange, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
    },
    maxSize,
    multiple: true,
  });

  const removeImage = (index: number) => {
    const newImages = [...images];
    const newPreviews = [...previews];
    
    // Revoke the preview URL to avoid memory leaks
    URL.revokeObjectURL(previews[index]);
    
    newImages.splice(index, 1);
    newPreviews.splice(index, 1);
    
    onChange(newImages);
    setPreviews(newPreviews);
  };

  const removeExistingImage = (index: number) => {
    if (onExistingChange) {
      const newExistingImages = [...existingImages];
      newExistingImages.splice(index, 1);
      onExistingChange(newExistingImages);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(images);
    const itemPreviews = Array.from(previews);
    const [reorderedItem] = items.splice(result.source.index, 1);
    const [reorderedPreview] = itemPreviews.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    itemPreviews.splice(result.destination.index, 0, reorderedPreview);

    onChange(items);
    setPreviews(itemPreviews);
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            {isDragActive ? (
              <p>Drop the files here...</p>
            ) : (
              <>
                <p>Drag and drop images here, or click to select files</p>
                <p className="text-xs text-gray-500">
                  JPG, JPEG, PNG or GIF (max {maxSize / 1024 / 1024}MB)
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <DragDropContext 
        onDragEnd={onDragEnd}
        enableDefaultSensors={true}
      >
        <Droppable 
          droppableId="images" 
          direction="horizontal" 
          isDropDisabled={false}
          isCombineEnabled={false}
          ignoreContainerClipping={false}
          mode="standard"
          type="DEFAULT"
        >
          {(provided: DroppableProvided) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="grid grid-cols-3 gap-4"
            >
              {/* Existing Images */}
              {existingImages.map((image, index) => (
                <div
                  key={`existing-${image.id}`}
                  className="relative aspect-square rounded-lg overflow-hidden group"
                >
                  <Image
                    src={image.url}
                    alt={`Image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeExistingImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {/* New Images */}
              {images.map((_, index) => (
                <Draggable
                  key={`new-${index}`}
                  draggableId={`image-${index}`}
                  index={index}
                  isDragDisabled={false}
                  disableInteractiveElementBlocking={false}
                >
                  {(provided: DraggableProvided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className="relative aspect-square rounded-lg overflow-hidden group"
                    >
                      <Image
                        src={previews[index]}
                        alt={`Image ${index + 1}`}
                        fill
                        className="object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {(images.length > 0 || existingImages.length > 0) && (
        <p className="text-sm text-gray-500">
          Drag images to reorder. First image will be the main image.
        </p>
      )}
    </div>
  );
};
