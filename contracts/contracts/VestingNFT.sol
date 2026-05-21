// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VestingNFT
 * @notice NFT-based vesting schedules - each vesting is an NFT that can be transferred
 * @dev Whoever owns the NFT receives the vested tokens
 */
contract VestingNFT is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Vesting {
        address token;          // Token being vested
        uint256 totalAmount;    // Total amount to vest
        uint256 startTime;      // Vesting start time
        uint256 duration;       // Vesting duration in seconds
        uint256 cliffDuration;  // Cliff duration (0 if no cliff)
        uint256 claimed;        // Amount already claimed
        bool revoked;           // Whether vesting was revoked
    }

    // Vesting data indexed by NFT tokenId
    mapping(uint256 => Vesting) public vestings;
    
    // Next token ID to mint
    uint256 public nextTokenId;

    // Events
    event VestingCreated(
        uint256 indexed tokenId,
        address indexed creator,
        address indexed beneficiary,
        address token,
        uint256 amount,
        uint256 duration,
        uint256 cliffDuration
    );
    
    event TokensClaimed(
        uint256 indexed tokenId,
        address indexed beneficiary,
        uint256 amount
    );
    
    event VestingRevoked(
        uint256 indexed tokenId,
        uint256 amountRevoked
    );

    constructor() ERC721("Vesting NFT", "VEST") Ownable(msg.sender) {}

    /**
     * @notice Create a new vesting schedule and mint NFT to beneficiary
     * @param beneficiary Address to receive the vesting NFT
     * @param token Address of token to vest
     * @param amount Total amount to vest
     * @param duration Vesting duration in seconds
     * @param cliffDuration Cliff duration in seconds (0 for no cliff)
     * @return tokenId The NFT token ID representing this vesting
     */
    function createVesting(
        address beneficiary,
        address token,
        uint256 amount,
        uint256 duration,
        uint256 cliffDuration
    ) external nonReentrant returns (uint256) {
        require(beneficiary != address(0), "Invalid beneficiary");
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be > 0");
        require(duration > 0, "Duration must be > 0");
        require(cliffDuration <= duration, "Cliff > duration");

        // Transfer tokens to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Get next token ID
        uint256 tokenId = nextTokenId++;

        // Store vesting data
        vestings[tokenId] = Vesting({
            token: token,
            totalAmount: amount,
            startTime: block.timestamp,
            duration: duration,
            cliffDuration: cliffDuration,
            claimed: 0,
            revoked: false
        });

        // Mint NFT to beneficiary
        _safeMint(beneficiary, tokenId);

        emit VestingCreated(
            tokenId,
            msg.sender,
            beneficiary,
            token,
            amount,
            duration,
            cliffDuration
        );

        return tokenId;
    }

    /**
     * @notice Claim vested tokens (only NFT owner can call)
     * @param tokenId The vesting NFT token ID
     */
    function claim(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not NFT owner");
        
        Vesting storage vesting = vestings[tokenId];
        require(!vesting.revoked, "Vesting revoked");

        uint256 claimable = _claimableAmount(tokenId);
        require(claimable > 0, "Nothing to claim");

        // Update claimed amount
        vesting.claimed += claimable;

        // Transfer tokens to NFT owner
        IERC20(vesting.token).safeTransfer(msg.sender, claimable);

        emit TokensClaimed(tokenId, msg.sender, claimable);
    }

    /**
     * @notice Calculate claimable amount for a vesting
     * @param tokenId The vesting NFT token ID
     */
    function claimableAmount(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Vesting does not exist");
        return _claimableAmount(tokenId);
    }

    /**
     * @notice Get vesting details
     * @param tokenId The vesting NFT token ID
     */
    function getVesting(uint256 tokenId) external view returns (Vesting memory) {
        require(_ownerOf(tokenId) != address(0), "Vesting does not exist");
        return vestings[tokenId];
    }

    /**
     * @notice Get all vesting NFTs owned by an address
     * @param owner Address to query
     * @return tokenIds Array of token IDs owned by address
     */
    function vestingsOf(address owner) external view returns (uint256[] memory) {
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
     * @notice Revoke a vesting (only owner can call)
     * @param tokenId The vesting NFT token ID
     * @dev Unvested tokens are returned to contract owner
     */
    function revokeVesting(uint256 tokenId) external onlyOwner nonReentrant {
        require(_ownerOf(tokenId) != address(0), "Vesting does not exist");
        
        Vesting storage vesting = vestings[tokenId];
        require(!vesting.revoked, "Already revoked");

        // Calculate claimable and unvested amounts
        uint256 claimable = _claimableAmount(tokenId);
        uint256 unvested = vesting.totalAmount - vesting.claimed - claimable;

        // Mark as revoked
        vesting.revoked = true;

        // Transfer claimable to beneficiary if any
        if (claimable > 0) {
            vesting.claimed += claimable;
            IERC20(vesting.token).safeTransfer(_ownerOf(tokenId), claimable);
        }

        // Return unvested to owner
        if (unvested > 0) {
            IERC20(vesting.token).safeTransfer(owner(), unvested);
        }

        emit VestingRevoked(tokenId, unvested);
    }

    /**
     * @notice Get total number of vestings created
     */
    function totalVestings() external view returns (uint256) {
        return nextTokenId;
    }

    /**
     * @notice Generate token URI with vesting metadata
     * @param tokenId The vesting NFT token ID
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Vesting does not exist");
        
        Vesting memory vesting = vestings[tokenId];
        
        string memory idStr = _toString(tokenId);
        string memory totalStr = _toString(vesting.totalAmount / 1e18);
        string memory claimedStr = _toString(vesting.claimed / 1e18);
        uint256 pct = vesting.totalAmount > 0 ? (vesting.claimed * 100) / vesting.totalAmount : 0;
        string memory pctStr = _toString(pct);
        string memory status = vesting.revoked ? "REVOKED" : (vesting.claimed >= vesting.totalAmount ? "COMPLETE" : "VESTING");
        
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">',
            '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#0D0B14"/><stop offset="100%" style="stop-color:#1a1528"/></linearGradient></defs>',
            '<rect width="400" height="250" fill="url(#bg)" rx="16"/>',
            '<rect x="1" y="1" width="398" height="248" rx="15" fill="none" stroke="#6B5CE7" stroke-opacity="0.4"/>',
            '<text x="24" y="36" font-family="monospace" font-size="10" fill="#6B5CE7" opacity="0.6">VESTING SCHEDULE</text>',
            '<text x="24" y="70" font-family="sans-serif" font-size="22" font-weight="bold" fill="#EDE0FF">Vesting #', idStr, '</text>',
            '<text x="24" y="100" font-family="monospace" font-size="12" fill="#C4A8F0">', status, '</text>',
            '<rect x="24" y="120" width="352" height="1" fill="#6B5CE7" opacity="0.2"/>',
            '<text x="24" y="150" font-family="monospace" font-size="11" fill="#6B5CE7">TOTAL</text>',
            '<text x="24" y="170" font-family="sans-serif" font-size="18" fill="#EDE0FF">', totalStr, ' tokens</text>',
            '<text x="240" y="150" font-family="monospace" font-size="11" fill="#6B5CE7">CLAIMED</text>',
            '<text x="240" y="170" font-family="sans-serif" font-size="18" fill="#EDE0FF">', claimedStr, '</text>'
        ));
        
        svg = string(abi.encodePacked(svg,
            '<rect x="24" y="200" width="352" height="8" rx="4" fill="#1a1528" stroke="#6B5CE7" stroke-opacity="0.2"/>',
            '<rect x="24" y="200" width="', _toString(pct * 352 / 100), '" height="8" rx="4" fill="#6B5CE7"/>',
            '<text x="24" y="230" font-family="monospace" font-size="11" fill="#C4A8F0">', pctStr, '% claimed</text>',
            '<circle cx="360" cy="36" r="16" fill="#6B5CE7" opacity="0.2"/><text x="353" y="41" font-family="sans-serif" font-size="14" fill="#C4A8F0">&#x23F3;</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name":"Vesting #', idStr,
            '","description":"', totalStr, ' tokens vesting | ', pctStr, '% claimed | Status: ', status,
            '","image":"data:image/svg+xml;base64,', _base64Encode(bytes(svg)),
            '","attributes":[{"trait_type":"Total","value":"', totalStr,
            '"},{"trait_type":"Claimed","value":"', claimedStr,
            '"},{"trait_type":"Progress","value":"', pctStr, '%"},{"trait_type":"Status","value":"', status, '"}]}'
        ));
        
        return string(abi.encodePacked("data:application/json;base64,", _base64Encode(bytes(json))));
    }

    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        string memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        if (data.length == 0) return "";
        bytes memory result = new bytes(4 * ((data.length + 2) / 3));
        bytes memory table = bytes(TABLE);
        for (uint256 i = 0; i < data.length; i += 3) {
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

    /**
     * @notice Internal function to calculate claimable amount
     */
    function _claimableAmount(uint256 tokenId) internal view returns (uint256) {
        Vesting memory vesting = vestings[tokenId];
        
        if (vesting.revoked) {
            return 0;
        }

        // Check if cliff has passed
        if (block.timestamp < vesting.startTime + vesting.cliffDuration) {
            return 0;
        }

        // Calculate vested amount
        uint256 vestedAmount;
        if (block.timestamp >= vesting.startTime + vesting.duration) {
            // Fully vested
            vestedAmount = vesting.totalAmount;
        } else {
            // Partially vested (linear)
            uint256 elapsed = block.timestamp - vesting.startTime;
            vestedAmount = (vesting.totalAmount * elapsed) / vesting.duration;
        }

        // Return claimable (vested - already claimed)
        return vestedAmount > vesting.claimed ? vestedAmount - vesting.claimed : 0;
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
