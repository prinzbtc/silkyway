/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "adminRole" TEXT,
ADD COLUMN     "adminSince" TIMESTAMP(3),
ADD COLUMN     "email" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "location" TEXT,
ADD COLUMN     "notificationPreferences" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
