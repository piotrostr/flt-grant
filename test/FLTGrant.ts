import { ethers, upgrades } from "hardhat";
import { Contract } from "ethers";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { FluenceToken } from "../typechain-types";

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

    it.skip("Should fail if the amount is zero", async () => {
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
      await fltGrant.addTokenAllocation(alice, 10_000);

      const allocation = await fltGrant.tokenAllocations(alice);
      expect(allocation).to.equal(10_000);

      const aliceFltGrant = fltGrant.connect(alice);
      const oneYear = 365 * 24 * 60 * 60;
      await time.increase(oneYear);

      const fltGrantBalance = await fltToken.balanceOf(
        await fltGrant.getAddress()
      );
      const amount = BigInt(10_000);

      const res = await aliceFltGrant.claim(amount);
      await res.wait();

      const balance = await fltToken.balanceOf(alice.address);
      expect(balance).to.equal(10_000);

      const postTxFltGrantBalance = await fltToken.balanceOf(
        await fltGrant.getAddress()
      );

      expect(postTxFltGrantBalance).to.equal(fltGrantBalance - amount);
    });

    it("Should fail if the grant has already been claimed", async () => {});

    it.skip("Should fail if the distribution is not active", async () => {});
  });

  describe("Pause Distribution", () => {
    it.skip("Should fail if the sender is not the owner", async () => {});

    it.skip("Should fail if the distribution is already paused", async () => {});
  });

  describe("Resume Distribution", () => {
    it.skip("Should fail if the sender is not the owner", async () => {});

    it.skip("Should fail if the distribution is already active", async () => {});
  });

  describe("Retrieve Remaining Balances", () => {
    it.skip("Should fail if the sender is not the owner", async () => {});

    it.skip("Should be possible to retrieve the remaining FLT tokens", async () => {});

    it.skip("Should not be possible to retrieve if before unlock time", async () => {});

    it.skip("Should fail if no FLT tokens are available", async () => {});
  });

  describe("Events", () => {
    it.skip("Should emit a Grant event when a grant is created", async () => {});

    it.skip("Should emit a Claim event when a grant is claimed", async () => {});

    it.skip("Should emit a Pause event when distribution is paused", async () => {});

    it.skip("Should emit a Resume event when distribution is resumed", async () => {});
  });
});
