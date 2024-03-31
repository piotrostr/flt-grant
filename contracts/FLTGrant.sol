// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.24;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

// TODO dbg, don't slip into prod
import {console} from "hardhat/console.sol";

// TODOs
// for time locking use governance/TimelockController from openzeppelin

contract FLTGrant is ERC20, Ownable {
    using EnumerableMap for EnumerableMap.AddressToUintMap;

    IERC20 public fltToken;

    bool _distributionActive;
    uint _unlockTime;
    EnumerableMap.AddressToUintMap private _tokenAllocations;
    mapping(address => uint) _lockTimes;
    mapping(address => bool) _claimed;

    constructor(
        IERC20 _fltToken
    ) ERC20("FLTGrant", "FLT-FPT") Ownable(msg.sender) {
        _unlockTime = block.timestamp + 5 * 365 days;
        _distributionActive = true;
        fltToken = _fltToken;
    }

    // TODO should there be no way to edit? what about adding multiple allocations?
    // is the allocation always a single unit?
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
        require(fltToken.transfer(msg.sender, amount), "FLT transfer failed"); // Transfer FLT to the sender

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
        if (block.timestamp < _unlockTime)
            revert("Unlock time has not been reached");
        for (uint i = 0; i < _tokenAllocations.length(); i++) {
            (address account, uint amount) = _tokenAllocations.at(i);
            console.log("Retrieving %s tokens from %s", amount, account);
            _burn(account, amount);
            require(fltToken.transfer(account, amount), "FLT transfer failed");
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
