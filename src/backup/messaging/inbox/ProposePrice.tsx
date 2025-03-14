'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import type { Listing } from '@/types/conversation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { formatPrice, formatSOL, getSolPrice, type Currency } from '@/lib/price';

const formSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
});

interface ProposePriceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: Listing | null;
  conversationId: string;
}

export default function ProposePrice({
  open,
  onOpenChange,
  listing,
  conversationId,
}: ProposePriceProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { preferredCurrency } = useCurrencyPreference();
  const [solPrice, setSolPrice] = useState<number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: listing?.price || 0,
    },
  });

  useEffect(() => {
    const updatePrice = async () => {
      // Make sure we're not passing 'SOL' to getSolPrice
      if (preferredCurrency !== 'SOL') {
        const price = await getSolPrice(preferredCurrency as Exclude<Currency, 'SOL'>);
        setSolPrice(price);
      }
    };

    updatePrice();
  }, [preferredCurrency]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/offers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: values.amount,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to make offer');
      }

      toast({
        title: 'Offer sent',
        description: 'Your offer has been sent to the seller',
      });

      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to make offer',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make an offer</DialogTitle>
          <DialogDescription>
            Enter your offer price for {listing?.title || 'this item'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price in SOL</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.000000001"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value))
                      }
                    />
                  </FormControl>
                  {solPrice && (
                    <div className="text-sm text-gray-500">
                      ≈{' '}
                      {formatPrice(
                        field.value * solPrice,
                        preferredCurrency
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Make Offer</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
