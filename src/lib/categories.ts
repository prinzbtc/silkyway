export type Category = {
  value: string;
  label: string;
};

export const categories = [
  { value: 'automobiles', label: 'Automobiles' },
  { value: 'collectibles', label: 'Collectibles' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'food', label: 'Food' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'gaming', label: 'Gaming' },
  { value: 'health', label: 'Health & Beauty' },
  { value: 'home', label: 'Home & Garden' },
  { value: 'jewelry', label: 'Jewelry & Watches' },
  { value: 'sports', label: 'Sports & Outdoors' },
  { value: 'tools', label: 'Tools & Equipment' },
  { value: 'toys', label: 'Toys & Hobbies' },
  { value: 'other', label: 'Other' },
] as const;
