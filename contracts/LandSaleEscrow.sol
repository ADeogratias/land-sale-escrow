// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;



// Interface tells LandSaleEscrow how to call LandHistory.
// It only includes the function we need.
interface ILandHistory {
    function recordTransfer(
        uint landId,
        address oldOwner,
        address newOwner
    ) external;
}

// This base contract stores registrar logic.
// Both LandHistory and LandSaleEscrow reuse it through inheritance.
contract RegistrarAccess {
    address public registrar;

    error NotRegistrar();

    constructor() {
        registrar = msg.sender;
    }

    modifier onlyRegistrar() {
        if (msg.sender != registrar) {
            revert NotRegistrar();
        }
        _;
    }
}

// This contract records ownership transfer history.
contract LandHistory is RegistrarAccess {
    struct TransferRecord {
        uint landId;
        address oldOwner;
        address newOwner;
        uint timestamp;
        uint blockNumber;
    }

    TransferRecord[] public records;

    mapping(address => bool) public approvedWriters;

    error NotApprovedWriter();

    event WriterApprovalChanged(address indexed writer, bool approved);

    event TransferRecorded(
        uint indexed landId,
        address indexed oldOwner,
        address indexed newOwner
    );

    modifier onlyApprovedWriter() {
        if (!approvedWriters[msg.sender]) {
            revert NotApprovedWriter();
        }
        _;
    }

    // Registrar approves which contract can record history.
    function setApprovedWriter(address writer, bool approved) external onlyRegistrar {
        approvedWriters[writer] = approved;

        emit WriterApprovalChanged(writer, approved);
    }

    // Approved writer records transfer history.
    function recordTransfer(
        uint landId,
        address oldOwner,
        address newOwner
    ) external onlyApprovedWriter {
        records.push(
            TransferRecord({
                landId: landId,
                oldOwner: oldOwner,
                newOwner: newOwner,
                timestamp: block.timestamp,
                blockNumber: block.number
            })
        );

        emit TransferRecorded(landId, oldOwner, newOwner);
    }

    function getRecordCount() external view returns (uint) {
        return records.length;
    }
}

// Main escrow contract.
contract LandSaleEscrow is RegistrarAccess {
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

    // This variable stores the address of the history contract using its interface.
    ILandHistory public landHistory;

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

    // Constructor receives the address of LandHistory.
    constructor(address landHistoryAddress) {
        landHistory = ILandHistory(landHistoryAddress);
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

    function approveSale(uint landId) external onlyRegistrar landMustExist(landId) {
        uint index = landIndexById[landId];
        Land storage land = lands[index];

        if (land.buyer == address(0)) {
            revert NoPendingBuyer();
        }

        address oldOwner = land.owner;
        address newOwner = land.buyer;
        uint salePrice = land.price;

        land.owner = newOwner;
        land.isSold = true;
        land.isForSale = false;
        land.buyer = address(0);

        ownerToLandIds[newOwner].push(landId);
        _removeLandFromOwner(oldOwner, landId);

        // This is the contract-to-contract call.
        // LandSaleEscrow tells LandHistory to record this transfer.
        landHistory.recordTransfer(landId, oldOwner, newOwner);

        (bool success, ) = payable(oldOwner).call{value: salePrice}("");

        if (!success) {
            revert PaymentTransferFailed();
        }

        emit LandSaleApproved(landId, oldOwner, newOwner, salePrice);
    }

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