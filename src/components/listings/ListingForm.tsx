'use client';

import { FC, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
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
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog } from '@/components/ui/dialog';
import { ImageUploader } from './ImageUploader';
import { categories } from '@/lib/constants';
import { useCurrencyPreference } from '@/hooks/useCurrencyPreference';
import { useToast } from '@/components/ui/use-toast';
import { ConnectButton } from '@/components/wallet/ConnectButton';

const formSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(40, 'Title must be 40 characters or less'),
  category: z.string().min(1, 'Category is required'),
  brand: z.string().optional(),
  description: z.string()
    .min(1, 'Description is required')
    .max(400, 'Description must be 400 characters or less'),
  price: z.number()
    .min(0.000001, 'Price must be greater than 0')
    .max(1000000, 'Price must be less than 1,000,000 SOL'),
  noDelivery: z.boolean(),
  handDelivery: z.boolean(),
  postalService: z.boolean(),
  deliveryPrice: z.number().optional(),
});

interface ListingFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  cancelLabel: string;
}

export const ListingForm: FC<ListingFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  submitLabel,
  cancelLabel,
}) => {
  const { publicKey } = useWallet();
  const router = useRouter();
  const { toast } = useToast();
  const { currency, formatPrice, solToFiat, fiatToSol } = useCurrencyPreference();
  
  const [images, setImages] = useState<File[]>([]); // For new images
  const [existingImages, setExistingImages] = useState(initialData?.images || []); // For existing images in edit mode
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [priceInFiat, setPriceInFiat] = useState(false);
  const [deliveryPriceInFiat, setDeliveryPriceInFiat] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title || '',
      category: initialData?.category || '',
      brand: initialData?.brand || '',
      description: initialData?.description || '',
      price: initialData?.price || 0,
      noDelivery: initialData?.noDelivery || false,
      handDelivery: initialData?.handDelivery || false,
      postalService: initialData?.postalService || false,
      deliveryPrice: initialData?.deliveryPrice || 0,
    },
  });

  const watchDeliveryOptions = {
    noDelivery: form.watch('noDelivery'),
    handDelivery: form.watch('handDelivery'),
    postalService: form.watch('postalService'),
  };

  const watchPrice = form.watch('price');
  const watchDeliveryPrice = form.watch('deliveryPrice');

  // Calculate total
  const listingPrice = priceInFiat ? fiatToSol(watchPrice) : watchPrice;
  const deliveryPrice = watchDeliveryOptions.postalService 
    ? (deliveryPriceInFiat ? fiatToSol(watchDeliveryPrice) : watchDeliveryPrice)
    : 0;
  const protectionFee = listingPrice * 0.01; // 1% fee
  const total = listingPrice + deliveryPrice + protectionFee;

  const handleSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      setIsSubmitting(true);
      
      // Convert prices back to SOL if they're in fiat
      const formData = {
        ...data,
        price: priceInFiat ? fiatToSol(data.price) : data.price,
        deliveryPrice: data.postalService 
          ? (deliveryPriceInFiat ? fiatToSol(data.deliveryPrice!) : data.deliveryPrice)
          : 0,
      };

      await onSubmit({ ...formData, images, existingImages });
    } catch (error) {
      console.error('Error submitting listing:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit listing. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect if not connected
  if (!publicKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Connect your wallet to create a listing
        </h1>
        <p className="text-gray-500 mb-8 text-center">
          You need to connect your wallet to create listings on Silkyway
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        {/* Image Uploader */}
        <FormItem>
          <FormLabel>Images (Max 3)</FormLabel>
          <ImageUploader
            images={images}
            existingImages={existingImages}
            onChange={setImages}
            onExistingChange={setExistingImages}
            maxImages={3}
            maxSize={3 * 1024 * 1024} // 3MB
          />
        </FormItem>

        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} maxLength={40} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem
                      key={category.value}
                      value={category.value}
                    >
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Brand */}
        <FormField
          control={form.control}
          name="brand"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Brand (Optional)</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  maxLength={400}
                  rows={4}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Price */}
        <FormField
          control={form.control}
          name="price"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price</FormLabel>
              <div className="flex items-center space-x-2">
                <FormControl>
                  <Input
                    type="number"
                    step="0.000001"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPriceInFiat(!priceInFiat);
                    const newValue = priceInFiat
                      ? fiatToSol(field.value)
                      : solToFiat(field.value);
                    field.onChange(newValue);
                  }}
                >
                  {priceInFiat ? 'SOL' : currency}
                </Button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                ≈ {priceInFiat 
                  ? `${field.value.toFixed(6)} SOL`
                  : formatPrice(solToFiat(field.value))
                }
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Delivery Options */}
        <div className="space-y-4">
          <FormLabel>Delivery Options</FormLabel>
          
          <FormField
            control={form.control}
            name="noDelivery"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={watchDeliveryOptions.handDelivery || watchDeliveryOptions.postalService}
                  />
                </FormControl>
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  No Delivery
                </label>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="handDelivery"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={watchDeliveryOptions.noDelivery || watchDeliveryOptions.postalService}
                  />
                </FormControl>
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Hand Delivery
                </label>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="postalService"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={watchDeliveryOptions.noDelivery || watchDeliveryOptions.handDelivery}
                  />
                </FormControl>
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Postal Service
                </label>
              </FormItem>
            )}
          />
        </div>

        {/* Delivery Price */}
        {watchDeliveryOptions.postalService && (
          <FormField
            control={form.control}
            name="deliveryPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery Price</FormLabel>
                <div className="flex items-center space-x-2">
                  <FormControl>
                    <Input
                      type="number"
                      step="0.000001"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setDeliveryPriceInFiat(!deliveryPriceInFiat);
                      const newValue = deliveryPriceInFiat
                        ? fiatToSol(field.value)
                        : solToFiat(field.value);
                      field.onChange(newValue);
                    }}
                  >
                    {deliveryPriceInFiat ? 'SOL' : currency}
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  ≈ {deliveryPriceInFiat 
                    ? `${field.value.toFixed(6)} SOL`
                    : formatPrice(solToFiat(field.value))
                  }
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Total */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Listing Price</span>
            <span className="text-sm font-medium">{total.toFixed(6)} SOL</span>
          </div>
          {watchDeliveryOptions.postalService && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Delivery Price</span>
              <span className="text-sm font-medium">{deliveryPrice.toFixed(6)} SOL</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500">Protection Fee (1%)</span>
            <span className="text-sm font-medium">{protectionFee.toFixed(6)} SOL</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="font-medium">Total</span>
            <div className="text-right">
              <div className="font-medium">{total.toFixed(6)} SOL</div>
              <div className="text-sm text-gray-500">
                ≈ {formatPrice(solToFiat(total))}
              </div>
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">Safety Tips</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Be cautious of potential scammers</li>
            <li>• Never share personal information like phone numbers</li>
            <li>• Do not list forbidden or illegal items</li>
            <li>• Use our secure payment system for all transactions</li>
            <li>• Report suspicious behavior immediately</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowCancelDialog(true)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
          >
            {submitLabel}
          </Button>
        </div>
      </form>

      {/* Cancel Dialog */}
      <Dialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
      >
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            Are you sure?
          </h2>
          <p className="text-gray-500 mb-6">
            Your changes will not be saved and your listing will not be published
          </p>
          <div className="flex justify-end space-x-4">
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Resume
            </Button>
            <Button
              variant="destructive"
              onClick={onCancel}
            >
              Cancel Listing
            </Button>
          </div>
        </div>
      </Dialog>
    </Form>
  );
};
