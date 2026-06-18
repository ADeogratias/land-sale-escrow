const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Milestone 5: Approve Sale", function () {
  async function deployPrepareSale() {
    const [registrar, seller, buyer, stranger] = await ethers.getSigners();

    const LandSaleEscrow = await ethers.getContractFactory("LandSaleEscrow");
    const escrow = await LandSaleEscrow.deploy();
    await escrow.waitForDeployment();

    const price = ethers.parseEther("1");

    await escrow.registerLand(1, "KGL-001", "Kigali, Gasabo", seller.address);
    await escrow.connect(seller).listLandForSale(1, price);
    await escrow.connect(buyer).buyLand(1, { value: price });

    return { registrar, seller, buyer, stranger, escrow, price };
  }

  it("allows registrar to approve sale", async function () {
    const { seller, buyer, escrow, price } = await deployPrepareSale();

    // Contract should hold ETH before approval.
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(price);

    // Registrar approves sale.
    await expect(escrow.approveSale(1)).to.emit(escrow, "LandSaleApproved");

    // Read land after approval.
    const land = await escrow.lands(0);

    // Buyer should now own the land.
    expect(land.owner).to.equal(buyer.address);

    // Land should be sold.
    expect(land.isSold).to.equal(true);

    // Land should not be for sale anymore.
    expect(land.isForSale).to.equal(false);

    // Buyer field should be reset.
    expect(land.buyer).to.equal(ethers.ZeroAddress);

    // Contract should release ETH to seller, so balance becomes zero.
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0n);

    // Old owner should no longer have this land ID.
    expect(await escrow.getOwnerLandIds(seller.address)).to.deep.equal([]);

    // New owner should now have this land ID.
    expect(await escrow.getOwnerLandIds(buyer.address)).to.deep.equal([1n]);
  });

  it("blocks non-registrar from approving sale", async function () {
    const { stranger, escrow } = await deployPrepareSale();

    // Stranger is not registrar.
    await expect(
      escrow.connect(stranger).approveSale(1)
    ).to.be.revertedWithCustomError(escrow, "NotRegistrar");
  });

  it("rejects approval when no buyer has paid", async function () {
    const [registrar, seller] = await ethers.getSigners();

    const LandSaleEscrow = await ethers.getContractFactory("LandSaleEscrow");
    const escrow = await LandSaleEscrow.deploy();
    await escrow.waitForDeployment();

    await escrow.registerLand(1, "KGL-001", "Kigali, Gasabo", seller.address);

    // No buyer has paid yet.
    await expect(
      escrow.approveSale(1)
    ).to.be.revertedWithCustomError(escrow, "NoPendingBuyer");
  });
});