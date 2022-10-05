import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

const emptyByte32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
enum statuses { OFFER, REVOKED, DECLINED, MOVES, CANCELED, REVEALING, FINISHED, TIMEOUT }

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

  describe("makeOffer", () => {
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

    it("should setup users and status", async () => {
      await contract.makeOffer(bob.address)
      const game = await contract.games(0);

      expect(game.player1.addr).to.equal(alice.address);
      expect(game.player1.move).to.equal(emptyByte32);
      expect(game.player1.secret).to.equal(0);
      expect(game.player1.isClaimed).to.equal(false);

      expect(game.player2.addr).to.equal(bob.address);
      expect(game.player2.move).to.equal(emptyByte32);
      expect(game.player2.secret).to.equal(0);
      expect(game.player2.isClaimed).to.equal(false);

      expect(game.status).to.equal(statuses.OFFER);
    })

    it("should start new game with 0 bet", async () => {
      await contract.makeOffer(bob.address)
      const game = await contract.games(0);
      expect(game.bet).to.equal(0);
    });

    it("should start new game with some bet", async () => {
      const bet = Math.round(Math.random() * 100_000);
      await expect(() => contract.makeOffer(bob.address, {
        value: bet,
      })).to.changeEtherBalances([contract, alice], [bet, -bet]);
      const game = await contract.games(0);
      expect(game.bet).to.equal(bet);
    });
  });
});
