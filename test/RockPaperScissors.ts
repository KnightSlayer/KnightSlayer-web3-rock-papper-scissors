import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, ContractFactory } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

const emptyByte32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
enum Statuses { OFFER, REVOKED, DECLINED, MOVES, CANCELED, REVEALING, FINISHED, TIMEOUT };
enum Figures { ROCK, PAPER, SCISSORS};
const getRandomInt = () => Math.round(Math.random() * 1_000_000_000);
const getMove = (figure: Figures, secret: number) => {
  const asHex = ethers.utils.hexlify(figure + secret);
  const bitesLike = ethers.utils.hexZeroPad(asHex, 32)

  return ethers.utils.keccak256(bitesLike)
}

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

      expect(game.status).to.equal(Statuses.OFFER);
    })

    it("should start new game with 0 bet", async () => {
      await contract.makeOffer(bob.address)
      const game = await contract.games(0);
      expect(game.bet).to.equal(0);
    });

    it("should start new game with some bet", async () => {
      const bet = getRandomInt();
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
      const bet = getRandomInt();
      const gameId = 0;
      await contract.makeOffer(bob.address, {
        value: bet,
      })
      await expect(() => contract.revokeOffer(gameId))
        .to.changeEtherBalances([contract, alice], [-bet, bet]);

      const game = await contract.games(gameId);
      expect(game.status).to.equal(Statuses.REVOKED);
    })

    it("only offer-maker can revoke offer", async () => {
      const bet = getRandomInt();
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
      const bet = getRandomInt();
      const gameId = 0;
      await contract.makeOffer(bob.address, {
        value: bet,
      })
      await expect(() => contract.connect(bob).declineOffer(gameId))
        .to.changeEtherBalances([contract, alice], [-bet, bet]);

      const game = await contract.games(gameId);
      expect(game.status).to.equal(Statuses.DECLINED);
    })

    it("only opponent can decline offer", async () => {
      const bet = getRandomInt();
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

  describe("acceptOffer",  () => {
    it("should accept offer", async () => {
      const bet = getRandomInt();
      const gameId = 0;
      await contract.makeOffer(bob.address, {
        value: bet,
      })
      await expect(() => contract.connect(bob).acceptOffer(gameId, {value: bet}))
        .to.changeEtherBalances([contract, bob], [bet, -bet]);

      const game = await contract.games(gameId);
      expect(game.status).to.equal(Statuses.MOVES);
    })

    it("should provide value equal to bet", async () => {
      const bet = getRandomInt() + 2;
      const gameId = 0;
      await contract.makeOffer(bob.address, {
        value: bet,
      })

      await expect(contract.connect(bob).acceptOffer(gameId, {value: Math.round(bet / 2)}))
        .to.be.revertedWith("You should provide the same amount of ether");
    })

    it("should emit GameUpdate", async () => {
      await contract.makeOffer(bob.address);
      const gameId = 0;
      expect(contract.connect(bob).acceptOffer(gameId))
        .to.emit(contract, "GameUpdate")
        .withArgs(0, anyValue);

    })

    it("can accept only offer status", async () => {
      await contract.makeOffer(bob.address);
      const gameId = 0;
      await contract.connect(bob).acceptOffer(gameId);

      await expect(
        contract.acceptOffer(gameId)
      ).to.be.revertedWith("Wrong action for current game status");
    })

    it("only opponent can accept offer", async () => {
      await contract.makeOffer(bob.address);
      const gameId = 0;
      await expect(
        contract.acceptOffer(gameId)
      ).to.be.revertedWith("Only opponent can accept the offer");
      await expect(
        contract.connect(stranger).acceptOffer(gameId)
      ).to.be.revertedWith("Only players can interact with game");
    })
  });

  describe("makeMove", () => {
    const createGame = async () => {
      const bet = getRandomInt();
      const gameId = 0;
      await contract.makeOffer(bob.address, {value: bet});
      await contract.connect(bob).acceptOffer(gameId, {value: bet});
      contract.connect(alice);

      return { gameId, bet }
    }

    it("should change status when bot players made a move", async () => {
      const { gameId } = await createGame();
      const aliceMove = getMove(Figures.ROCK, getRandomInt());
      await contract.makeMove(gameId, aliceMove);
      let game = await contract.games(gameId);
      expect(game.status).to.equal(Statuses.MOVES);
      const bobMove = getMove(Figures.ROCK, getRandomInt());
      await contract.connect(bob).makeMove(gameId, bobMove);
      game = await contract.games(gameId);
      expect(game.status).to.equal(Statuses.REVEALING);
      expect(game.player1.move).to.equal(aliceMove);
      expect(game.player2.move).to.equal(bobMove);
    })

    it("player can change his move", async () => {
      const { gameId } = await createGame();
      await contract.makeMove(gameId, getMove(Figures.ROCK, getRandomInt()));
      const newMove = getMove(Figures.SCISSORS, getRandomInt());
      await contract.makeMove(gameId, newMove);
      const game = await contract.games(gameId);
      expect(game.player1.move).to.equal(newMove);
      expect(game.status).to.equal(Statuses.MOVES);
    });

    it("only players can make move", async () => {
      const { gameId } = await createGame();
      await expect(
        contract.connect(stranger).makeMove(gameId, getMove(Figures.ROCK, getRandomInt()))
      ).to.be.revertedWith("Only players can interact with game");
    });

    it("can make move only on move status", async () => {
      await contract.makeOffer(bob.address);
      const gameId = 0;

      await expect(
        contract.makeMove(gameId, getMove(Figures.ROCK, getRandomInt()))
      ).to.be.revertedWith("Wrong action for current game status");
    })
  })
});
