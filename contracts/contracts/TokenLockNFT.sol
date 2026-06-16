// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenLockNFT
 * @notice NFT-based token locks — each lock is an ERC-721 that can be transferred.
 *         Whoever owns the NFT owns the locked tokens.
 *
 * LEADERBOARD SUPPORT (off-chain friendly):
 *   - locksLength()              total locks ever created
 *   - locksOf(owner)             token IDs owned by an address
 *   - allTokens(offset, limit)   paginated unique ERC-20s (capped index)
 *   - allLockers(offset, limit)  paginated unique lockers (capped index)
 *   Front-ends iterate these to compute leaderboards client-side.
 */
contract TokenLockNFT is ERC721, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public platformFeeBps = 75;
    uint256 public constant MAX_FEE = 1000;

    uint256 public constant MAX_PAGE_SIZE = 100;
    uint256 public constant MAX_TRACKED_TOKENS = 256;
    uint256 public constant MAX_TRACKED_LOCKERS = 2048;

    struct Lock {
        address token;
        uint256 amount;
        uint256 unlockTime;
        uint256 createdAt;
        bool    withdrawn;
    }

    mapping(uint256 => Lock) public locks;
    uint256 public nextTokenId;

    mapping(address => uint256[]) private _locksByToken;
    mapping(address => uint256[]) private _locksByCreator;

    address[] private _allTokens;
    mapping(address => bool) private _tokenSeen;

    address[] private _allLockers;
    mapping(address => bool) private _lockerSeen;

    mapping(address => uint256) public totalEscrowed;

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

    event PlatformFeeCollected(address indexed token, uint256 fee);
    event FeeUpdated(uint256 newFeeBps);

    constructor() ERC721("Token Lock NFT", "LOCK") Ownable(msg.sender) {}

    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE, "Fee too high");
        platformFeeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

    function createLock(
        address token,
        uint256 amount,
        uint256 unlockTime
    ) external nonReentrant returns (uint256) {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(unlockTime > block.timestamp, "Unlock time must be future");

        uint256 balBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balBefore;
        require(received > 0, "Zero received");
        uint256 lockedAmount = _applyPlatformFee(token, received);
        require(lockedAmount > 0, "Amount too small after fee");
        totalEscrowed[token] += lockedAmount;

        uint256 tokenId = nextTokenId++;

        locks[tokenId] = Lock({
            token:      token,
            amount:     lockedAmount,
            unlockTime: unlockTime,
            createdAt:  block.timestamp,
            withdrawn:  false
        });

        _locksByToken[token].push(tokenId);
        _locksByCreator[msg.sender].push(tokenId);

        if (!_tokenSeen[token] && _allTokens.length < MAX_TRACKED_TOKENS) {
            _tokenSeen[token] = true;
            _allTokens.push(token);
        }
        if (!_lockerSeen[msg.sender] && _allLockers.length < MAX_TRACKED_LOCKERS) {
            _lockerSeen[msg.sender] = true;
            _allLockers.push(msg.sender);
        }

        _mint(msg.sender, tokenId);

        emit LockCreated(tokenId, msg.sender, token, lockedAmount, unlockTime);

        return tokenId;
    }

    function withdraw(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not NFT owner");

        Lock storage lock = locks[tokenId];
        require(!lock.withdrawn, "Already withdrawn");
        require(block.timestamp >= lock.unlockTime, "Still locked");

        lock.withdrawn = true;
        totalEscrowed[lock.token] -= lock.amount;

        IERC20(lock.token).safeTransfer(msg.sender, lock.amount);

        emit TokensWithdrawn(tokenId, msg.sender, lock.token, lock.amount);

        _burn(tokenId);
    }

    function getLock(uint256 tokenId) external view returns (Lock memory) {
        require(_ownerOf(tokenId) != address(0), "Lock does not exist");
        return locks[tokenId];
    }

    function isUnlocked(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "Lock does not exist");
        return block.timestamp >= locks[tokenId].unlockTime;
    }

    function locksLength() external view returns (uint256) {
        return nextTokenId;
    }

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

    function locksOfToken(address token) external view returns (uint256[] memory) {
        return _locksByToken[token];
    }

    function locksOfCreator(address creator) external view returns (uint256[] memory) {
        return _locksByCreator[creator];
    }

    function allTokens(uint256 offset, uint256 limit) external view returns (address[] memory) {
        return _paginateAddresses(_allTokens, offset, limit);
    }

    function tokensLength() external view returns (uint256) {
        return _allTokens.length;
    }

    function allLockers(uint256 offset, uint256 limit) external view returns (address[] memory) {
        return _paginateAddresses(_allLockers, offset, limit);
    }

    function lockersLength() external view returns (uint256) {
        return _allLockers.length;
    }

    function _paginateAddresses(
        address[] storage source,
        uint256 offset,
        uint256 limit
    ) internal view returns (address[] memory) {
        if (limit > MAX_PAGE_SIZE) limit = MAX_PAGE_SIZE;
        uint256 len = source.length;
        if (offset >= len) return new address[](0);
        uint256 end = offset + limit;
        if (end > len) end = len;
        uint256 size = end - offset;
        address[] memory result = new address[](size);
        for (uint256 i = 0; i < size; i++) {
            result[i] = source[offset + i];
        }
        return result;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Lock does not exist");
        Lock memory lock = locks[tokenId];

        string memory idStr = _toString(tokenId);
        string memory amountStr = _toString(lock.amount / 1e18);
        string memory unlockStr = _toString(lock.unlockTime);
        string memory status = lock.withdrawn ? "WITHDRAWN" : (block.timestamp >= lock.unlockTime ? "UNLOCKED" : "LOCKED");

        // Hosted artwork shown on marketplaces (OpenSea, etc.). Square, high-res image.
        string memory image = "https://www.image2url.com/r2/default/images/1781347039322-42a5f5ba-833a-4c23-b5bb-9b89acc99652.jpg";

        string memory json = string(abi.encodePacked(
            '{"name":"Token Lock #', idStr,
            '","description":"', amountStr, ' tokens locked | Status: ', status,
            '","image":"', image,
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

    function _applyPlatformFee(address token, uint256 received) internal returns (uint256 net) {
        uint256 fee = (received * platformFeeBps) / BASIS_POINTS;
        net = received - fee;
        if (fee > 0) {
            IERC20(token).safeTransfer(owner(), fee);
            emit PlatformFeeCollected(token, fee);
        }
    }

    function emergencyRecoverToken(address token, uint256 amount) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 escrow = totalEscrowed[token];
        uint256 recoverable = balance > escrow ? balance - escrow : 0;
        require(amount <= recoverable, "Exceeds non-escrow balance");
        IERC20(token).safeTransfer(owner(), amount);
    }

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
