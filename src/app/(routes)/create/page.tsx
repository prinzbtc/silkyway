'use client';

import { FC, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { MediaUploader } from '@/components/listings/MediaUploader';
import { MediaProcessingTracker } from '@/components/listings/MediaProcessingTracker';
import { MediaFile, MediaType, MediaProcessingStatus } from '@/types/media';
import { UPLOAD_CONFIG } from '@/config/upload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';
import { LoadingDialog } from '@/components/ui/loading-dialog';
import { ListingCard } from '@/components/listings/ListingCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { usePrice } from '@/hooks/usePrice';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { categories } from '@/lib/categories';
import { BRAND_CATEGORIES, type BrandCategories } from "@/lib/brands"
import { cn } from '@/lib/utils';
import { normalizeCurrency } from '@/lib/price';
import { BrandCombobox } from '@/components/ui/brand-combobox';
import { Skeleton } from '@/components/ui/skeleton';

const formSchema = z.object({
  title: z.string().min(3, { message: "Title must be at least 3 characters" }),
  description: z.string().min(10, { message: "Description must be at least 10 characters" }),
  category: z.string(),
  brand: z.string().optional(),
  price: z.coerce.number().min(0, { message: "Price must be a positive number" }),
  condition: z.string(), // Add condition field
  media: z.array(z.object({
    id: z.string().optional(),
    url: z.string().optional(),
    filename: z.string(),
    type: z.enum(['IMAGE', 'VIDEO']),
    order: z.number(),
    isMain: z.boolean().optional(),
    thumbnail: z.string().optional(),
    status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  })).min(1, { message: "At least one media file is required" }),
  noDelivery: z.boolean().optional(),
  handDelivery: z.boolean().optional(),
  postalService: z.boolean().optional(),
  deliveryPrice: z.coerce.number().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type CategoryBrands = Record<BrandCategories, string[]>;

// SOL price conversion component
const SolPriceConversion: FC<{ amount: number; currency: string }> = ({ amount, currency }) => {
  // Use the provided currency for SOL conversion
  // This ensures SOL conversion is based on the user's selected currency
  const { solAmount, isSolLoading, formattedSol } = usePrice(amount, normalizeCurrency(currency));

  if (isSolLoading) return (
    <span className="inline-block">
      <span className="inline-block w-24 h-4 animate-pulse rounded-md bg-muted" />
    </span>
  );

  if (solAmount === null) return (
    <span className="text-muted-foreground">SOL price unavailable</span>
  );

  return (
    <span className="text-muted-foreground">
      {formattedSol}
    </span>
  );
};

// Removed FiatPriceConversion component as SOL is no longer a selectable currency

const CreateListingPage: FC = () => {
  const { toast } = useToast();
  const router = useRouter();
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [categoryBrands, setCategoryBrands] = useState<CategoryBrands>({} as CategoryBrands);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  // Get preferredCurrency from the usePrice hook
  const { preferredCurrency } = usePrice(0, normalizeCurrency('USD'));
  // Normalize the preferred currency to ensure consistent handling
  const normalizedPreferredCurrency = normalizeCurrency(preferredCurrency);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [newListingId, setNewListingId] = useState<string | null>(null);
  const [createdListing, setCreatedListing] = useState<any>(null);
  const [mediaProcessingComplete, setMediaProcessingComplete] = useState(false);
  const [processingFailed, setProcessingFailed] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      brand: '',
      price: 0,
      condition: '',
      media: [],
      noDelivery: false,
      handDelivery: false,
      postalService: false,
      deliveryPrice: 0,
    }
  });

  const onSubmit = async (values: FormValues) => {
    try {
      setIsLoading(true);
      
      // Log form values for debugging
      console.log('Form values being submitted:', {
        ...values,
        noDelivery: values.noDelivery === true,
        handDelivery: values.handDelivery === true,
        postalService: values.postalService === true,
      });

      // If a brand is provided, check if it needs to be added to the system
      if (values.brand && values.category) {
        const categoryBrands = BRAND_CATEGORIES[values.category as BrandCategories] || [];
        const brandsList = Array.isArray(categoryBrands) ? categoryBrands : [];
        
        // Type-safe brand check
        const isValidBrand = brandsList.some(
          (existingBrand) => existingBrand.toLowerCase() === values.brand?.toLowerCase()
        );

        // If the brand doesn't exist in our static list, add it to the system
        if (!isValidBrand) {
          console.log(`Adding new brand "${values.brand}" to category "${values.category}"`);
          try {
            const response = await fetch('/api/brands', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                category: values.category,
                brand: values.brand,
              }),
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              console.error('Failed to add brand:', errorData);
              toast({
                title: "Warning",
                description: "Could not add the new brand to the system. The listing will still be created.",
                variant: "destructive"
              });
            } else {
              console.log('Brand added successfully');
              // Add to local BRAND_CATEGORIES for immediate UI update
              // We'll use the BrandService utility function instead of directly modifying the array
              if (values.category in BRAND_CATEGORIES) {
                // Import the BrandService function dynamically to avoid circular dependencies
                import('@/lib/brands').then(({ BrandService }) => {
                  BrandService.addToStaticList(values.brand!, values.category as BrandCategories);
                }).catch(err => {
                  console.error('Error importing BrandService:', err);
                });
              }
            }
          } catch (error) {
            console.error('Error adding brand:', error);
            toast({
              title: "Warning",
              description: "Could not add the new brand to the system due to a network error. The listing will still be created.",
              variant: "destructive"
            });
          }
        }
      }

      // Validate that we have at least one image
      const hasImage = media.some(m => m.type === MediaType.IMAGE);
      if (!hasImage) {
        toast({
          title: 'Error',
          description: 'You must upload at least one image',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Ensure we have a main media, or set the first one as main
      const hasMainMedia = media.some(m => m.isMain);
      if (!hasMainMedia && media.length > 0) {
        const updatedMedia = [...media];
        updatedMedia[0].isMain = true;
        setMedia(updatedMedia);
      }

      // Check if any media is still processing
      const pendingMedia = media.filter(m => 
        m.status === MediaProcessingStatus.PENDING || 
        m.status === MediaProcessingStatus.PROCESSING
      );

      if (pendingMedia.length > 0 && !mediaProcessingComplete) {
        toast({
          title: 'Media processing',
          description: 'Please wait while we process your media files',
        });
        
        // Don't proceed with submission until media processing is complete
        setIsLoading(false);
        return;
      }

      // Check for failed media
      const failedMedia = media.filter(m => m.status === MediaProcessingStatus.FAILED);
      if (failedMedia.length > 0) {
        toast({
          title: 'Media processing failed',
          description: 'Some media files failed to process. Please remove them and try again.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Log media items for debugging
      console.log('Submitting media items:', media.map(m => ({
        url: m.url,
        serverUrl: (m as any).serverUrl,
        finalUrl: (m as any).serverUrl || m.url
      })));
      
      // Create the listing
      const response = await fetch('/api/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Extract only the fields that should be directly on the listing
          title: values.title,
          description: values.description,
          category: values.category,
          brand: values.brand,
          price: values.price,
          condition: values.condition,
          // Include media items
          media: media.map(m => {
            // Use serverUrl if available, otherwise use the regular url
            const url = (m as any).serverUrl || m.url;
            
            return {
              id: m.id,
              url: url,
              filename: m.filename,
              type: m.type,
              order: m.order,
              isMain: m.isMain,
              thumbnail: m.thumbnail,
            };
          }),
          // Include delivery options
          // Explicitly convert boolean values to ensure they're properly transmitted
          noDelivery: values.noDelivery === true,
          handDelivery: values.handDelivery === true,
          postalService: values.postalService === true,
          deliveryPrice: values.deliveryPrice || 0,
          // Include currency (normalized to ensure consistent handling)
          currency: normalizedPreferredCurrency,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Listing creation error:', errorData);
        toast({
          title: 'Error',
          description: errorData.error || 'Failed to create listing',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const newListing = await response.json();
      console.log('Listing created:', newListing);
      
      // Store the new listing ID
      setNewListingId(newListing.id);
      
      // Fetch the complete listing with user data for the success dialog
      try {
        const listingResponse = await fetch(`/api/listings/${newListing.id}`);
        if (listingResponse.ok) {
          const completeListingData = await listingResponse.json();
          setCreatedListing(completeListingData);
        }
      } catch (error) {
        console.error('Error fetching complete listing data:', error);
      }

      // Invalidate all caches to ensure the new listing appears everywhere
      try {
        console.log('Invalidating all listing caches');
        const invalidateResponse = await fetch('/api/cache/invalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'all' }),
        });
        
        if (invalidateResponse.ok) {
          console.log('Cache invalidation successful');
        } else {
          console.error('Cache invalidation failed:', await invalidateResponse.text());
        }
      } catch (error) {
        console.error('Error invalidating caches:', error);
      }

      // Show success dialog
      setShowSuccessDialog(true);
      setIsLoading(false);
    } catch (error) {
      console.error('Unexpected error in listing creation:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setConfirmCancel(true);
  };

  const handleConfirmCancel = () => {
    router.push('/dashboard');
  };

  // Handle file upload
  const handleMediaChange = async (newMedia: MediaFile[]) => {
    setMedia(newMedia);
    
    // Reset processing status when media changes
    setMediaProcessingComplete(false);
    setProcessingFailed(false);
    
    // Update the form with the new media files
    form.setValue('media', newMedia, { shouldValidate: true });
  };

  // Handle media processing completion
  const handleProcessingComplete = () => {
    setMediaProcessingComplete(true);
    setProcessingFailed(false);
    toast({
      title: 'Media processing complete',
      description: 'All media files have been processed successfully',
    });
  };
  
  // We'll validate the form when needed instead of using an effect
  
  // Debug log for media state and form validity - only log on significant changes
  useEffect(() => {
    // Only log when media changes or processing status changes
    if (media.length > 0) {
      console.log('Media processing status update:');
      console.log('- Media processing complete:', mediaProcessingComplete);
      console.log('- Media with server URLs:', media.filter(item => !!(item as any).serverUrl).length);
      console.log('- Total media count:', media.length);
      console.log('- Button enabled:', !(isLoading || (media.length > 0 && !isMediaReadyForSubmission(media)) || processingFailed || !form.formState.isValid));
    }
  }, [media.length, mediaProcessingComplete, isLoading, processingFailed]);

  // Check if all media items have server URLs or are otherwise ready for submission
  const isMediaReadyForSubmission = (mediaItems: MediaFile[]) => {
    // If there are no media items, they're ready by default
    if (mediaItems.length === 0) return true;
    
    // If mediaProcessingComplete is true, trust that flag
    if (mediaProcessingComplete) return true;
    
    // Otherwise, check if all media items have server URLs
    const allHaveServerUrls = mediaItems.every(item => !!(item as any).serverUrl);
    
    // If all have server URLs, also set mediaProcessingComplete to true
    if (allHaveServerUrls && !mediaProcessingComplete) {
      setMediaProcessingComplete(true);
    }
    
    return allHaveServerUrls;
  };
  
  // Handle media processing failure
  const handleProcessingFailed = (failedMedia: MediaFile[]) => {
    setProcessingFailed(true);
    toast({
      title: 'Media processing failed',
      description: `${failedMedia.length} media files failed to process`,
      variant: 'destructive',
    });
  };

  return (
    <div className="flex justify-center min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4 md:px-8">
      <h1 className="text-3xl font-bold mb-8">Create a New Listing</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            console.log('Form validation errors:', errors);
          })} className="space-y-8">
          {/* Media Upload */}
          <div className="space-y-4">
            <FormLabel>Media Files</FormLabel>
            <MediaUploader
              media={media}
              onChange={handleMediaChange}
              onProcessingComplete={handleProcessingComplete}
            />
            <FormDescription>
              Upload up to {UPLOAD_CONFIG.IMAGE.MAX_FILES} images (max {UPLOAD_CONFIG.IMAGE.MAX_SIZE_MB}MB each) and {UPLOAD_CONFIG.VIDEO.MAX_FILES} video (max {UPLOAD_CONFIG.VIDEO.MAX_SIZE_MB}MB). 
              Drag to reorder - you can set any media as the main one.
            </FormDescription>
            
            {/* Media Processing Tracker */}
            {media.length > 0 && (
              <MediaProcessingTracker 
                media={media}
                onProcessingComplete={handleProcessingComplete}
                onProcessingFailed={handleProcessingFailed}
              />
            )}
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
                      console.log('Create form: getting initial suggestions for category:', category);
                      
                      // Validate the category is a valid BrandCategories value
                      if (category && Object.keys(BRAND_CATEGORIES).includes(category)) {
                        const suggestions = [...BRAND_CATEGORIES[category]];
                        console.log(`Create form: found ${suggestions.length} initial suggestions for ${category}`);
                        return suggestions;
                      }
                      console.log('Create form: no valid category selected, returning empty suggestions');
                      return [];
                    })()}
                    category={(() => {
                      const category = form.watch('category') as BrandCategories;
                      
                      // Log the category value for debugging
                      console.log('Create form: category value:', category);
                      
                      // Check if it's a valid BrandCategories value
                      const isValid = category && Object.keys(BRAND_CATEGORIES).includes(category);
                      console.log('Create form: is valid category?', isValid);
                      
                      // Only pass the category if it's valid
                      return isValid ? category : undefined;
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
                  Price ({normalizedPreferredCurrency})
                  <span className="text-destructive">*</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      id="listing-price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="1000000"
                      placeholder={`Enter price in ${normalizedPreferredCurrency}`}
                      className={cn(
                        field.value < 0.01 && "border-destructive focus-visible:ring-destructive",
                        field.value > 1000000 && "border-destructive focus-visible:ring-destructive",
                        !field.value && form.formState.isSubmitted && "border-destructive focus-visible:ring-destructive"
                      )}
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                        field.onChange(isNaN(value) ? 0 : value);
                      }}
                    />
                    <div className="absolute right-3 top-2 text-sm">
                      <SolPriceConversion amount={field.value} currency={normalizedPreferredCurrency} />
                    </div>
                  </div>
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
                <FormLabel>Delivery Price ({normalizedPreferredCurrency})</FormLabel>
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
                    <SolPriceConversion amount={field.value || 0} currency={normalizedPreferredCurrency} />
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
                  <div className="font-semibold">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: normalizedPreferredCurrency
                    }).format(form.watch('price'))}
                  </div>
                  <div className="text-sm">
                    <SolPriceConversion amount={form.watch('price')} currency={normalizedPreferredCurrency} />
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
                    <div>
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: normalizedPreferredCurrency
                      }).format(form.watch('price') * 0.018)}
                    </div>
                    <div className="text-xs">
                      <SolPriceConversion amount={form.watch('price') * 0.018} currency={normalizedPreferredCurrency} />
                    </div>
                  </div>
                </div>

                {/* Delivery Fee if applicable */}
                {form.watch('postalService') && (
                  <div className="flex justify-between items-center">
                    <span>Delivery Fee</span>
                    <div className="text-right">
                      <div>
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: normalizedPreferredCurrency
                        }).format(form.watch('deliveryPrice') || 0)}
                      </div>
                      <div className="text-xs">
                        <SolPriceConversion amount={form.watch('deliveryPrice') || 0} currency={normalizedPreferredCurrency} />
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
            <Button 
              type="submit" 
              disabled={isLoading || (media.length > 0 && !isMediaReadyForSubmission(media)) || processingFailed || !form.formState.isValid}
            >
              {isLoading ? 'Publishing...' : 'Publish Listing'}
            </Button>
          </div>
        </form>
      </Form>

      {/* Cancel Dialog */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Listing</DialogTitle>
            <DialogDescription>
              Are you sure? Your changes will not be saved and your listing will not be published.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>
              Resume
            </Button>
            <Button variant="destructive" onClick={handleConfirmCancel}>
              Cancel Listing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publishing Loading Dialog */}
      <LoadingDialog
        open={isLoading}
        title="Publishing Your Listing"
        description="Please wait while we process your media and create your listing"
      />

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Listing Card Preview - Left Side */}
            <div className="w-full md:w-1/2 bg-muted/20">
              {createdListing ? (
                <div className="p-4 h-full flex items-center justify-center">
                  <div className="w-full max-w-sm">
                    <ListingCard listing={createdListing} />
                  </div>
                </div>
              ) : (
                <div className="p-8 h-full flex items-center justify-center">
                  <div className="animate-pulse flex flex-col space-y-4 w-full max-w-sm">
                    <div className="rounded-lg bg-gray-200 h-64 w-full"></div>
                    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Content - Right Side */}
            <div className="w-full md:w-1/2 p-6 flex flex-col">
              <DialogHeader className="text-left mb-6">
                <DialogTitle className="text-2xl">Congratulations!</DialogTitle>
                <DialogDescription className="text-base mt-2">
                  Your item has been successfully listed on Silkyway. You can view it, share it, or return to your dashboard.
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-auto space-y-4">
                <div className="flex flex-col space-y-2">
                  <h4 className="text-sm font-medium">What's next?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    <li>Share your listing on social media</li>
                    <li>Add more listings to your shop</li>
                    <li>Check your dashboard for activity</li>
                  </ul>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-6">
                  <Button variant="outline" onClick={() => {
                    setShowSuccessDialog(false);
                    router.push('/dashboard');
                  }} className="sm:flex-1">
                    Go to Dashboard
                  </Button>
                  <Button 
                    onClick={() => router.push(`/listings/${newListingId}`)}
                    className="sm:flex-1"
                  >
                    View Listing
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
};

export default CreateListingPage;
