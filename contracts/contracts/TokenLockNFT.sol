// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenLockNFT
 * @notice NFT-based token locks - each lock is an NFT that can be transferred
 * @dev Whoever owns the NFT owns the locked tokens
 */
contract TokenLockNFT is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Lock {
        address token;          // Token being locked
        uint256 amount;         // Amount locked
        uint256 unlockTime;     // When tokens unlock
        uint256 createdAt;      // Lock creation timestamp
        bool withdrawn;         // Whether tokens have been withdrawn
    }

    // Lock data indexed by NFT tokenId
    mapping(uint256 => Lock) public locks;
    
    // Next token ID to mint
    uint256 public nextTokenId;

    // Events
    event LockCreated(
        uint256 indexed tokenId,
        address indexed creator,
        address indexed token,
        uint256 amount,
        uint256 unlockTime
    );
    
    event TokensWithdrawn(
        uint256 indexed tokenId,
        address indexed recipient,
        address indexed token,
        uint256 amount
    );

    constructor() ERC721("Token Lock NFT", "LOCK") Ownable(msg.sender) {}

    /**
     * @notice Create a new token lock and mint NFT to creator
     * @param token Address of token to lock
     * @param amount Amount to lock
     * @param unlockTime Timestamp when tokens unlock
     * @return tokenId The NFT token ID representing this lock
     */
    function createLock(
        address token,
        uint256 amount,
        uint256 unlockTime
    ) external nonReentrant returns (uint256) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(unlockTime > block.timestamp, "Unlock time must be future");

        // Transfer tokens to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Get next token ID
        uint256 tokenId = nextTokenId++;

        // Store lock data
        locks[tokenId] = Lock({
            token: token,
            amount: amount,
            unlockTime: unlockTime,
            createdAt: block.timestamp,
            withdrawn: false
        });

        // Mint NFT to creator
        _safeMint(msg.sender, tokenId);

        emit LockCreated(tokenId, msg.sender, token, amount, unlockTime);

        return tokenId;
    }

    /**
     * @notice Withdraw locked tokens (only NFT owner can call)
     * @param tokenId The lock NFT token ID
     */
    function withdraw(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not NFT owner");
        
        Lock storage lock = locks[tokenId];
        require(!lock.withdrawn, "Already withdrawn");
        require(block.timestamp >= lock.unlockTime, "Still locked");

        // Mark as withdrawn
        lock.withdrawn = true;

        // Transfer tokens to NFT owner
        IERC20(lock.token).safeTransfer(msg.sender, lock.amount);

        emit TokensWithdrawn(tokenId, msg.sender, lock.token, lock.amount);
    }

    /**
     * @notice Get lock details
     * @param tokenId The lock NFT token ID
     */
    function getLock(uint256 tokenId) external view returns (Lock memory) {
        require(_ownerOf(tokenId) != address(0), "Lock does not exist");
        return locks[tokenId];
    }

    /**
     * @notice Check if lock is unlocked
     * @param tokenId The lock NFT token ID
     */
    function isUnlocked(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Lock does not exist");
        return block.timestamp >= locks[tokenId].unlockTime;
    }

    /**
     * @notice Get all lock NFTs owned by an address
     * @param owner Address to query
     * @return tokenIds Array of token IDs owned by address
     */
    function locksOf(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        
        uint256 index = 0;
        for (uint256 i = 0; i < nextTokenId && index < balance; i++) {
            if (_ownerOf(i) == owner) {
                tokenIds[index] = i;
                index++;
            }
        }
        
        return tokenIds;
    }

    /**
     * @notice Get total number of locks created
     */
    function totalLocks() external view returns (uint256) {
        return nextTokenId;
    }

    /**
     * @notice Generate token URI with lock metadata
     * @param tokenId The lock NFT token ID
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Lock does not exist");
        
        Lock memory lock = locks[tokenId];
        
        // In production, generate proper JSON metadata
        // For now, return a simple string
        return string(
            abi.encodePacked(
                "Token Lock #",
                _toString(tokenId),
                " - ",
                _toString(lock.amount),
                " tokens locked until ",
                _toString(lock.unlockTime)
            )
        );
    }

    /**
     * @notice Emergency function to recover stuck tokens (only owner)
     * @dev Should only be used for tokens accidentally sent to contract
     */
    function emergencyRecoverToken(
        address token,
        uint256 amount
    ) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // Helper function to convert uint to string
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
