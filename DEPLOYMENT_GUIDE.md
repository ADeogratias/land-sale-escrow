# Beginner's Deployment Guide

This guide explains what to copy, where to put it, and why it is needed. The complete working files remain in the project:

- `contracts/LandSaleEscrow.sol` contains the complete smart contracts.
- `scripts/land-cli.js` contains the complete, heavily commented terminal program.
- `hardhat.config.js` contains the complete Hardhat configuration.
- `package.json` contains the complete project commands.

The smaller code pieces below are taken from those complete files. They help us learn one idea at a time without staring at the whole elephant at once.

## The four pieces of the project

Think of the project as a small office:

1. The Solidity contract is the rule book.
2. Hardhat is the pretend blockchain and workshop.
3. ethers is the messenger between JavaScript and the blockchain.
4. `land-cli.js` is the person at the front desk asking what we want to do.

## Step 1: Check `package.json`

Open `package.json`. The complete `scripts` part should contain:

```json
"scripts": {
  "compile": "hardhat compile",
  "node": "hardhat node",
  "land": "hardhat run scripts/land-cli.js"
}
```

Where to copy it: replace the existing `scripts` object inside `package.json`.

Why it is needed:

- `npm run compile` checks and translates Solidity into blockchain bytecode.
- `npm run node` starts the pretend local blockchain.
- `npm run land -- --network localhost` starts our menu and connects it to that blockchain.

JSON does not allow comments, so explanations belong in this guide instead of inside `package.json`.

## Step 2: Check the complete Hardhat configuration

Open `hardhat.config.js`. Its complete local-learning version is:

```javascript
// Load the Hardhat toolbox. It includes ethers and testing helpers.
require("@nomicfoundation/hardhat-toolbox");

// Export the settings that Hardhat should use.
module.exports = {
  // Compile the contracts using this Solidity compiler family.
  solidity: "0.8.28",
};
```

Where to copy it: this is the whole `hardhat.config.js` file.

Why it is needed: Hardhat reads this file before compiling, starting a node, or deploying. Hardhat already knows that a node started with `hardhat node` is available as the `localhost` network, so we do not need to write an extra localhost block.

## Step 3: Install the tools

From the project folder, run:

```bash
npm install
```

This reads `package.json` and downloads Hardhat and its toolbox into `node_modules`. Run it once after downloading the project, and again when dependencies change.

## Step 4: Compile the contracts

```bash
npm run compile
```

Compilation is like translating a story into a language the blockchain understands. Success means the Solidity is valid. It does not mean the contracts are deployed.

The generated files go into `artifacts/` and `cache/`. Do not hand-edit them; Hardhat recreates them.

## Step 5: Start localhost in terminal 1

```bash
npm run node
```

Keep this terminal open. It is now acting like the blockchain computer.

It prints test account addresses, private keys, and pretend ETH. Those keys are published learning keys. Never send real money to them and never reuse them outside local testing.

## Step 6: Start the menu in terminal 2

Open a second terminal in the same project folder:

```bash
npm run land -- --network localhost
```

Why `--network localhost` matters: without it, Hardhat creates a short-lived blockchain inside the command. With it, the program talks to the node that is still running in terminal 1.

## Step 7: Understand the deployment code

This is the most important deployment part from `scripts/land-cli.js`:

```javascript
// Make a factory that knows how to build LandHistory.
const History = await ethers.getContractFactory("LandHistory");

// Deploy LandHistory and wait for its transaction to enter a block.
history = await History.deploy();
await confirmed("LandHistory deployment", history.deploymentTransaction());

// Make a factory for the main escrow contract.
const Escrow = await ethers.getContractFactory("LandSaleEscrow");

// Give the new escrow the history contract's address.
escrow = await Escrow.deploy(await history.getAddress());
await confirmed("LandSaleEscrow deployment", escrow.deploymentTransaction());

// Allow only this escrow contract to add official transfer history.
await confirmed(
  "History writer approval",
  await history.setApprovedWriter(await escrow.getAddress(), true),
);
```

Where it belongs: inside the `deployOrConnect()` function in `scripts/land-cli.js`. It is already there in the complete file; copy this block only when rebuilding that function yourself.

Why history is deployed first: the escrow constructor asks for the history address. We cannot give it an address until history exists.

## Step 8: Deploy

Choose menu option **1 — Deploy or reconnect**.

The console performs three transactions:

1. create `LandHistory`;
2. create `LandSaleEscrow` and connect it to history;
3. approve escrow as a history writer.

For each transaction, this helper waits for proof:

```javascript
async function confirmed(label, transaction) {
  // The transaction hash is its unique tracking number.
  console.log(`${label} submitted: ${transaction.hash}`);

  // Wait until a validator puts the transaction into a block.
  const receipt = await transaction.wait();

  // Read that block so we can display its unique hash too.
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  console.log(`Confirmed in block ${receipt.blockNumber}: ${block.hash}`);
  console.log(`Gas used: ${receipt.gasUsed}`);
}
```

## Step 9: Know that deployment worked

Choose **2 — Verify deployed contracts**. Confirm that:

- both contract addresses are displayed;
- `History approved` is `true`;
- `Bytecode present` is `true`;
- the registrar matches local account 0.

An address tells us where to look. Non-empty bytecode proves that a contract actually lives there.

The addresses are saved in `deployments/localhost-31337.json`. The number `31337` is Hardhat's local chain ID. This file is a bookmark, not the contract itself.

If the node restarts, its temporary blockchain disappears. Option 1 checks the saved addresses, notices that no bytecode exists, and safely deploys again.

## Step 10: What happens during a land sale

The important JavaScript calls are:

```javascript
// Registrar creates the first land record.
await escrow.connect(registrar).registerLand(landId, plot, location, owner.address);

// Owner advertises the land and its price.
await escrow.connect(owner).listLandForSale(landId, priceInWei);

// Buyer sends the price into escrow instead of directly to the seller.
await escrow.connect(buyer).buyLand(landId, { value: land.price });

// Registrar approves ownership transfer and releases payment to the seller.
await escrow.connect(registrar).approveSale(landId);
```

Where they belong: these calls already live inside `registerLand()`, `listLand()`, `buyLand()`, and `approveSale()` in the complete `scripts/land-cli.js` file.

Why `.connect(person)` matters: it chooses who signs the action. The contract checks the signer, not the name we give the JavaScript variable.

## Optional: prepare a public testnet such as Sepolia

Localhost is a private practice board. Sepolia is a public practice board shared across the internet. Testnet ETH has no real-world value, but deployment still requires testnet ETH for gas.

Do not change the config until you have an RPC URL and a dedicated test-only deployer private key. Then the complete `hardhat.config.js` can become:

```javascript
require("@nomicfoundation/hardhat-toolbox");

// Read secrets from the terminal environment, not from Git-tracked code.
const rpcUrl = process.env.SEPOLIA_RPC_URL;
const privateKey = process.env.DEPLOYER_PRIVATE_KEY;

module.exports = {
  solidity: "0.8.28",
  networks: {
    // Add Sepolia only when both secrets were supplied.
    ...(rpcUrl && privateKey
      ? {
          sepolia: {
            url: rpcUrl,
            accounts: [privateKey],
            chainId: 11155111,
          },
        }
      : {}),
  },
};
```

Set the secrets only in the current terminal:

```bash
export SEPOLIA_RPC_URL="YOUR_RPC_PROVIDER_URL"
export DEPLOYER_PRIVATE_KEY="YOUR_TEST_ONLY_PRIVATE_KEY"
npm run land -- --network sepolia
```

Never paste a wallet containing real funds into a classroom project, screenshot, chat, or Git repository. Start with a new test-only account.

## MetaMask step-by-step for localhost

MetaMask is applicable, but there are two levels of connection:

- It can connect to localhost, display local test ETH, and control an imported Hardhat test account.
- This terminal menu still signs actions through Hardhat. A browser frontend is required if every contract action should open a MetaMask confirmation window.

### A. Start the local chain

Run and keep this open:

```bash
npm run node
```

### B. Add the Hardhat network to MetaMask Extension

In MetaMask, open the network menu, choose **Add a custom network**, and enter:

| Field | Value |
|---|---|
| Network name | Hardhat Localhost |
| Default RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | `ETH` |
| Block explorer URL | Leave empty |

Save it. MetaMask's official guide confirms that custom nodes are added through the Networks area. If MetaMask runs on another computer or phone, `127.0.0.1` points to that device—not the development computer—so extra networking setup is required.

### C. Import one local test account

1. Look at terminal 1 and copy one Hardhat private key.
2. In MetaMask, open the account selector.
3. Choose **Add wallet**.
4. Choose **Import an account**.
5. Paste the private key and choose **Import**.
6. Select **Hardhat Localhost** and confirm that the account shows its pretend ETH.

Only do this with a disposable Hardhat key. MetaMask warns that anyone who knows a private key controls that account.

### D. See transactions and contracts

Keep both the node and menu running. Complete a demo in the terminal. MetaMask can show the imported account's balance changes. Contract addresses are printed by option 1 and stored in `deployments/localhost-31337.json`.

`LandSaleEscrow` is not an ERC-20 token, so do not use MetaMask's **Import token** button for it. It is an application contract, not a coin.

### E. Make MetaMask approve contract actions later

A browser page would use MetaMask's provider like this:

```javascript
// Ask MetaMask for permission to use the selected account.
const provider = new ethers.BrowserProvider(window.ethereum);
await provider.send("eth_requestAccounts", []);

// The signer is the MetaMask account that approves popup transactions.
const signer = await provider.getSigner();

// ABI explains the contract's functions; address tells ethers where it lives.
const escrow = new ethers.Contract(escrowAddress, escrowAbi, signer);

// This opens a MetaMask confirmation instead of using a Hardhat signer.
await escrow.buyLand(landId, { value: price });
```

This snippet belongs in browser JavaScript, not in `land-cli.js`. A complete web interface also needs HTML controls, the compiled contract ABI, network checks, user-friendly errors, and tests.

For current wallet instructions, see MetaMask's official guides for [adding a custom network](https://support.metamask.io/configure/networks/how-to-add-a-custom-network-rpc/), [using a local node](https://support.metamask.io/configure/networks/using-a-local-node/), and [importing an account](https://support.metamask.io/start/use-an-existing-wallet/).

## WSL launcher troubleshooting

If `npm` says `WSL 1 is not supported`, the shell is using Windows npm with Linux Node. Upgrade to WSL 2 or install Node and npm inside Linux, reopen the terminal, then check:

```bash
command -v node
command -v npm
```

Both should point to Linux locations before repeating the guide.
