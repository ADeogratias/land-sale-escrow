const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Milestone 6: History Contract and Interface", function () {
  async function deployFullSystem() {
    const [registrar, seller, buyer, stranger] = await ethers.getSigners();

    // Deploy LandHistory first.
    const LandHistory = await ethers.getContractFactory("LandHistory");
    const history = await LandHistory.deploy();
    await history.waitForDeployment();

    // Deploy LandSaleEscrow and pass LandHistory address.
    const LandSaleEscrow = await ethers.getContractFactory("LandSaleEscrow");
    const escrow = await LandSaleEscrow.deploy(await history.getAddress());
    await escrow.waitForDeployment();

    // Approve escrow contract to write into LandHistory.
    await history.setApprovedWriter(await escrow.getAddress(), true);

    return { registrar, seller, buyer, stranger, history, escrow };
  }

  it("blocks normal users from writing history directly", async function () {
    const { seller, buyer, history } = await deployFullSystem();

    // Normal account tries to record transfer directly.
    await expect(
      history.recordTransfer(1, seller.address, buyer.address)
    ).to.be.revertedWithCustomError(history, "NotApprovedWriter");
  });

  it("records transfer history when sale is approved", async function () {
    const { seller, buyer, history, escrow } = await deployFullSystem();

    const price = ethers.parseEther("1");

    // Register land.
    await escrow.registerLand(1, "KGL-001", "Kigali, Gasabo", seller.address);

    // Seller lists land.
    await escrow.connect(seller).listLandForSale(1, price);

    // Buyer pays.
    await escrow.connect(buyer).buyLand(1, { value: price });

    // Approving sale should call LandHistory and emit TransferRecorded.
    await expect(
      escrow.approveSale(1)
    ).to.emit(history, "TransferRecorded");

    // Check one record was created.
    expect(await history.getRecordCount()).to.equal(1n);

    // Read first history record.
    const record = await history.records(0);

    // Check record values.
    expect(record.landId).to.equal(1n);
    expect(record.oldOwner).to.equal(seller.address);
    expect(record.newOwner).to.equal(buyer.address);
    expect(record.timestamp).to.be.greaterThan(0n);
    expect(record.blockNumber).to.be.greaterThan(0n);
  });
});