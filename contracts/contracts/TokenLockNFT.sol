// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenLockNFT
 * @notice NFT-based token locks — each lock is an ERC-721 that can be transferred.
 *         Whoever owns the NFT owns the locked tokens.
 *
 * LEADERBOARD SUPPORT (off-chain friendly):
 *   - locksLength()          total locks ever created
 *   - locksOf(owner)         token IDs owned by an address
 *   - locksOfToken(token)    token IDs for a given ERC-20
 *   - allLockers()           every address that has ever locked
 *   - allTokens()            every ERC-20 that has ever been locked
 *   Front-ends iterate these to compute leaderboards client-side.
 */
contract TokenLockNFT is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────
    //  Structs
    // ─────────────────────────────────────────────────────────────────────

    struct Lock {
        address token;       // ERC-20 being locked
        uint256 amount;      // Amount locked
        uint256 unlockTime;  // When tokens unlock
        uint256 createdAt;   // Lock creation timestamp
        bool    withdrawn;   // Whether tokens have been withdrawn
    }

    // ─────────────────────────────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────────────────────────────

    /// Lock data indexed by NFT tokenId
    mapping(uint256 => Lock) public locks;

    /// Next token ID to mint
    uint256 public nextTokenId;

    // Index: token address → list of lock IDs that locked that token
    mapping(address => uint256[]) private _locksByToken;

    // Index: user address → list of lock IDs created by that user
    mapping(address => uint256[]) private _locksByCreator;

    // Enumerable set of unique token addresses that have been locked
    address[] private _allTokens;
    mapping(address => bool) private _tokenSeen;

    // Enumerable set of unique locker addresses
    address[] private _allLockers;
    mapping(address => bool) private _lockerSeen;

    // ─────────────────────────────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────────────────────────────

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

    // ─────────────────────────────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────────────────────────────

    constructor() ERC721("Token Lock NFT", "LOCK") Ownable(msg.sender) {}

    // ─────────────────────────────────────────────────────────────────────
    //  Core: create / withdraw
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a new token lock and mint an NFT to the caller.
     * @param token      ERC-20 address to lock
     * @param amount     Amount to lock
     * @param unlockTime Timestamp when tokens become withdrawable
     * @return tokenId   The NFT token ID representing this lock
     */
    function createLock(
        address token,
        uint256 amount,
        uint256 unlockTime
    ) external nonReentrant returns (uint256) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(unlockTime > block.timestamp, "Unlock time must be future");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 tokenId = nextTokenId++;

        locks[tokenId] = Lock({
            token:      token,
            amount:     amount,
            unlockTime: unlockTime,
            createdAt:  block.timestamp,
            withdrawn:  false
        });

        // Update indexes
        _locksByToken[token].push(tokenId);
        _locksByCreator[msg.sender].push(tokenId);

        if (!_tokenSeen[token]) {
            _tokenSeen[token] = true;
            _allTokens.push(token);
        }
        if (!_lockerSeen[msg.sender]) {
            _lockerSeen[msg.sender] = true;
            _allLockers.push(msg.sender);
        }

        _safeMint(msg.sender, tokenId);

        emit LockCreated(tokenId, msg.sender, token, amount, unlockTime);

        return tokenId;
    }

    /**
     * @notice Withdraw locked tokens. Only the current NFT owner can call.
     * @param tokenId The lock NFT token ID
     */
    function withdraw(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not NFT owner");

        Lock storage lock = locks[tokenId];
        require(!lock.withdrawn, "Already withdrawn");
        require(block.timestamp >= lock.unlockTime, "Still locked");

        lock.withdrawn = true;

        IERC20(lock.token).safeTransfer(msg.sender, lock.amount);

        emit TokensWithdrawn(tokenId, msg.sender, lock.token, lock.amount);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  View helpers
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Get lock details.
     */
    function getLock(uint256 tokenId) external view returns (Lock memory) {
        require(_ownerOf(tokenId) != address(0), "Lock does not exist");
        return locks[tokenId];
    }

    /**
     * @notice Check if a lock has passed its unlock time.
     */
    function isUnlocked(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Lock does not exist");
        return block.timestamp >= locks[tokenId].unlockTime;
    }

    /**
     * @notice Total number of locks ever created (= next token ID).
     */
    function locksLength() external view returns (uint256) {
        return nextTokenId;
    }

    /**
     * @notice All lock NFT IDs currently owned by `owner`.
     *         Iterates the full supply — fine for moderate counts.
     */
    function locksOf(address owner) external view returns (uint256[] memory) {
        uint256 bal = balanceOf(owner);
        uint256[] memory ids = new uint256[](bal);
        uint256 idx;
        for (uint256 i = 0; i < nextTokenId && idx < bal; i++) {
            if (_ownerOf(i) == owner) {
                ids[idx++] = i;
            }
        }
        return ids;
    }

    /**
     * @notice All lock IDs that were originally created for `token`.
     *         Includes locks that may have been transferred or withdrawn.
     */
    function locksOfToken(address token) external view returns (uint256[] memory) {
        return _locksByToken[token];
    }

    /**
     * @notice All lock IDs originally created by `creator`.
     */
    function locksOfCreator(address creator) external view returns (uint256[] memory) {
        return _locksByCreator[creator];
    }

    /**
     * @notice Every unique ERC-20 address that has ever been locked.
     *         Used by front-ends to build the token leaderboard off-chain.
     */
    function allTokens() external view returns (address[] memory) {
        return _allTokens;
    }

    /**
     * @notice Number of unique ERC-20s ever locked.
     */
    function tokensLength() external view returns (uint256) {
        return _allTokens.length;
    }

    /**
     * @notice Every unique address that has ever created a lock.
     *         Used by front-ends to build the user leaderboard off-chain.
     */
    function allLockers() external view returns (address[] memory) {
        return _allLockers;
    }

    /**
     * @notice Number of unique lockers.
     */
    function lockersLength() external view returns (uint256) {
        return _allLockers.length;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  NFT metadata
    // ─────────────────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Lock does not exist");
        Lock memory lock = locks[tokenId];
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

    // ─────────────────────────────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Emergency token recovery — only for tokens accidentally sent
     *         to this contract (not locked tokens).
     */
    function emergencyRecoverToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Internal helpers
    // ─────────────────────────────────────────────────────────────────────

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
