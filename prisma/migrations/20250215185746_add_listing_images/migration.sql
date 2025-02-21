/*
  Warnings:

  - You are about to drop the column `deliveryPrice` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `handDelivery` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `images` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `noDelivery` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `postalService` on the `Listing` table. All the data in the column will be lost.
  - You are about to drop the column `shippingRequired` on the `Listing` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Listing" DROP COLUMN "deliveryPrice",
DROP COLUMN "handDelivery",
DROP COLUMN "images",
DROP COLUMN "noDelivery",
DROP COLUMN "postalService",
DROP COLUMN "shippingRequired",
ADD COLUMN     "deliveryOptions" JSONB NOT NULL DEFAULT '{"noDelivery": false, "handDelivery": false, "postalService": false, "deliveryPrice": 0}';

-- CreateTable
CREATE TABLE "ListingImage" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "listingId" TEXT NOT NULL,

    CONSTRAINT "ListingImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingImage_listingId_idx" ON "ListingImage"("listingId");

-- AddForeignKey
ALTER TABLE "ListingImage" ADD CONSTRAINT "ListingImage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
