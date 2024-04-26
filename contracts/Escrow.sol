//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

interface IERC721 {
    function transferFrom(address _from, address _to, uint256 _id) external;
}

contract Escrow {
    address public nftAddress;
    address payable public seller;
    address public inspector;
    address public lender;

    //nftID to bool listed;
    mapping(uint256 => bool) public isListed;
    //nftID to purchase price;
    mapping(uint256 => uint256) public purchasePrice;
    //nftID to the escrow amount;
    mapping(uint256 => uint256) public escrowAmount;
    //nftID to the buyer;
    mapping(uint256 => address) public buyer;
    //inspection status mapping;
    mapping(uint256 => bool) public inspectionPassed;
    //nftID to address to status of approval;
    mapping(uint256 => mapping(address => bool)) public approval;

    constructor(
        address _nftAddress,
        address payable _seller,
        address _inspector,
        address _lender
    ) {
        nftAddress = _nftAddress;
        seller = _seller;
        inspector = _inspector;
        lender = _lender;
    }

    modifier onlyOwner() {
        require(msg.sender == seller, "Only seller to call this method");
        _;
    }

    modifier onlyBuyer(uint256 _nftID) {
        require(msg.sender == buyer[_nftID], "Only buyer to call this method");
        _;
    }

    modifier onlyInspector() {
        require(msg.sender == inspector, "Only inspector to call this method");
        _;
    }

    //function to list a property and transfer token;
    function list(
        uint256 _nftID,
        address _buyer,
        uint256 _purchasePrice,
        uint256 _escrowAmount
    ) public payable onlyOwner {
        //transfer nft from user wallet and move it to escrow contract;
        IERC721(nftAddress).transferFrom(msg.sender, address(this), _nftID);

        isListed[_nftID] = true;
        purchasePrice[_nftID] = _purchasePrice;
        escrowAmount[_nftID] = _escrowAmount;
        buyer[_nftID] = _buyer;
    }

    //down payment model;
    function downPayment(uint256 _nftID) public payable onlyBuyer(_nftID) {
        require(msg.value >= escrowAmount[_nftID]);
    }

    function updateInspectionStatus(
        uint256 _nftID,
        bool _passed
    ) public onlyInspector {
        inspectionPassed[_nftID] = _passed;
    }

    function approveSale(uint256 _nftID) public {
        approval[_nftID][msg.sender] = true;
    }

    //finalize sale;
    // ->require inspection status
    // ->require sale to be authorized
    // ->require funds to be correct amount
    // ->transfer NFT to buyer
    // ->transfer funds to seller
    function finalizeSale(uint256 _nftID) public {
        require(inspectionPassed[_nftID]);
        require(approval[_nftID][buyer[_nftID]]);
        require(approval[_nftID][seller]);
        require(approval[_nftID][lender]);
        address(this).balance >= purchasePrice[_nftID];

        isListed[_nftID] = false;

        (bool success, ) = payable(seller).call{value: address(this).balance}(
            ""
        );
        require(success);

        IERC721(nftAddress).transferFrom(address(this), buyer[_nftID], _nftID);
    }

    //function to handle sale cancellation if inspection status is not approved;
    //refund the buyer if not then send to the sender;
    function cancelSale(uint256 _nftID) public {
        if (inspectionPassed[_nftID] == false) {
            payable(buyer[_nftID]).transfer(address(this).balance);
        } else {
            payable(seller).transfer(address(this).balance);
        }
    }

    //receive ether for smart contract;
    receive() external payable {}

    //get ether balance;
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
