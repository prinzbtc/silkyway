-- Add listingId column to the Conversation table
ALTER TABLE "Conversation" ADD COLUMN "listingId" TEXT;

-- Add foreign key constraint
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for better query performance
CREATE INDEX "Conversation_listingId_idx" ON "Conversation"("listingId");
