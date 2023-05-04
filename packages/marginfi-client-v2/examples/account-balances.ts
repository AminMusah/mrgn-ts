import { Connection } from "@solana/web3.js";
import { AccountType, getConfig, MarginfiClient, NodeWallet, shortenAddress } from "../src";
import { MarginRequirementType } from "../src/account";

async function main() {
  const connection = new Connection("https://devnet.genesysgo.net/", "confirmed");
  const wallet = NodeWallet.local();
  const config = await getConfig("dev");
  const client = await MarginfiClient.fetch(config, wallet, connection);

  const programAddresses = await client.getAllProgramAccountAddresses(AccountType.MarginfiGroup);
  console.log(programAddresses.map((key) => key.toBase58()));

  // const marginfiAccount = await MarginfiAccount.fetch(
  //   "H9rVGRzqZJC2gJ9ysgVDq1AnwLurdipVz94f4yy9igan",
  //   client
  // );

  const marginfiAccount = await client.createMarginfiAccount();

  const group = marginfiAccount.group;

  const bankLabel1 = "SOL";
  const bank1 = group.getBankByLabel(bankLabel1);
  if (!bank1) throw Error(`${bankLabel1} bank not found`);

  const bankLabel2 = "USDC";
  const bank2 = group.getBankByLabel(bankLabel2);
  if (!bank2) throw Error(`${bankLabel2} bank not found`);

  await marginfiAccount.deposit(1, bank1);
  await marginfiAccount.deposit(2, bank2);
  await marginfiAccount.reload();

  marginfiAccount.activeBalances.forEach((balance) => {
    const bank = group.banks.get(balance.bankPk.toString())!;
    const { assets, liabilities } = balance.getUsdValue(bank, MarginRequirementType.Equity);

    console.log(
      `Balance for ${shortenAddress(bank.mint)} (${shortenAddress(
        balance.bankPk
      )}) deposits: ${assets}, borrows: ${liabilities}`
    );


    const emissions = balance.getTotalOutstandingEmissions(bank);
  });
}

main().catch((e) => console.log(e));
