import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";

describe("FLTGrant", () => {
  describe("Deployment", () => {});

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

  describe("Events", () => {
    it("Should emit a Grant event when a grant is created", async () => {});

    it("Should emit a Claim event when a grant is claimed", async () => {});

    it("Should emit a Pause event when the distribution is paused", async () => {});

    it("Should emit a Resume event when the distribution is resumed", async () => {});
  });
});
