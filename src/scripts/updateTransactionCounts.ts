import { updateTransactionCounts } from '@/lib/jobs/updateTransactionCounts';

async function main() {
  console.log('Starting transaction count update...');
  
  try {
    await updateTransactionCounts();
    console.log('Successfully updated all user transaction counts');
  } catch (error) {
    console.error('Error updating transaction counts:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
