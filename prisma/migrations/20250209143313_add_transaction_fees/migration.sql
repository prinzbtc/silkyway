-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "protectionFee" DOUBLE PRECISION,
ADD COLUMN     "shippingFee" DOUBLE PRECISION,
ADD COLUMN     "signature" TEXT;
