# Thoughts

## Qs

1. are we going to add allocations as deployment params similar to
   flt/Vesting.sol?
2. are the amounts dynamic? e.g. the contract owner can allocate both 1M FLT or 1B FLT?
3. what is the usage from the owner perspecive, example of how the contract is
   going to be used?
4. should we allow public view of `tokenAllocations` and `lockTimes`?
5. should we allow multiple allocations that vest at given intervals?
6. if it is past unlock time and there is an allocation locked for say 1 year at
   the 5 year mark, the tokens can get retrieved by owner, shall the lock time be
   for each of the balances? after 1 year user can retrieve, after 5 years owner
   can retrieve?

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
