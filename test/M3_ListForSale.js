const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Milestone 3: List Land For Sale", function () {
  async function deployAndRegister() {
    const [registrar, seller, buyer] = await ethers.getSigners();

    const LandSaleEscrow = await ethers.getContractFactory("LandSaleEscrow");
    const escrow = await LandSaleEscrow.deploy();
    await escrow.waitForDeployment();

    // Register land for seller before listing.
    await escrow.registerLand(1, "KGL-001", "Kigali, Gasabo", seller.address);

    return { registrar, seller, buyer, escrow };
  }

  it("allows land owner to list land for sale", async function () {
    const { seller, escrow } = await deployAndRegister();

    const price = ethers.parseEther("1");

    // Seller lists land.
    await expect(
      escrow.connect(seller).listLandForSale(1, price)
    ).to.emit(escrow, "LandListedForSale");

    // Read land.
    const land = await escrow.lands(0);

    // Confirm price and sale status.
    expect(land.price).to.equal(price);
    expect(land.isForSale).to.equal(true);
  });

  it("blocks non-owner from listing land", async function () {
    const { buyer, escrow } = await deployAndRegister();

    const price = ethers.parseEther("1");

    // Buyer is not the owner, so this should fail.
    await expect(
      escrow.connect(buyer).listLandForSale(1, price)
    ).to.be.revertedWithCustomError(escrow, "NotLandOwner");
  });

  it("rejects zero price", async function () {
    const { seller, escrow } = await deployAndRegister();

    // Price zero should fail.
    await expect(
      escrow.connect(seller).listLandForSale(1, 0)
    ).to.be.revertedWithCustomError(escrow, "PriceMustBeAboveZero");
  });

  it("rejects land that does not exist", async function () {
    const { seller, escrow } = await deployAndRegister();

    const price = ethers.parseEther("1");

    // Land 999 does not exist.
    await expect(
      escrow.connect(seller).listLandForSale(999, price)
    ).to.be.revertedWithCustomError(escrow, "LandDoesNotExist");
  });
});