import { Transaction, TransactionBadge, TransactionStatus } from '@/types/transaction';

export function getTransactionBadges(
  transaction: Transaction,
  isCurrentUserBuyer: boolean
): TransactionBadge[] {
  const badges: TransactionBadge[] = [];

  // Role badge
  badges.push({
    label: isCurrentUserBuyer ? 'You bought' : 'You sold',
    variant: 'primary',
  });

  // Status badges
  switch (transaction.status) {
    case 'pending':
      badges.push({
        label: 'On-going',
        variant: 'secondary',
      });
      break;

    case 'awaiting_tracking':
      badges.push({
        label: isCurrentUserBuyer ? 'Awaiting Tracking Number' : 'Tracking Number Missing',
        variant: 'destructive',
      });
      break;

    case 'shipped':
      badges.push({
        label: 'On-Going Delivery',
        variant: 'secondary',
      });
      break;

    case 'awaiting_confirmation':
      if (isCurrentUserBuyer) {
        badges.push({
          label: 'Confirm Delivery',
          variant: 'secondary',
        });
      }
      break;

    case 'completed':
      badges.push({
        label: 'Completed',
        variant: 'default',
      });
      break;

    case 'cancelled':
      badges.push({
        label: 'Transaction Cancelled',
        variant: 'destructive',
      });
      break;
  }

  return badges;
}

export function getNextTransactionStatus(
  currentStatus: TransactionStatus,
  action: 'provide_tracking' | 'confirm_delivery' | 'cancel'
): TransactionStatus {
  switch (action) {
    case 'provide_tracking':
      if (currentStatus === 'awaiting_tracking') {
        return 'shipped';
      }
      break;

    case 'confirm_delivery':
      if (currentStatus === 'awaiting_confirmation') {
        return 'completed';
      }
      break;

    case 'cancel':
      return 'cancelled';
  }

  return currentStatus;
}

export function formatTransactionAmount(
  amount: number,
  currency: string,
  solPrice: number | null
): string {
  const solAmount = `${amount.toFixed(2)} SOL`;
  
  if (!solPrice) return solAmount;
  
  const fiatAmount = (amount * solPrice).toFixed(2);
  const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
  
  return `${solAmount} (${currencySymbol}${fiatAmount})`;
}
