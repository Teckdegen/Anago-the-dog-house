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
        uint256 claimable = _claimableAmount(tokenId);
        
        // In production, generate proper JSON metadata
        // For now, return a simple string
        return string(
            abi.encodePacked(
                "Vesting #",
                _toString(tokenId),
                " - ",
                _toString(vesting.totalAmount),
                " tokens, ",
                _toString(claimable),
                " claimable"
            )
        );
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
