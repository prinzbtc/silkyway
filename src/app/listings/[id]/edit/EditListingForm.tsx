"use client"

import { type FC, useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useWallet } from "@solana/wallet-adapter-react"
import { getSession } from "@/lib/auth/session"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { MediaUploader } from "@/components/listings/MediaUploader"
import { MediaProcessingTracker } from "@/components/listings/MediaProcessingTracker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useCurrencyPreference } from "@/context/CurrencyPreferenceProvider"
import { usePrice } from "@/hooks/usePrice"
import { categories } from "@/lib/categories"
import { BRAND_CATEGORIES, type BrandCategories } from "@/lib/brands"
import { BrandCombobox } from "@/components/ui/brand-combobox"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { normalizeCurrency } from "@/lib/price"
import { MediaFile, MediaType, MediaProcessingStatus } from "@/types/media"
import { LoadingDialog } from "@/components/ui/loading-dialog"
import { ListingCard } from "@/components/listings/ListingCard"

interface EditListingFormProps {
  listingId: string
}

interface ListingImage {
  id: string
  url: string
}

const formSchema = z.object({
  title: z
    .string()
    .min(1, { message: "Title is required" })
    .max(40, { message: "Title must be 40 characters or less" })
    .trim()
    .transform((val) => val || undefined)
    .pipe(
      z.string({
        required_error: "Title is required",
        invalid_type_error: "Title must be a string",
      })
    ),
  description: z.string().optional(),
  category: z.string({
    required_error: "Category is required",
  }),
  brand: z.string().optional(),
  price: z.number({
    required_error: "Price is required",
    invalid_type_error: "Price must be a number",
  }).nonnegative({ message: "Price must be a positive number" }),
  condition: z.string().optional(),
  noDelivery: z.boolean().default(false),
  postalService: z.boolean().default(false),
  deliveryPrice: z.number().default(0),
  existingMedia: z.array(z.object({
    id: z.string().optional(),
    url: z.string().optional(),
    filename: z.string().optional(),
    type: z.nativeEnum(MediaType),
    order: z.number().optional(),
    isMain: z.boolean().optional(),
    thumbnail: z.string().optional(),
    status: z.nativeEnum(MediaProcessingStatus).optional(),
  })).optional(),
})

type FormValues = z.infer<typeof formSchema>

// SOL price conversion component
function PriceConversion({ amount, currency }: { amount: number; currency: string }) {
  // Use the provided currency for SOL conversion
  // This ensures SOL conversion is based on the user's selected currency
  const { solAmount, isSolLoading, formattedSol } = usePrice(amount, normalizeCurrency(currency))

  if (isSolLoading) {
    return <Skeleton className="h-4 w-24" />
  }

  if (solAmount === null) {
    return <span className="text-sm text-gray-500">SOL price unavailable</span>
  }

  return (
    <span className="text-sm text-gray-500">
      {formattedSol}
    </span>
  )
}

const EditListingForm: FC<EditListingFormProps> = ({ listingId }) => {
  const { preferredCurrency, setPreferredCurrency } = useCurrencyPreference();
  // Normalize the preferred currency to ensure consistent handling
  const normalizedPreferredCurrency = normalizeCurrency(preferredCurrency);
  // Track the original listing currency and user's original preference
  const [listingCurrency, setListingCurrency] = useState<string | null>(null);
  const [originalUserPreference, setOriginalUserPreference] = useState<string | null>(null);
  // Use a ref to track if we've already set the currency to avoid loops
  const currencyAlreadySet = useRef(false);
  const router = useRouter()
  const { publicKey } = useWallet()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showSuccessDialog, setShowSuccessDialog] = useState(false)
  const [updatedListing, setUpdatedListing] = useState<any>(null)
  const [existingMedia, setExistingMedia] = useState<MediaFile[]>([])
  const [newMedia, setNewMedia] = useState<MediaFile[]>([])
  // Set mediaProcessingComplete to true by default for existing listings
  // This allows editing listings without re-processing already processed media
  const [mediaProcessingComplete, setMediaProcessingComplete] = useState(true)
  const [processingFailed, setProcessingFailed] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      brand: "",
      price: 0,
      noDelivery: false,
      postalService: false,
      deliveryPrice: 0,
      condition: "",
    },
  })

  // Fetch existing listing data on component mount
  // Debug effect to watch form values
  useEffect(() => {
    const formValues = form.getValues();
    console.log('Current form values:', formValues);
  }, [form.watch()]);
  
  // Effect to specifically handle delivery options
  useEffect(() => {
    // Get current delivery option values
    const noDelivery = form.watch('noDelivery');
    const postalService = form.watch('postalService');
    
    console.log('Delivery options from watch:', { 
      noDelivery, 
      postalService 
    });
  }, [form.watch('noDelivery'), form.watch('postalService')]);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/listings/${listingId}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch listing')
        }
        
        const listingData = await response.json()
        
        // If the listing has a currency, update the user's preference to match it
        if (listingData.currency && !currencyAlreadySet.current) {
          const normalizedListingCurrency = normalizeCurrency(listingData.currency);
          console.log('Setting currency preference to match listing currency:', normalizedListingCurrency);
          setListingCurrency(normalizedListingCurrency);
          
          // Store the user's original preference before changing it
          setOriginalUserPreference(preferredCurrency);
          
          // Only update if it's a valid fiat currency (USD, EUR, GBP)
          if (['USD', 'EUR', 'GBP'].includes(normalizedListingCurrency)) {
            // Mark that we've set the currency to prevent loops
            currencyAlreadySet.current = true;
            setPreferredCurrency(normalizedListingCurrency as any);
          }
        }
        
        // Convert old images to media format if needed
        const media = listingData.media || listingData.images?.map((img: ListingImage, index: number) => ({
          id: img.id,
          url: img.url,
          filename: `image-${index}.jpg`,
          type: MediaType.IMAGE,
          order: index,
          isMain: index === 0,
        })) || []
        
        // Define type for delivery options
        interface DeliveryOptions {
          noDelivery: boolean;
          postalService: boolean;
          deliveryPrice: number;
        }
        
        // Process delivery options with robust parsing
        let deliveryOptions: Partial<DeliveryOptions> = {};
        
        try {
          // Handle different possible formats of deliveryOptions
          if (typeof listingData.deliveryOptions === 'string') {
            // Parse from JSON string
            deliveryOptions = JSON.parse(listingData.deliveryOptions);
          } else if (typeof listingData.deliveryOptions === 'object' && listingData.deliveryOptions !== null) {
            // Already an object
            deliveryOptions = listingData.deliveryOptions;
          }
          
          console.log('Successfully processed delivery options:', deliveryOptions);
        } catch (e) {
          console.error('Error processing delivery options:', e);
          // Default empty object already set
        }
        
        // Ensure all delivery option fields exist with proper boolean values
        const processedDeliveryOptions: DeliveryOptions = {
          noDelivery: deliveryOptions.noDelivery === true,
          postalService: deliveryOptions.postalService === true,
          deliveryPrice: Number(deliveryOptions.deliveryPrice) || 0
        };
        
        // Debug logs
        console.log('Raw delivery options:', listingData.deliveryOptions);
        console.log('Processed delivery options:', processedDeliveryOptions);
        
        // Populate form with existing listing data
        // Prepare form values with proper type conversion
        const formValues = {
          title: listingData.title,
          description: listingData.description,
          category: listingData.category || "",  // Ensure category is never null or undefined
          brand: listingData.brand,
          price: listingData.price,
          condition: listingData.condition || "",  // Ensure condition is never null or undefined
          noDelivery: processedDeliveryOptions.noDelivery,
          postalService: processedDeliveryOptions.postalService,
          deliveryPrice: processedDeliveryOptions.deliveryPrice,
          existingMedia: media,
        };
        
        // Reset form with prepared values
        form.reset(formValues);
        
        // Manually set checkbox values to ensure they're properly initialized
        setTimeout(() => {
          // Use setTimeout to ensure the form has been reset before setting values
          form.setValue('noDelivery', processedDeliveryOptions.noDelivery);
          form.setValue('postalService', processedDeliveryOptions.postalService);
          console.log('Checkbox values set after timeout');
        }, 0);
        
        // Log form values after reset
        console.log('Form values after manual setting:', form.getValues());

        // Set existing media
        setExistingMedia(media)
        
        // Debug log for form values
        console.log('Form values after reset:', {
          title: listingData.title,
          description: listingData.description,
          category: listingData.category,
          brand: listingData.brand,
          price: listingData.price,
          condition: listingData.condition,
          deliveryOptions: listingData.deliveryOptions,
          media: media
        })
        
        // Specific logs for select fields
        console.log('Category value type:', typeof listingData.category, 'Value:', listingData.category)
        console.log('Condition value type:', typeof listingData.condition, 'Value:', listingData.condition)
      } catch (error) {
        console.error("Error loading listing:", error)
        setError(error instanceof Error ? error.message : "Failed to load listing")
        toast({
          title: "Error",
          description: "Failed to load listing details",
          variant: "destructive"
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchListing()
  }, [listingId, form, toast])
  
  // Cleanup effect to restore the user's original currency preference when leaving the page
  useEffect(() => {
    return () => {
      // Reset the ref when the component unmounts
      currencyAlreadySet.current = false;
      
      // When component unmounts, restore the original preference if we changed it
      if (originalUserPreference && originalUserPreference !== preferredCurrency) {
        console.log('Restoring original currency preference:', originalUserPreference);
        setPreferredCurrency(originalUserPreference as any);
      }
    };
  }, [originalUserPreference, preferredCurrency, setPreferredCurrency])

  const onSubmit = async (data: FormValues) => {
    // Debug log for form values on submission
    console.log('Form values on submission:', data);
    console.log('Form is submitting - onSubmit function called');
    
    // If a brand is provided, check if it needs to be added to the system
    if (data.brand && data.category) {
      const categoryBrands = BRAND_CATEGORIES[data.category as BrandCategories] || [];
      const brandsList = Array.isArray(categoryBrands) ? categoryBrands : [];
      
      // Type-safe brand check
      const isValidBrand = brandsList.some(
        (existingBrand) => existingBrand.toLowerCase() === data.brand?.toLowerCase()
      );

      // If the brand doesn't exist in our static list, add it to the system
      if (!isValidBrand) {
        console.log(`Adding new brand "${data.brand}" to category "${data.category}"`);
        try {
          const response = await fetch('/api/brands', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              category: data.category,
              brand: data.brand,
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
            if (data.category in BRAND_CATEGORIES) {
              // Import the BrandService function dynamically to avoid circular dependencies
              import('@/lib/brands').then(({ BrandService }) => {
                BrandService.addToStaticList(data.brand!, data.category as BrandCategories);
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

    // Check if any media is still processing
    const allMedia = [...newMedia, ...existingMedia];
    
    // Filter out temporary media files that haven't been processed yet
    // These will be processed after submission
    const pendingMedia = allMedia.filter(m => 
      m.id && !m.id.startsWith('temp-') && (
        m.status === MediaProcessingStatus.PENDING || 
        m.status === MediaProcessingStatus.PROCESSING
      )
    );

    if (pendingMedia.length > 0) {
      toast({
        title: 'Media processing',
        description: 'Your media files are still processing, but we will save your changes',
      });
      
      // Continue with submission even if media is still processing
      // The MediaProcessingTracker will handle updating the status
    }

    // Check for failed media, but ignore temp files which haven't been processed yet
    const failedMedia = allMedia.filter(m => 
      m.id && !m.id.startsWith('temp-') && m.status === MediaProcessingStatus.FAILED
    );
    if (failedMedia.length > 0) {
      toast({
        title: 'Media processing failed',
        description: 'Some media files failed to process. Please remove them and try again.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Show loading dialog
      setIsSaving(true);
      
      // Process any temporary media files before submitting
      const tempMedia = allMedia.filter(m => m.id && m.id.startsWith('temp-'));
      if (tempMedia.length > 0) {
        // Mark temp media as being processed
        const updatedNewMedia = newMedia.map(item => {
          if (item.id && item.id.startsWith('temp-')) {
            return { ...item, status: MediaProcessingStatus.PROCESSING };
          }
          return item;
        });
        setNewMedia(updatedNewMedia);
      }
      
      // Replace blob URLs with server URLs for submission if available
      const processedMediaWithServerUrls = allMedia.map(item => {
        // If the item has a serverUrl property, use it instead of the blob URL
        if ((item as any).serverUrl) {
          return {
            ...item,
            url: (item as any).serverUrl
          };
        }
        return item;
      });
      
      // Create a copy of the data with the media field and normalized currency
      // When editing, we should preserve the original listing currency if available
      const submissionCurrency = listingCurrency || normalizedPreferredCurrency;
      
      const dataToSubmit = {
        ...data,
        currency: submissionCurrency, // Use original listing currency if available, otherwise use preferred currency
        media: processedMediaWithServerUrls.filter(m => !m.id?.startsWith('temp-')),
        existingMedia: processedMediaWithServerUrls.filter(m => !m.id?.startsWith('temp-'))
      };
      
      // Add debug logs for currency handling
      console.log('Submitting with currency:', {
        originalListingCurrency: listingCurrency,
        userPreferredCurrency: preferredCurrency,
        normalizedPreferredCurrency: normalizedPreferredCurrency,
        submissionCurrency: submissionCurrency
      });
      
      // Remove the media field before submission if needed
      // data.media = processedMediaWithServerUrls.filter(m => !m.id?.startsWith('temp-'));
      // data.existingMedia = processedMediaWithServerUrls.filter(m => !m.id?.startsWith('temp-'));

      console.log('Sending request to update listing with data:', JSON.stringify(dataToSubmit));
      
      try {
        const response = await fetch(`/api/listings/${listingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSubmit),
        });

        console.log('Update response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server error response:', errorText);
          throw new Error(`Failed to update listing: ${response.status} ${errorText}`);
        }
        
        const responseData = await response.json();
        console.log('Update response data:', responseData);
      } catch (fetchError) {
        console.error('Fetch error during listing update:', fetchError);
        throw fetchError;
      }
      
      // Fetch the updated listing with user data for the success dialog
      try {
        const listingResponse = await fetch(`/api/listings/${listingId}`);
        if (listingResponse.ok) {
          const completeListingData = await listingResponse.json();
          setUpdatedListing(completeListingData);
        }
      } catch (error) {
        console.error('Error fetching complete listing data:', error);
      }
      
      // Invalidate all caches to ensure the updated listing appears everywhere
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

      // Hide loading dialog and show success dialog
      setIsSaving(false);
      setShowSuccessDialog(true);
      
      toast({
        title: "Success",
        description: "Listing updated successfully",
      });
    } catch (error) {
      console.error('Error updating listing:', error);
      setIsSaving(false);
      toast({
        title: "Error",
        description: "Failed to update listing",
        variant: "destructive"
      });
    }
  }

  const handleDelete = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete listing');
      }

      // Parse the response to get media files that need to be deleted
      const data = await response.json();
      console.log('Deletion response:', data);
      
      // Log the user ID specifically for debugging
      if (data.userId) {
        console.log('User ID from API response:', data.userId);
      } else {
        console.warn('No user ID returned from API');
      }
      
      // If there are media files to delete, handle them
      if (data.mediaFiles && data.mediaFiles.length > 0) {
        console.log('Media files to clean up:', data.mediaFiles.length);
        
        // Call the cleanup endpoint to delete the files from the filesystem
        try {
          const cleanupResponse = await fetch('/api/media/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: data.mediaFiles })
          });
          
          if (cleanupResponse.ok) {
            const cleanupResult = await cleanupResponse.json();
            console.log('Media cleanup result:', cleanupResult);
          } else {
            console.error('Failed to clean up media files:', await cleanupResponse.text());
          }
        } catch (cleanupError) {
          console.error('Error cleaning up media files:', cleanupError);
          // Continue with the process even if cleanup fails
        }
      }

      toast({
        title: "Success",
        description: "Listing deleted successfully",
      });

      // Get the user ID from the API response
      if (data.userId) {
        console.log('Using user ID from API response for redirect');
        // Redirect to the user's listings page using the actual user ID
        router.push(`/users/${data.userId}/userlistings`);
      } else {
        // Try to get the user ID from the session as a fallback
        console.log('No user ID in API response, trying to get from session');
        try {
          const session = await getSession();
          if (session?.user?.id) {
            console.log('Using user ID from session for redirect:', session.user.id);
            router.push(`/users/${session.user.id}/userlistings`);
          } else {
            console.warn('No user ID in session, falling back to listings page');
            router.push('/listings');
          }
        } catch (sessionError) {
          console.error('Error getting session:', sessionError);
          router.push('/listings');
        }
      }
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast({
        title: "Error",
        description: "Failed to delete listing",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="space-y-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Listing</h1>
            <p className="mt-1 text-sm text-gray-500">
              Update your listing details below
            </p>
            {listingCurrency && originalUserPreference && (
              <Alert className="mt-4">
                <AlertDescription>
                  For this editing session, your currency preference has been temporarily set to match this listing's original currency ({listingCurrency}). Your previous preference ({originalUserPreference}) will be restored when you leave this page.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={(e) => {
              console.log('Form submit event triggered');
              form.handleSubmit((data) => {
                console.log('Form handleSubmit callback triggered');
                onSubmit(data);
              })(e);
            }} className="space-y-8">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
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
                          onBlur={(e) => {
                            field.onBlur()
                            form.trigger('title')
                          }}
                          onChange={(e) => {
                            field.onChange(e)
                            form.trigger('title')
                          }}
                          className={cn(
                            !field.value && "border-destructive focus-visible:ring-destructive",
                            field.value?.length > 40 && "border-destructive focus-visible:ring-destructive"
                          )}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Category
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger
                            className={cn(
                              !field.value && form.formState.isSubmitted && "border-destructive focus-visible:ring-destructive"
                            )}
                          >
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

                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand (Optional)</FormLabel>
                      <FormControl>
                        <BrandCombobox
                          value={field.value || ""}
                          onChange={field.onChange}
                          suggestions={Array.from(BRAND_CATEGORIES[form.watch("category") as BrandCategories] || [])}
                          category={form.watch("category") as BrandCategories}
                          placeholder="Start typing to see suggestions"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => {
                    // We already have normalizedPreferredCurrency from the parent component
                    return (
                    <FormItem>
                      <FormLabel>Price ({normalizedPreferredCurrency})</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max="1000000"
                            placeholder={`Enter price in ${normalizedPreferredCurrency}`}
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value))}
                          />
                          <div className="absolute right-3 top-2">
                            <PriceConversion amount={field.value} currency={normalizedPreferredCurrency} />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                  }}
                />

                <div className="sm:col-span-2">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Tell potential buyers about your item..."
                            className="resize-none whitespace-pre-line"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="sm:col-span-2">
                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Condition</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select condition" />
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
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="sm:col-span-2 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Delivery Options</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Select all delivery methods that apply
                    </p>
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="noDelivery"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value === true}
                              onCheckedChange={(checked) => {
                                // Ensure we're setting a boolean value
                                const boolValue = checked === true;
                                field.onChange(boolValue);
                                // Force update the form value
                                form.setValue(field.name, boolValue, { shouldValidate: true, shouldDirty: true });
                                if (boolValue) {
                                  form.setValue('postalService', false, { shouldValidate: true, shouldDirty: true });
                                }
                                console.log(`${field.name} changed to:`, boolValue);
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>No Delivery (Pickup Only)</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="postalService"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value === true}
                              onCheckedChange={(checked) => {
                                // Ensure we're setting a boolean value
                                const boolValue = checked === true;
                                field.onChange(boolValue);
                                // Force update the form value
                                form.setValue(field.name, boolValue, { shouldValidate: true, shouldDirty: true });
                                if (boolValue) {
                                  form.setValue('noDelivery', false, { shouldValidate: true, shouldDirty: true });
                                }
                                console.log(`${field.name} changed to:`, boolValue);
                              }}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Postal Service</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    {form.watch("postalService") && (
                      <FormField
                        control={form.control}
                        name="deliveryPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Price ({normalizedPreferredCurrency})</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  type="number"
                                  step="0.000001"
                                  min="0"
                                  placeholder="0.000000"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value))}
                                />
                                <div className="absolute right-3 top-2">
                                  <PriceConversion amount={field.value} currency={normalizedPreferredCurrency} />
                                </div>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Media</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Add up to 7 images and 1 video of your item
                      </p>
                    </div>
                    
                    {/* Media Processing Tracker */}
                    {(newMedia.length > 0 || existingMedia.length > 0) && (
                      <MediaProcessingTracker 
                        media={[...newMedia, ...existingMedia].filter(m => m.id && !m.id.startsWith('temp-'))}
                        onProcessingComplete={() => {
                          setMediaProcessingComplete(true);
                          setProcessingFailed(false);
                          toast({
                            title: 'Media processing complete',
                            description: 'All media files have been processed successfully',
                          });
                        }}
                        onProcessingFailed={(failedMedia) => {
                          setProcessingFailed(true);
                          toast({
                            title: 'Media processing failed',
                            description: `${failedMedia.length} media files failed to process`,
                            variant: 'destructive',
                          });
                        }}
                      />
                    )}
                    
                    <MediaUploader
                      media={newMedia}
                      existingMedia={existingMedia}
                      onChange={(media) => {
                        setNewMedia(media);
                      }}
                      onExistingChange={(media) => {
                        setExistingMedia(media);
                        form.setValue("existingMedia", media);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={isLoading}
                >
                  Delete Listing
                </Button>
                <div className="space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="button"
                    onClick={() => {
                      console.log('Save button clicked manually');
                      console.log('Form validation state:', form.formState);
                      console.log('Form errors:', form.formState.errors);
                      
                      // Manually trigger form submission
                      const data = form.getValues();
                      console.log('Manual form submission with data:', data);
                      onSubmit(data);
                    }}
                    disabled={
                      !form.watch('category') || 
                      !form.watch('title') || 
                      form.watch('title')?.length > 40 || 
                      form.formState.isSubmitting ||
                      processingFailed
                    }
                  >
                    {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={(open) => {
        // Only allow closing if not currently loading
        if (!isLoading) {
          setShowDeleteDialog(open);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this listing? This action cannot be undone.
              {isLoading && (
                <div className="mt-4 flex items-center justify-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <span>Deleting listing and cleaning up media files...</span>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isLoading}
            >
              {isLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loading Dialog */}
      <LoadingDialog
        open={isSaving}
        title="Updating Your Listing"
        description="Please wait while we process your changes"
      />

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Listing Card Preview - Left Side */}
            <div className="w-full md:w-1/2 bg-muted/20">
              {updatedListing ? (
                <div className="p-4 h-full flex items-center justify-center">
                  <div className="w-full max-w-sm">
                    <ListingCard listing={updatedListing} />
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
                <DialogTitle className="text-2xl">Success!</DialogTitle>
                <DialogDescription className="text-base mt-2">
                  Your listing has been successfully updated on Silkyway.
                </DialogDescription>
              </DialogHeader>
              
              <div className="mt-auto space-y-4">
                <div className="flex flex-col space-y-2">
                  <h4 className="text-sm font-medium">What's next?</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
                    <li>Share your updated listing on social media</li>
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
                    onClick={() => {
                      setShowSuccessDialog(false);
                      router.push(`/listings/${listingId}`);
                    }}
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
  )
}

export default EditListingForm
