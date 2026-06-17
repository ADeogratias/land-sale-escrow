const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Milestone 2: Register Land", function () {
  async function deployContract() {
    // Get fake accounts.
    const [registrar, seller, stranger] = await ethers.getSigners();

    // Prepare contract for deployment.
    const LandSaleEscrow = await ethers.getContractFactory("LandSaleEscrow");

    // Deploy contract.
    const escrow = await LandSaleEscrow.deploy();

    // Wait for deployment.
    await escrow.waitForDeployment();

    // Return useful variables.
    return { registrar, seller, stranger, escrow };
  }

  it("allows registrar to register land", async function () {
    const { seller, escrow } = await deployContract();

    // Registrar registers land.
    await expect(
      escrow.registerLand(1, "KGL-001", "Kigali, Gasabo", seller.address)
    ).to.emit(escrow, "LandRegistered");

    // Land count should now be 1.
    expect(await escrow.getLandCount()).to.equal(1n);

    // Read the first land record.
    const land = await escrow.lands(0);

    // Confirm stored data.
    expect(land.landId).to.equal(1n);
    expect(land.plotNumber).to.equal("KGL-001");
    expect(land.location).to.equal("Kigali, Gasabo");
    expect(land.owner).to.equal(seller.address);
    expect(land.price).to.equal(0n);
    expect(land.buyer).to.equal(ethers.ZeroAddress);
    expect(land.isForSale).to.equal(false);
    expect(land.isSold).to.equal(false);
  });

  it("blocks non-registrar from registering land", async function () {
    const { seller, stranger, escrow } = await deployContract();

    // Stranger tries to register land.
    await expect(
      escrow
        .connect(stranger)
        .registerLand(1, "KGL-001", "Kigali, Gasabo", seller.address)
    ).to.be.revertedWithCustomError(escrow, "NotRegistrar");
  });

  it("rejects duplicate land ID", async function () {
    const { seller, escrow } = await deployContract();

    // Register land once.
    await escrow.registerLand(1, "KGL-001", "Kigali, Gasabo", seller.address);

    // Try registering same land ID again.
    await expect(
      escrow.registerLand(1, "KGL-001-B", "Kigali, Gasabo", seller.address)
    ).to.be.revertedWithCustomError(escrow, "LandAlreadyExists");
  });
});