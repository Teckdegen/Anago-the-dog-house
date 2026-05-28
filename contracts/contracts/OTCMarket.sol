// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OTCMarket — Peer-to-peer NFT position marketplace
 * @notice Users can list locked positions (locks, vestings, farm NFTs) for sale.
 *         Buyers pay in native MON (paymentToken = address(0)) or any ERC20. Sellers set their own price.
 * @dev
 *   - Supports any ERC721 NFT (TokenLockNFT, VestingNFT, StreamFarm positions)
 *   - Seller approves NFT to this contract, then lists
 *   - Buyer sends MON (payable buy) or approves ERC20 payment token, then buys
 *   - Platform fee configurable by owner
 *   - Listings can be cancelled anytime by seller
 */
contract OTCMarket is ERC721Holder, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════
    //                              STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    struct Listing {
        address seller;
        address nftContract;        // Which NFT contract (lock, vesting, farm)
        uint256 tokenId;            // NFT token ID
        address paymentToken;       // ERC20 token buyer pays with
        uint256 price;              // Price in payment token units
        bool active;                // Still for sale
        uint256 createdAt;          // When listed
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                            STATE
    // ═══════════════════════════════════════════════════════════════════════

    Listing[] public listings;
    uint256 public platformFeeBps = 100; // 1% default
    uint256 public constant MAX_FEE = 1000; // 10% max
    uint256 public constant BASIS_POINTS = 10000;
    /// @dev address(0) in paymentToken means native MON
    address public constant NATIVE_PAYMENT = address(0);

    // Track active listings per seller
    mapping(address => uint256[]) public sellerListings;

    /// Active listing for an NFT held in escrow (listingId + 1; 0 = none)
    mapping(address => mapping(uint256 => uint256)) public activeListingByNft;

    // ═══════════════════════════════════════════════════════════════════════
    //                            EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event Listed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, address paymentToken, uint256 price);
    event Sold(uint256 indexed listingId, address indexed buyer, address indexed seller, uint256 price, uint256 fee);
    event Unlisted(uint256 indexed listingId, address indexed seller);
    event FeeUpdated(uint256 newFeeBps);

    // ═══════════════════════════════════════════════════════════════════════
    //                          CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor() Ownable(msg.sender) {}

    // ═══════════════════════════════════════════════════════════════════════
    //                      USER: LIST / BUY / UNLIST
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice List an NFT position for sale. Transfers NFT to this contract.
     * @param nftContract Address of the NFT contract
     * @param tokenId Token ID to sell
     * @param paymentToken ERC20 token to receive payment in, or address(0) for native MON
     * @param price Price in payment token units (wei for MON)
     */
    function list(
        address nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price
    ) external nonReentrant returns (uint256 listingId) {
        require(nftContract != address(0), "Invalid NFT contract");
        require(price > 0, "Price must be > 0");
        require(activeListingByNft[nftContract][tokenId] == 0, "Already listed");

        // Transfer NFT to this contract (seller must approve first)
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

    /**
     * @notice Buy a listed position. Pays seller, transfers NFT to buyer.
     * @param listingId ID of the listing to buy
     */
    function buy(uint256 listingId) external payable nonReentrant {
        require(listingId < listings.length, "Invalid listing");
        Listing storage listing = listings[listingId];
        require(listing.active, "Not active");
        require(msg.sender != listing.seller, "Cannot buy own listing");

        listing.active = false;
        activeListingByNft[listing.nftContract][listing.tokenId] = 0;

        // Calculate fee
        uint256 fee = (listing.price * platformFeeBps) / BASIS_POINTS;
        uint256 sellerAmount = listing.price - fee;

        if (listing.paymentToken == NATIVE_PAYMENT) {
            require(msg.value == listing.price, "Incorrect MON amount");
            (bool sellerOk, ) = listing.seller.call{value: sellerAmount}("");
            require(sellerOk, "MON transfer to seller failed");
            if (fee > 0) {
                (bool feeOk, ) = owner().call{value: fee}("");
                require(feeOk, "MON fee transfer failed");
            }
        } else {
            require(msg.value == 0, "Send MON only for native listings");
            IERC20(listing.paymentToken).safeTransferFrom(msg.sender, listing.seller, sellerAmount);
            if (fee > 0) {
                IERC20(listing.paymentToken).safeTransferFrom(msg.sender, owner(), fee);
            }
        }

        // Transfer NFT to buyer
        IERC721(listing.nftContract).safeTransferFrom(address(this), msg.sender, listing.tokenId);

        emit Sold(listingId, msg.sender, listing.seller, listing.price, fee);
    }

    /**
     * @notice Cancel a listing. Returns NFT to seller.
     * @param listingId ID of the listing to cancel
     */
    function unlist(uint256 listingId) external nonReentrant {
        require(listingId < listings.length, "Invalid listing");
        Listing storage listing = listings[listingId];
        require(listing.active, "Not active");
        require(msg.sender == listing.seller, "Not seller");

        listing.active = false;
        activeListingByNft[listing.nftContract][listing.tokenId] = 0;

        // Return NFT to seller
        IERC721(listing.nftContract).safeTransferFrom(address(this), msg.sender, listing.tokenId);

        emit Unlisted(listingId, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════════════════════
    //                          ADMIN
    // ═══════════════════════════════════════════════════════════════════════

    function setFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE, "Fee too high");
        platformFeeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    /**
     * @notice Recover NFTs accidentally sent to this contract (not active listings).
     */
    function recoverStuckNFT(address nftContract, uint256 tokenId, address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");
        require(activeListingByNft[nftContract][tokenId] == 0, "Active listing");
        IERC721(nftContract).safeTransferFrom(address(this), to, tokenId);
    }
}