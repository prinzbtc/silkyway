export interface SessionData {
  user: {
    id: string;
    walletAddress: string;
    isAdmin?: boolean;
  };
  exp: number;
}
