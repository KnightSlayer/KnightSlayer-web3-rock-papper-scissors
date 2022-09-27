// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

contract RockPaperScissors {
    enum Figure { NONE, ROCK, PAPER, SCISSORS }
    enum GameStatus { OFFER, REVOKED, DECLINED, MOVES, REVEALING, FINISHED, TIMEOUT }
    event Offer(address player1, address player2, uint bet);
    uint nextGameId = 1;

    modifier noSmartContract() {
        require(msg.sender != tx.origin);
        _;
    }

    modifier markUpdate(uint _gameId) {
        _;
        Game memory game = games[msg.sender][_gameId];
        game.updatedAt = now;
    }

    modifier forStatus(GameStatus _status, gameId) {
        require(msg.sender != tx.origin);
        _;
    }

    struct Game {
        uint id;
        address player1; // initiator (offer maker)
        address player2;
        Figure player1Figure;
        Figure player2Figure;
        uint bet;
        GameStatus status;
        uint updatedAt;
        uint createdAt;
    }

    // playerAddress -> gameId -> gameState
    mapping (address => mapping(uint => Game)) games;

    function getAllGamesOf(address _address) external {
        return userGames[_address];
    }

    // https://stackoverflow.com/a/40939341
    function isContract(address _address) private returns (bool) {
        uint size;
        assembly { size := extcodesize(_address) }
        return size > 0;
    }

    function makeOffer(address _opponent) external payable noSmartContract {
        require(nextGameId != 0, "This contract reached maximum games count. Fork this contract for new games"); // overflow happen
        require(!isContract(_opponent), "You can't challenge smart contract address");
        uint gameId = nextGameId;
        nextGameId++;
        Game memory newGame = Game(
            gameId, // id
            msg.sender, // player 1
            _opponent,  // player 2
            Figure.NONE,  // player 1's move
            Figure.NONE, // player 2's move
            msg.value, // bet
            GameStatus.OFFER, // status
            now, // updatedAt
            now // createdAt
        );

        games[msg.sender][gameId] = newGame;
        games[_opponent][gameId] = newGame;
    }

    function revokeOffer(uint _gameId) external forStatus(GameStatus.OFFER) markUpdate(_gameId) {
        Game memory game = games[msg.sender][_gameId];
        require(game.player1 == msg.sender, 'Only offer maker can revoke the offer');
        game.status = GameStatus.REVOKED;
        game.player1.transfer(game.bet);
    }

    function declineOffer(uint _gameId) external forStatus(GameStatus.OFFER) markUpdate(_gameId) {
        Game memory game = games[msg.sender][_gameId];
        require(game.player2 == msg.sender, 'Only opponent can decline the offer');
        game.status = GameStatus.DECLINED;
        game.player1.transfer(game.bet);
    }
}
