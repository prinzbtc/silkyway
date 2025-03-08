'use client';

import React, { useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type DeliveryOption = 'all' | 'noDelivery' | 'postalService';

interface DeliverySelectProps {
  value: DeliveryOption;
  onChange: (value: DeliveryOption) => void;
  className?: string;
}

const DeliverySelect: React.FC<DeliverySelectProps> = ({
  value,
  onChange,
  className,
}) => {
  // Log the current value when it changes for debugging
  useEffect(() => {
    console.log('DeliverySelect current value:', value);
  }, [value]);

  return (
    <Select
      value={value}
      onValueChange={(newValue) => {
        console.log('Delivery option selected:', newValue);
        
        // Ensure we're passing a valid DeliveryOption
        const deliveryOption = newValue as DeliveryOption;
        
        // Log the change for debugging
        if (deliveryOption === 'all') {
          console.log('Selected "All Delivery options" - will clear all delivery filters');
        } else if (deliveryOption === 'noDelivery') {
          console.log('Selected "No delivery (Pickup only)" - will filter for noDelivery=true');
        } else if (deliveryOption === 'postalService') {
          console.log('Selected "Postal Service" - will filter for postalService=true');
        }
        
        onChange(deliveryOption);
      }}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select delivery option" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Delivery options</SelectItem>
        <SelectItem value="noDelivery">No delivery (Pickup only)</SelectItem>
        <SelectItem value="postalService">Postal Service</SelectItem>
      </SelectContent>
    </Select>
  );
};

export default DeliverySelect;
