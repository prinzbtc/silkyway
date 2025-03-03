import * as React from "react";
import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface LoadingDialogProps {
  open: boolean;
  title: string;
  description?: string;
  className?: string;
}

export function LoadingDialog({
  open,
  title,
  description,
  className,
}: LoadingDialogProps) {
  const loadingMessages = [
    "Uploading your media...",
    "Processing your images...",
    "Optimizing your listing...",
    "Almost there...",
    "Finalizing your listing..."
  ];
  
  const [messageIndex, setMessageIndex] = useState(0);
  const [fadeState, setFadeState] = useState("in"); // "in" or "out"
  
  useEffect(() => {
    if (!open) return;
    
    const fadeOutInterval = setInterval(() => {
      setFadeState("out");
      
      // After fade out, change message and fade back in
      setTimeout(() => {
        setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
        setFadeState("in");
      }, 300); // Match the transition duration
      
    }, 3000);
    
    return () => clearInterval(fadeOutInterval);
  }, [open, loadingMessages.length]);
  return (
    <Dialog open={open}>
      <DialogContent 
        className={cn(
          "flex flex-col items-center justify-center gap-6 p-8 loading-dialog",
          className
        )}
      >
        {/* No close button for loading dialog */}
        <style jsx global>{`
          .loading-dialog [data-radix-collection-item] {
            display: none;
          }
        `}</style>
        <DialogHeader className="w-full text-center">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          {description && (
            <DialogDescription className="mt-2">{description}</DialogDescription>
          )}
        </DialogHeader>
        
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <Spinner size="lg" className="text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full bg-primary/20 animate-ping" />
            </div>
          </div>
          
          <div className="space-y-2 text-center">
            <p 
              className={`text-sm text-muted-foreground min-h-[1.25rem] transition-opacity duration-300 ${
                fadeState === "out" ? "opacity-0" : "opacity-100"
              }`}
            >
              {loadingMessages[messageIndex]}
            </p>
            <div className="flex justify-center space-x-1">
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="h-2 w-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
