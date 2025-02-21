-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false;
