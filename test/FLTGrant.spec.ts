import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { FluenceToken } from "../typechain-types";

const oneYear = 365 * 24 * 60 * 60;
const fiveYears = 5 * 365 * 24 * 60 * 60;

describe("FLTGrant", () => {
  const deployFLTGrant = async () => {
    const [owner, alice, bob] = await ethers.getSigners();

    const FluenceToken = await ethers.getContractFactory("FluenceToken");
    const FLTGrant = await ethers.getContractFactory("FLTGrant");

    // hardhat-upgrades doesn't support the typechain types out-of-the-box
    const fltToken = (await upgrades.deployProxy(FluenceToken, [
      "Fluence Token",
      "FLT",
      1_000_000_000,
    ])) as FluenceToken & Contract;

    const fltGrant = await FLTGrant.deploy(
      await fltToken.getAddress(),
      oneYear,
      fiveYears
    );
    await fltGrant.waitForDeployment();
    await fltToken.transfer(await fltGrant.getAddress(), 100_000);

    return { owner, alice, bob, fltGrant, fltToken };
  };

  describe("Deployment", () => {
    it("Deploys without issues", async () => {
      const { owner, alice, bob, fltGrant, fltToken } = await loadFixture(
        deployFLTGrant
      );
      const fltGrantAddress = await fltGrant.getAddress();
      const fltTokenAddress = await fltToken.getAddress();
      expect(fltGrantAddress).to.be.string;
      expect(fltTokenAddress).to.be.string;
      expect(await fltGrant.token()).to.equal(await fltToken.getAddress());
      expect(await fltToken.balanceOf(fltGrantAddress)).to.equal(100_000);
      expect(await fltGrant.owner()).to.equal(owner.address);
      expect(await fltGrant.balanceOf(alice.address)).to.equal(0);
      expect(await fltGrant.balanceOf(bob.address)).to.equal(0);
      expect(await fltGrant.distributionActive()).to.be.true;
      expect(await fltGrant.lockedBalance()).to.equal(0);
      expect(await fltGrant.lockPeriod()).to.equal(oneYear);
    });
  });

  describe("Allocating", () => {
    it("Should fail if the sender is not the owner", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const aliceFltGrant = fltGrant.connect(alice);
      const tx = aliceFltGrant.addTokenAllocation(alice, 10_000);
      await expect(tx).to.be.reverted;
    });

    it("Should allocate right amount of tokens", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      (await fltGrant.addTokenAllocation(alice, 10_000)).wait();
      const allocation = await fltGrant.balanceOf(alice);
      expect(allocation).to.equal(10_000);
    });

    it("Should not be possible to allocate more tokens than FLT available", async () => {
      const { alice, fltGrant, fltToken } = await loadFixture(deployFLTGrant);
      const fltBalance = await fltToken.balanceOf(await fltGrant.getAddress());
      expect(fltBalance).not.to.equal(0);
      const tx = fltGrant.addTokenAllocation(alice, fltBalance + BigInt(1));
      await expect(tx).to.be.revertedWith(
        "FLTGrant has insufficient FLT balance, cannot allocate"
      );
    });

    it("Should fail if the recipient is the zero address", async () => {
      const { fltGrant } = await loadFixture(deployFLTGrant);
      const tx = fltGrant.addTokenAllocation(ethers.ZeroAddress, 10_000);
      await expect(tx).to.be.reverted;
    });

    it("Should not be possible to add multiple allocations", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      await (await fltGrant.addTokenAllocation(alice, 10_000)).wait();
      await expect(
        fltGrant.addTokenAllocation(alice, 10_000)
      ).to.be.revertedWith("Account was already allocated");
    });

    it("Should lock and unlock the allocated FLT properly", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const amount = BigInt(10_000);
      await (await fltGrant.addTokenAllocation(alice, amount)).wait();
      expect(await fltGrant.lockedBalance()).to.equal(amount);
      const aliceFltGrant = fltGrant.connect(alice);
      await time.increase(oneYear);
      await aliceFltGrant.claim(amount);
      expect(await fltGrant.lockedBalance()).to.equal(0);
    });

    it("Should not be possible to add allocations after claim", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const amount = BigInt(10_000);
      await (await fltGrant.addTokenAllocation(alice, amount)).wait();
      await time.increase(oneYear);
      await fltGrant.connect(alice).claim(amount);
      await expect(
        fltGrant.addTokenAllocation(alice, amount)
      ).to.be.revertedWith(
        "Account already claimed, no second-time allocation allowed"
      );
    });

    it("Should not be possible to add allocations if balance is insufficient", async () => {
      const { alice, bob, fltGrant, fltToken } = await loadFixture(
        deployFLTGrant
      );
      await (await fltGrant.addTokenAllocation(alice, 100_000)).wait();

      const fltGrantFltBalance = await fltToken.balanceOf(
        await fltGrant.getAddress()
      );
      expect(fltGrantFltBalance).to.equal(100_000);
      expect(await fltGrant.lockedBalance()).to.equal(100_000);

      await expect(fltGrant.addTokenAllocation(bob, 1)).to.be.revertedWith(
        "FLTGrant has insufficient FLT balance, cannot allocate"
      );
    });
  });

  describe("Claiming", () => {
    it("Should be possible to claim in increments using claim method", async () => {
      const { alice, fltGrant, fltToken } = await loadFixture(deployFLTGrant);
      const amount = BigInt(10_000);
      const halfAmount = BigInt(5_000);
      await (await fltGrant.addTokenAllocation(alice, amount)).wait();
      expect(await fltGrant.balanceOf(alice)).to.equal(amount);

      await time.increase(oneYear);

      const aliceFltGrant = fltGrant.connect(alice);
      const res = await aliceFltGrant.claim(halfAmount);
      await res.wait();

      expect(await fltToken.balanceOf(alice.address)).to.equal(halfAmount);
      expect(await fltGrant.balanceOf(alice)).to.equal(halfAmount);
      expect(await fltGrant.claimed(alice)).to.be.false;

      const res2 = await aliceFltGrant.claim(halfAmount);
      await res2.wait();

      expect(await fltToken.balanceOf(alice.address)).to.equal(amount);
      expect(await fltGrant.balanceOf(alice)).to.equal(0);
      expect(await fltGrant.claimed(alice)).to.be.true;
    });

    it("Should be possible to claim in increments using transfer method", async () => {
      const { alice, fltGrant, fltToken } = await loadFixture(deployFLTGrant);
      const amount = BigInt(10_000);
      const halfAmount = BigInt(5_000);
      await (await fltGrant.addTokenAllocation(alice, amount)).wait();
      expect(await fltGrant.balanceOf(alice)).to.equal(amount);

      await time.increase(oneYear);

      const aliceFltGrant = fltGrant.connect(alice);
      await aliceFltGrant.transfer(ethers.ZeroAddress, halfAmount);
      expect(await fltToken.balanceOf(alice.address)).to.equal(halfAmount);
      expect(await fltGrant.balanceOf(alice)).to.equal(halfAmount);
      expect(await fltGrant.claimed(alice)).to.be.false;

      await aliceFltGrant.transfer(await fltGrant.getAddress(), halfAmount);
      expect(await fltToken.balanceOf(alice.address)).to.equal(amount);
      expect(await fltGrant.balanceOf(alice)).to.equal(0);
      expect(await fltGrant.claimed(alice)).to.be.true;

      // transfer should not increment the fltGrant FLT-GRANT balance
      expect(await fltGrant.balanceOf(await fltGrant.getAddress())).to.equal(0);
    });

    it("Should work for random increments and many txs", async () => {
      const { alice, fltGrant, fltToken } = await loadFixture(deployFLTGrant);
      const amount = BigInt(10_000);
      const tenthAmount = BigInt(1_000);
      await (await fltGrant.addTokenAllocation(alice, amount)).wait();
      expect(await fltGrant.balanceOf(alice)).to.equal(amount);

      await time.increase(oneYear);
      for (let i = 0; i < 10; i++) {
        const aliceFltGrant = fltGrant.connect(alice);
        await aliceFltGrant.claim(tenthAmount);
      }

      expect(await fltToken.balanceOf(alice.address)).to.equal(amount);
      expect(await fltGrant.balanceOf(alice)).to.equal(0);
      expect(await fltGrant.claimed(alice)).to.be.true;
    });

    it("Should fail if the unlockTime has not passed", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      await (await fltGrant.addTokenAllocation(alice, 10_000)).wait();
      const allocation = await fltGrant.balanceOf(alice);
      expect(allocation).to.equal(10_000);
      const aliceFltGrant = fltGrant.connect(alice);
      await expect(aliceFltGrant.claim(allocation)).to.be.reverted;
    });

    it("Should fail if no FLT tokens are available", async () => {
      const { bob, fltGrant } = await loadFixture(deployFLTGrant);
      expect(await fltGrant.lockedBalance()).to.equal(0);
      expect(await fltGrant.balanceOf(bob.address)).to.equal(0);
      const bobFltGrant = fltGrant.connect(bob);
      await expect(bobFltGrant.claim(1)).to.be.revertedWith(
        "Insufficient FLT-GRANT balance"
      );
    });

    it("Should be possible to claim the FLT tokens", async () => {
      const { alice, fltGrant, fltToken } = await loadFixture(deployFLTGrant);
      const amount = BigInt(10_000);
      await (await fltGrant.addTokenAllocation(alice, amount)).wait();
      const allocation = await fltGrant.balanceOf(alice);
      expect(allocation).to.equal(amount);
      const aliceFltGrant = fltGrant.connect(alice);
      await time.increase(oneYear);
      const fltGrantBalance = await fltToken.balanceOf(
        await fltGrant.getAddress()
      );
      const res = await aliceFltGrant.claim(amount);
      await res.wait();
      const balance = await fltToken.balanceOf(alice.address);
      expect(balance).to.equal(amount);
      const postTxFltGrantBalance = await fltToken.balanceOf(
        await fltGrant.getAddress()
      );

      expect(postTxFltGrantBalance).to.equal(fltGrantBalance - amount);
      expect(await fltGrant.balanceOf(alice)).to.equal(0);
      expect(await fltGrant.claimed(alice)).to.be.true;
    });

    it("Should fail if the grant has already been claimed", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const aliceFltGrant = fltGrant.connect(alice);

      const amount = BigInt(10_000);
      await (await fltGrant.addTokenAllocation(alice, amount)).wait();

      const oneYear = 365 * 24 * 60 * 60;
      await time.increase(oneYear);

      await aliceFltGrant.claim(amount);

      await expect(aliceFltGrant.claim(amount)).to.be.revertedWith(
        "Already claimed"
      );
    });

    it("Should fail if the distribution is not active", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      await fltGrant.pauseDistribution();

      expect(await fltGrant.distributionActive()).to.be.false;

      const aliceFltGrant = fltGrant.connect(alice);

      await expect(aliceFltGrant.claim(10_000)).to.be.revertedWith(
        "Distribution is paused"
      );
    });

    it("Should be possible to claim with FLT-GRANT transfer", async () => {
      const { alice, fltGrant, fltToken } = await loadFixture(deployFLTGrant);
      const amount = BigInt(10_000);
      await (await fltGrant.addTokenAllocation(alice, amount)).wait();
      const allocation = await fltGrant.balanceOf(alice);
      expect(allocation).to.equal(amount);
      await time.increase(oneYear);
      const aliceFltGrant = fltGrant.connect(alice);
      await expect(aliceFltGrant.transfer(alice.address, 10_000)).to.not.be
        .reverted;
      const balance = await fltToken.balanceOf(alice.address);
      expect(balance).to.equal(amount);
      expect(await fltGrant.balanceOf(alice)).to.equal(0);
      expect(await fltGrant.claimed(alice)).to.be.true;
    });
  });

  describe("Pause Distribution", () => {
    it("Should fail if the sender is not the owner", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const aliceFltGrant = fltGrant.connect(alice);
      await expect(aliceFltGrant.pauseDistribution()).to.be.reverted;
    });

    it("Should fail if the distribution is already paused", async () => {
      const { fltGrant } = await loadFixture(deployFLTGrant);

      await fltGrant.pauseDistribution();
      await expect(fltGrant.pauseDistribution()).to.be.revertedWith(
        "Cannot pause inactive distribution"
      );
    });
  });

  describe("Resume Distribution", () => {
    it("Should fail if the sender is not the owner", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      await fltGrant.pauseDistribution();
      const aliceFltGrant = fltGrant.connect(alice);
      await expect(aliceFltGrant.resumeDistribution()).to.be.reverted;
    });

    it("Should fail if the distribution is already active", async () => {
      const { fltGrant } = await loadFixture(deployFLTGrant);
      expect(fltGrant.resumeDistribution()).to.be.revertedWith(
        "Cannot resume active distribution"
      );
    });
  });

  describe("Retrieve Remaining Balances", () => {
    it("Should not be possible to retrieve if before unlock time", async () => {
      const { alice, bob, fltGrant } = await loadFixture(deployFLTGrant);

      await (await fltGrant.addTokenAllocation(alice, 10_000)).wait();
      await (await fltGrant.addTokenAllocation(bob, 20_000)).wait();

      await expect(fltGrant.retrieveRemainingBalance()).to.be.revertedWith(
        "Unlock time not reached"
      );
    });

    it("Should fail if the sender is not the owner", async () => {
      const { alice, bob, fltGrant } = await loadFixture(deployFLTGrant);
      await (await fltGrant.addTokenAllocation(alice, 10_000)).wait();
      await (await fltGrant.addTokenAllocation(bob, 20_000)).wait();
      await time.increase(fiveYears + 1);

      const aliceFltGrant = fltGrant.connect(alice);
      await expect(aliceFltGrant.retrieveRemainingBalance()).to.be.reverted;
    });

    it("Should be possible to retrieve the remaining FLT tokens", async () => {
      const { owner, alice, bob, fltGrant, fltToken } = await loadFixture(
        deployFLTGrant
      );

      const fltGrantFltBalance = await fltToken.balanceOf(
        await fltGrant.getAddress()
      );

      const aliceAmount = BigInt(10_000);
      const bobAmount = BigInt(20_000);

      await (await fltGrant.addTokenAllocation(alice, aliceAmount)).wait();
      await (await fltGrant.addTokenAllocation(bob, bobAmount)).wait();

      const lockedAmount = aliceAmount + bobAmount;

      const availableForRetrieval = fltGrantFltBalance - lockedAmount;

      await time.increase(fiveYears);

      const ownerFltBalance = await fltToken.balanceOf(owner.address);

      await (await fltGrant.retrieveRemainingBalance()).wait();

      const postTxOwnerFltBalance = await fltToken.balanceOf(owner.address);

      const expectedOwnerBalancePostTx =
        ownerFltBalance + availableForRetrieval;

      expect(postTxOwnerFltBalance).to.equal(expectedOwnerBalancePostTx);

      expect(await fltToken.balanceOf(await fltGrant.getAddress())).to.equal(
        lockedAmount
      );
    });

    it("Should fail if no FLT tokens are available", async () => {
      const { alice, bob, fltGrant } = await loadFixture(deployFLTGrant);

      await (await fltGrant.addTokenAllocation(alice, 10_000)).wait();
      await (await fltGrant.addTokenAllocation(bob, 20_000)).wait();

      await time.increase(fiveYears);

      await (await fltGrant.retrieveRemainingBalance()).wait();

      await expect(fltGrant.retrieveRemainingBalance()).to.be.reverted;
    });
  });

  describe("Events", () => {
    it("Emits TokenAllocationAdded", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const tx = fltGrant.addTokenAllocation(alice, 10_000);

      await expect(tx)
        .to.emit(fltGrant, "TokenAllocationAdded")
        .withArgs(alice.address, 10_000);
    });

    it("Emits Claimed", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const amount = BigInt(10_000);

      await (await fltGrant.addTokenAllocation(alice, amount)).wait();
      await time.increase(oneYear);

      const aliceFltGrant = fltGrant.connect(alice);
      const tx = aliceFltGrant.claim(amount);

      await expect(tx)
        .to.emit(fltGrant, "Claimed")
        .withArgs(alice.address, amount);
    });

    it("Emits DistributionPaused", async () => {
      const { fltGrant } = await loadFixture(deployFLTGrant);
      const tx = fltGrant.pauseDistribution();
      await expect(tx).to.emit(fltGrant, "DistributionPaused");
    });

    it("Emits DistributionResumed", async () => {
      const { fltGrant } = await loadFixture(deployFLTGrant);
      await fltGrant.pauseDistribution();
      const tx = fltGrant.resumeDistribution();

      await expect(tx).to.emit(fltGrant, "DistributionResumed");
    });

    it("Emits RemainingBalanceRetrieved", async () => {
      const { owner, fltToken, fltGrant } = await loadFixture(deployFLTGrant);
      const totalFltBalance = await fltToken.balanceOf(
        await fltGrant.getAddress()
      );
      const amount = BigInt(10_000);
      await (await fltGrant.addTokenAllocation(owner, amount)).wait();
      await time.increase(fiveYears);

      const tx = fltGrant.retrieveRemainingBalance();
      await expect(tx)
        .to.emit(fltGrant, "RemainingBalanceRetrieved")
        .withArgs(totalFltBalance - amount);
    });
  });

  describe("Implements ERC20", () => {
    it("Should have totalSupply that increases on mint", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const totalSupply = await fltGrant.totalSupply();
      const amount = BigInt(10_000);
      await (await fltGrant.addTokenAllocation(alice, amount)).wait();
      expect(await fltGrant.totalSupply()).to.equal(totalSupply + amount);
    });

    it("Should have balanceOf that returns the balance of an address", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const amount = BigInt(10_000);
      await (await fltGrant.addTokenAllocation(alice, amount)).wait();
      expect(await fltGrant.balanceOf(alice.address)).to.equal(amount);
    });

    it("Should have decimals that match the FluenceToken decimals", async () => {
      const { fltGrant, fltToken } = await loadFixture(deployFLTGrant);
      expect(await fltGrant.decimals()).to.equal(await fltToken.decimals());
    });
  });

  describe("Overrides ERC20", () => {
    it("Should not be possible to transfer tokens (without allocation)", async () => {
      const { fltGrant, alice } = await loadFixture(deployFLTGrant);
      await expect(fltGrant.transfer(alice.address, 10_000)).to.be.reverted;
    });

    it("Should not be possible to approve tokens", async () => {
      const { fltGrant, alice } = await loadFixture(deployFLTGrant);
      await expect(fltGrant.approve(alice.address, 10_000)).to.be.reverted;
    });

    it("Should not be possible to transferFrom tokens", async () => {
      const { fltGrant, alice } = await loadFixture(deployFLTGrant);
      await expect(fltGrant.transferFrom(alice.address, alice.address, 10_000))
        .to.be.reverted;
    });
  });
});
