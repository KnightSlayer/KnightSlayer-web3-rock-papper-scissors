// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

contract RockPaperScissors {
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
        string player1Move;
        string player2Move;
        uint player1Secret;
        uint player2Secret;
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

    function isSameStrings(string _str1, string _str2) private pure returns (bool) {
        return keccak256(abi.encodePacked(_str1)) == keccak256(abi.encodePacked(_str2));
    }

    function isEmptyStrings(string _str) private pure returns (bool) {
        return isSameStrings(_str, '');
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
            '',  // player 1's move
            '', // player 2's move
            0,
            0,
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

    function acceptOffer(uint _gameId) external payable forStatus(GameStatus.OFFER) markUpdate(_gameId) {
        Game memory game = games[msg.sender][_gameId];
        require(game.player2 == msg.sender, 'Only opponent can accept the offer');
        require(game.bet == msg.value, 'You should provide the same amount of ether');
        game.status = GameStatus.MOVES;
    }

    // do we need `memory` for move?
    function makeMove(uint _gameId, string memory move) external forStatus(GameStatus.MOVES) markUpdate(_gameId) {
        Game memory game = games[msg.sender][_gameId];
        require(msg.sender == game.player1 || msg.sender == game.player2, 'Only players can make a move');

        if (msg.sender == game.player1) {
            game.player1Move = move;
            if (!isEmptyStrings(game.player2Move)) {
                game.status = GameStatus.REVEALING;
            }
        } else {
            game.player2Move = move;
            if (!isEmptyStrings(game.player1Move)) {
                game.status = GameStatus.REVEALING;
            }
        }
    }
}
