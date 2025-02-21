-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "deliveryPrice" DOUBLE PRECISION,
ADD COLUMN     "handDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "noDelivery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postalService" BOOLEAN NOT NULL DEFAULT false;
