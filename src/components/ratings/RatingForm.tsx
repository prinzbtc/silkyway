'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Star } from 'lucide-react';
import { Transaction } from '@/types/transaction';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { SmallTransactionCard } from '@/components/transactions/SmallTransactionCard';

const ratingFormSchema = z.object({
  rating: z.number().min(1).max(5),
  comment: z.string().max(500, 'Review must be 500 words or less'),
});

type RatingFormValues = z.infer<typeof ratingFormSchema>;

interface RatingFormProps {
  transaction: Transaction;
  type: 'buyer' | 'seller';
}

export default function RatingForm({ transaction, type }: RatingFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [showThankYou, setShowThankYou] = useState(false);

  const form = useForm<RatingFormValues>({
    resolver: zodResolver(ratingFormSchema),
    defaultValues: {
      rating: 0,
      comment: '',
    },
  });

  const onSubmit = async (data: RatingFormValues) => {
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId: transaction.id,
          rating: data.rating,
          comment: data.comment,
          type,
        }),
      });

      if (!response.ok) throw new Error('Failed to submit review');

      setShowThankYou(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to submit review. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Leave a Review</CardTitle>
          <CardDescription>
            Share your experience with the {type === 'buyer' ? 'seller' : 'buyer'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <SmallTransactionCard
              transaction={transaction}
              type={type}
              compact
            />
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          className="focus:outline-none"
                          onMouseEnter={() => setHoveredRating(i + 1)}
                          onMouseLeave={() => setHoveredRating(0)}
                          onClick={() => {
                            setRating(i + 1);
                            field.onChange(i + 1);
                          }}
                        >
                          <Star
                            className={`h-8 w-8 ${
                              i < (hoveredRating || rating)
                                ? 'fill-yellow-400'
                                : 'fill-gray-200'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Write your review here..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                >
                  Cancel Review
                </Button>
                <Button
                  type="submit"
                  disabled={!rating || form.formState.isSubmitting}
                >
                  Send Review
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Dialog open={showThankYou} onOpenChange={setShowThankYou}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thanks for your review!</DialogTitle>
            <DialogDescription>
              Your feedback helps make our marketplace better.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}
