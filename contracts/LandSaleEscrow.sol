// SPDX-License-Identifier: MIT
// This license line tells people how this code can be reused.

pragma solidity ^0.8.20;
// This tells Solidity to compile this file using version 0.8.20 or compatible 0.8.x versions.

contract LandSaleEscrow {
    // This variable stores the address of the registrar/admin.
    address public registrar;

    // This struct groups all important details about one land plot.
    struct Land {
        // This is the unique land ID.
        uint landId;

        // This is the human-readable plot number, for example "KGL-001".
        string plotNumber;

        // This is the human-readable location, for example "Kigali, Gasabo".
        string location;

        // This is the current owner of the land.
        address owner;
    }

    // This array stores all registered lands.
    Land[] public lands;

    // This mapping checks whether a land ID already exists.
    mapping(uint => bool) public landExistsById;

    // This mapping stores where each land ID is located inside the lands array.
    mapping(uint => uint) public landIndexById;

    // This constructor runs only once when the contract is deployed.
    constructor() {
        // msg.sender is the address deploying the contract, so that address becomes registrar.
        registrar = msg.sender;
    }

    // This function registers a new land record.
    function registerLand(
        uint landId,
        string calldata plotNumber,
        string calldata location,
        address firstOwner
    ) external {
        // Save that this land ID now exists.
        landExistsById[landId] = true;

        // Save the position where this land will be stored in the array.
        landIndexById[landId] = lands.length;

        // Add the new land record into the lands array.
        lands.push(
            Land({
                landId: landId,
                plotNumber: plotNumber,
                location: location,
                owner: firstOwner
            })
        );
    }

    // This function reads how many lands are registered.
    function getLandCount() external view returns (uint) {
        // Return the number of items in the lands array.
        return lands.length;
    }
}

