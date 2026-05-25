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

    /// Per-token escrow liability (active, non-withdrawn locks)
    mapping(address => uint256) public totalEscrowed;

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
        totalEscrowed[token] += amount;

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
        totalEscrowed[lock.token] -= lock.amount;

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
        
        string memory idStr = _toString(tokenId);
        string memory amountStr = _toString(lock.amount / 1e18);
        string memory unlockStr = _toString(lock.unlockTime);
        string memory status = lock.withdrawn ? "WITHDRAWN" : (block.timestamp >= lock.unlockTime ? "UNLOCKED" : "LOCKED");
        
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">',
            '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#0D0B14"/><stop offset="100%" style="stop-color:#1a1528"/></linearGradient></defs>',
            '<rect width="400" height="250" fill="url(#bg)" rx="16"/>',
            '<rect x="1" y="1" width="398" height="248" rx="15" fill="none" stroke="#9B7FD4" stroke-opacity="0.4"/>',
            '<text x="24" y="36" font-family="monospace" font-size="10" fill="#9B7FD4" opacity="0.6">TOKEN LOCK</text>',
            '<text x="24" y="70" font-family="sans-serif" font-size="22" font-weight="bold" fill="#EDE0FF">Lock #', idStr, '</text>',
            '<text x="24" y="100" font-family="monospace" font-size="12" fill="#C4A8F0">', status, '</text>',
            '<rect x="24" y="120" width="352" height="1" fill="#9B7FD4" opacity="0.2"/>',
            '<text x="24" y="155" font-family="monospace" font-size="11" fill="#9B7FD4">AMOUNT</text>',
            '<text x="24" y="175" font-family="sans-serif" font-size="18" fill="#EDE0FF">', amountStr, ' tokens</text>',
            '<text x="24" y="215" font-family="monospace" font-size="11" fill="#9B7FD4">UNLOCK TIME</text>',
            '<text x="24" y="235" font-family="sans-serif" font-size="14" fill="#EDE0FF">', unlockStr, '</text>',
            '<circle cx="360" cy="36" r="16" fill="#9B7FD4" opacity="0.2"/><text x="352" y="41" font-family="sans-serif" font-size="14" fill="#C4A8F0">&#x1F512;</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name":"Token Lock #', idStr,
            '","description":"', amountStr, ' tokens locked | Status: ', status,
            '","image":"data:image/svg+xml;base64,', _base64Encode(bytes(svg)),
            '","attributes":[{"trait_type":"Amount","value":"', amountStr,
            '"},{"trait_type":"Status","value":"', status,
            '"},{"trait_type":"Unlock Time","value":"', unlockStr, '"}]}'
        ));
        
        return string(abi.encodePacked("data:application/json;base64,", _base64Encode(bytes(json))));
    }

    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        string memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        if (data.length == 0) return "";
        bytes memory result = new bytes(4 * ((data.length + 2) / 3));
        bytes memory table = bytes(TABLE);
        uint256 i;
        for (i = 0; i < data.length; i += 3) {
            uint256 a = uint8(data[i]);
            uint256 b = i + 1 < data.length ? uint8(data[i + 1]) : 0;
            uint256 c = i + 2 < data.length ? uint8(data[i + 2]) : 0;
            uint256 triple = (a << 16) | (b << 8) | c;
            result[i / 3 * 4] = table[(triple >> 18) & 0x3F];
            result[i / 3 * 4 + 1] = table[(triple >> 12) & 0x3F];
            result[i / 3 * 4 + 2] = i + 1 < data.length ? table[(triple >> 6) & 0x3F] : bytes1("=");
            result[i / 3 * 4 + 3] = i + 2 < data.length ? table[triple & 0x3F] : bytes1("=");
        }
        return string(result);
    }

    // ─────────────────────────────────────────────────────────────────────
    //  Admin
    // ─────────────────────────────────────────────────────────────────────

    /**
     * @notice Emergency token recovery — only for tokens accidentally sent
     *         to this contract (not locked tokens).
     */
    function emergencyRecoverToken(address token, uint256 amount) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 escrow = totalEscrowed[token];
        uint256 recoverable = balance > escrow ? balance - escrow : 0;
        require(amount <= recoverable, "Exceeds non-escrow balance");
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
