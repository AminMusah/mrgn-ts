import React, { createContext, FC, useCallback, useContext, useEffect, useState } from "react";
import { nativeToUi } from "@mrgnlabs/marginfi-client-v2";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import BN from "bn.js";
import { getAssociatedTokenAddressSync, unpackAccount } from "@mrgnlabs/marginfi-client-v2/src/utils/spl";
import { useBanks } from "~/context";
import { TokenAccount, TokenAccountMap } from "~/types";

// @ts-ignore - Safe because context hook checks for null
const TokenAccountsContext = createContext<TokenAccountsState>();

interface TokenAccountsState {
  fetching: boolean;
  refresh: () => Promise<void>;
  tokenAccountMap: TokenAccountMap;
  nativeSol: number;
}

const TokenAccountsProvider: FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { banks } = useBanks();

  const [fetching, setFetching] = useState<boolean>(false);
  const [nativeSol, setNativeSol] = useState<number>(0);
  const [tokenAccountMap, setTokenAccountMap] = useState<TokenAccountMap>(new Map<string, TokenAccount>());

  const fetchTokenAccounts = useCallback(async (): Promise<TokenAccountMap> => {
    if (!wallet.publicKey) {
      return new Map<string, TokenAccount>();
    }

    // Get relevant addresses
    const mintList = banks.map((bank) => ({
      address: bank.mint,
      decimals: bank.mintDecimals,
    }));
    const ataAddresses = mintList.map((mint) => getAssociatedTokenAddressSync(mint.address, wallet.publicKey!));

    // Fetch relevant accounts
    const accountsAiList = await connection.getMultipleAccountsInfo([wallet.publicKey, ...ataAddresses]);

    // Decode account buffers
    const [walletAi, ...ataAiList] = accountsAiList;
    setNativeSol(walletAi?.lamports ? walletAi.lamports / 1e9 : 0);

    const ataList: TokenAccount[] = ataAiList.map((ai, index) => {
      if (!ai) {
        return {
          created: false,
          mint: mintList[index].address,
          balance: 0,
        };
      }
      const decoded = unpackAccount(ataAddresses[index], ai);
      return {
        created: true,
        mint: decoded.mint,
        balance: nativeToUi(new BN(decoded.amount.toString()), mintList[index].decimals),
      };
    });

    return new Map(ataList.map((ata) => [ata.mint.toString(), ata]));
  }, [banks, connection, wallet.publicKey]);

  const refresh = useCallback(async () => {
    setFetching(true);
    try {
      setTokenAccountMap(await fetchTokenAccounts());
    } catch (error: any) {
      console.error(error);
    } finally {
      setFetching(false);
    }
  }, [fetchTokenAccounts]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <TokenAccountsContext.Provider value={{ fetching, refresh, tokenAccountMap: tokenAccountMap, nativeSol }}>
      {children}
    </TokenAccountsContext.Provider>
  );
};

const useTokenAccounts = () => {
  const context = useContext(TokenAccountsContext);
  if (!context) {
    throw new Error("useTokenAccounts must be used within a TokenAccountsProvider");
  }

  return context;
};

export { useTokenAccounts, TokenAccountsProvider };
