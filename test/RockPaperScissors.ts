import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("RockPaperScissors.sol", () => {
  let contractFactory: ContractFactory;
  let contract: Contract;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let stranger: SignerWithAddress;

  beforeEach(async () => {
    [alice, bob, stranger] = await ethers.getSigners();
    contractFactory = await ethers.getContractFactory("RockPaperScissors");
    contract = await contractFactory.deploy();
  });

  describe("Offer", () => {
    it("should increment game id", async () => {
      expect(contract.makeOffer(bob.address))
        .to.emit(contract, "GameUpdate")
        .withArgs(0, anyValue);

      expect(contract.makeOffer(bob.address))
        .to.emit(contract, "GameUpdate")
        .withArgs(1, anyValue);

      expect(contract.makeOffer(bob.address))
        .to.emit(contract, "GameUpdate")
        .withArgs(2, anyValue);

      expect(contract.makeOffer(bob.address))
        .to.emit(contract, "GameUpdate")
        .withArgs(3, anyValue);

    })

    it("should start new game with 0 bet", async () => {
      await contract.makeOffer(bob.address)
      const game = await contract.games(0);
      expect(game.bet).to.equal(0);
    });
  });
});
