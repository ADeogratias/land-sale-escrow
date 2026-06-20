// ================================================================
// LAND SALE ESCROW - FRIENDLY TERMINAL PROGRAM
// ================================================================
// Imagine the blockchain is a shared school notebook.
// Nobody may secretly erase a page after it has been written.
// This program lets us read that notebook and add new pages to it.

// Hardhat gives us a pretend blockchain for learning.
// ethers is the helper that lets JavaScript talk to that blockchain.
const { ethers, network } = require("hardhat");

// fs means "file system". It lets us save contract addresses in a file.
const fs = require("node:fs");

// path builds file names that work on Windows, macOS, and Linux.
const path = require("node:path");

// readline lets the program ask a question and wait for an answer.
const readline = require("node:readline/promises");

// process.stdin is what the person types.
// process.stdout is what the terminal displays.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// __dirname is the scripts folder. ".." means go up to the project folder.
// Therefore this points to land-sale-escrow/deployments.
const deploymentDirectory = path.join(__dirname, "..", "deployments");

// These boxes start empty. They are filled after deployment or reconnection.
let history;
let escrow;
let accounts = [];
let deploymentFile;

// Ask one terminal question. trim() removes accidental spaces around the answer.
const ask = async (question) => (await rl.question(question)).trim();

// A wallet address is long. This turns 0x1234...ABCD into a short display name.
const short = (address) => `${address.slice(0, 6)}...${address.slice(-4)}`;

// Show all available pretend users and return the one the learner chooses.
async function chooseAccount(label) {
  console.log(`\nChoose the ${label}:`);
  accounts.forEach((account, index) => console.log(`  ${index}: ${short(account.address)}`));
  const index = Number(await ask("Account number: "));
  // Stop this one action when the choice is not a whole, existing number.
  // The main menu catches this error, so the whole program does not crash.
  if (!Number.isInteger(index) || !accounts[index]) {
    throw new Error("Choose a valid account number.");
  }
  return accounts[index];
}

// Blockchain actions need contract addresses. Give a helpful reminder when
// option 1 has not been used yet.
function requireContracts() {
  if (!history || !escrow) throw new Error("Deploy or reconnect first (option 1).");
}

// Smart contracts sometimes return machine-like error data.
// This function tries to turn it into a short name a human can understand.
function friendlyError(error) {
  const data = error?.data ?? error?.error?.data ?? error?.info?.error?.data;
  for (const contract of [escrow, history]) {
    if (!contract || !data) continue;
    try {
      const decoded = contract.interface.parseError(data);
      if (decoded) return `Contract rejected the action: ${decoded.name}`;
    } catch (_) {
      // This contract did not recognize the error. Try the next contract.
    }
  }
  return error.shortMessage || error.reason || error.message || String(error);
}

// Wait until a transaction is placed inside a block.
// A submitted transaction is like a letter in the post.
// A confirmed transaction is like a delivered and signed-for letter.
async function confirmed(label, transaction) {
  console.log(`${label} submitted: ${transaction.hash}`);
  const receipt = await transaction.wait();
  const block = await ethers.provider.getBlock(receipt.blockNumber);
  console.log(`Confirmed in block ${receipt.blockNumber}: ${block.hash}`);
  console.log(`Gas used: ${receipt.gasUsed}`);
}

// Save the two new contract addresses so we can find them next time.
async function saveDeployment() {
  // Create the deployments folder if it does not exist yet.
  fs.mkdirSync(deploymentDirectory, { recursive: true });
  fs.writeFileSync(deploymentFile, `${JSON.stringify({
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    landHistory: await history.getAddress(),
    landSaleEscrow: await escrow.getAddress(),
  }, null, 2)}\n`);
}

// Try to reconnect to contracts that were deployed earlier.
async function connectSaved() {
  // No address file means there is nothing to reconnect to.
  if (!fs.existsSync(deploymentFile)) return false;

  // Read the JSON file and turn its text back into a JavaScript object.
  const saved = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));

  // getCode asks, "Is contract bytecode living at this address?"
  // "0x" means the address is empty, often because the local node restarted.
  if ((await ethers.provider.getCode(saved.landHistory)) === "0x" ||
      (await ethers.provider.getCode(saved.landSaleEscrow)) === "0x") return false;
  history = await ethers.getContractAt("LandHistory", saved.landHistory);
  escrow = await ethers.getContractAt("LandSaleEscrow", saved.landSaleEscrow);
  console.log(`Reconnected to LandHistory:    ${saved.landHistory}`);
  console.log(`Reconnected to LandSaleEscrow: ${saved.landSaleEscrow}`);
  return true;
}

// Menu option 1: reuse live contracts, or build fresh ones when needed.
async function deployOrConnect() {
  if (await connectSaved()) return;
  console.log("No live saved deployment found. Deploying a fresh system...");

  // A factory is a machine that knows how to build one kind of contract.
  const History = await ethers.getContractFactory("LandHistory");

  // Build the history contract and wait for its block confirmation.
  history = await History.deploy();
  await confirmed("LandHistory deployment", history.deploymentTransaction());

  // The escrow contract needs the history contract's address when it is born.
  const Escrow = await ethers.getContractFactory("LandSaleEscrow");
  escrow = await Escrow.deploy(await history.getAddress());
  await confirmed("LandSaleEscrow deployment", escrow.deploymentTransaction());

  // Only approved writers may add history. Give escrow that permission.
  await confirmed("History writer approval", await history.setApprovedWriter(await escrow.getAddress(), true));
  await saveDeployment();
  console.log(`LandHistory:    ${await history.getAddress()}`);
  console.log(`LandSaleEscrow: ${await escrow.getAddress()}`);
  console.log(`Addresses saved in ${path.relative(process.cwd(), deploymentFile)}`);
}

// Menu option 2: prove that the contracts are alive and connected correctly.
async function showContracts() {
  requireContracts();
  const historyAddress = await history.getAddress();
  const escrowAddress = await escrow.getAddress();
  console.log(`LandHistory:      ${historyAddress}`);
  console.log(`LandSaleEscrow:   ${escrowAddress}`);
  console.log(`Registrar:        ${await escrow.registrar()}`);
  console.log(`History approved: ${await history.approvedWriters(escrowAddress)}`);
  console.log(`Registered lands: ${await escrow.getLandCount()}`);
  console.log(`History records:  ${await history.getRecordCount()}`);
  console.log(`Bytecode present: ${(await ethers.provider.getCode(escrowAddress)) !== "0x"}`);
}

// Menu option 3: show every pretend user and how much ETH each one has.
async function showAccounts() {
  console.log("\nAccounts and balances:");
  for (let index = 0; index < accounts.length; index += 1) {
    const balance = await ethers.provider.getBalance(accounts[index].address);
    console.log(`  ${index}: ${accounts[index].address}  ${ethers.formatEther(balance)} ETH`);
  }
  if (escrow) console.log(`  escrow: ${await escrow.getAddress()}  ${ethers.formatEther(await ethers.provider.getBalance(await escrow.getAddress()))} ETH`);
}

// Menu option 4: the registrar creates a land record for its first owner.
async function registerLand() {
  requireContracts();
  const registrar = await chooseAccount("registrar");
  const owner = await chooseAccount("first owner");
  const landId = await ask("Land ID (whole number): ");
  const plot = await ask("Plot number: ");
  const location = await ask("Location: ");
  await confirmed("Land registration", await escrow.connect(registrar).registerLand(landId, plot, location, owner.address));
}

// Menu option 5: the owner chooses a selling price.
async function listLand() {
  requireContracts();
  const owner = await chooseAccount("current owner");
  const landId = await ask("Land ID: ");
  const eth = await ask("Sale price in ETH: ");
  // Humans type ETH as "1". The contract needs the much smaller wei unit.
  const priceInWei = ethers.parseEther(eth);
  await confirmed(
    "Land listing",
    await escrow.connect(owner).listLandForSale(landId, priceInWei),
  );
}

// Menu option 6: the buyer places the exact price inside the escrow contract.
async function buyLand() {
  requireContracts();
  const buyer = await chooseAccount("buyer");
  const landId = await ask("Land ID: ");
  if (!(await escrow.landExistsById(landId))) throw new Error("That land ID is not registered.");
  // The contract stores lands in a list, so first find this land's list position.
  const landIndex = await escrow.landIndexById(landId);
  const land = await escrow.lands(landIndex);
  console.log(`Sending the exact listed price: ${ethers.formatEther(land.price)} ETH`);
  await confirmed("Purchase", await escrow.connect(buyer).buyLand(landId, { value: land.price }));
}

// Menu option 7: the registrar approves the ownership change and seller payment.
async function approveSale() {
  requireContracts();
  const registrar = await chooseAccount("registrar");
  const landId = await ask("Land ID: ");
  await confirmed("Sale approval", await escrow.connect(registrar).approveSale(landId));
}

// Menu option 8: read one land record without changing the blockchain.
async function showLand() {
  requireContracts();
  const landId = await ask("Land ID: ");
  if (!(await escrow.landExistsById(landId))) throw new Error("That land ID is not registered.");
  const land = await escrow.lands(await escrow.landIndexById(landId));
  console.log({ landId: land.landId.toString(), plotNumber: land.plotNumber,
    location: land.location, priceETH: ethers.formatEther(land.price), owner: land.owner,
    pendingBuyer: land.buyer, isForSale: land.isForSale, isSold: land.isSold });
}

// Menu option 9: print every completed ownership transfer.
async function showHistory() {
  requireContracts();
  const count = Number(await history.getRecordCount());
  if (count === 0) return console.log("No completed transfers yet.");
  for (let index = 0; index < count; index += 1) {
    const record = await history.records(index);
    console.log({ record: index, landId: record.landId.toString(), oldOwner: record.oldOwner,
      newOwner: record.newOwner, time: new Date(Number(record.timestamp) * 1000).toISOString(),
      block: record.blockNumber.toString() });
  }
}

// Menu option 10: show recent pages (blocks) in our blockchain notebook.
async function showBlocks() {
  const latest = await ethers.provider.getBlockNumber();
  const requested = Number(await ask("How many recent blocks? [5]: ") || "5");
  if (!Number.isInteger(requested) || requested < 1) throw new Error("Enter a positive whole number.");
  for (let number = Math.max(0, latest - requested + 1); number <= latest; number += 1) {
    const block = await ethers.provider.getBlock(number);
    console.log(`Block ${block.number}: ${block.hash} | parent ${block.parentHash} | ${block.transactions.length} tx`);
  }
}

// Menu option 11: perform a complete example automatically.
async function runDemo() {
  requireContracts();
  // Use the clock to make a land ID that is unlikely to have been used already.
  const suffix = Date.now().toString().slice(-6);
  const landId = Number(suffix);
  // Skip account 0 (the registrar), then name accounts 1 and 2.
  const [, seller, buyer] = accounts;
  const price = ethers.parseEther("1");
  console.log(`Demo: registrar=0, seller=1, buyer=2, land=${landId}, price=1 ETH`);
  await confirmed("Register", await escrow.registerLand(landId, `DEMO-${suffix}`, "Demo location", seller.address));
  await confirmed("List", await escrow.connect(seller).listLandForSale(landId, price));
  await confirmed("Buy", await escrow.connect(buyer).buyLand(landId, { value: price }));
  console.log(`Escrow holds ${ethers.formatEther(await ethers.provider.getBalance(await escrow.getAddress()))} ETH`);
  await confirmed("Registrar approval", await escrow.approveSale(landId));
  console.log(`Escrow holds ${ethers.formatEther(await ethers.provider.getBalance(await escrow.getAddress()))} ETH`);
  console.log("Demo completed. Inspect it with options 3, 8, 9 and 10.");
}

// This is the menu's map: each number points to the function it should run.
const actions = { "1": deployOrConnect, "2": showContracts, "3": showAccounts,
  "4": registerLand, "5": listLand, "6": buyLand, "7": approveSale,
  "8": showLand, "9": showHistory, "10": showBlocks, "11": runDemo };

// Print the choices. Printing does not change anything on the blockchain.
function menu() {
  console.log(`\nLAND SALE ESCROW
  1. Deploy or reconnect
  2. Verify deployed contracts
  3. Show users and balances
  4. Registrar: register land
  5. Owner: list land for sale
  6. Buyer: pay into escrow
  7. Registrar: approve sale
  8. Inspect land
  9. Show transfer history
 10. Show recent blocks
 11. Run a complete demo
  0. Exit`);
}

// main() starts the application and keeps it alive until the person exits.
async function main() {
  // Hardhat gives us ready-made local users with pretend ETH.
  accounts = await ethers.getSigners();

  // A chain ID is the blockchain's ID card number.
  const chainId = (await ethers.provider.getNetwork()).chainId;

  // Use a different saved-address file for each network.
  deploymentFile = path.join(deploymentDirectory, `${network.name}-${chainId}.json`);
  console.log(`Connected to ${network.name} (chain ${chainId}) at block ${await ethers.provider.getBlockNumber()}.`);
  // Keep showing the menu. "break" below is the only normal way out.
  while (true) {
    menu();
    const choice = await ask("\nChoose an option: ");
    if (choice === "0" || choice.toLowerCase() === "exit") break;
    if (!actions[choice]) { console.log("Unknown option. Choose a menu number."); continue; }
    // Try only the selected action. If it fails, catch its error and loop again.
    try { await actions[choice](); }
    catch (error) {
      console.error(`\nAction failed: ${friendlyError(error)}`);
      console.error("Nothing crashed—you can correct the input and choose another option.");
    }
  }
}

// Start the program. finally() closes the keyboard reader even after an error.
main()
  .catch((error) => console.error(`Fatal startup error: ${friendlyError(error)}`))
  .finally(() => rl.close());
