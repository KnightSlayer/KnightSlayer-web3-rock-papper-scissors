import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

const emptyByte32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
enum statuses { OFFER, REVOKED, DECLINED, MOVES, CANCELED, REVEALING, FINISHED, TIMEOUT }
const getRandomBet = () => Math.round(Math.random() * 100_000);

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
      const bet = getRandomBet();
      const gameId = 0;
      await expect(() => contract.makeOffer(bob.address, {
        value: bet,
      })).to.changeEtherBalances([contract, alice], [bet, -bet]);
      const game = await contract.games(gameId);
      expect(game.bet).to.equal(bet);
    });
  });

  describe("revokeOffer",  () => {
    it("should revoke offer", async () => {
      const bet = getRandomBet();
      const gameId = 0;
      await contract.makeOffer(bob.address, {
        value: bet,
      })
      await expect(() => contract.revokeOffer(gameId))
        .to.changeEtherBalances([contract, alice], [-bet, bet]);

      const game = await contract.games(gameId);
      expect(game.status).to.equal(statuses.REVOKED);
    })

    it("only offer-maker can revoke offer", async () => {
      const bet = getRandomBet();
      const gameId = 0;
      await contract.makeOffer(bob.address, {
        value: bet,
      })

      await expect(
        contract.connect(bob).revokeOffer(gameId)
      ).to.be.revertedWith("Only offer maker can revoke the offer");

      await expect(
        contract.connect(stranger).revokeOffer(gameId)
      ).to.be.revertedWith("Only players can interact with game");
    })

    it("should emit GameUpdate", async () => {
      await contract.makeOffer(bob.address);
      expect(contract.revokeOffer())
        .to.emit(contract, "GameUpdate")
        .withArgs(0, anyValue);

    })

    it("can revoke only offer status", async () => {
      await contract.makeOffer(bob.address)
      await contract.revokeOffer(0);

      await expect(
        contract.revokeOffer(0)
      ).to.be.revertedWith("Wrong action for current game status");
    })
  });

  describe("declineOffer",  () => {
    it("should decline offer", async () => {
      const bet = getRandomBet();
      const gameId = 0;
      await contract.makeOffer(bob.address, {
        value: bet,
      })
      await expect(() => contract.connect(bob).declineOffer(gameId))
        .to.changeEtherBalances([contract, alice], [-bet, bet]);

      const game = await contract.games(gameId);
      expect(game.status).to.equal(statuses.DECLINED);
    })

    it("only opponent can decline offer", async () => {
      const bet = getRandomBet();
      const gameId = 0;
      await contract.makeOffer(bob.address, {
        value: bet,
      })

      await expect(
        contract.declineOffer(gameId)
      ).to.be.revertedWith("Only opponent can decline the offer");

      await expect(
        contract.connect(stranger).declineOffer(gameId)
      ).to.be.revertedWith("Only players can interact with game");
    })

    it("should emit GameUpdate", async () => {
      await contract.makeOffer(bob.address);
      expect(contract.connect(bob).declineOffer())
        .to.emit(contract, "GameUpdate")
        .withArgs(0, anyValue);

    })

    it("can decline only offer status", async () => {
      await contract.makeOffer(bob.address)
      await contract.connect(bob).declineOffer(0);

      await expect(
        contract.declineOffer(0)
      ).to.be.revertedWith("Wrong action for current game status");
    })
  });
});
