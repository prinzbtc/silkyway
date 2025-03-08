"use client"

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface VirusAlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
}

export function VirusAlertDialog({ isOpen, onClose, fileName }: VirusAlertDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="border-red-500 border-2 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600 flex items-center gap-2">
            <span className="text-2xl">⚠️</span> Security Threat Detected
          </DialogTitle>
          {/* Use div instead of DialogDescription to avoid nested p tags */}
          <div className="text-base text-muted-foreground mt-2 space-y-2">
            <div className="mb-2">
              Our security scan has detected a potential threat in the file <strong>{fileName}</strong>.
            </div>
            <div className="mb-2">
              The file has been rejected and was not uploaded to protect your security and the security of other users.
            </div>
            <div className="text-sm text-gray-600">
              If you believe this is a false positive, please contact support with details about the file.
            </div>
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={onClose}>
            Acknowledge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
