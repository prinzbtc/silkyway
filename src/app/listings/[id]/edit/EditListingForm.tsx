"use client"

import { type FC, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useWallet } from "@solana/wallet-adapter-react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { ImageUploader } from "@/components/listings/ImageUploader"
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
import { useConvertedPrice } from "@/hooks/price/useConvertedPrice"
import { categories } from "@/lib/categories"
import { BRAND_CATEGORIES, type BrandCategories } from "@/lib/brands"
import { BrandCombobox } from "@/components/ui/brand-combobox"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

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
        invalid_type_error: "Title must be text",
      })
      .min(1, { message: "Title is required" })
      .max(40, { message: "Title must be 40 characters or less" })
    ),
  category: z
    .string()
    .min(1, { message: "Category is required" }),
  brand: z
    .string()
    .optional(),
  price: z
    .number()
    .min(0, { message: "Price must be greater than 0" }),
  description: z
    .string()
    .min(1, { message: "Description is required" })
    .max(500, { message: "Description must be 500 characters or less" })
    .trim(),
  condition: z
    .string()
    .min(1, { message: "Condition is required" }),
  noDelivery: z.boolean(),
  handDelivery: z.boolean(),
  postalService: z.boolean(),
  deliveryPrice: z.number(),
  existingImages: z.array(z.object({
    id: z.string(),
    url: z.string()
  })).optional(),
})

type FormValues = z.infer<typeof formSchema>

// Price conversion component
function PriceConversion({ amount }: { amount: number }) {
  const { preferredCurrency } = useCurrencyPreference()
  const { convertedAmount, isLoading } = useConvertedPrice(amount)

  if (isLoading) {
    return <Skeleton className="h-4 w-24" />
  }

  return (
    <span className="text-sm text-gray-500">
      ≈ {new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: preferredCurrency,
      }).format(convertedAmount || 0)}
    </span>
  )
}

const EditListingForm: FC<EditListingFormProps> = ({ listingId }) => {
  const router = useRouter()
  const { publicKey } = useWallet()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [existingImages, setExistingImages] = useState<ListingImage[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      brand: "",
      price: 0,
      noDelivery: false,
      handDelivery: false,
      postalService: false,
      deliveryPrice: 0,
      condition: "",
    },
  })

  // Fetch existing listing data on component mount
  useEffect(() => {
    const fetchListing = async () => {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/listings/${listingId}`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch listing')
        }
        
        const listingData = await response.json()
        
        // Populate form with existing listing data
        form.reset({
          title: listingData.title,
          description: listingData.description,
          category: listingData.category,
          brand: listingData.brand,
          price: listingData.price,
          condition: listingData.condition,
          noDelivery: listingData.deliveryOptions?.noDelivery || false,
          handDelivery: listingData.deliveryOptions?.handDelivery || false,
          postalService: listingData.deliveryOptions?.postalService || false,
          deliveryPrice: listingData.deliveryOptions?.deliveryPrice || 0,
          existingImages: listingData.images?.map((img: ListingImage) => ({
            id: img.id,
            url: img.url
          })) || [],
        })

        // Set existing images
        setExistingImages(listingData.images || [])
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

  const onSubmit = async (data: FormValues) => {
    // If a brand is provided and it's not in the list, add it
    if (data.brand && data.category) {
      const categoryBrands = BRAND_CATEGORIES[data.category as BrandCategories] || [];
      const brandsList = Array.isArray(categoryBrands) ? categoryBrands : [];
      
      // Type-safe brand check
      const isValidBrand = brandsList.some(
        (existingBrand) => existingBrand === data.brand
      );

      if (!isValidBrand) {
        try {
          await fetch('/api/brands', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              category: data.category,
              brand: data.brand,
            }),
          });
        } catch (error) {
          console.error('Error adding brand:', error);
        }
      }
    }

    try {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update listing');
      }

      toast({
        title: "Success",
        description: "Listing updated successfully",
      })

      router.push(`/listings/${listingId}`)
    } catch (error) {
      console.error('Error updating listing:', error);
      toast({
        title: "Error",
        description: "Failed to update listing",
        variant: "destructive"
      })
    }
  }

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete listing');
      }

      toast({
        title: "Success",
        description: "Listing deleted successfully",
      })

      router.push('/listings')
    } catch (error) {
      console.error('Error deleting listing:', error);
      toast({
        title: "Error",
        description: "Failed to delete listing",
        variant: "destructive"
      })
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
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
                        defaultValue={field.value}
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (SOL)</FormLabel>
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
                            <PriceConversion amount={field.value} />
                          </div>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
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
                            className="resize-none"
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
                          defaultValue={field.value}
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
                              checked={field.value}
                              onCheckedChange={field.onChange}
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
                      name="handDelivery"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Hand Delivery</FormLabel>
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
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>Postal Service</FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />

                    {(form.watch("handDelivery") || form.watch("postalService")) && (
                      <FormField
                        control={form.control}
                        name="deliveryPrice"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Price (SOL)</FormLabel>
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
                                  <PriceConversion amount={field.value} />
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
                      <h3 className="text-lg font-medium text-gray-900">Images</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Add up to 10 images of your item
                      </p>
                    </div>
                    <ImageUploader
                      images={[]}
                      existingImages={existingImages}
                      onChange={() => {}}
                      onExistingChange={(images) => {
                        form.setValue("existingImages", images)
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
                    type="submit"
                    disabled={
                      !form.watch('category') || 
                      !form.watch('title') || 
                      form.watch('title')?.length > 40 || 
                      form.formState.isSubmitting
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

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Listing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this listing? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default EditListingForm
