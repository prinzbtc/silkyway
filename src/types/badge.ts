export type BadgeType = 
  | 'admin'
  | 'newbie'
  | 'hobbit'
  | 'merchant'
  | 'grand_merchant'
  | 'big_boss'
  | 'verified';

export interface UserBadge {
  type: BadgeType;
  label: string;
  color: 'white' | 'pink' | 'green' | 'blue' | 'silver' | 'gold' | 'black';
  minTransactions?: number;
}

export const USER_BADGES: Record<BadgeType, UserBadge> = {
  admin: {
    type: 'admin',
    label: 'Admin',
    color: 'white'
  },
  newbie: {
    type: 'newbie',
    label: 'Newbie',
    color: 'pink',
    minTransactions: 0
  },
  hobbit: {
    type: 'hobbit',
    label: 'Hobbit',
    color: 'green',
    minTransactions: 1
  },
  merchant: {
    type: 'merchant',
    label: 'Merchant',
    color: 'blue',
    minTransactions: 5
  },
  grand_merchant: {
    type: 'grand_merchant',
    label: 'Grand Merchant',
    color: 'silver',
    minTransactions: 10
  },
  big_boss: {
    type: 'big_boss',
    label: 'Big Boss',
    color: 'gold',
    minTransactions: 20
  },
  verified: {
    type: 'verified',
    label: 'Verified',
    color: 'black'
  }
};
