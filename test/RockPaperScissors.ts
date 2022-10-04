import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("RockPaperScissors.sol", () => {
  let contractFactory: ContractFactory;
  let contract: Contract;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let ownerAddress: string;
  let aliceAddress: string;
  let bobAddress: string;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();
    contractFactory = await ethers.getContractFactory("RockPaperScissors");
    contract = await contractFactory.deploy();
    ownerAddress = await owner.getAddress();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();
  });

  describe("Correct setup", () => {
    it("should be named 'MyToken", async () => {
      const res = await contract.test();
      console.log('t', res);

      expect(res).to.equal("tt11");
    });
  });
});
