'use client';

import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { TransactionStatus } from '@/hooks/useTransactionStatus';

interface TransactionProgressProps {
  step: 'escrow' | 'confirmation' | 'record';
  status: TransactionStatus;
  error: string | null;
  retryFn?: () => void;
}

const steps = {
  escrow: {
    title: 'Creating Escrow',
    description: 'Setting up secure escrow for your purchase',
  },
  confirmation: {
    title: 'Confirming Transaction',
    description: 'Waiting for blockchain confirmation',
  },
  record: {
    title: 'Finalizing Purchase',
    description: 'Creating transaction records',
  },
};

const stepOrder = ['escrow', 'confirmation', 'record'] as const;

export function TransactionProgress({
  step,
  status,
  error,
  retryFn,
}: TransactionProgressProps) {
  const currentStepIndex = stepOrder.indexOf(step);
  const progress = ((currentStepIndex + 1) / stepOrder.length) * 100;

  return (
    <div className="w-full space-y-4">
      <Progress value={progress} className="h-2" />
      
      <div className="space-y-6">
        {stepOrder.map((s, index) => {
          const isPast = index < currentStepIndex;
          const isCurrent = s === step;
          const isFuture = index > currentStepIndex;

          return (
            <div
              key={s}
              className={cn(
                'flex items-start gap-4',
                isPast && 'text-muted-foreground'
              )}
            >
              <div className="mt-1">
                {isPast ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : isCurrent ? (
                  status === 'pending' ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : status === 'confirmed' ? (
                    <CheckCircle2 className="h-5 w-5 text-primary" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive" />
                  )
                ) : (
                  <div className="h-5 w-5 rounded-full border-2" />
                )}
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {steps[s].title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {steps[s].description}
                </p>

                {isCurrent && status === 'failed' && error && (
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-destructive">{error}</p>
                    {retryFn && (
                      <button
                        onClick={retryFn}
                        className="text-sm text-primary hover:underline"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
