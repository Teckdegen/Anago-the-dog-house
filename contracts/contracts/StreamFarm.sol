// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
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
contract StreamFarm is ERC721, Ownable2Step, ReentrancyGuard {
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
        uint256 totalDistributed;   // Total accrued into accRewardPerShare (not yet claimed)
        uint256 totalClaimed;       // Total actually transferred to stakers
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
    /// @dev Max boost multiplier (5x) — prevents admin from setting extreme tiers
    uint256 public constant MAX_BOOST_MULTIPLIER = 5e18;
    /// @dev Cap reward streams per farm — prevents gas-griefing via unbounded loops
    uint256 public constant MAX_REWARD_STREAMS_PER_FARM = 16;

    // Protocol admins: whitelist operators, add admins, recover tokens, boost tiers
    mapping(address => bool) public admins;

    // Whitelisted wallets allowed to create and manage their own farms
    mapping(address => bool) public farmOperators;

    /// @dev Farm IDs per creator — for listing a wallet's pools without scanning all farms.
    mapping(address => uint256[]) private _farmsByCreator;

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
    event FarmOperatorUpdated(address indexed operator, bool allowed);
    event EmergencyWithdrawn(uint256 indexed tokenId, uint256 indexed farmId, address indexed user, uint256 amount);

    // ═══════════════════════════════════════════════════════════════════════
    //                          MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "Not admin");
        _;
    }

    modifier onlyFarmOperator() {
        require(
            farmOperators[msg.sender] || admins[msg.sender] || msg.sender == owner(),
            "Not farm operator"
        );
        _;
    }

    /** Farm creator only — whitelisted operators cannot manage another user's pool. */
    modifier onlyFarmCreator(uint256 farmId) {
        require(farmId < farms.length, "Invalid farm");
        require(msg.sender == farms[farmId].creator, "Not farm creator");
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

    /**
     * @notice Whitelist or revoke a wallet that may create and manage farms.
     */
    function setFarmOperator(address operator, bool allowed) external onlyAdmin {
        require(operator != address(0), "Invalid address");
        farmOperators[operator] = allowed;
        emit FarmOperatorUpdated(operator, allowed);
    }

    function isFarmOperator(address account) external view returns (bool) {
        return farmOperators[account] || admins[account] || account == owner();
    }

    function getFarmCreator(uint256 farmId) external view returns (address) {
        require(farmId < farms.length, "Invalid farm");
        return farms[farmId].creator;
    }

    function isFarmCreator(address account, uint256 farmId) external view returns (bool) {
        require(farmId < farms.length, "Invalid farm");
        return account == farms[farmId].creator;
    }

    function farmsOfCreator(address creator) external view returns (uint256[] memory) {
        return _farmsByCreator[creator];
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                      FARM OPERATOR: CREATE & MANAGE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new farm. Whitelisted operators only.
     * @param stakeToken Token users will deposit
     * @param lockDuration Optional lock period in seconds (0 = no lock)
     * @param earlyWithdrawBps Penalty for early withdrawal in basis points (0 = no penalty)
     */
    function createFarm(
        IERC20 stakeToken,
        uint256 lockDuration,
        uint256 earlyWithdrawBps
    ) external onlyFarmOperator returns (uint256 farmId) {
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
        _farmsByCreator[msg.sender].push(farmId);
        emit FarmCreated(farmId, msg.sender, address(stakeToken));
    }

    /**
     * @notice Add a reward stream to a farm. Only the wallet that created this farm.
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
    ) external onlyFarmCreator(farmId) nonReentrant {
        require(address(rewardToken) != address(0), "Invalid reward token");
        require(endTime > startTime, "End must be after start");
        require(startTime >= block.timestamp, "Start in past");
        require(totalBudget > 0, "Budget must be > 0");
        require(farmRewards[farmId].length < MAX_REWARD_STREAMS_PER_FARM, "Max streams");

        uint256 balBefore = rewardToken.balanceOf(address(this));
        rewardToken.safeTransferFrom(msg.sender, address(this), totalBudget);
        uint256 received = rewardToken.balanceOf(address(this)) - balBefore;
        require(received > 0, "Zero received");

        uint256 duration = endTime - startTime;
        uint256 rewardRate = (received * 1e18) / duration;

        farmRewards[farmId].push(RewardStream({
            token: rewardToken,
            rewardRate: rewardRate,
            startTime: startTime,
            endTime: endTime,
            lastUpdateTime: startTime,
            accRewardPerShare: 0,
            totalBudget: received,
            totalDistributed: 0,
            totalClaimed: 0
        }));

        uint256 rewardIdx = farmRewards[farmId].length - 1;
        emit RewardStreamAdded(farmId, rewardIdx, address(rewardToken), rewardRate, startTime, endTime);
    }

    /**
     * @notice Toggle farm active status. Only the farm creator (not other operators).
     */
    function setFarmActive(uint256 farmId, bool active) external onlyFarmCreator(farmId) {
        farms[farmId].active = active;
        emit FarmActiveToggled(farmId, active);
    }

    /**
     * @notice Protocol admin emergency pause / unpause for any farm.
     */
    function setFarmActiveByAdmin(uint256 farmId, bool active) external onlyAdmin {
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
            require(durations[i] > 0, "Zero duration");
            require(multipliers[i] >= 1e18, "Min 1x boost");
            require(multipliers[i] <= MAX_BOOST_MULTIPLIER, "Max 5x boost");
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

        uint256 balBefore = farm.stakeToken.balanceOf(address(this));
        farm.stakeToken.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = farm.stakeToken.balanceOf(address(this)) - balBefore;
        require(received > 0, "Zero received");

        // Calculate boost — farm lock duration is a floor; tier cannot shorten it
        uint256 boost = 1e18; // base 1x
        uint256 lockExpiry = 0;

        if (lockTier > 0) {
            require(lockTier <= boostDurations.length, "Invalid lock tier");
            uint256 tierIdx = lockTier - 1;
            uint256 tierDuration = boostDurations[tierIdx];
            if (farm.lockDuration > 0) {
                require(tierDuration >= farm.lockDuration, "Tier below farm lock");
            }
            boost = boostMultipliers[tierIdx];
            lockExpiry = block.timestamp + tierDuration;
        }

        if (farm.lockDuration > 0) {
            uint256 farmExpiry = block.timestamp + farm.lockDuration;
            if (lockExpiry < farmExpiry) {
                lockExpiry = farmExpiry;
            }
        }

        uint256 shares = (received * boost) / 1e18;

        // Mint NFT position
        tokenId = nextTokenId++;
        positions[tokenId] = Position({
            farmId: farmId,
            amount: received,
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
        farm.totalStaked += received;

        _mint(msg.sender, tokenId);
        emit Deposited(tokenId, farmId, msg.sender, received, shares);
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

        // Enforce lock: boosted positions cannot withdraw early; base lock requires penalty or wait
        if (pos.lockExpiry > 0 && block.timestamp < pos.lockExpiry) {
            if (pos.boostMultiplier > 1e18) {
                revert("Boost lock active");
            }
            if (farm.earlyWithdrawBps > 0) {
                penalty = (amount * farm.earlyWithdrawBps) / BASIS_POINTS;
            } else {
                revert("Still locked");
            }
        }

        // Update farm totals
        farm.totalShares -= pos.shares;
        farm.totalStaked -= amount;

        // Clean up position and reward debt
        uint256 rewardCount = farmRewards[pos.farmId].length;
        for (uint256 i = 0; i < rewardCount; i++) {
            delete rewardDebt[tokenId][i];
        }
        delete positions[tokenId];
        _burn(tokenId);

        // Transfer tokens
        uint256 userAmount = amount - penalty;
        farm.stakeToken.safeTransfer(msg.sender, userAmount);

        // Penalty stays in contract (can be recovered by admin)
        emit Withdrawn(tokenId, pos.farmId, msg.sender, userAmount, penalty);
    }

    /**
     * @notice Escape hatch: withdraw staked principal without updating reward streams.
     *         Skips pending reward accrual/claims — use when stream spam bricks normal withdraw.
     */
    function emergencyWithdraw(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not position owner");

        Position storage pos = positions[tokenId];
        Farm storage farm = farms[pos.farmId];

        uint256 amount = pos.amount;
        uint256 penalty = 0;

        if (pos.lockExpiry > 0 && block.timestamp < pos.lockExpiry) {
            if (pos.boostMultiplier > 1e18) {
                revert("Boost lock active");
            }
            if (farm.earlyWithdrawBps > 0) {
                penalty = (amount * farm.earlyWithdrawBps) / BASIS_POINTS;
            } else {
                revert("Still locked");
            }
        }

        farm.totalShares -= pos.shares;
        farm.totalStaked -= amount;

        uint256 rewardCount = farmRewards[pos.farmId].length;
        for (uint256 i = 0; i < rewardCount; i++) {
            delete rewardDebt[tokenId][i];
        }
        delete positions[tokenId];
        _burn(tokenId);

        uint256 userAmount = amount - penalty;
        farm.stakeToken.safeTransfer(msg.sender, userAmount);

        emit EmergencyWithdrawn(tokenId, pos.farmId, msg.sender, userAmount);
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
        uint256 totalClaimed,
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
            r.totalClaimed,
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
                    uint256 remaining = stream.totalBudget - stream.totalDistributed;
                    uint256 reward;
                    if (timeEnd >= stream.endTime && remaining > 0) {
                        reward = remaining;
                    } else {
                        reward = (elapsed * stream.rewardRate) / 1e18;
                        if (reward > remaining) reward = remaining;
                    }
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
     * @notice Recover penalty tokens or accidentally sent tokens (never user stake/reward escrow).
     */
    function recoverTokens(IERC20 token, uint256 amount) external onlyAdmin {
        uint256 recoverable = _recoverableBalance(token);
        require(amount <= recoverable, "Exceeds non-escrow balance");
        token.safeTransfer(owner(), amount);
    }

    /**
     * @notice Balance that is not reserved for stakers or undistributed rewards.
     */
    function recoverableBalance(IERC20 token) external view returns (uint256) {
        return _recoverableBalance(token);
    }

    function _recoverableBalance(IERC20 token) internal view returns (uint256) {
        uint256 balance = token.balanceOf(address(this));
        uint256 liability = _tokenLiability(token);
        return balance > liability ? balance - liability : 0;
    }

    function _tokenLiability(IERC20 token) internal view returns (uint256) {
        uint256 liability;
        uint256 farmLen = farms.length;
        for (uint256 f = 0; f < farmLen; f++) {
            if (address(farms[f].stakeToken) == address(token)) {
                liability += farms[f].totalStaked;
            }
            RewardStream[] storage streams = farmRewards[f];
            uint256 streamLen = streams.length;
            for (uint256 r = 0; r < streamLen; r++) {
                if (address(streams[r].token) == address(token)) {
                    uint256 remaining = streams[r].totalBudget - streams[r].totalClaimed;
                    liability += remaining;
                }
            }
        }
        return liability;
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
        uint256 remaining = stream.totalBudget - stream.totalDistributed;
        uint256 reward;
        if (timeEnd >= stream.endTime && remaining > 0) {
            reward = remaining;
        } else {
            reward = (elapsed * stream.rewardRate) / 1e18;
            if (reward > remaining) reward = remaining;
        }

        if (reward > 0) {
            stream.accRewardPerShare += (reward * PRECISION) / farm.totalShares;
            stream.totalDistributed += reward;
        }

        stream.lastUpdateTime = block.timestamp;
    }

    function _claimRewards(uint256 tokenId) internal {
        _claimRewardsTo(tokenId, _ownerOf(tokenId));
    }

    function _claimRewardsTo(uint256 tokenId, address recipient) internal {
        Position storage pos = positions[tokenId];
        uint256 farmId = pos.farmId;
        uint256 rewardCount = farmRewards[farmId].length;

        for (uint256 i = 0; i < rewardCount; i++) {
            RewardStream storage stream = farmRewards[farmId][i];
            uint256 accumulated = (pos.shares * stream.accRewardPerShare) / PRECISION;
            uint256 pending = accumulated - rewardDebt[tokenId][i];

            if (pending > 0) {
                rewardDebt[tokenId][i] = accumulated;
                stream.token.safeTransfer(recipient, pending);
                stream.totalClaimed += pending;
                emit RewardsClaimed(tokenId, recipient, address(stream.token), pending);
            } else {
                rewardDebt[tokenId][i] = accumulated;
            }
        }
    }

    /// @dev Auto-claim pending rewards to the outgoing owner on NFT transfer.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            Position storage pos = positions[tokenId];
            _updateFarmRewards(pos.farmId);
            _claimRewardsTo(tokenId, from);
        }
        return super._update(to, tokenId, auth);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Invalid token");
        Position storage pos = positions[tokenId];
        
        string memory boostStr = _toString(pos.boostMultiplier / 1e18);
        string memory amountStr = _toString(pos.amount / 1e18);
        string memory farmStr = _toString(pos.farmId);
        string memory idStr = _toString(tokenId);
        
        // Generate SVG
        string memory svg = string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">',
            '<defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#0D0B14"/><stop offset="100%" style="stop-color:#1a1528"/></linearGradient></defs>',
            '<rect width="400" height="250" fill="url(#bg)" rx="16"/>',
            '<rect x="1" y="1" width="398" height="248" rx="15" fill="none" stroke="#6B5CE7" stroke-opacity="0.4"/>',
            '<text x="24" y="36" font-family="monospace" font-size="10" fill="#9B7FD4" opacity="0.6">STREAM FARM</text>',
            '<text x="24" y="70" font-family="sans-serif" font-size="22" font-weight="bold" fill="#EDE0FF">Position #', idStr, '</text>',
            '<text x="24" y="110" font-family="monospace" font-size="12" fill="#C4A8F0">Farm #', farmStr, '</text>',
            '<rect x="24" y="130" width="352" height="1" fill="#6B5CE7" opacity="0.2"/>',
            '<text x="24" y="165" font-family="monospace" font-size="11" fill="#9B7FD4">STAKED</text>',
            '<text x="24" y="185" font-family="sans-serif" font-size="18" fill="#EDE0FF">', amountStr, ' tokens</text>',
            '<text x="280" y="165" font-family="monospace" font-size="11" fill="#9B7FD4">BOOST</text>',
            '<text x="280" y="185" font-family="sans-serif" font-size="18" fill="#EDE0FF">', boostStr, 'x</text>',
            '<circle cx="360" cy="36" r="16" fill="#6B5CE7" opacity="0.2"/><text x="354" y="41" font-family="sans-serif" font-size="14" fill="#C4A8F0">&#x26A1;</text>',
            '</svg>'
        ));

        string memory json = string(abi.encodePacked(
            '{"name":"Stream Farm Position #', idStr,
            '","description":"', amountStr, ' tokens staked in Farm #', farmStr, ' with ', boostStr, 'x boost',
            '","image":"data:image/svg+xml;base64,', _base64Encode(bytes(svg)),
            '","attributes":[{"trait_type":"Farm","value":"', farmStr,
            '"},{"trait_type":"Staked","value":"', amountStr,
            '"},{"trait_type":"Boost","value":"', boostStr, 'x"}]}'
        ));
        
        return string(abi.encodePacked("data:application/json;base64,", _base64Encode(bytes(json))));
    }

    // Base64 encoding for on-chain SVG
    function _base64Encode(bytes memory data) internal pure returns (string memory) {
        string memory TABLE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        if (data.length == 0) return "";
        uint256 encodedLen = 4 * ((data.length + 2) / 3);
        bytes memory result = new bytes(encodedLen);
        bytes memory table = bytes(TABLE);

        uint256 dataPtr;
        uint256 resultPtr;
        assembly { dataPtr := add(data, 32) resultPtr := add(result, 32) }

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