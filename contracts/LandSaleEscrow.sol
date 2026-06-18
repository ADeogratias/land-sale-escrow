// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract LandSaleEscrow {
    address public registrar;

    struct Land {
        uint landId;
        string plotNumber;
        string location;
        uint price;
        address owner;
        address buyer;
        bool isForSale;
        bool isSold;
    }

    Land[] public lands;

    mapping(uint => bool) public landExistsById;
    mapping(uint => uint) public landIndexById;
    mapping(address => uint[]) public ownerToLandIds;

    error NotRegistrar();
    error LandAlreadyExists();
    error LandDoesNotExist();
    error NotLandOwner();
    error PriceMustBeAboveZero();
    error LandAlreadySold();
    error LandNotForSale();
    error SaleAlreadyPending();
    error OwnerCannotBuyOwnLand();
    error IncorrectPayment();
    error NoPendingBuyer();
    error PaymentTransferFailed();
    error DirectPaymentNotAllowed();

    event LandRegistered(uint indexed landId, string plotNumber, string location, address indexed owner);
    event LandListedForSale(uint indexed landId, uint price);
    event LandPurchaseStarted(uint indexed landId, address indexed buyer, uint amount);
    event LandSaleApproved(uint indexed landId, address indexed oldOwner, address indexed newOwner, uint price);

    constructor() {
        registrar = msg.sender;
    }

    modifier onlyRegistrar() {
        if (msg.sender != registrar) {
            revert NotRegistrar();
        }
        _;
    }

    modifier landMustExist(uint landId) {
        if (!landExistsById[landId]) {
            revert LandDoesNotExist();
        }
        _;
    }

    modifier onlyLandOwner(uint landId) {
        uint index = landIndexById[landId];

        if (lands[index].owner != msg.sender) {
            revert NotLandOwner();
        }

        _;
    }

    function registerLand(
        uint landId,
        string calldata plotNumber,
        string calldata location,
        address firstOwner
    ) external onlyRegistrar {
        if (landExistsById[landId]) {
            revert LandAlreadyExists();
        }

        landExistsById[landId] = true;
        landIndexById[landId] = lands.length;

        lands.push(
            Land({
                landId: landId,
                plotNumber: plotNumber,
                location: location,
                price: 0,
                owner: firstOwner,
                buyer: address(0),
                isForSale: false,
                isSold: false
            })
        );

        ownerToLandIds[firstOwner].push(landId);

        emit LandRegistered(landId, plotNumber, location, firstOwner);
    }

    function listLandForSale(
        uint landId,
        uint price
    ) external landMustExist(landId) onlyLandOwner(landId) {
        if (price == 0) {
            revert PriceMustBeAboveZero();
        }

        uint index = landIndexById[landId];
        Land storage land = lands[index];

        if (land.isSold) {
            revert LandAlreadySold();
        }

        land.price = price;
        land.isForSale = true;

        emit LandListedForSale(landId, price);
    }

    function buyLand(uint landId) external payable landMustExist(landId) {
        uint index = landIndexById[landId];
        Land storage land = lands[index];

        if (!land.isForSale) {
            revert LandNotForSale();
        }

        if (land.isSold) {
            revert LandAlreadySold();
        }

        if (land.buyer != address(0)) {
            revert SaleAlreadyPending();
        }

        if (msg.sender == land.owner) {
            revert OwnerCannotBuyOwnLand();
        }

        if (msg.value != land.price) {
            revert IncorrectPayment();
        }

        land.buyer = msg.sender;

        emit LandPurchaseStarted(landId, msg.sender, msg.value);
    }
    
    // Registrar approves the sale.
    function approveSale(uint landId) external onlyRegistrar landMustExist(landId) {
        uint index = landIndexById[landId];
        Land storage land = lands[index];

        // There must be a buyer waiting.
        if (land.buyer == address(0)) {
            revert NoPendingBuyer();
        }

        // Save important values before changing state.
        address oldOwner = land.owner;
        address newOwner = land.buyer;
        uint salePrice = land.price;

        // Update land ownership.
        land.owner = newOwner;

        // Mark land as sold and no longer for sale.
        land.isSold = true;
        land.isForSale = false;

        // Reset buyer field because sale is complete.
        land.buyer = address(0);

        // Add land to new owner's list.
        ownerToLandIds[newOwner].push(landId);

        // Remove land from old owner's list.
        _removeLandFromOwner(oldOwner, landId);

        // Send ETH to old owner/seller.
        (bool success, ) = payable(oldOwner).call{value: salePrice}("");

        // Stop if payment fails.
        if (!success) {
            revert PaymentTransferFailed();
        }

        // Emit event showing the sale is complete.
        emit LandSaleApproved(landId, oldOwner, newOwner, salePrice);
    }

    // Internal helper function to remove land from previous owner.
    function _removeLandFromOwner(address owner, uint landId) internal {
        uint[] storage ownerLands = ownerToLandIds[owner];

        for (uint i = 0; i < ownerLands.length; i++) {
            if (ownerLands[i] == landId) {
                ownerLands[i] = ownerLands[ownerLands.length - 1];
                ownerLands.pop();
                break;
            }
        }
    }

    function getOwnerLandIds(address owner) external view returns (uint[] memory) {
        return ownerToLandIds[owner];
    }

    function getLandCount() external view returns (uint) {
        return lands.length;
    }

    receive() external payable {
        revert DirectPaymentNotAllowed();
    }
}