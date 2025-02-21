'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { X, Upload } from 'lucide-react';
import { Button } from './button';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  onFileRemoved: (index: number) => void;
  maxFiles?: number;
  maxSizeInMB?: number;
  allowedTypes?: string[];
  files: File[];
}

export function FileUpload({
  onFilesSelected,
  onFileRemoved,
  maxFiles = 3,
  maxSizeInMB = 3,
  allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'],
  files,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    setError(null);

    // Check if adding these files would exceed the limit
    if (files.length + selectedFiles.length > maxFiles) {
      setError(`You can only upload up to ${maxFiles} files`);
      return;
    }

    // Validate each file
    const validFiles = selectedFiles.filter(file => {
      // Check file type
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Only images (JPG, PNG, GIF) and PDFs are allowed.');
        return false;
      }

      // Check file size
      if (file.size > maxSizeInMB * 1024 * 1024) {
        setError(`Files must be smaller than ${maxSizeInMB}MB`);
        return false;
      }

      return true;
    });

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isImage = (type: string) => type.startsWith('image/');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={files.length >= maxFiles}
        >
          <Upload className="h-4 w-4 mr-2" />
          Add Files
        </Button>
        <p className="text-sm text-gray-500">
          {files.length}/{maxFiles} files
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileChange}
        accept={allowedTypes.join(',')}
        multiple={true}
      />

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
            >
              <div className="flex items-center space-x-2">
                {isImage(file.type) && (
                  <div className="h-10 w-10 rounded-md overflow-hidden">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / (1024 * 1024)).toFixed(2)}MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onFileRemoved(index)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-500">
        Allowed files: Images (JPG, PNG, GIF) and PDFs up to {maxSizeInMB}MB
      </p>
    </div>
  );
}
