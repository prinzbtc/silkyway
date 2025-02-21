'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { User } from '@/types/user';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { styled } from '@/lib/styled-system';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CountrySelect, CountrySelectValue } from '@/components/ui/country-select';

const SaveButton = styled(Button, {
  base: {
    backgroundColor: '#0a4614',
    color: '#ffffff',
    border: 'none',
    outline: 'none',
    boxShadow: 'none',
    _hover: {
      backgroundColor: '#0a4614',
      opacity: '0.9',
    },
  },
});

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

const usernameRegex = /^[a-z0-9_-]+$/;

const profileFormSchema = z.object({
  username: z.string()
    .min(2, { message: 'Username must be at least 2 characters.' })
    .max(20, { message: 'Username must be less than 20 characters.' })
    .regex(usernameRegex, { message: 'Username can only contain lowercase letters, numbers, underscores and hyphens.' })
    .transform(val => val.toLowerCase()),
  bio: z.string()
    .max(300, { message: 'Bio must be less than 300 characters.' })
    .optional()
    .or(z.literal('')),
  location: z.object({
    value: z.string(),
    label: z.string(),
    flag: z.string(),
  }).optional(),
  email: z.union([
    z.string().email({ message: 'Invalid email address.' }),
    z.literal('')
  ]).optional(),
  twitterHandle: z.string().optional(),
  avatar: z.string().optional().nullable(),
  hideWalletAddress: z.boolean().optional(),
  allowInAppNotifications: z.boolean().optional(),
  allowEmailNotifications: z.boolean().optional(),
  allowUpdates: z.boolean().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

interface EditProfileFormProps {
  user: User;
}

export default function EditProfileForm({ user }: EditProfileFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(user.avatar || '');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [usernameExists, setUsernameExists] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // Check if username exists
  const checkUsername = useCallback(async (username: string) => {
    if (!username || username === user.username) return;
    setIsCheckingUsername(true);
    try {
      const response = await fetch(`/api/user/check-username?username=${username}`);
      const data = await response.json();
      setUsernameExists(data.exists);
    } catch (error) {
      console.error('Error checking username:', error);
    } finally {
      setIsCheckingUsername(false);
    }
  }, [user.username]);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      username: user.username || '',
      bio: user.bio || '',
      location: user.location ? {
        value: user.location.split('|')[0] || '',
        label: user.location.split('|')[1] || '',
        flag: user.location.split('|')[2] || '',
      } : undefined,
      email: user.email || '',
      twitterHandle: user.twitterHandle || '',
      avatar: user.avatar || null,
      hideWalletAddress: user.hideWalletAddress || false,
      allowInAppNotifications: user.allowInAppNotifications || false,
      allowEmailNotifications: user.allowEmailNotifications || false,
      allowUpdates: user.allowUpdates || false,
    },
  });

  // Track form changes
  const formState = form.formState;
  const [isDirty, setIsDirty] = useState(false);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);

  useEffect(() => {
    setIsDirty(formState.isDirty);
  }, [formState.isDirty]);

  // Debounce username check
  useEffect(() => {
    const username = form.getValues('username');
    // Only check if username has changed and is not the original username
    if (username && username !== user.username) {
      const timer = setTimeout(() => checkUsername(username), 500);
      return () => clearTimeout(timer);
    }
  }, [form.watch('username'), checkUsername, user.username]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'Error',
        description: 'Image must be less than 3MB',
        variant: 'destructive',
      });
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast({
        title: 'Error',
        description: 'File must be .jpg, .jpeg, .png, or .gif',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Compress image before converting to base64
      const compressedFile = await new Promise<File>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = new window.Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Max dimensions
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            
            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Failed to get canvas context'));
              return;
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Failed to compress image'));
                  return;
                }
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              },
              'image/jpeg',
              0.8
            );
          };
          img.src = reader.result as string;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      setImageFile(compressedFile);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        setImagePreview(base64Data);
        form.setValue('avatar', base64Data, {
          shouldValidate: true,
          shouldDirty: true
        });
        setIsDirty(true);
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error('Error processing image:', error);
      toast({
        title: 'Error',
        description: 'Failed to process image',
        variant: 'destructive',
      });
    }
  }, [form, toast]);

  const onSubmit = async (data: ProfileFormValues) => {
    if (!isDirty) {
      router.push('/profile');
      return;
    }

    try {
      // If an image file is selected, convert it to base64
      let avatar: string | null = null;
      if (imageFile) {
        try {
          // Convert compressed image to base64
          avatar = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
          });
        } catch (error) {
          console.error('Error processing image:', error);
          toast({
            title: 'Error',
            description: 'Failed to process image',
            variant: 'destructive',
          });
          return;
        }
      }

      // Prepare the data for submission
      const { location, ...restData } = data;
      const updateData = {
        ...restData,
        location: location ? `${location.value}|${location.label}|${location.flag}` : null,
        avatar: avatar || null,
      };

      try {
        const response = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': localStorage.getItem('userId') || '',
          },
          body: JSON.stringify(updateData),
        });

        let result;
        try {
          result = await response.json();
        } catch (e) {
          throw new Error('Invalid response from server');
        }

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to update profile');
        }

        const { user: updatedUser } = result;

        // Show toast notification
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated.',
          duration: 5000, // 5 seconds
        });

        // Wait for toast to be visible
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Reset form state
        form.reset({
          ...restData,
          location: location,
          avatar,
        });
        setIsDirty(false);
        setImageFile(null);

        // Redirect to profile page
        router.push('/profile');
      } catch (error) {
        console.error('Profile update error:', error);
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'An unexpected error occurred',
          variant: 'destructive',
          duration: 5000, // 5 seconds
        });
      }
    } catch (error) {
      console.error('Form submission error:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit form',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'DELETE',
        headers: {
          'x-user-id': localStorage.getItem('userId') || '',
        },
      });

      if (!response.ok) throw new Error('Failed to delete account');

      toast({
        title: 'Account Deleted',
        description: 'Your account has been scheduled for deletion',
      });
      
      router.push('/');
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete account',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    const subscription = form.watch(() => setIsDirty(true));
    return () => subscription.unsubscribe();
  }, [form]);

  return (
    <Card>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Your username" 
                      {...field} 
                      disabled={!!user.username}
                      className={cn(
                        user.username && 'font-bold',
                        field.value && !usernameExists && !form.formState.errors.username ? 'text-green-600' : '',
                        (usernameExists || form.formState.errors.username) ? 'text-red-600' : ''
                      )}
                      onChange={(e) => {
                        const value = e.target.value.toLowerCase();
                        field.onChange(value);
                        setIsDirty(true);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Usernames are unique and can only be set once.
                  </FormDescription>
                  {usernameExists && (
                    <p className="text-sm font-medium text-red-600">This username is already taken</p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell us about yourself" 
                      className="resize-none"
                      {...field} 
                      onChange={(e) => {
                        field.onChange(e);
                        setIsDirty(true);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Maximum 300 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <CountrySelect
                      value={field.value as CountrySelectValue}
                      onChange={(value) => {
                        field.onChange(value);
                        setIsDirty(true);
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Required for creating listings and buying/selling items. Helps us provide accurate delivery options.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="Your email" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4">
              <FormLabel>Profile Picture</FormLabel>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="Profile"
                      fill
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full rounded-full bg-gray-200 flex items-center justify-center text-2xl font-semibold text-gray-600">
                      {user.username?.[0]?.toUpperCase() || 'A'}
                    </div>
                  )}
                </div>
                <Input
                  type="file"
                  accept={ACCEPTED_IMAGE_TYPES.join(',')}
                  onChange={handleFileChange}
                  className="max-w-[250px]"
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="hideWalletAddress"
              render={({ field }) => (
                <FormItem className="flex items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Hide wallet address on profile</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowInAppNotifications"
              render={({ field }) => (
                <FormItem className="flex items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Allow in-app notifications for marketplace events</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowEmailNotifications"
              render={({ field }) => (
                <FormItem className="flex items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Allow email notifications for marketplace events</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allowUpdates"
              render={({ field }) => (
                <FormItem className="flex items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Allow updates notifications</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="mt-6 flex justify-between items-center">
              <div className="flex space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    if (isDirty) {
                      setIsLeaveDialogOpen(true);
                    } else {
                      router.push('/dashboard');
                    }
                  }}
                >
                  Cancel
                </Button>
                <SaveButton 
                  type="submit" 
                  disabled={!isDirty || 
                           form.formState.isSubmitting || 
                           usernameExists || 
                           Object.keys(form.formState.errors).length > 0}
                  className={cn(
                    'transition-all',
                    (!isDirty || form.formState.isSubmitting || usernameExists || Object.keys(form.formState.errors).length > 0) 
                      ? 'opacity-50 cursor-not-allowed' 
                      : ''
                  )}
                >
                  {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                </SaveButton>
              </div>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={() => setIsDeleteDialogOpen(true)}
              >
                Delete Account
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              This action will schedule your account for deletion. Your information will be kept in our database for 1 year before being permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              No
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to leave?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLeaveDialogOpen(false)}>
              No
            </Button>
            <Button variant="destructive" onClick={() => router.push('/dashboard')}>
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
