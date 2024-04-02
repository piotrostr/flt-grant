# FLTGrant

## Intro

Smart contact that implements token lock up with some customization. Admin of
the contract creates allocations for addresses, which owners of addresses can
see in their wallet during the lock up period and then can get token after their
lock up expires.

## Contract Requirements

- Allocations should be visible in a wallet as FLT-FPT
- After each allocation submission, this allocation should be locked for 1 year

Example of the lock up contract that displays as a token:
[Vesting.sol](https://github.com/fluencelabs/dao/blob/main/contracts/contracts/Vesting.sol)

Owner of the contract should be able to:

1. Add token allocation to any address one by one at any moment
2. Pause and release distribution at any moment
3. After 5 years of contract deployment, retrieve remaining balance of FLT
4. After 1 year of particular allocation creation, release allocated FLT to the receiver
5. Transfer ownership to another address

Receiver of the allocation should be able to:

- After 1 year, to burn FLT-FPT token and receive FLT from the contract. Burning can be implemented as transfer to self or transfer to any address or transfer to 0x0 address.

## Usage

```shell
npx hardhat help
npx hardhat test
REPORT_GAS=true npx hardhat test
npx hardhat node
npx hardhat ignition deploy ./ignition/modules/Lock.ts
```
