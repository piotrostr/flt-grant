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

    const fltGrant = await FLTGrant.deploy(await fltToken.getAddress());
    await fltGrant.waitForDeployment();

    await fltToken.transfer(await fltGrant.getAddress(), 100_000);

    return { owner, alice, bob, fltGrant, fltToken };
  };

  describe("Deployment", () => {
    it("Deploys without issues", async () => {
      const { owner, fltGrant, fltToken } = await loadFixture(deployFLTGrant);
      const fltGrantAddress = await fltGrant.getAddress();
      const fltTokenAddress = await fltToken.getAddress();

      expect(fltGrantAddress).to.be.string;
      expect(fltTokenAddress).to.be.string;

      expect(await fltGrant.token()).to.equal(await fltToken.getAddress());

      expect(await fltToken.balanceOf(fltGrantAddress)).to.equal(100_000);
    });
  });

  describe("Granting", () => {
    it("Should fail if the sender is not the owner", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const aliceFltGrant = fltGrant.connect(alice);
      const tx = aliceFltGrant.addTokenAllocation(alice, 10_000);
      await expect(tx).to.be.reverted;
    });

    it("Should allocate right amount of tokens", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      await fltGrant.addTokenAllocation(alice, 10_000);

      const allocation = await fltGrant.tokenAllocations(alice);
      expect(allocation).to.equal(10_000);
    });

    it("Should fail if the unlockTime is not in the future", async () => {});

    it("Should fail if the amount is zero", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      expect(fltGrant.addTokenAllocation(alice, 0)).to.be.reverted;
    });

    it("Should fail if the recipient is the zero address", async () => {
      const { fltGrant } = await loadFixture(deployFLTGrant);
      const tx = fltGrant.addTokenAllocation(ethers.ZeroAddress, 10_000);
      expect(tx).to.be.reverted;
    });
  });

  describe("Claiming", () => {
    it("Should fail if the unlockTime has not passed", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      await fltGrant.addTokenAllocation(alice, 10_000);

      const allocation = await fltGrant.tokenAllocations(alice);
      expect(allocation).to.equal(10_000);

      const aliceFltGrant = fltGrant.connect(alice);

      expect(aliceFltGrant.claim(10_000)).to.be.reverted;
    });

    it("Should fail if no FLT tokens are available", async () => {
      const { bob, fltGrant } = await loadFixture(deployFLTGrant);
      const bobFltGrant = fltGrant.connect(bob);

      expect(bobFltGrant.claim(10_000)).to.be.reverted;
    });

    // TODO
    it.skip("Should be possible to add multiple allocations", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      await fltGrant.addTokenAllocation(alice, 10_000);
      await fltGrant.addTokenAllocation(alice, 10_000);
      await fltGrant.addTokenAllocation(alice, 1_000);

      const allocation = await fltGrant.tokenAllocations(alice);
      expect(allocation).to.equal(21_000);
    });

    it("Should be possible to claim the FLT tokens", async () => {
      const { alice, fltGrant, fltToken } = await loadFixture(deployFLTGrant);
      const amount = BigInt(10_000);
      await fltGrant.addTokenAllocation(alice, amount);

      const allocation = await fltGrant.tokenAllocations(alice);
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
    });

    it("Should fail if the grant has already been claimed", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const aliceFltGrant = fltGrant.connect(alice);

      const amount = BigInt(10_000);
      await fltGrant.addTokenAllocation(alice, amount);

      const allocation = await fltGrant.tokenAllocations(alice);
      expect(allocation).to.equal(amount);

      const oneYear = 365 * 24 * 60 * 60;
      await time.increase(oneYear);

      await aliceFltGrant.claim(amount);

      expect(aliceFltGrant.claim(amount)).to.be.reverted;
    });

    it("Should fail if the distribution is not active", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      await fltGrant.pauseDistribution();

      expect(await fltGrant.distributionActive()).to.be.false;

      const aliceFltGrant = fltGrant.connect(alice);

      expect(aliceFltGrant.claim(10_000)).to.be.reverted;
    });
  });

  describe("Pause Distribution", () => {
    it("Should fail if the sender is not the owner", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      const aliceFltGrant = fltGrant.connect(alice);
      expect(aliceFltGrant.pauseDistribution()).to.be.reverted;
    });

    it("Should fail if the distribution is already paused", async () => {
      const { fltGrant } = await loadFixture(deployFLTGrant);

      await fltGrant.pauseDistribution();
      expect(fltGrant.pauseDistribution()).to.be.reverted;
    });
  });

  describe("Resume Distribution", () => {
    it("Should fail if the sender is not the owner", async () => {
      const { alice, fltGrant } = await loadFixture(deployFLTGrant);
      await fltGrant.pauseDistribution();
      const aliceFltGrant = fltGrant.connect(alice);
      expect(aliceFltGrant.resumeDistribution()).to.be.reverted;
    });

    it("Should fail if the distribution is already active", async () => {
      const { fltGrant } = await loadFixture(deployFLTGrant);
      expect(fltGrant.resumeDistribution()).to.be.reverted;
    });
  });

  describe("Retrieve Remaining Balances", () => {
    it("Should fail if the sender is not the owner", async () => {
      const { alice, bob, fltGrant } = await loadFixture(deployFLTGrant);
      await fltGrant.addTokenAllocation(alice, 10_000);
      await fltGrant.addTokenAllocation(bob, 20_000);
      await time.increase(fiveYears + 1);

      const aliceFltGrant = fltGrant.connect(alice);
      expect(aliceFltGrant.retrieveRemainingBalance()).to.be.reverted;
    });

    it("Should be possible to retrieve the remaining FLT tokens", async () => {
      const { owner, alice, bob, fltGrant, fltToken } = await loadFixture(
        deployFLTGrant
      );

      await fltGrant.addTokenAllocation(alice, 10_000);
      await fltGrant.addTokenAllocation(bob, 20_000);

      const balance = await fltToken.balanceOf(owner.address);

      await time.increase(fiveYears);

      await (await fltGrant.retrieveRemainingBalance()).wait();

      const postTxBalance = await fltToken.balanceOf(owner.address);
      expect(postTxBalance).to.equal(balance + BigInt(30_000));
    });

    it("Should not be possible to retrieve if before unlock time", async () => {
      const { alice, bob, fltGrant } = await loadFixture(deployFLTGrant);

      await fltGrant.addTokenAllocation(alice, 10_000);
      await fltGrant.addTokenAllocation(bob, 20_000);

      expect(fltGrant.retrieveRemainingBalance()).to.be.reverted;
    });

    it("Should fail if no FLT tokens are available", async () => {
      const { owner, alice, bob, fltGrant, fltToken } = await loadFixture(
        deployFLTGrant
      );

      await fltGrant.addTokenAllocation(alice, 10_000);
      await fltGrant.addTokenAllocation(bob, 20_000);

      await time.increase(fiveYears);

      await (await fltGrant.retrieveRemainingBalance()).wait();

      expect(fltGrant.retrieveRemainingBalance()).to.be.reverted;
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

      await fltGrant.addTokenAllocation(alice, amount);
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
      const { owner, fltGrant } = await loadFixture(deployFLTGrant);
      await fltGrant.addTokenAllocation(owner, 10_000);
      await time.increase(fiveYears);

      const tx = fltGrant.retrieveRemainingBalance();
      await expect(tx)
        .to.emit(fltGrant, "RemainingBalanceRetrieved")
        .withArgs(10_000);
    });
  });
});
