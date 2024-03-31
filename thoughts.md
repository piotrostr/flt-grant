# Thoughts

## Qs

1. are we going to add allocations as deployment params similar to
   flt/Vesting.sol?
2. are the amounts dynamic? e.g. the contract owner can allocate both 1M FLT or 1B FLT?
3. what is the usage from the owner perspecive, example of how the contract is
   going to be used?
4. should we allow public view of `tokenAllocations` and `lockTimes`?
5. should we allow multiple allocations that vest at given intervals?

e.g.

```pseudocode
addTokenAllocation(bob, 1000)
addTokenAllocation(bob, 1000)
tokenAllocations[bob] => 2000
```

## Things to do

- get some data from a moonshot like SIF/USD, analyze the tx distribution
- similar to helius, see if can get 'reputation' score and try to snipe new launches,
  something like dextools.io real time launches
