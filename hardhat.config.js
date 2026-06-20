// Load Hardhat's toolbox.
// Think of it as opening a toolbox that contains ethers, testing helpers,
// and other useful tools for building and checking smart contracts.
require("@nomicfoundation/hardhat-toolbox");

// Give these settings to Hardhat whenever we run a Hardhat command.
module.exports = {
  // Use the Solidity 0.8.28 compiler to translate our contract.
  // LandSaleEscrow.sol asks for ^0.8.20, so 0.8.28 is a compatible version.
  solidity: "0.8.28",
};
