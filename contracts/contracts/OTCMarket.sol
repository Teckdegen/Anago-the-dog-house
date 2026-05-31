// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IVestingNFTView {
    function vestings(uint256 tokenId) external view returns (
        address token,
        address creator,
        uint256 totalAmount,
        uint256 startTime,
        uint256 duration,
        uint256 cliffDuration,
        uint256 claimed,
        bool revoked
    );
}

interface ITokenLockView {
    function locks(uint256 tokenId) external view returns (
        address token,
        uint256 amount,
        uint256 unlockTime,
        uint256 createdAt,
        bool withdrawn
    );
}

/**
 * @title OTCMarket — Peer-to-peer NFT position marketplace
 * @notice Users can list locked positions (locks, vestings, farm NFTs) for sale.
 *         Buyers pay in native MON (paymentToken = address(0)) or any ERC20. Sellers set their own price.
 */
contract OTCMarket is ERC721Holder, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        address paymentToken;
        uint256 price;
        bool active;
        uint256 createdAt;
    }

    Listing[] public listings;
    uint256 public platformFeeBps = 100;
    uint256 public constant MAX_FEE = 1000;
    uint256 public constant BASIS_POINTS = 10000;
    address public constant NATIVE_PAYMENT = address(0);

    mapping(address => uint256[]) public sellerListings;
    mapping(address => mapping(uint256 => uint256)) public activeListingByNft;

    mapping(address => uint256) public pendingNativePayments;
    mapping(address => mapping(address => uint256)) public pendingTokenPayments;
    mapping(address => uint256) public totalPendingTokenPayments;

    event Listed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, address paymentToken, uint256 price);
    event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 fee);
    event Unlisted(uint256 indexed listingId, address indexed seller);
    event FeeUpdated(uint256 newFeeBps);
    event NativePaymentWithdrawn(address indexed recipient, uint256 amount);
    event TokenPaymentWithdrawn(address indexed token, address indexed recipient, uint256 amount);
    event StuckERC20Recovered(address indexed token, address indexed to, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function list(
        address nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price
    ) external nonReentrant returns (uint256 listingId) {
        require(nftContract != address(0), "Invalid NFT contract");
        require(price > 0, "Price must be > 0");
        require(activeListingByNft[nftContract][tokenId] == 0, "Already listed");

        _requireListableNft(nftContract, tokenId);

        IERC721(nftContract).safeTransferFrom(msg.sender, address(this), tokenId);

        listingId = listings.length;
        listings.push(Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            paymentToken: paymentToken,
            price: price,
            active: true,
            createdAt: block.timestamp
        }));

        sellerListings[msg.sender].push(listingId);
        activeListingByNft[nftContract][tokenId] = listingId + 1;

        emit Listed(listingId, msg.sender, nftContract, tokenId, paymentToken, price);
    }

    function buy(uint256 listingId) external payable nonReentrant {
        require(listingId < listings.length, "Invalid listing");
        Listing storage listing = listings[listingId];
        require(listing.active, "Not active");
        require(msg.sender != listing.seller, "Cannot buy own listing");

        listing.active = false;
        activeListingByNft[listing.nftContract][listing.tokenId] = 0;

        _requireListableNft(listing.nftContract, listing.tokenId);

        uint256 fee = (listing.price * platformFeeBps) / BASIS_POINTS;
        uint256 sellerAmount = listing.price - fee;

        if (listing.paymentToken == NATIVE_PAYMENT) {
            require(msg.value == listing.price, "Incorrect MON amount");
            pendingNativePayments[listing.seller] += sellerAmount;
            if (fee > 0) {
                pendingNativePayments[owner()] += fee;
            }
        } else {
            require(msg.value == 0, "Send MON only for native listings");
            IERC20(listing.paymentToken).safeTransferFrom(msg.sender, address(this), listing.price);
            pendingTokenPayments[listing.paymentToken][listing.seller] += sellerAmount;
            totalPendingTokenPayments[listing.paymentToken] += sellerAmount;
            if (fee > 0) {
                pendingTokenPayments[listing.paymentToken][owner()] += fee;
                totalPendingTokenPayments[listing.paymentToken] += fee;
            }
        }

        IERC721(listing.nftContract).safeTransferFrom(address(this), msg.sender, listing.tokenId);

        emit Sold(listingId, msg.sender, listing.seller, listing.price, fee);
    }

    function unlist(uint256 listingId) external nonReentrant {
        require(listingId < listings.length, "Invalid listing");
        Listing storage listing = listings[listingId];
        require(listing.active, "Not active");
        require(msg.sender == listing.seller, "Not seller");

        listing.active = false;
        activeListingByNft[listing.nftContract][listing.tokenId] = 0;

        IERC721(listing.nftContract).safeTransferFrom(address(this), msg.sender, listing.tokenId);

        emit Unlisted(listingId, msg.sender);
    }

    function listingCount() external view returns (uint256) {
        return listings.length;
    }

    function getListing(uint256 listingId) external view returns (
        address seller,
        address nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price,
        bool active,
        uint256 createdAt
    ) {
        require(listingId < listings.length, "Invalid listing");
        Listing storage l = listings[listingId];
        return (l.seller, l.nftContract, l.tokenId, l.paymentToken, l.price, l.active, l.createdAt);
    }

    function getActiveListings(uint256 offset, uint256 limit) external view returns (uint256[] memory ids) {
        uint256 count = 0;
        uint256[] memory temp = new uint256[](limit);

        for (uint256 i = offset; i < listings.length && count < limit; i++) {
            if (listings[i].active) {
                temp[count] = i;
                count++;
            }
        }

        ids = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            ids[i] = temp[i];
        }
    }

    function getSellerListings(address seller) external view returns (uint256[] memory) {
        return sellerListings[seller];
    }

    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE, "Fee too high");
        platformFeeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function withdrawNativePayments() external nonReentrant {
        uint256 amount = pendingNativePayments[msg.sender];
        require(amount > 0, "Nothing pending");
        pendingNativePayments[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "MON transfer failed");
        emit NativePaymentWithdrawn(msg.sender, amount);
    }

    function withdrawTokenPayments(address token) external nonReentrant {
        require(token != address(0), "Invalid token");
        uint256 amount = pendingTokenPayments[token][msg.sender];
        require(amount > 0, "Nothing pending");
        pendingTokenPayments[token][msg.sender] = 0;
        totalPendingTokenPayments[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit TokenPaymentWithdrawn(token, msg.sender, amount);
    }

    function recoverStuckERC20(IERC20 token, uint256 amount, address to) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        uint256 balance = token.balanceOf(address(this));
        uint256 reserved = totalPendingTokenPayments[address(token)];
        uint256 recoverable = balance > reserved ? balance - reserved : 0;
        require(amount <= recoverable, "Exceeds recoverable");
        token.safeTransfer(to, amount);
        emit StuckERC20Recovered(address(token), to, amount);
    }

    function recoverStuckNFT(address nftContract, uint256 tokenId, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(activeListingByNft[nftContract][tokenId] == 0, "Active listing");
        IERC721(nftContract).safeTransferFrom(address(this), to, tokenId);
    }

    function _requireListableNft(address nftContract, uint256 tokenId) internal view {
        try ITokenLockView(nftContract).locks(tokenId) returns (
            address, uint256, uint256, uint256, bool withdrawn
        ) {
            require(!withdrawn, "Lock withdrawn");
        } catch {}

        try IVestingNFTView(nftContract).vestings(tokenId) returns (
            address, address, uint256 totalAmount, uint256, uint256, uint256, uint256 claimed, bool revoked
        ) {
            require(!revoked, "Vesting revoked");
            require(claimed < totalAmount, "Vesting complete");
        } catch {}
    }
}
