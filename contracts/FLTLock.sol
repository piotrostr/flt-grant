// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

// TODO dbg, don't slip into prod
import {console} from "hardhat/console.sol";

contract FLTLock is Ownable {
    bool _distributionActive;
    uint _unlockTime;

    using EnumerableMap for EnumerableMap.AddressToUintMap;

    EnumerableMap.AddressToUintMap private _tokenAllocations;

    constructor() Ownable(msg.sender) {
        _unlockTime = block.timestamp + 5 * 365 days;
        _distributionActive = true;
    }

    function addTokenAllocation(
        address account,
        uint amount
    ) public onlyOwner returns (bool) {
        _tokenAllocations.set(account, amount);
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
        // Retrieve remaining balance, this will be iterative likely
        for (uint i = 0; i < _tokenAllocations.length(); i++) {
            (address account, uint amount) = _tokenAllocations.at(i);
            console.log("Retrieving %s tokens from %s", amount, account);
            // this is not trivial, retrieving the remaining tokens to the owner
            // will require using an IERC20 interface for the token
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
