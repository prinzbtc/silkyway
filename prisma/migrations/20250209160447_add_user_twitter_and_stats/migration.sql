/*
  Warnings:

  - A unique constraint covering the columns `[twitterHandle]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "completedTransactionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "twitterHandle" TEXT,
ADD COLUMN     "twitterVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_twitterHandle_key" ON "User"("twitterHandle");
