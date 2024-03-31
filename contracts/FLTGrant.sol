// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.24;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {FluenceToken} from "./FluenceToken.sol";

import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

// TODO dbg, don't slip into prod
import {console} from "hardhat/console.sol";

// TODOs
// for time locking use governance/TimelockController from openzeppelin

contract FLTGrant is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    FluenceToken public immutable token;

    bool _distributionActive;
    uint _unlockTime;

    EnumerableMap.AddressToUintMap private _tokenAllocations;

    mapping(address => uint) _lockTimes;
    mapping(address => bool) _claimed;

    constructor(
        FluenceToken token_
    ) ERC20("Fluence Token Grant", "FLT-FPT") Ownable(msg.sender) {
        require(address(token_) != address(0), "Invalid token address");
        _unlockTime = block.timestamp + 5 * 365 days;
        _distributionActive = true;

        token = token_;
    }

    // TODO should there be no way to edit? what about adding multiple allocations?
    // is the allocation always a single unit?
    // if multiple allocations are to be added, the vest time has to be vary of
    // e.g. add allocation 1, after 364 days add allocation 1000000, iffy
    function addTokenAllocation(
        address account,
        uint256 amount
    ) public onlyOwner returns (bool) {
        _tokenAllocations.set(account, amount);
        _lockTimes[account] = block.timestamp + 365 days; // Lock for 1 year
        _mint(account, amount); // Mint FLT-FPT tokens representing the allocation
        return true;
    }

    function claim(uint amount) public returns (bool) {
        require(
            block.timestamp >= _lockTimes[msg.sender],
            "Lock period not over"
        );
        require(
            balanceOf(msg.sender) >= amount,
            "Insufficient FLT-FPT balance"
        );
        require(_distributionActive, "Distribution is paused");
        require(!_claimed[msg.sender], "Already claimed");

        _burn(msg.sender, amount); // Burn FLT-FPT tokens

        IERC20(token).safeTransfer(msg.sender, amount);

        return true;
    }

    function pauseDistribution() public onlyOwner returns (bool) {
        if (!_distributionActive) {
            revert("Cannot pause inactive distribution");
        }
        _distributionActive = false;
        return true;
        // Pause distribution
    }

    function retrieveRemainingBalance() public onlyOwner returns (bool) {
        require(
            block.timestamp < _unlockTime,
            "Unlock time has not been reached"
        );
        for (uint i = 0; i < _tokenAllocations.length(); i++) {
            (address account, uint amount) = _tokenAllocations.at(i);
            console.log("Retrieving %s tokens from %s", amount, account);

            _burn(account, amount);

            IERC20(token).safeTransfer(account, amount);
        }
        return true;
    }

    function releaseDistribution() public onlyOwner returns (bool) {
        if (_distributionActive) {
            revert("Cannot resume active distribution");
        }
        _distributionActive = true;
        return true;
    }

    function tokenAllocations(address account) public view returns (uint) {
        return _tokenAllocations.get(account);
    }

    function distributionActive() public view returns (bool) {
        return _distributionActive;
    }
}
