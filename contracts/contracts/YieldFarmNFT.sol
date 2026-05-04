// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title YieldFarmNFT - Advanced Liquidity Arena for Meme Coins
 * @notice NFT-based multi-reward farming with vote-escrow, bribes, and dynamic emissions
 * @dev Each stake position is an NFT - fully transferable and tradeable
 * 
 * KEY FEATURES:
 * - Permissionless pool creation (with fee/stake requirement)
 * - Vote-escrow locking for boosted rewards
 * - Bribe marketplace for emission control
 * - Dynamic emissions based on performance
 * - Multi-reward per pool
 * - Real-time leaderboards
 */
contract YieldFarmNFT is ERC721, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════
    //                            STRUCTS
    // ═══════════════════════════════════════════════════════════════════════

    struct PoolInfo {
        IERC20 stakeToken;          // Token users stake
        address creator;            // Pool creator
        uint256 totalStaked;        // Total staked
        uint256 createdAt;          // Creation timestamp
        bool verified;              // Verified by platform
        bool active;                // Active status
    }

    struct RewardInfo {
        IERC20 rewardToken;         // Reward token
        uint256 rewardPerSecond;    // Base reward rate
        uint256 accRewardPerShare;  // Accumulated per share (1e18 scaled)
        uint256 lastRewardTime;     // Last update
        uint256 endTime;            // End time (0 = infinite)
        uint256 totalSupply;        // Total allocated
        uint256 totalPaid;          // Total paid out
        address funder;             // Who funded this reward
    }

    struct StakePosition {
        uint256 poolId;             // Pool ID
        uint256 amount;             // Staked amount
        uint256 stakedAt;           // Stake time
        uint256 boost;              // Boost multiplier (1e18 = 1x)
        mapping(uint256 => uint256) rewardDebt;
    }

    struct VoteLock {
        uint256 amount;             // Locked amount
        uint256 unlockTime;         // Unlock timestamp
        uint256 votingPower;        // Voting power
    }

    struct PoolVotes {
        uint256 totalVotes;         // Total votes for pool
        mapping(address => uint256) userVotes;  // User votes
    }

    struct Bribe {
        IERC20 token;               // Bribe token
        uint256 amount;             // Bribe amount
        uint256 perVote;            // Amount per vote
        address creator;            // Bribe creator
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                            STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════

    // Platform token (for locking/voting)
    IERC20 public platformToken;

    // Pools
    PoolInfo[] public pools;
    mapping(uint256 => RewardInfo[]) public poolRewards;
    mapping(uint256 => StakePosition) public positions;
    uint256 public nextTokenId;

    // Vote-Escrow
    mapping(address => VoteLock) public voteLocks;
    mapping(uint256 => PoolVotes) public poolVotes;
    uint256 public totalVotingPower;

    // Bribes
    mapping(uint256 => Bribe[]) public poolBribes;  // poolId => bribes
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public bribeClaimed;  // poolId => user => bribeId => claimed

    // Platform settings
    uint256 public poolCreationFee = 100 * 1e18;  // 100 tokens to create pool
    uint256 public minLockDuration = 7 days;
    uint256 public maxLockDuration = 365 days;
    uint256 public platformFeePercent = 100;  // 1% (basis points)
    uint256 public constant BASIS_POINTS = 10000;

    // Dynamic emissions
    uint256 public baseEmissionRate = 1e18;  // 1 token per second base
    uint256 public emissionMultiplier = 1e18;  // 1x multiplier

    // ═══════════════════════════════════════════════════════════════════════
    //                            EVENTS
    // ═══════════════════════════════════════════════════════════════════════

    event PoolCreated(uint256 indexed poolId, address indexed creator, address stakeToken);
    event PoolVerified(uint256 indexed poolId);
    event RewardAdded(uint256 indexed poolId, uint256 rewardId, address token, uint256 amount);
    event Staked(address indexed user, uint256 indexed tokenId, uint256 poolId, uint256 amount);
    event Unstaked(address indexed user, uint256 indexed tokenId, uint256 amount);
    event RewardClaimed(address indexed user, uint256 tokenId, uint256 rewardId, uint256 amount);
    event TokensLocked(address indexed user, uint256 amount, uint256 unlockTime, uint256 votingPower);
    event TokensUnlocked(address indexed user, uint256 amount);
    event Voted(address indexed user, uint256 indexed poolId, uint256 votes);
    event BribeAdded(uint256 indexed poolId, uint256 bribeId, address token, uint256 amount);
    event BribeClaimed(address indexed user, uint256 poolId, uint256 bribeId, uint256 amount);

    // ═══════════════════════════════════════════════════════════════════════
    //                            CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════

    constructor(IERC20 _platformToken) ERC721("Yield Farm Position", "FARM") Ownable(msg.sender) {
        platformToken = _platformToken;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                        PERMISSIONLESS POOL CREATION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new farm pool (permissionless with fee)
     */
    function createPool(IERC20 stakeToken) external nonReentrant returns (uint256) {
        require(address(stakeToken) != address(0), "Invalid token");

        // Charge creation fee
        platformToken.safeTransferFrom(msg.sender, address(this), poolCreationFee);

        pools.push(PoolInfo({
            stakeToken: stakeToken,
            creator: msg.sender,
            totalStaked: 0,
            createdAt: block.timestamp,
            verified: false,
            active: true
        }));

        uint256 poolId = pools.length - 1;
        emit PoolCreated(poolId, msg.sender, address(stakeToken));
        
        return poolId;
    }

    /**
     * @notice Add reward to pool (anyone can fund)
     */
    function addReward(
        uint256 poolId,
        IERC20 rewardToken,
        uint256 rewardPerSecond,
        uint256 duration,
        uint256 totalSupply
    ) external nonReentrant {
        require(poolId < pools.length, "Invalid pool");
        require(address(rewardToken) != address(0), "Invalid token");
        require(totalSupply > 0, "Supply must be > 0");

        // Transfer rewards
        rewardToken.safeTransferFrom(msg.sender, address(this), totalSupply);

        uint256 endTime = duration > 0 ? block.timestamp + duration : 0;

        poolRewards[poolId].push(RewardInfo({
            rewardToken: rewardToken,
            rewardPerSecond: rewardPerSecond,
            accRewardPerShare: 0,
            lastRewardTime: block.timestamp,
            endTime: endTime,
            totalSupply: totalSupply,
            totalPaid: 0,
            funder: msg.sender
        }));

        emit RewardAdded(poolId, poolRewards[poolId].length - 1, address(rewardToken), totalSupply);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                        VOTE-ESCROW LOCKING
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Lock platform tokens for voting power and boost
     */
    function lock(uint256 amount, uint256 duration) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(duration >= minLockDuration && duration <= maxLockDuration, "Invalid duration");

        VoteLock storage userLock = voteLocks[msg.sender];
        
        // Transfer tokens
        platformToken.safeTransferFrom(msg.sender, address(this), amount);

        // Calculate voting power (longer lock = more power)
        uint256 votingPower = (amount * duration) / maxLockDuration;

        // Update lock
        userLock.amount += amount;
        userLock.unlockTime = block.timestamp + duration;
        userLock.votingPower += votingPower;
        totalVotingPower += votingPower;

        emit TokensLocked(msg.sender, amount, userLock.unlockTime, votingPower);
    }

    /**
     * @notice Unlock tokens after lock period
     */
    function unlock() external nonReentrant {
        VoteLock storage userLock = voteLocks[msg.sender];
        require(userLock.amount > 0, "Nothing locked");
        require(block.timestamp >= userLock.unlockTime, "Still locked");

        uint256 amount = userLock.amount;
        totalVotingPower -= userLock.votingPower;

        delete voteLocks[msg.sender];

        platformToken.safeTransfer(msg.sender, amount);

        emit TokensUnlocked(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                        VOTING & EMISSIONS
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Vote for pool to direct emissions
     */
    function vote(uint256 poolId, uint256 votes) external {
        require(poolId < pools.length, "Invalid pool");
        VoteLock storage userLock = voteLocks[msg.sender];
        require(userLock.votingPower >= votes, "Insufficient voting power");

        PoolVotes storage pv = poolVotes[poolId];
        
        // Remove old votes
        uint256 oldVotes = pv.userVotes[msg.sender];
        pv.totalVotes = pv.totalVotes - oldVotes + votes;
        pv.userVotes[msg.sender] = votes;

        emit Voted(msg.sender, poolId, votes);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                        BRIBE MARKETPLACE
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Add bribe to attract votes to pool
     */
    function addBribe(
        uint256 poolId,
        IERC20 token,
        uint256 amount
    ) external nonReentrant {
        require(poolId < pools.length, "Invalid pool");
        require(amount > 0, "Amount must be > 0");

        token.safeTransferFrom(msg.sender, address(this), amount);

        uint256 totalVotes = poolVotes[poolId].totalVotes;
        uint256 perVote = totalVotes > 0 ? amount / totalVotes : 0;

        poolBribes[poolId].push(Bribe({
            token: token,
            amount: amount,
            perVote: perVote,
            creator: msg.sender
        }));

        emit BribeAdded(poolId, poolBribes[poolId].length - 1, address(token), amount);
    }

    /**
     * @notice Claim bribes for voting
     */
    function claimBribe(uint256 poolId, uint256 bribeId) external nonReentrant {
        require(poolId < pools.length, "Invalid pool");
        require(bribeId < poolBribes[poolId].length, "Invalid bribe");
        require(!bribeClaimed[poolId][msg.sender][bribeId], "Already claimed");

        uint256 userVotes = poolVotes[poolId].userVotes[msg.sender];
        require(userVotes > 0, "No votes");

        Bribe storage bribe = poolBribes[poolId][bribeId];
        uint256 reward = userVotes * bribe.perVote;

        bribeClaimed[poolId][msg.sender][bribeId] = true;

        bribe.token.safeTransfer(msg.sender, reward);

        emit BribeClaimed(msg.sender, poolId, bribeId, reward);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                        STAKING (NFT-BASED)
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Stake tokens and mint NFT
     */
    function stake(uint256 poolId, uint256 amount) external nonReentrant returns (uint256) {
        require(poolId < pools.length, "Invalid pool");
        require(pools[poolId].active, "Pool not active");
        require(amount > 0, "Amount must be > 0");

        PoolInfo storage pool = pools[poolId];
        _updateAllPoolRewards(poolId);

        pool.stakeToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 tokenId = nextTokenId++;
        StakePosition storage position = positions[tokenId];
        position.poolId = poolId;
        position.amount = amount;
        position.stakedAt = block.timestamp;
        
        // Calculate boost from vote-lock
        position.boost = _calculateBoost(msg.sender);

        // Set reward debt
        for (uint256 i = 0; i < poolRewards[poolId].length; i++) {
            uint256 boostedAmount = (amount * position.boost) / 1e18;
            position.rewardDebt[i] = (boostedAmount * poolRewards[poolId][i].accRewardPerShare) / 1e18;
        }

        pool.totalStaked += amount;
        _safeMint(msg.sender, tokenId);

        emit Staked(msg.sender, tokenId, poolId, amount);
        return tokenId;
    }

    /**
     * @notice Unstake and burn NFT
     */
    function unstake(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not owner");

        StakePosition storage position = positions[tokenId];
        uint256 poolId = position.poolId;
        uint256 amount = position.amount;

        PoolInfo storage pool = pools[poolId];
        _updateAllPoolRewards(poolId);
        _claimAllRewards(tokenId);

        pool.totalStaked -= amount;
        delete positions[tokenId];
        _burn(tokenId);

        // Take platform fee
        uint256 fee = (amount * platformFeePercent) / BASIS_POINTS;
        uint256 userAmount = amount - fee;

        pool.stakeToken.safeTransfer(msg.sender, userAmount);

        emit Unstaked(msg.sender, tokenId, userAmount);
    }

    /**
     * @notice Claim all rewards
     */
    function claimAllRewards(uint256 tokenId) external nonReentrant {
        require(_ownerOf(tokenId) == msg.sender, "Not owner");
        
        StakePosition storage position = positions[tokenId];
        _updateAllPoolRewards(position.poolId);
        _claimAllRewards(tokenId);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                        ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function verifyPool(uint256 poolId) external onlyOwner {
        require(poolId < pools.length, "Invalid pool");
        pools[poolId].verified = true;
        emit PoolVerified(poolId);
    }

    function setPoolActive(uint256 poolId, bool active) external onlyOwner {
        require(poolId < pools.length, "Invalid pool");
        pools[poolId].active = active;
    }

    function setPoolCreationFee(uint256 fee) external onlyOwner {
        poolCreationFee = fee;
    }

    function setPlatformFee(uint256 fee) external onlyOwner {
        require(fee <= 1000, "Max 10%");  // Max 10%
        platformFeePercent = fee;
    }

    function setEmissionRate(uint256 rate) external onlyOwner {
        baseEmissionRate = rate;
    }

    function emergencyRecover(IERC20 token, uint256 amount) external onlyOwner {
        token.safeTransfer(owner(), amount);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                        VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function getPosition(uint256 tokenId) external view returns (
        uint256 poolId,
        uint256 amount,
        uint256 stakedAt,
        uint256 boost
    ) {
        require(_ownerOf(tokenId) != address(0), "Invalid token");
        StakePosition storage pos = positions[tokenId];
        return (pos.poolId, pos.amount, pos.stakedAt, pos.boost);
    }

    function pendingAllRewards(uint256 tokenId) external view returns (uint256[] memory) {
        StakePosition storage position = positions[tokenId];
        uint256 poolId = position.poolId;
        uint256 rewardCount = poolRewards[poolId].length;
        
        uint256[] memory pending = new uint256[](rewardCount);
        for (uint256 i = 0; i < rewardCount; i++) {
            pending[i] = _pendingReward(tokenId, i);
        }
        return pending;
    }

    function positionsOf(address owner) external view returns (uint256[] memory) {
        uint256 balance = balanceOf(owner);
        uint256[] memory tokenIds = new uint256[](balance);
        
        uint256 index = 0;
        for (uint256 i = 0; i < nextTokenId && index < balance; i++) {
            if (_ownerOf(i) == owner) {
                tokenIds[index++] = i;
            }
        }
        return tokenIds;
    }

    function poolLength() external view returns (uint256) {
        return pools.length;
    }

    function poolRewardLength(uint256 poolId) external view returns (uint256) {
        return poolRewards[poolId].length;
    }

    function getUserVotingPower(address user) external view returns (uint256) {
        return voteLocks[user].votingPower;
    }

    function getPoolVotes(uint256 poolId) external view returns (uint256) {
        return poolVotes[poolId].totalVotes;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //                        INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════

    function _calculateBoost(address user) internal view returns (uint256) {
        VoteLock storage userLock = voteLocks[user];
        if (userLock.amount == 0) return 1e18;  // 1x base
        
        // Max 2.5x boost for max lock
        uint256 lockRatio = (userLock.unlockTime - block.timestamp) * 1e18 / maxLockDuration;
        return 1e18 + (lockRatio * 15) / 10;  // 1x + up to 1.5x
    }

    function _updatePool(uint256 poolId, uint256 rewardId) internal {
        RewardInfo storage reward = poolRewards[poolId][rewardId];
        PoolInfo storage pool = pools[poolId];

        if (block.timestamp <= reward.lastRewardTime || pool.totalStaked == 0) {
            reward.lastRewardTime = block.timestamp;
            return;
        }

        uint256 endTime = reward.endTime > 0 && block.timestamp >= reward.endTime
            ? reward.endTime
            : block.timestamp;

        if (reward.lastRewardTime >= endTime) return;

        uint256 timeElapsed = endTime - reward.lastRewardTime;
        
        // Apply dynamic emissions based on votes
        uint256 poolVoteShare = totalVotingPower > 0 
            ? (poolVotes[poolId].totalVotes * 1e18) / totalVotingPower
            : 1e18;
        
        uint256 adjustedRate = (reward.rewardPerSecond * poolVoteShare) / 1e18;
        uint256 rewardAmount = timeElapsed * adjustedRate;

        uint256 remaining = reward.totalSupply - reward.totalPaid;
        if (rewardAmount > remaining) rewardAmount = remaining;

        reward.accRewardPerShare += (rewardAmount * 1e18) / pool.totalStaked;
        reward.lastRewardTime = endTime;
    }

    function _updateAllPoolRewards(uint256 poolId) internal {
        for (uint256 i = 0; i < poolRewards[poolId].length; i++) {
            _updatePool(poolId, i);
        }
    }

    function _pendingReward(uint256 tokenId, uint256 rewardId) internal view returns (uint256) {
        StakePosition storage position = positions[tokenId];
        uint256 poolId = position.poolId;
        RewardInfo storage reward = poolRewards[poolId][rewardId];

        uint256 accRewardPerShare = reward.accRewardPerShare;
        uint256 boostedAmount = (position.amount * position.boost) / 1e18;

        return (boostedAmount * accRewardPerShare) / 1e18 - position.rewardDebt[rewardId];
    }

    function _claimAllRewards(uint256 tokenId) internal {
        StakePosition storage position = positions[tokenId];
        uint256 poolId = position.poolId;

        for (uint256 i = 0; i < poolRewards[poolId].length; i++) {
            uint256 pending = _pendingReward(tokenId, i);
            if (pending > 0) {
                RewardInfo storage reward = poolRewards[poolId][i];
                reward.totalPaid += pending;
                reward.rewardToken.safeTransfer(_ownerOf(tokenId), pending);

                uint256 boostedAmount = (position.amount * position.boost) / 1e18;
                position.rewardDebt[i] = (boostedAmount * reward.accRewardPerShare) / 1e18;

                emit RewardClaimed(_ownerOf(tokenId), tokenId, i, pending);
            }
        }
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "Invalid token");
        StakePosition storage pos = positions[tokenId];
        return string(abi.encodePacked("Farm Position #", _toString(tokenId), " - Pool ", _toString(pos.poolId)));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
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
