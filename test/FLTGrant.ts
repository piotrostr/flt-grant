import { ethers, upgrades } from "hardhat";
import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";

describe("FLTGrant", () => {
  const deployFLTGrant = async () => {
    const [owner, recipient] = await ethers.getSigners();

    const FluenceToken = await ethers.getContractFactory("FluenceToken");

    const fltToken = await upgrades.deployProxy(FluenceToken, [
      "Fluence Token",
      "FLT",
      1000000000, // 9 zeros
    ]);
    await fltToken.waitForDeployment();

    const FLTGrant = await ethers.getContractFactory("FLTGrant");

    const fltGrant = await FLTGrant.deploy(await fltToken.getAddress());

    return { owner, fltGrant, fltToken };
  };

  describe("Deployment", () => {
    it("Deploys without issues", async () => {
      const { fltGrant, fltToken } = await loadFixture(deployFLTGrant);
      const address = await fltGrant.getAddress();
      expect(address).to.not.be.undefined;
      expect(address).to.be.string;

      expect(await fltGrant.fltToken()).to.equal(await fltToken.getAddress());
    });
  });

  describe("Granting", () => {
    it("Should fail if the unlockTime is not in the future", async () => {});

    it("Should fail if the amount is zero", async () => {});

    it("Should fail if the recipient is the zero address", async () => {});

    it("Should fail if the sender is not the owner", async () => {});
  });

  describe("Claiming", () => {
    it("Should fail if the unlockTime has not passed", async () => {});

    it("Should fail if the sender is not the recipient", async () => {});

    it("Should fail if no FLT tokens are available", async () => {});

    it("Should fail if the grant has already been claimed", async () => {});

    it("Should fail if the distribution is not active", async () => {});
  });

  describe("Pause Distribution", () => {
    it("Should fail if the sender is not the owner", async () => {});

    it("Should fail if the distribution is already paused", async () => {});
  });

  describe("Resume Distribution", () => {
    it("Should fail if the sender is not the owner", async () => {});

    it("Should fail if the distribution is already active", async () => {});
  });

  describe("Retrieve Remaining Balances", () => {
    it("Should fail if the sender is not the owner", async () => {});

    it("Should be possible to retrieve the remaining FLT tokens", async () => {});

    it("Should not be possible to retrieve if before unlock time", async () => {});

    it("Should fail if no FLT tokens are available", async () => {});
  });

  describe("Events", () => {
    it("Should emit a Grant event when a grant is created", async () => {});

    it("Should emit a Claim event when a grant is claimed", async () => {});

    it("Should emit a Pause event when distribution is paused", async () => {});

    it("Should emit a Resume event when distribution is resumed", async () => {});
  });
});
