import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("RockPaperScissors.sol", () => {
  let contractFactory: ContractFactory;
  let contract: Contract;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let stranger: SignerWithAddress;
  let aliceAddress: string;
  let bobAddress: string;
  let strangerAddress: string;

  beforeEach(async () => {
    [alice, bob, stranger] = await ethers.getSigners();
    contractFactory = await ethers.getContractFactory("RockPaperScissors");
    contract = await contractFactory.deploy();
    aliceAddress = await alice.getAddress();
    bobAddress = await bob.getAddress();
    strangerAddress = await stranger.getAddress();
  });

  describe("Correct setup", () => {
    it("should start new game with 0 bet", async () => {
      const res = await contract.makeOffer(bob.getAddress());
      const [id] = ethers.utils.defaultAbiCoder.decode(['uint'], ethers.utils.hexDataSlice(res.data, 4));
      console.log('id', id);
      expect(id).to.equal(0);

      const game = await contract.games(id);
      console.log('game', game);
      expect(1).to.equal(1);
    });
  });
});
