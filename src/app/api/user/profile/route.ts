import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { saveFile, validateFile } from '@/lib/uploads';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        walletAddress: true,
        createdAt: true,
        location: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let data;
    let avatar: File | null = null;

    // Check content type
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // Handle multipart form data (legacy support)
      const formData = await request.formData();
      avatar = formData.get('avatar') as File | null;
      data = JSON.parse(formData.get('data') as string);
    } else if (contentType.includes('application/json')) {
      // Handle JSON data
      try {
        data = await request.json();
        console.log('Received profile update data:', data);
      } catch (e) {
        console.error('Failed to parse JSON body:', e);
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        );
      }
      // If avatar is a base64 string, convert to File
      if (data.avatar && data.avatar.startsWith('data:image')) {
        try {
          // Extract base64 data after the comma
          const base64Data = data.avatar.split(',')[1];
          const buffer = Buffer.from(base64Data, 'base64');
          avatar = new File([buffer], 'avatar.jpg', { type: 'image/jpeg' });
        } catch (e) {
          console.error('Failed to process avatar:', e);
          return NextResponse.json(
            { 
              success: false,
              error: 'Failed to process avatar: ' + (e instanceof Error ? e.message : 'Unknown error')
            },
            { status: 400 }
          );
        }
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 }
      );
    }

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If username is being set, check if it's unique
    if (data.username && !currentUser.username) {
      const existingUser = await prisma.user.findUnique({
        where: { username: data.username },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 400 }
        );
      }
    }

    // Handle avatar upload if present
    let avatarUrl = undefined;
    if (avatar) {
      // Validate and save profile picture
      await validateFile(avatar, 'profile');
      const { url } = await saveFile(avatar, 'profile');
      avatarUrl = url;
    }

    // Extract allowed fields from data
    const { 
      username, 
      bio, 
      location, 
      email,
      twitterHandle,
      hideWalletAddress,
      allowInAppNotifications,
      allowEmailNotifications,
      allowUpdates
    } = data;

    // Prepare update data
    const updateData: Prisma.UserUpdateInput = {};

    // Only add defined fields to update
    updateData.avatar = avatarUrl || data.avatar || null;
    if (username) updateData.username = username;
    updateData.bio = bio === '' ? null : bio;
    updateData.location = location === '' ? null : location;
    updateData.email = email === '' ? null : email;
    updateData.twitterHandle = twitterHandle === '' ? null : twitterHandle;

    // Update notification preferences
    const notificationPreferences: Prisma.JsonObject = {
      hideWalletAddress: hideWalletAddress ?? false,
      allowInAppNotifications: allowInAppNotifications ?? false,
      allowEmailNotifications: allowEmailNotifications ?? false,
      allowUpdates: allowUpdates ?? false
    };

    // Use Prisma's InputJsonValue for safe JSON input
    updateData.notificationPreferences = notificationPreferences as Prisma.InputJsonValue;

    // Perform the update
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        avatar: true,
        bio: true,
        location: true,
        email: true,
        twitterHandle: true,
        notificationPreferences: true,
      }
    });

    // Return the updated user with a success message
    return NextResponse.json({
      success: true,
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile update error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return a properly formatted error response
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error', 
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current timestamp
    const now = new Date();

    // Soft delete the user
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: now,
      },
    });

    return NextResponse.json({ message: 'Profile deleted successfully' });
  } catch (error) {
    console.error('Error deleting profile:', error);
    return NextResponse.json(
      { error: 'Failed to delete profile' },
      { status: 500 }
    );
  }
}
