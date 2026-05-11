// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StreamFarm — Generalized Streaming Incentive Infrastructure
 * @notice Multi-reward streaming farm with NFT position receipts and global share accounting.
 * @dev
 *   - Rewards stream continuously between startTime and endTime per reward config.
 *   - Global accRewardPerShare accounting — no per-user iteration.
 *   - Each deposit mints a lightweight NFT position receipt.
 *   - Supports multiple reward tokens per farm.
 *   - Optional lock boost multipliers.
 *   - Minimal storage, minimal gas.
 */
contract StreamFarm is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════
    //                              STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    struct Farm {
        IERC20 stakeToken;          // Token users deposit
        address creator;            // Admin who created the farm
        uint256 totalShares;        // Sum of all boosted shares
        uint256 totalStaked;        // Sum of raw staked amounts
        bool active;                // Can new deposits enter
        uint256 lockDuration;       // Optional lock period (0 = no lock)
        uint256 earlyWithdrawBps;   // Penalty in basis points (0 = no penalty)
    }

    struct RewardStream {
        IERC20 token;               // Reward token
        uint256 rewardRate;         // Tokens per second (scaled 1e18)
        uint256 startTime;          // Emission start
        uint256 endTime;            // Emission end
        uint256 lastUpdateTime;     // Last time accRewardPerShare was updated
        uint256 accRewardPerShare;  // Accumulated reward per share (1e36 precision)
        uint256 totalBudget;        // Total reward tokens deposited
        uint256 totalDistributed;   // Total paid out
    }

    struct Position {
        uint256 farmId;             // Which farm
        uint256 amount;             // Raw staked amount
        uint256 shares;             // Boosted shares (amount * boost / 1e18)
        uint256 depositTime;        // When deposited
        uint256 lockExpiry;         // When lock expires (0 = no lock)
        uint256 boostMultiplier;    // 1e18 = 1x, 2e18 = 2x
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                            STATE
    // ═══════════════════════════════════════════════════════════════════════

    Farm[] public farms;
    mapping(uint256 => RewardStream[]) public farmRewards;       // farmId => reward streams
    mapping(uint256 => Position) public positions;               // tokenId => position
    mapping(uint256 => mapping(uint256 => uint256)) public rewardDebt; // tokenId => rewardIdx => debt

    uint256 public nextTokenId;
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant PRECISION = 1e36;

    // Multi-admin support
    mapping(address => bool) public admins;

    // Boost tiers: lock duration => multiplier (1e18 scaled)
    uint256[] public boostDurations;   // e.g. [7 days, 30 days, 90 days]
    uint256[] public boostMultipliers; // e.g. [1.2e18, 1.5e18, 2.0e18]

    // ═══════════════════════════════════════════════════════════════════════
    //                            EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event FarmCreated(uint256 indexed farmId, address indexed creator, address stakeToken);
    event RewardStreamAdded(uint256 indexed farmId, uint256 rewardIdx, address token, uint256 rewardRate, uint256 startTime, uint256 endTime);
    event Deposited(uint256 indexed tokenId, uint256 indexed farmId, address indexed user, uint256 amount, uint256 shares);
    event Withdrawn(uint256 indexed tokenId, uint256 indexed farmId, address indexed user, uint256 amount, uint256 penalty);
    event RewardsClaimed(uint256 indexed tokenId, address indexed user, address rewardToken, uint256 amount);
    event FarmActiveToggled(uint256 indexed farmId, bool active);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    // ═══════════════════════════════════════════════════════════════════════
    //                          MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "Not admin");
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor() ERC721("Stream Farm Position", "sFARM") Ownable(msg.sender) {
        admins[msg.sender] = true;
        // Default boost tiers
        boostDurations.push(7 days);
        boostDurations.push(30 days);
        boostDurations.push(90 days);
        boostMultipliers.push(1.2e18);
        boostMultipliers.push(1.5e18);
        boostMultipliers.push(2.0e18);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                      ADMIN MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    function addAdmin(address admin) external onlyOwner {
        require(admin != address(0), "Invalid address");
        admins[admin] = true;
        emit AdminAdded(admin);
    }

    function removeAdmin(address admin) external onlyOwner {
        require(admin != owner(), "Cannot remove owner");
        admins[admin] = false;
        emit AdminRemoved(admin);
    }

    function isAdmin(address account) external view returns (bool) {
        return admins[account] || account == owner();
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                      ADMIN: FARM MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new farm. Only owner (admin).
     * @param stakeToken Token users will deposit
     * @param lockDuration Optional lock period in seconds (0 = no lock)
     * @param earlyWithdrawBps Penalty for early withdrawal in basis points (0 = no penalty)
     */
    function createFarm(
        IERC20 stakeToken,
        uint256 lockDuration,
        uint256 earlyWithdrawBps
    ) external onlyAdmin returns (uint256 farmId) {
        require(address(stakeToken) != address(0), "Invalid stake token");
        require(earlyWithdrawBps <= 5000, "Max 50% penalty");

        farms.push(Farm({
            stakeToken: stakeToken,
            creator: msg.sender,
            totalShares: 0,
            totalStaked: 0,
            active: true,
            lockDuration: lockDuration,
            earlyWithdrawBps: earlyWithdrawBps
        }));

        farmId = farms.length - 1;
        emit FarmCreated(farmId, msg.sender, address(stakeToken));
    }

    /**
     * @notice Add a reward stream to a farm. Only owner.
     * @param farmId Target farm
     * @param rewardToken Token to distribute
     * @param totalBudget Total tokens to stream
     * @param startTime When emissions begin
     * @param endTime When emissions end
     */
    function addRewardStream(
        uint256 farmId,
        IERC20 rewardToken,
        uint256 totalBudget,
        uint256 startTime,
        uint256 endTime
    ) external onlyAdmin nonReentrant {
        require(farmId < farms.length, "Invalid farm");
        require(address(rewardToken) != address(0), "Invalid reward token");
        require(endTime > startTime, "End must be after start");
        require(totalBudget > 0, "Budget must be > 0");

        // Transfer reward tokens in
        rewardToken.safeTransferFrom(msg.sender, address(this), totalBudget);

        uint256 duration = endTime - startTime;
        uint256 rewardRate = (totalBudget * 1e18) / duration; // scaled by 1e18

        farmRewards[farmId].push(RewardStream({
            token: rewardToken,
            rewardRate: rewardRate,
            startTime: startTime,
            endTime: endTime,
            lastUpdateTime: startTime,
            accRewardPerShare: 0,
            totalBudget: totalBudget,
            totalDistributed: 0
        }));

        uint256 rewardIdx = farmRewards[farmId].length - 1;
        emit RewardStreamAdded(farmId, rewardIdx, address(rewardToken), rewardRate, startTime, endTime);
    }

    /**
     * @notice Toggle farm active status
     */
    function setFarmActive(uint256 farmId, bool active) external onlyAdmin {
        require(farmId < farms.length, "Invalid farm");
        farms[farmId].active = active;
        emit FarmActiveToggled(farmId, active);
    }

    /**
     * @notice Update boost tiers
     */
    function setBoostTiers(uint256[] calldata durations, uint256[] calldata multipliers) external onlyAdmin {
        require(durations.length == multipliers.length, "Length mismatch");
        delete boostDurations;
        delete boostMultipliers;
        for (uint256 i = 0; i < durations.length; i++) {
            require(multipliers[i] >= 1e18, "Min 1x boost");
            boostDurations.push(durations[i]);
            boostMultipliers.push(multipliers[i]);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                      USER: DEPOSIT / WITHDRAW / CLAIM
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Deposit tokens into a farm. Mints NFT position receipt.
     * @param farmId Target farm
     * @param amount Amount of stake tokens to deposit
     * @param lockTier Index into boost tiers (0 = no lock/base boost)
     */
    function deposit(uint256 farmId, uint256 amount, uint256 lockTier) external nonReentrant returns (uint256 tokenId) {
        require(farmId < farms.length, "Invalid farm");
        Farm storage farm = farms[farmId];
        require(farm.active, "Farm not active");
        require(amount > 0, "Amount must be > 0");

        // Update all reward streams for this farm
        _updateFarmRewards(farmId);

        // Transfer stake tokens
        farm.stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate boost
        uint256 boost = 1e18; // base 1x
        uint256 lockExpiry = 0;

        if (lockTier > 0 && lockTier <= boostDurations.length) {
            uint256 tierIdx = lockTier - 1;
            boost = boostMultipliers[tierIdx];
            lockExpiry = block.timestamp + boostDurations[tierIdx];
        } else if (farm.lockDuration > 0) {
            lockExpiry = block.timestamp + farm.lockDuration;
        }

        uint256 shares = (amount * boost) / 1e18;

        // Mint NFT position
        tokenId = nextTokenId++;
        positions[tokenId] = Position({
            farmId: farmId,
            amount: amount,
            shares: shares,
            depositTime: block.timestamp,
            lockExpiry: lockExpiry,
            boostMultiplier: boost
        });

        // Set reward debt for all active streams
        uint256 rewardCount = farmRewards[farmId].length;
        for (uint256 i = 0; i < rewardCount; i++) {
            rewardDebt[tokenId][i] = (shares * farmRewards[farmId][i].accRewardPerShare) / PRECISION;
        }

        // Update farm totals
        farm.totalShares += shares;
        farm.totalStaked += amount;

        _safeMint(msg.sender, tokenId);
        emit Deposited(tokenId, farmId, msg.sender, amount, shares);
    }

    /**
     * @notice Withdraw staked tokens and burn NFT position.
     * @param tokenId Position NFT to withdraw
     */
    function withdraw(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not position owner");

        Position storage pos = positions[tokenId];
        Farm storage farm = farms[pos.farmId];

        // Update rewards and claim pending
        _updateFarmRewards(pos.farmId);
        _claimRewards(tokenId);

        uint256 amount = pos.amount;
        uint256 penalty = 0;

        // Check lock and apply penalty if early
        if (pos.lockExpiry > 0 && block.timestamp < pos.lockExpiry && farm.earlyWithdrawBps > 0) {
            penalty = (amount * farm.earlyWithdrawBps) / BASIS_POINTS;
        }

        // Update farm totals
        farm.totalShares -= pos.shares;
        farm.totalStaked -= amount;

        // Clean up
        delete positions[tokenId];
        _burn(tokenId);

        // Transfer tokens
        uint256 userAmount = amount - penalty;
        farm.stakeToken.safeTransfer(msg.sender, userAmount);

        // Penalty stays in contract (can be recovered by admin)
        emit Withdrawn(tokenId, pos.farmId, msg.sender, userAmount, penalty);
    }

    /**
     * @notice Claim all pending rewards for a position without withdrawing.
     * @param tokenId Position NFT
     */
    function claim(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not position owner");

        Position storage pos = positions[tokenId];
        _updateFarmRewards(pos.farmId);
        _claimRewards(tokenId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function farmCount() external view returns (uint256) {
        return farms.length;
    }

    function getFarm(uint256 farmId) external view returns (
        address stakeToken,
        uint256 totalShares,
        uint256 totalStaked,
        bool active,
        uint256 lockDuration,
        uint256 earlyWithdrawBps,
        uint256 rewardStreamCount
    ) {
        require(farmId < farms.length, "Invalid farm");
        Farm storage f = farms[farmId];
        return (
            address(f.stakeToken),
            f.totalShares,
            f.totalStaked,
            f.active,
            f.lockDuration,
            f.earlyWithdrawBps,
            farmRewards[farmId].length
        );
    }

    function getRewardStream(uint256 farmId, uint256 rewardIdx) external view returns (
        address token,
        uint256 rewardRate,
        uint256 startTime,
        uint256 endTime,
        uint256 totalBudget,
        uint256 totalDistributed,
        uint256 accRewardPerShare
    ) {
        require(farmId < farms.length, "Invalid farm");
        require(rewardIdx < farmRewards[farmId].length, "Invalid reward");
        RewardStream storage r = farmRewards[farmId][rewardIdx];
        return (
            address(r.token),
            r.rewardRate,
            r.startTime,
            r.endTime,
            r.totalBudget,
            r.totalDistributed,
            r.accRewardPerShare
        );
    }

    function getPosition(uint256 tokenId) external view returns (
        uint256 farmId,
        uint256 amount,
        uint256 shares,
        uint256 depositTime,
        uint256 lockExpiry,
        uint256 boostMultiplier
    ) {
        require(_ownerOf(tokenId) != address(0), "Invalid position");
        Position storage p = positions[tokenId];
        return (p.farmId, p.amount, p.shares, p.depositTime, p.lockExpiry, p.boostMultiplier);
    }

    /**
     * @notice Calculate pending rewards for a position across all streams.
     */
    function pendingRewards(uint256 tokenId) external view returns (
        address[] memory tokens,
        uint256[] memory amounts
    ) {
        require(_ownerOf(tokenId) != address(0), "Invalid position");
        Position storage pos = positions[tokenId];
        uint256 farmId = pos.farmId;
        uint256 rewardCount = farmRewards[farmId].length;

        tokens = new address[](rewardCount);
        amounts = new uint256[](rewardCount);

        for (uint256 i = 0; i < rewardCount; i++) {
            RewardStream storage stream = farmRewards[farmId][i];
            tokens[i] = address(stream.token);

            uint256 accPerShare = stream.accRewardPerShare;

            // Simulate update
            if (farms[farmId].totalShares > 0 && block.timestamp > stream.lastUpdateTime) {
                uint256 timeEnd = block.timestamp < stream.endTime ? block.timestamp : stream.endTime;
                uint256 timeStart = stream.lastUpdateTime < stream.startTime ? stream.startTime : stream.lastUpdateTime;
                if (timeEnd > timeStart) {
                    uint256 elapsed = timeEnd - timeStart;
                    uint256 reward = (elapsed * stream.rewardRate) / 1e18;
                    uint256 remaining = stream.totalBudget - stream.totalDistributed;
                    if (reward > remaining) reward = remaining;
                    accPerShare += (reward * PRECISION) / farms[farmId].totalShares;
                }
            }

            uint256 pending = (pos.shares * accPerShare) / PRECISION - rewardDebt[tokenId][i];
            amounts[i] = pending;
        }
    }

    /**
     * @notice Get all positions owned by an address.
     */
    function positionsOf(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextTokenId && idx < balance; i++) {
            if (_ownerOf(i) == owner) {
                tokenIds[idx++] = i;
            }
        }
        return tokenIds;
    }

    function getBoostTiers() external view returns (uint256[] memory durations, uint256[] memory multipliers) {
        return (boostDurations, boostMultipliers);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                      ADMIN: RECOVERY
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Recover penalty tokens or accidentally sent tokens.
     */
    function recoverTokens(IERC20 token, uint256 amount) external onlyAdmin {
        token.safeTransfer(owner(), amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                          INTERNAL
    // ═══════════════════════════════════════════════════════════════════════

    function _updateFarmRewards(uint256 farmId) internal {
        uint256 rewardCount = farmRewards[farmId].length;
        for (uint256 i = 0; i < rewardCount; i++) {
            _updateRewardStream(farmId, i);
        }
    }

    function _updateRewardStream(uint256 farmId, uint256 rewardIdx) internal {
        RewardStream storage stream = farmRewards[farmId][rewardIdx];
        Farm storage farm = farms[farmId];

        if (block.timestamp <= stream.lastUpdateTime) return;
        if (farm.totalShares == 0) {
            stream.lastUpdateTime = block.timestamp;
            return;
        }

        uint256 timeEnd = block.timestamp < stream.endTime ? block.timestamp : stream.endTime;
        uint256 timeStart = stream.lastUpdateTime < stream.startTime ? stream.startTime : stream.lastUpdateTime;

        if (timeEnd <= timeStart) {
            stream.lastUpdateTime = block.timestamp;
            return;
        }

        uint256 elapsed = timeEnd - timeStart;
        uint256 reward = (elapsed * stream.rewardRate) / 1e18;

        // Cap at remaining budget
        uint256 remaining = stream.totalBudget - stream.totalDistributed;
        if (reward > remaining) reward = remaining;

        if (reward > 0) {
            stream.accRewardPerShare += (reward * PRECISION) / farm.totalShares;
            stream.totalDistributed += reward;
        }

        stream.lastUpdateTime = block.timestamp;
    }

    function _claimRewards(uint256 tokenId) internal {
        Position storage pos = positions[tokenId];
        uint256 farmId = pos.farmId;
        uint256 rewardCount = farmRewards[farmId].length;
        address owner = _ownerOf(tokenId);

        for (uint256 i = 0; i < rewardCount; i++) {
            RewardStream storage stream = farmRewards[farmId][i];
            uint256 accumulated = (pos.shares * stream.accRewardPerShare) / PRECISION;
            uint256 pending = accumulated - rewardDebt[tokenId][i];

            if (pending > 0) {
                rewardDebt[tokenId][i] = accumulated;
                stream.token.safeTransfer(owner, pending);
                emit RewardsClaimed(tokenId, owner, address(stream.token), pending);
            } else {
                rewardDebt[tokenId][i] = accumulated;
            }
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Invalid token");
        Position storage pos = positions[tokenId];
        return string(abi.encodePacked(
            "Stream Farm Position #", _toString(tokenId),
            " | Farm ", _toString(pos.farmId),
            " | ", _toString(pos.amount / 1e18), " staked"
        ));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (value != 0) { digits -= 1; buffer[digits] = bytes1(uint8(48 + uint256(value % 10))); value /= 10; }
        return string(buffer);
    }
}