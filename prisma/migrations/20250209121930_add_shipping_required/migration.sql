/*
  Warnings:

  - You are about to drop the column `details` on the `Report` table. All the data in the column will be lost.
  - You are about to drop the column `reportedUserId` on the `Report` table. All the data in the column will be lost.
  - Made the column `listingId` on table `Report` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_listingId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_reportedUserId_fkey";

-- DropIndex
DROP INDEX "Report_reportedUserId_idx";

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "shippingRequired" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Report" DROP COLUMN "details",
DROP COLUMN "reportedUserId",
ADD COLUMN     "attachments" JSONB,
ALTER COLUMN "listingId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
