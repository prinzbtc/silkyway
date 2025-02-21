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
import { brands, type BrandCategories } from "@/lib/brands"
import { BrandCombobox } from "@/components/ui/brand-combobox"
import { Skeleton } from "@/components/ui/skeleton"

// Mock data for testing
const MOCK_LISTING = {
  id: "test-listing-id",
  title: "Test Listing",
  category: "electronics",
  brand: "Test Brand",
  description: "This is a test listing description that we can edit.",
  price: 1.5,
  noDelivery: false,
  handDelivery: true,
  postalService: true,
  deliveryPrice: 0.1,
  sellerId: null as string | null, // Will be set to current user's publicKey
  images: [
    { id: "img1", url: "/mockImages/laptop1.jpg" },
    { id: "img2", url: "/mockImages/laptop2.jpg" },
    { id: "img3", url: "/mockImages/laptop3.jpg" },
  ],
}

interface EditListingPageProps {
  params: {
    id: string
  }
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
    .trim(),
  category: z
    .string({
      required_error: "Category is required",
    })
    .min(1, { message: "Please select a category" }),
  brand: z.string().optional().nullable(),
  description: z
    .string()
    .min(1, { message: "Description is required" })
    .max(500, { message: "Description cannot be longer than 500 characters" }),
  price: z
    .number()
    .min(0.00001, { message: "Price must be at least 0.00001 SOL" })
    .max(2000000, { message: "Price cannot exceed 2,000,000 SOL" }),
  noDelivery: z.boolean().optional(),
  handDelivery: z.boolean().optional(),
  postalService: z.boolean().optional(),
  deliveryPrice: z.number().optional(),
  existingImages: z
    .array(
      z.object({
        id: z.string(),
        url: z.string(),
      }),
    )
    .optional(),
})

type FormValues = z.infer<typeof formSchema>

type CategoryBrands = Record<BrandCategories, string[]>

// Price conversion component
const PriceConversion: FC<{ amount: number | null }> = ({ amount }) => {
  const { convertedAmount, isLoading } = useConvertedPrice(amount || 0)
  const { preferredCurrency } = useCurrencyPreference()

  if (isLoading)
    return (
      <span className="inline-block">
        <Skeleton className="h-4 w-16" />
      </span>
    )

  // Ensure we have a number before formatting
  const formattedAmount = convertedAmount || 0

  return (
    <span className="text-muted-foreground">
      ≈{" "}
      {new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: preferredCurrency,
      }).format(formattedAmount)}
    </span>
  )
}

const TestEditPage: FC<EditListingPageProps> = ({ params }) => {
  const router = useRouter()
  const { publicKey } = useWallet()
  const { toast } = useToast()
  const [uploadImages, setUploadImages] = useState<File[]>([])
  const [existingImages, setExistingImages] = useState<ListingImage[]>([])
  const [isPublishing, setIsPublishing] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { preferredCurrency } = useCurrencyPreference()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      noDelivery: false,
      handDelivery: false,
      postalService: false,
      deliveryPrice: 0,
      existingImages: [],
    },
  })

  // Load mock data instead of fetching
  useEffect(() => {
    const loadMockData = () => {
      try {
        // For test page, we'll always allow access
        // In a real page, we'd check if publicKey?.toBase58() === listing.sellerId

        // Use the mock images directly since they're already in the right format
        const formattedImages = MOCK_LISTING.images

        // Set form values
        form.reset({
          title: MOCK_LISTING.title,
          category: MOCK_LISTING.category,
          brand: MOCK_LISTING.brand,
          description: MOCK_LISTING.description,
          price: MOCK_LISTING.price,
          noDelivery: MOCK_LISTING.noDelivery,
          handDelivery: MOCK_LISTING.handDelivery,
          postalService: MOCK_LISTING.postalService,
          deliveryPrice: MOCK_LISTING.deliveryPrice,
          existingImages: formattedImages,
        })

        setExistingImages(formattedImages)
      } catch (error) {
        console.error("Error loading mock data:", error)
        setError("Failed to load mock data")
      } finally {
        setIsLoading(false)
      }
    }

    // Add a small delay to simulate network request
    setTimeout(loadMockData, 500)
  }, [publicKey, form])

  const onSubmit = async (data: FormValues) => {
    try {
      setIsPublishing(true)

      // Simulate a delay for the update
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Success",
        description: "Your test listing has been updated successfully!",
        action: <Button onClick={() => router.push("/test/listings")}>View Listings</Button>,
      })

      router.push("/test/listings")
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update test listing. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleCancel = () => {
    if (form.formState.isDirty) {
      setShowCancelDialog(true)
    } else {
      router.push("/test/listings")
    }
  }

  const confirmCancel = () => {
    router.push("/test/listings")
  }

  if (isLoading) {
    return (
      <div className="flex justify-center min-h-screen bg-background">
        <div className="container max-w-4xl py-8 px-4 md:px-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="space-y-8">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center min-h-screen bg-background">
        <div className="container max-w-4xl py-8 px-4 md:px-8">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center min-h-screen bg-background">
      <div className="container max-w-4xl py-8 px-4 md:px-8">
        <h1 className="text-2xl font-bold mb-8">Test Edit Listing</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Image Upload */}
            <div className="space-y-4">
              <FormLabel>Images</FormLabel>
              <ImageUploader
                images={uploadImages}
                onChange={setUploadImages}
                maxImages={3}
                maxSize={3 * 1024 * 1024}
                existingImages={existingImages}
                onExistingChange={(images: ListingImage[]) => {
                  form.setValue("existingImages", images)
                  setExistingImages(images)
                }}
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
                  <FormLabel>
                    Title
                    <span className="text-xs text-muted-foreground ml-2">({field.value?.length || 0}/40)</span>
                  </FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
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
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <BrandCombobox
                      value={field.value || ""}
                      onChange={field.onChange}
                      suggestions={(brands as CategoryBrands)[form.watch("category") as BrandCategories] || []}
                      placeholder="Start typing to see suggestions"
                    />
                  </FormControl>
                  <FormDescription>Optional - select from suggestions or enter a new brand</FormDescription>
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
                  <FormLabel>
                    Description
                    <span className="text-xs text-muted-foreground ml-2">({field.value?.length || 0}/500)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea {...field} className="min-h-[100px]" />
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
                  <FormLabel>Price (SOL)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.00001"
                        min="0.00001"
                        max="2000000"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) => {
                          const value = e.target.value
                          field.onChange(value === "" ? 0 : Number.parseFloat(value))
                        }}
                      />
                      <div className="absolute right-3 top-2.5 text-sm">
                        <PriceConversion amount={field.value} />
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
              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="noDelivery"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>No delivery - in-person pickup only</FormLabel>
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
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Hand delivery available</FormLabel>
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
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Postal service available</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Delivery Price */}
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
                          step="0.00001"
                          min="0"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value === "" ? 0 : Number.parseFloat(value))
                          }}
                        />
                        <div className="absolute right-3 top-2.5 text-sm">
                          <PriceConversion amount={field.value || 0} />
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Price Summary Section */}
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-4">
              {/* Listing Price */}
              <div>
                <h3 className="font-semibold mb-2">Listing Price</h3>
                <div className="flex justify-between items-center text-lg">
                  <span>Price:</span>
                  <div className="text-right">
                    <div className="font-semibold">{form.watch("price")} SOL</div>
                    <div className="text-sm">
                      <PriceConversion amount={form.watch("price")} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Buyer Fees Section */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-sm text-muted-foreground mb-2">
                  Additional Fees (paid by the buyer)
                </h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {/* Protection Fee */}
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1">
                      Protection Fee
                      <span className="text-xs">(1.8%)</span>
                    </span>
                    <div className="text-right">
                      <div>{(form.watch("price") * 0.018).toFixed(6)} SOL</div>
                      <div className="text-xs">
                        <PriceConversion amount={form.watch("price") * 0.018} />
                      </div>
                    </div>
                  </div>

                  {/* Delivery Fee if applicable */}
                  {form.watch("postalService") && (
                    <div className="flex justify-between items-center">
                      <span>Delivery Fee</span>
                      <div className="text-right">
                        <div>{form.watch("deliveryPrice")} SOL</div>
                        <div className="text-xs">
                          <PriceConversion amount={form.watch("deliveryPrice") || 0} />
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

            {/* Submit and Cancel Buttons */}
            <div className="flex justify-end space-x-4 pt-4">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPublishing}>
                {isPublishing ? "Updating..." : "Update Listing"}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Editing?</DialogTitle>
            <DialogDescription>Are you sure you want to cancel? All your changes will be lost.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Continue Editing
            </Button>
            <Button variant="destructive" onClick={confirmCancel}>
              Yes, Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default TestEditPage

