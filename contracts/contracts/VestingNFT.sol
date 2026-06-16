// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VestingNFT
 * @notice NFT-based vesting schedules - each vesting is an NFT that can be transferred
 * @dev Whoever owns the NFT receives the vested tokens
 */
contract VestingNFT is ERC721, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public platformFeeBps = 75;
    uint256 public constant MAX_FEE = 1000;

    struct Vesting {
        address token;
        address creator;
        uint256 totalAmount;
        uint256 startTime;
        uint256 duration;
        uint256 cliffDuration;
        uint256 claimed;
        bool revoked;
    }

    mapping(uint256 => Vesting) public vestings;
    uint256 public nextTokenId;
    mapping(address => uint256) public totalEscrowed;

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

    event PlatformFeeCollected(address indexed token, uint256 fee);
    event FeeUpdated(uint256 newFeeBps);

    constructor() ERC721("Vesting NFT", "VEST") Ownable(msg.sender) {}

    function setPlatformFee(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= MAX_FEE, "Fee too high");
        platformFeeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }

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

        uint256 balBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = IERC20(token).balanceOf(address(this)) - balBefore;
        require(received > 0, "Zero received");
        uint256 vestedAmount = _applyPlatformFee(token, received);
        require(vestedAmount > 0, "Amount too small after fee");
        totalEscrowed[token] += vestedAmount;

        uint256 tokenId = nextTokenId++;

        vestings[tokenId] = Vesting({
            token: token,
            creator: msg.sender,
            totalAmount: vestedAmount,
            startTime: block.timestamp,
            duration: duration,
            cliffDuration: cliffDuration,
            claimed: 0,
            revoked: false
        });

        if (beneficiary == msg.sender) {
            _mint(beneficiary, tokenId);
        } else {
            _safeMint(beneficiary, tokenId);
        }

        emit VestingCreated(
            tokenId,
            msg.sender,
            beneficiary,
            token,
            vestedAmount,
            duration,
            cliffDuration
        );

        return tokenId;
    }

    function claim(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not NFT owner");

        Vesting storage vesting = vestings[tokenId];
        require(!vesting.revoked, "Vesting revoked");

        uint256 claimable = _claimableAmount(tokenId);
        require(claimable > 0, "Nothing to claim");

        vesting.claimed += claimable;
        totalEscrowed[vesting.token] -= claimable;

        IERC20(vesting.token).safeTransfer(msg.sender, claimable);

        emit TokensClaimed(tokenId, msg.sender, claimable);

        if (vesting.claimed >= vesting.totalAmount) {
            _burn(tokenId);
        }
    }

    function claimableAmount(uint256 tokenId) external view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Vesting does not exist");
        return _claimableAmount(tokenId);
    }

    function getVesting(uint256 tokenId) external view returns (Vesting memory) {
        require(_ownerOf(tokenId) != address(0), "Vesting does not exist");
        return vestings[tokenId];
    }

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

    function revokeVesting(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) != address(0), "Vesting does not exist");

        Vesting storage vesting = vestings[tokenId];
        require(msg.sender == vesting.creator, "Not vesting creator");
        require(!vesting.revoked, "Already revoked");

        uint256 claimable = _claimableAmount(tokenId);
        uint256 unvested = vesting.totalAmount - vesting.claimed - claimable;
        uint256 liability = vesting.totalAmount - vesting.claimed;

        vesting.revoked = true;
        totalEscrowed[vesting.token] -= liability;

        if (claimable > 0) {
            vesting.claimed += claimable;
            IERC20(vesting.token).safeTransfer(_ownerOf(tokenId), claimable);
        }

        if (unvested > 0) {
            IERC20(vesting.token).safeTransfer(vesting.creator, unvested);
        }

        emit VestingRevoked(tokenId, unvested);

        _burn(tokenId);
    }

    function totalVestings() external view returns (uint256) {
        return nextTokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Vesting does not exist");

        Vesting memory vesting = vestings[tokenId];

        string memory idStr = _toString(tokenId);
        string memory totalStr = _toString(vesting.totalAmount / 1e18);
        string memory claimedStr = _toString(vesting.claimed / 1e18);
        uint256 pct = vesting.totalAmount > 0 ? (vesting.claimed * 100) / vesting.totalAmount : 0;
        string memory pctStr = _toString(pct);
        string memory status = vesting.revoked ? "REVOKED" : (vesting.claimed >= vesting.totalAmount ? "COMPLETE" : "VESTING");

        // Hosted artwork shown on marketplaces (OpenSea, etc.). Square, high-res image.
        string memory image = "https://www.image2url.com/r2/default/images/1781346975174-c7be879b-3954-4651-8186-d3deab22fecd.jpg";

        string memory json = string(abi.encodePacked(
            '{"name":"Vesting #', idStr,
            '","description":"', totalStr, ' tokens vesting | ', pctStr, '% claimed | Status: ', status,
            '","image":"', image,
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

    function _claimableAmount(uint256 tokenId) internal view returns (uint256) {
        Vesting memory vesting = vestings[tokenId];

        if (vesting.revoked) {
            return 0;
        }

        if (block.timestamp < vesting.startTime + vesting.cliffDuration) {
            return 0;
        }

        uint256 vestedAmount;
        if (block.timestamp >= vesting.startTime + vesting.duration) {
            vestedAmount = vesting.totalAmount;
        } else {
            uint256 elapsed = block.timestamp - vesting.startTime;
            vestedAmount = (vesting.totalAmount * elapsed) / vesting.duration;
        }

        return vestedAmount > vesting.claimed ? vestedAmount - vesting.claimed : 0;
    }

    function _applyPlatformFee(address token, uint256 received) internal returns (uint256 net) {
        uint256 fee = (received * platformFeeBps) / BASIS_POINTS;
        net = received - fee;
        if (fee > 0) {
            IERC20(token).safeTransfer(owner(), fee);
            emit PlatformFeeCollected(token, fee);
        }
    }

    function emergencyRecoverToken(
        address token,
        uint256 amount
    ) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 escrow = totalEscrowed[token];
        uint256 recoverable = balance > escrow ? balance - escrow : 0;
        require(amount <= recoverable, "Exceeds non-escrow balance");
        IERC20(token).safeTransfer(owner(), amount);
    }

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
