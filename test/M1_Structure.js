// Importing expect so we can check if results are correct.
const { expect }  = require("chai");

// We need to import ether so our test can deploy and talk to contracts
const { ethers }  = require("hardhat");

describe("Milestone 1: Contract Structure", function () {

  it("deploys the contracts and sets the registrar", async function () {
    // Get test accounts from Hardhat.
    const [registrar] = await ethers.getSigners();

    // Prepare the LandHistory contract for deployment.
    const LandHistory = await ethers.getContractFactory("LandHistory");

    // Deploy LandHistory.
    const history = await LandHistory.deploy();

    // Wait until deployment is complete.
    await history.waitForDeployment();

    // Prepare the LandSaleEscrow contract for deployment.
    const LandSaleEscrow = await ethers.getContractFactory("LandSaleEscrow");

    // Deploy LandSaleEscrow and give it the LandHistory address.
    const escrow = await LandSaleEscrow.deploy(await history.getAddress());

    // Wait until deployment is complete.
    await escrow.waitForDeployment();

    // Check that the registrar is the person who deployed the contract.
    expect(await escrow.registrar()).to.equal(registrar.address);

    // Check that the system starts with zero registered lands.
    expect(await escrow.getLandCount()).to.equal(0n);
  });
});