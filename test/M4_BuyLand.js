const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Milestone 4: Buy Land With ETH", function () {
  async function deployRegisterAndList() {
    const [registrar, seller, buyer, secondBuyer] = await ethers.getSigners();

    const LandSaleEscrow = await ethers.getContractFactory("LandSaleEscrow");
    const escrow = await LandSaleEscrow.deploy();
    await escrow.waitForDeployment();

    const price = ethers.parseEther("1");

    await escrow.registerLand(1, "KGL-001", "Kigali, Gasabo", seller.address);
    await escrow.connect(seller).listLandForSale(1, price);

    return { registrar, seller, buyer, secondBuyer, escrow, price };
  }

  it("allows buyer to pay exact price", async function () {
    const { buyer, escrow, price } = await deployRegisterAndList();

    // Buyer sends exactly 1 ETH.
    await expect(
      escrow.connect(buyer).buyLand(1, { value: price })
    ).to.emit(escrow, "LandPurchaseStarted");

    // Read land.
    const land = await escrow.lands(0);

    // Buyer should be saved.
    expect(land.buyer).to.equal(buyer.address);

    // Contract should hold the ETH.
    const balance = await ethers.provider.getBalance(await escrow.getAddress());
    expect(balance).to.equal(price);
  });

  it("rejects wrong payment amount", async function () {
    const { buyer, escrow } = await deployRegisterAndList();

    // Buyer sends less than price.
    await expect(
      escrow.connect(buyer).buyLand(1, { value: ethers.parseEther("0.5") })
    ).to.be.revertedWithCustomError(escrow, "IncorrectPayment");
  });

  it("blocks owner from buying own land", async function () {
    const { seller, escrow, price } = await deployRegisterAndList();

    // Seller tries to buy own land.
    await expect(
      escrow.connect(seller).buyLand(1, { value: price })
    ).to.be.revertedWithCustomError(escrow, "OwnerCannotBuyOwnLand");
  });

  it("blocks second buyer after one buyer has paid", async function () {
    const { buyer, secondBuyer, escrow, price } = await deployRegisterAndList();

    // First buyer pays.
    await escrow.connect(buyer).buyLand(1, { value: price });

    // Second buyer tries to buy same land.
    await expect(
      escrow.connect(secondBuyer).buyLand(1, { value: price })
    ).to.be.revertedWithCustomError(escrow, "SaleAlreadyPending");
  });
});