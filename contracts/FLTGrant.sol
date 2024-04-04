// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.24;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FluenceToken} from "./FluenceToken.sol";

contract FLTGrant is ERC20, Ownable {
    using SafeERC20 for IERC20;

    FluenceToken public immutable token;

    // time when non-locked FLT can be retrieved by owner
    uint public immutable unlockTime;

    // if false, no new claims can be made
    bool public distributionActive;

    // total amount of FLT tokens available for claim
    uint public lockedBalance;

    // lock period after which the allocation can be claimed
    uint public lockPeriod;

    // time of allocation, used to determine when the lock period is over
    mapping(address => uint) public lockTimes;

    // whether the allocation has been claimed
    mapping(address => bool) public claimed;

    event Claimed(address indexed account, uint amount);
    event TokenAllocationAdded(address indexed account, uint amount);
    event RemainingBalanceRetrieved(uint total);
    event DistributionPaused();
    event DistributionResumed();

    constructor(
        FluenceToken token_,
        uint lockPeriod_,
        uint unlockPeriod_
    ) ERC20("Fluence Token Grant", "FLT-FPT") Ownable(msg.sender) {
        lockPeriod = lockPeriod_;
        unlockTime = block.timestamp + unlockPeriod_;
        distributionActive = true;
        token = token_;
    }

    /**
     * @dev Adds a new token allocation to the grant.
     * The method can be called only once per account and only by owner.
     *
     * @param account The account to allocate tokens to.
     * @param amount The amount of tokens to allocate.
     */
    function addTokenAllocation(
        address account,
        uint256 amount
    ) external onlyOwner {
        require(balanceOf(account) == 0, "Account was already allocated");
        require(
            IERC20(token).balanceOf(address(this)) - lockedBalance >= amount,
            "FLTGrant has insufficient FLT balance, cannot allocate"
        );
        require(
            !claimed[account],
            "Account already claimed, no second-time allocation allowed"
        );

        lockTimes[account] = block.timestamp;

        // Mint FLT-FPT tokens representing the allocation
        _mint(account, amount);

        lockedBalance += amount;

        emit TokenAllocationAdded(account, amount);
    }

    /**
     * @dev Claims the allocated tokens.
     * The method can be called only after the lock period is over.
     * Lock period is for 365 days.
     * After lock period elapses, allocation can be claimed indifinitely.
     */
    function claim() external {
        require(
            block.timestamp >= lockTimes[msg.sender] + lockPeriod,
            "Lock period not over"
        );
        require(distributionActive, "Distribution is paused");
        require(!claimed[msg.sender], "Already claimed");

        uint amount = balanceOf(msg.sender);
        require(amount > 0, "No allocation");

        // Burn FLT-FPT tokens
        _burn(msg.sender, amount);

        IERC20(token).safeTransfer(msg.sender, amount);

        claimed[msg.sender] = true;

        lockedBalance -= amount;

        emit Claimed(msg.sender, amount);
    }

    /**
     * @dev Pauses the distribution.
     * The method can be called only by the owner.
     */
    function pauseDistribution() external onlyOwner {
        if (!distributionActive) {
            revert("Cannot pause inactive distribution");
        }

        distributionActive = false;

        emit DistributionPaused();
    }

    /**
     * @dev Resumes the distribution.
     * The method can be called only by the owner.
     */
    function resumeDistribution() external onlyOwner {
        if (distributionActive) {
            revert("Cannot resume active distribution");
        }
        distributionActive = true;

        emit DistributionResumed();
    }

    /**
     * @dev Retrieves the remaining balance of unallocated FLT tokens.
     * The method can be called only by the owner after 5 years of contract
     * creation.
     */
    function retrieveRemainingBalance() external onlyOwner {
        require(block.timestamp >= unlockTime, "Unlock time not reached");

        uint total = IERC20(token).balanceOf(address(this));
        uint unallocated = total - lockedBalance;

        require(unallocated > 0, "No unallocated FLT in the contract");

        IERC20(token).safeTransfer(owner(), unallocated);

        emit RemainingBalanceRetrieved(unallocated);
    }

    /**
     * @dev Overrides ERC20 transfer to prevent allocation transfers
     */
    function transfer(
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        assembly {
            let _to := to
            let _amount := amount
        }
        revert("Unsupported operation");
    }

    /**
     * @dev Overrides ERC20 transferFrom to prevent allocation transfers
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        assembly {
            let _from := from
            let _to := to
            let _amount := amount
        }
        revert("Unsupported operation");
    }

    /**
     * @dev Overrides ERC20 approve to prevent allocation approvals
     */
    function approve(
        address spender,
        uint256 amount
    ) public virtual override returns (bool) {
        assembly {
            let _spender := spender
            let _amount := amount
        }
        revert("Unsupported operation");
    }
}
