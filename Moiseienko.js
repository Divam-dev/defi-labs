import { Wallet, JsonRpcProvider, formatEther, parseEther } from 'ethers';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const command = process.argv[2];

async function main() {
  if (!['generate', 'balance', 'send'].includes(command)) {
    console.log('Usage: node Moiseienko.js <generate|balance|send>');
    return;
  }

  // 1. Find a wallet address starting with 03
  if (command === 'generate') {
    if (existsSync('wallet.json')) {
      console.log('A wallet already exists in wallet.json.');
      return;
    }
    let wallet;
    let attempts = 0;
    do {
      wallet = Wallet.createRandom();
      attempts++;
    } while (!wallet.address.startsWith('0x03'));

    writeFileSync('wallet.json', JSON.stringify({
      address: wallet.address,
      privateKey: wallet.privateKey,
      attempts,
    }, null, 2), { flag: 'wx' });

    console.log('Address:', wallet.address);
    console.log('Private key:', wallet.privateKey);
    console.log('Attempts:', attempts);
    return;
  }

  if (!existsSync('wallet.json')) throw new Error('Run node Moiseienko.js generate first.');

  // 2. Connect to Alchemy and load the saved wallet
  process.loadEnvFile('.env');
  if (!process.env.SEPOLIA_RPC_URL) throw new Error('Set SEPOLIA_RPC_URL in .env.');
  const provider = new JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
  try {
    const network = await provider.getNetwork();
    if (network.chainId !== 11155111n) throw new Error('Ethereum Sepolia is required.');

    const saved = JSON.parse(readFileSync('wallet.json', 'utf8'));
    const wallet = new Wallet(saved.privateKey, provider);
    if (!wallet.address.startsWith('0x03')) throw new Error('The address must start with 0x03.');
    const balance = await provider.getBalance(wallet.address);
    console.log('Address:', wallet.address);
    console.log('Balance in Wei:', balance.toString());
    console.log('Balance in ETH:', formatEther(balance));
    if (command === 'balance') return;

    // 3. Create a recipient wallet and transfer test ETH
    const value = parseEther('0.00001');
    if (balance <= value) throw new Error('Fund the wallet using a Sepolia faucet.');
    if (!existsSync('recipient.json')) {
      const recipient = Wallet.createRandom();
      writeFileSync('recipient.json', JSON.stringify({
        address: recipient.address, privateKey: recipient.privateKey,
      }, null, 2), { flag: 'wx' });
    }
    const recipient = JSON.parse(readFileSync('recipient.json', 'utf8'));
    if (recipient.address === wallet.address) throw new Error('The recipient address must differ from the sender address.');
    const tx = await wallet.sendTransaction({ to: recipient.address, value });
    console.log('Recipient:', recipient.address);
    console.log('Hash:', tx.hash);
    const link = `https://sepolia.etherscan.io/tx/${tx.hash}`;
    console.log('Explorer:', link);

    // 4. Wait for block inclusion and display the receipt
    const receipt = await tx.wait(1, 180000);
    console.log('Status:', receipt.status);
    console.log('Block number:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());
    if (receipt.status !== 1) throw new Error('The transaction failed.');
  } finally {
    provider.destroy();
  }
}

main().catch((error) => {
  const message = error.shortMessage || error.message;
  console.error('Error:', message.replace(/https?:\/\/[^\s"']+/g, '[RPC URL]'));
  process.exitCode = 1;
});
