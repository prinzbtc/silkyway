'use client';

import { FC, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { ImageUploader } from '@/components/listings/ImageUploader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useCurrencyPreference } from '@/context/CurrencyPreferenceProvider';
import { useConvertedPrice } from '@/hooks/price/useConvertedPrice';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { categories } from '@/lib/categories';
import { BRAND_CATEGORIES, type BrandCategories } from "@/lib/brands"
import { cn } from '@/lib/utils';
import { BrandCombobox } from '@/components/ui/brand-combobox';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  category: z.string(),
  brand: z.string().optional(),
  price: z.coerce.number().min(0, { message: "Price must be a positive number" }),
  condition: z.string(), // Add condition field
  images: z.array(z.object({
    url: z.string(),
    filename: z.string(),
    order: z.number(),
  })).min(1, { message: "At least one image is required" }),
  noDelivery: z.boolean().optional(),
  handDelivery: z.boolean().optional(),
  postalService: z.boolean().optional(),
  deliveryPrice: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type CategoryBrands = Record<BrandCategories, string[]>;

// Price conversion component
const PriceConversion: FC<{ amount: number }> = ({ amount }) => {
  const { convertedAmount, isLoading } = useConvertedPrice(amount);
  const { preferredCurrency } = useCurrencyPreference();

  if (isLoading) return (
    <span className="inline-block">
      <span className="inline-block w-24 h-4 animate-pulse rounded-md bg-muted" />
    </span>
  );

  if (convertedAmount === null) return (
    <span className="text-muted-foreground">Price unavailable</span>
  );

  return (
    <span className="text-muted-foreground">
      ≈ {new Intl.NumberFormat('en-US', { style: 'currency', currency: preferredCurrency }).format(convertedAmount)}
    </span>
  );
};

const CreateListingPage: FC = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [images, setImages] = useState<File[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [newListingId, setNewListingId] = useState<string>('');
  const { preferredCurrency } = useCurrencyPreference();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      price: 0,
      noDelivery: false,
      handDelivery: false,
      postalService: false,
      deliveryPrice: 0,
      condition: '',
    },
  });

  // Effect to sync images with form
  useEffect(() => {
    // Convert File[] to the format expected by the form schema
    const formattedImages = images.map((file, index) => ({
      url: URL.createObjectURL(file),
      filename: file.name,
      order: index
    }));
    
    // Set the images in the form
    form.setValue('images', formattedImages);
  }, [images, form.setValue]);

  const onSubmit = async (values: FormValues) => {
    console.log('Form submission started', values);
    console.log('Form validation state:', form.formState);
    setIsPublishing(true);
    try {
      // Prepare delivery options
      const deliveryOptions = {
        noDelivery: values.noDelivery || false,
        handDelivery: values.handDelivery || false,
        postalService: values.postalService || false,
        deliveryPrice: values.deliveryPrice || 0,
      };

      // Prepare form data
      const formData = new FormData();
      formData.append('title', values.title);
      formData.append('category', values.category);
      formData.append('brand', values.brand || '');
      formData.append('description', values.description);
      formData.append('price', values.price.toString());
      formData.append('condition', values.condition);
      formData.append('deliveryOptions', JSON.stringify(deliveryOptions));

      // Append images
      images.forEach((file, index) => {
        formData.append(`image${index}`, file);
      });

      console.log('Submitting form data:', Object.fromEntries(formData.entries()));

      // Submit listing
      const response = await fetch('/api/listings', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Listing creation error:', errorData);
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to create listing',
          variant: 'destructive',
        });
        return;
      }

      const newListing = await response.json();
      console.log('Listing created:', newListing);

      // Set new listing ID and show success dialog
      setNewListingId(newListing.id);
      setShowSuccessDialog(true);

      // Optional: Redirect after a short delay
      setTimeout(() => {
        router.push(`/listings/${newListing.id}`);
      }, 1500);
    } catch (error) {
      console.error('Unexpected error in listing creation:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  const confirmCancel = () => {
    router.push('/dashboard');
  };

  return (
    <div className="flex justify-center min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4 md:px-8">
      <h1 className="text-3xl font-bold mb-8">Create a New Listing</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            console.log('Form validation errors:', errors);
          })} className="space-y-8">
          {/* Image Upload */}
          <div className="space-y-4">

            <FormLabel>Images</FormLabel>
            <ImageUploader
              images={images}
              onChange={setImages}
              maxImages={3}
              maxSize={3 * 1024 * 1024}
            />
            <FormDescription>
              Upload up to 3 images (max 3MB each). Drag to reorder - first image will be the main image.
            </FormDescription>
          </div>

          {/* Title */}
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="listing-title">
                  Title
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id="listing-title"
                    placeholder="Enter listing title"
                    {...field}
                    className={cn(
                      !field.value && form.formState.isSubmitted && "border-destructive focus-visible:ring-destructive"
                    )}
                  />
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
                <FormLabel htmlFor="listing-category">
                  Category
                  <span className="text-destructive">*</span>
                </FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger id="listing-category">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
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
                <FormLabel>
                  Brand
                  <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
                </FormLabel>
                <FormControl>
                  <BrandCombobox
                    value={field.value || ''}
                    onChange={field.onChange}
                    suggestions={(() => {
                      const category = form.watch('category') as BrandCategories;
                      if (category && Object.keys(BRAND_CATEGORIES).includes(category)) {
                        return [...BRAND_CATEGORIES[category]];
                      }
                      return [];
                    })()}
                    placeholder="Start typing to see suggestions"
                  />
                </FormControl>
                <FormDescription>
                  Add a brand name or select from existing ones
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Condition */}
          <FormField
            control={form.control}
            name="condition"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="listing-condition">
                  Condition
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger
                        id="listing-condition"
                        className={cn(
                          !field.value && form.formState.isSubmitted && 'border-destructive focus-visible:ring-destructive'
                        )}
                      >
                        <SelectValue placeholder="Select a condition" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="like-new">Like New</SelectItem>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="salvage">Salvage</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage className="text-destructive" />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="listing-description">
                  Description
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Textarea
                    id="listing-description"
                    placeholder="Describe your item"
                    className={cn(
                      "resize-none h-32",
                      field.value?.length > 500 && "border-destructive focus-visible:ring-destructive",
                      !field.value && form.formState.isSubmitted && "border-destructive focus-visible:ring-destructive"
                    )}
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Describe your item in detail (max 500 characters)
                </FormDescription>
                <FormMessage />
                {field.value?.length > 500 && (
                  <p className="text-xs text-destructive mt-1">
                    Please shorten your description by {field.value.length - 500} characters
                  </p>
                )}
              </FormItem>
            )}
          />

          {/* Price */}
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="listing-price">
                  Price (SOL)
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    id="listing-price"
                    type="number"
                    step="0.00001"
                    min="0.00001"
                    max="2000000"
                    placeholder="Enter price in SOL"
                    className={cn(
                      field.value < 0.00001 && "border-destructive focus-visible:ring-destructive",
                      field.value > 2000000 && "border-destructive focus-visible:ring-destructive",
                      !field.value && form.formState.isSubmitted && "border-destructive focus-visible:ring-destructive"
                    )}
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      field.onChange(isNaN(value) ? 0 : value);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Delivery Options */}
          <div className="space-y-4">
            <FormLabel>Delivery Options</FormLabel>
            
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="noDelivery"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue('handDelivery', false);
                            form.setValue('postalService', false);
                          }
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">No delivery</FormLabel>
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
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue('noDelivery', false);
                            form.setValue('postalService', false);
                          }
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Hand delivery</FormLabel>
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
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) {
                            form.setValue('noDelivery', false);
                            form.setValue('handDelivery', false);
                          }
                        }}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">Postal service</FormLabel>
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Delivery Price */}
          <FormField
            control={form.control}
            name="deliveryPrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery Price (SOL)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.000001"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      field.onChange(isNaN(value) ? 0 : value);
                    }}
                    disabled={!form.watch('postalService')}
                  />
                </FormControl>
                {form.watch('postalService') && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    <PriceConversion amount={field.value || 0} />
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Price Summary Section */}
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-4">
            {/* Listing Price */}
            <div>
              <h3 className="font-semibold mb-2">Listing Price</h3>
              <div className="flex justify-between items-center text-lg">
                <span>Price:</span>
                <div className="text-right">
                  <div className="font-semibold">{form.watch('price')} SOL</div>
                  <div className="text-sm">
                    <PriceConversion amount={form.watch('price')} />
                  </div>
                </div>
              </div>
            </div>

            {/* Buyer Fees Section */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Additional Fees (paid by the buyer)</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                {/* Protection Fee */}
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-1">
                    Protection Fee
                    <span className="text-xs">(1.8%)</span>
                  </span>
                  <div className="text-right">
                    <div>{(form.watch('price') * 0.018).toFixed(6)} SOL</div>
                    <div className="text-xs">
                      <PriceConversion amount={form.watch('price') * 0.018} />
                    </div>
                  </div>
                </div>

                {/* Delivery Fee if applicable */}
                {form.watch('postalService') && (
                  <div className="flex justify-between items-center">
                    <span>Delivery Fee</span>
                    <div className="text-right">
                      <div>{form.watch('deliveryPrice')} SOL</div>
                      <div className="text-xs">
                        <PriceConversion amount={form.watch('deliveryPrice') || 0} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <Alert>
            <AlertDescription>
              <h4 className="font-semibold mb-2">Best Practices</h4>
              <ul className="list-disc pl-4 space-y-1">
                <li>Be cautious of potential scammers</li>
                <li>Protect your personal information</li>
                <li>Never list prohibited or illegal items</li>
                <li>Use secure payment methods</li>
                <li>Document item condition thoroughly</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Action Buttons */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel Listing
            </Button>
            <Button type="submit" disabled={isPublishing}>
              {isPublishing ? 'Publishing...' : 'Publish Listing'}
            </Button>
          </div>
        </form>
      </Form>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Listing</DialogTitle>
            <DialogDescription>
              Are you sure? Your changes will not be saved and your listing will not be published.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Resume
            </Button>
            <Button variant="destructive" onClick={confirmCancel}>
              Cancel Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Congratulations!</DialogTitle>
            <DialogDescription>
              Your item is listed on Silkyway.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)}>
              Close
            </Button>
            <Button onClick={() => router.push(`/listings/${newListingId}`)}>
              View Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default CreateListingPage;
