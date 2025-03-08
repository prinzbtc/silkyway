"use client"

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { VirusAlertDialog } from './VirusAlertDialog';

export function VirusAlertTest() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="p-4 border border-dashed border-gray-300 rounded">
      <h2 className="text-lg font-semibold mb-2">Virus Alert Dialog Test</h2>
      <div className="flex flex-col gap-2">
        <Button 
          variant="destructive" 
          onClick={() => {
            console.log('Opening virus alert dialog from test component');
            setIsOpen(true);
          }}
        >
          Open Virus Alert Dialog
        </Button>
        
        <div className="text-sm text-muted-foreground">
          Dialog state: {isOpen ? 'Open' : 'Closed'}
        </div>
        
        <VirusAlertDialog 
          isOpen={isOpen}
          onClose={() => {
            console.log('Closing virus alert dialog from test component');
            setIsOpen(false);
          }}
          fileName="test-virus-file.jpg"
        />
      </div>
    </div>
  );
}
