use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    sysvar::Sysvar,
};

// Declare program's entrypoint
entrypoint!(process_instruction);

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum EscrowInstruction {
    /// Initialize a new escrow account
    /// 
    /// Accounts expected:
    /// 0. `[signer]` The buyer's account
    /// 1. `[writable]` The escrow account
    /// 2. `[]` The seller's account
    Initialize,

    /// Release funds to the seller
    /// 
    /// Accounts expected:
    /// 0. `[writable]` The escrow account
    /// 1. `[writable]` The seller's account
    ReleaseToSeller,

    /// Return funds to the buyer
    /// 
    /// Accounts expected:
    /// 0. `[writable]` The escrow account
    /// 1. `[writable]` The buyer's account
    ReturnToBuyer,
}

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct EscrowAccount {
    pub buyer: Pubkey,
    pub seller: Pubkey,
    pub amount: u64,
    pub created_at: i64,
    pub tracking_number_provided_at: Option<i64>,
    pub is_active: bool,
}

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = EscrowInstruction::try_from_slice(instruction_data)?;

    match instruction {
        EscrowInstruction::Initialize => {
            msg!("Instruction: Initialize Escrow");
            process_initialize(program_id, accounts)
        }
        EscrowInstruction::ReleaseToSeller => {
            msg!("Instruction: Release to Seller");
            process_release_to_seller(program_id, accounts)
        }
        EscrowInstruction::ReturnToBuyer => {
            msg!("Instruction: Return to Buyer");
            process_return_to_buyer(program_id, accounts)
        }
    }
}

fn process_initialize(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let buyer_info = next_account_info(account_info_iter)?;
    let escrow_account_info = next_account_info(account_info_iter)?;
    let seller_info = next_account_info(account_info_iter)?;

    if !buyer_info.is_signer {
        return Err(ProgramError::MissingRequiredSignature);
    }

    let rent = Rent::get()?;
    if !rent.is_exempt(escrow_account_info.lamports(), escrow_account_info.data_len()) {
        return Err(ProgramError::AccountNotRentExempt);
    }

    let mut escrow_state = EscrowAccount {
        buyer: *buyer_info.key,
        seller: *seller_info.key,
        amount: escrow_account_info.lamports(),
        created_at: solana_program::clock::Clock::get()?.unix_timestamp,
        tracking_number_provided_at: None,
        is_active: true,
    };

    escrow_state.serialize(&mut &mut escrow_account_info.data.borrow_mut()[..])?;

    Ok(())
}

fn process_release_to_seller(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let escrow_account_info = next_account_info(account_info_iter)?;
    let seller_info = next_account_info(account_info_iter)?;

    let mut escrow_state = EscrowAccount::try_from_slice(&escrow_account_info.data.borrow())?;

    if !escrow_state.is_active {
        return Err(ProgramError::InvalidAccountData);
    }

    if escrow_state.seller != *seller_info.key {
        return Err(ProgramError::InvalidAccountData);
    }

    let current_time = solana_program::clock::Clock::get()?.unix_timestamp;
    
    // Check if 20 days have passed since tracking number was provided
    if let Some(tracking_time) = escrow_state.tracking_number_provided_at {
        if current_time - tracking_time < 20 * 24 * 60 * 60 {
            return Err(ProgramError::InvalidAccountData);
        }
    }

    **escrow_account_info.try_borrow_mut_lamports()? = 0;
    **seller_info.try_borrow_mut_lamports()? += escrow_account_info.lamports();

    escrow_state.is_active = false;
    escrow_state.serialize(&mut &mut escrow_account_info.data.borrow_mut()[..])?;

    Ok(())
}

fn process_return_to_buyer(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();
    let escrow_account_info = next_account_info(account_info_iter)?;
    let buyer_info = next_account_info(account_info_iter)?;

    let mut escrow_state = EscrowAccount::try_from_slice(&escrow_account_info.data.borrow())?;

    if !escrow_state.is_active {
        return Err(ProgramError::InvalidAccountData);
    }

    if escrow_state.buyer != *buyer_info.key {
        return Err(ProgramError::InvalidAccountData);
    }

    let current_time = solana_program::clock::Clock::get()?.unix_timestamp;
    
    // Check if 7 days have passed without tracking number
    if escrow_state.tracking_number_provided_at.is_none() 
        && current_time - escrow_state.created_at > 7 * 24 * 60 * 60 {
        **escrow_account_info.try_borrow_mut_lamports()? = 0;
        **buyer_info.try_borrow_mut_lamports()? += escrow_account_info.lamports();

        escrow_state.is_active = false;
        escrow_state.serialize(&mut &mut escrow_account_info.data.borrow_mut()[..])?;
    } else {
        return Err(ProgramError::InvalidAccountData);
    }

    Ok(())
}
