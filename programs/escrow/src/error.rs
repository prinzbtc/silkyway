use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Debug, Copy, Clone)]
pub enum EscrowError {
    #[error("Invalid Instruction")]
    InvalidInstruction,

    #[error("Not Rent Exempt")]
    NotRentExempt,

    #[error("Escrow Not Active")]
    EscrowNotActive,

    #[error("Invalid Account Owner")]
    InvalidAccountOwner,

    #[error("Invalid Release Time")]
    InvalidReleaseTime,
}

impl From<EscrowError> for ProgramError {
    fn from(e: EscrowError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
