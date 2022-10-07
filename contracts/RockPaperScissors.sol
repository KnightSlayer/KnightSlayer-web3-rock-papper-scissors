// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;

//import "hardhat/console.sol";

contract RockPaperScissors {
    enum GameStatus { OFFER, REVOKED, DECLINED, MOVES, CANCELED, REVEALING, FINISHED, TIMEOUT }

    modifier noSmartContract() {
        require(msg.sender == tx.origin);
        _;
    }

    modifier onlyPlayerOnStatus(GameStatus _status, uint _gameId) {
        Game storage game = games[_gameId];
        require(game.status == _status, "Wrong action for current game status");
        require(msg.sender == game.player1.addr || msg.sender == game.player2.addr, "Only players can interact with game");
        _;
        game.updatedAt = block.timestamp;
        emit GameUpdate(_gameId, game);
    }

    struct Player {
        address payable addr;
        bytes32 move; // move = hash(figure + secret)
        uint secret;
        bool isClaimed;
    }

    struct Game {
        Player player1; // initiator (offer maker)
        Player player2;
        uint bet;
        GameStatus status;
        uint updatedAt;
        uint createdAt;
    }

    event GameUpdate(uint indexed gameId, Game indexed game);

    uint8 immutable rockFigure = 0;
    uint8 immutable paperFigure = 1;
    uint8 immutable scissorsFigure = 2;
    Game[] public games;

    // https://stackoverflow.com/a/40939341
    function isContract(address _address) private view returns (bool) {
        uint size;
        assembly { size := extcodesize(_address) }
        return size > 0;
    }

    function getPlayers(uint _gameId) private view returns (Player storage actor, Player storage opponent) {
        Game storage game = games[_gameId];
        return game.player1.addr == msg.sender ? (game.player1, game.player2) :  (game.player2, game.player1);
    }

    function getMove(uint8 _figure, uint _secret) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(_secret + uint(_figure)));
    }

    function getFigure(bytes32 _move, uint _secret) private pure returns (uint8) {
        uint8[3] memory figures = [rockFigure, paperFigure, scissorsFigure];
        for (uint8 i = 0; i < figures.length; i++) {
            uint8 figure = figures[i];
            bytes32 move = getMove(figure, _secret);
            if (_move == move) return figure;
        }

        revert("Invalid figure");
    }

    function isCorrectMove(bytes32 _move, uint _secret) private pure returns (bool) {
        bytes32 rockMove = getMove(rockFigure, _secret);
        bytes32 paperMove = getMove(paperFigure, _secret);
        bytes32 scissorsMove = getMove(scissorsFigure, _secret);
        return rockMove == _move || paperMove == _move || scissorsMove == _move;
    }

    function makeOffer(address payable _opponent) external payable noSmartContract {
        require(!isContract(_opponent), "You can't challenge smart contract address");
        uint newGameId = games.length;

        games.push(Game(
            Player(payable(msg.sender), "", 0, false), // initiator (offer maker)
            Player(_opponent, "", 0, false), // opponent
            msg.value, // bet
            GameStatus.OFFER, // status
            block.timestamp, // updatedAt
            block.timestamp // createdAt
        ));

        emit GameUpdate(newGameId, games[newGameId]);
    }

    function revokeOffer(uint _gameId) external onlyPlayerOnStatus(GameStatus.OFFER, _gameId){
        Game storage game = games[_gameId];
        require(game.player1.addr == msg.sender, "Only offer maker can revoke the offer");
        game.status = GameStatus.REVOKED;
        game.player1.addr.transfer(game.bet);
    }

    function declineOffer(uint _gameId) external onlyPlayerOnStatus(GameStatus.OFFER, _gameId) {
        Game storage game = games[_gameId];
        require(game.player2.addr == msg.sender, "Only opponent can decline the offer");
        game.status = GameStatus.DECLINED;
        game.player1.addr.transfer(game.bet);
    }

    function acceptOffer(uint _gameId) external payable onlyPlayerOnStatus(GameStatus.OFFER, _gameId) {
        Game storage game = games[_gameId];
        require(game.player2.addr == msg.sender, "Only opponent can accept the offer");
        require(game.bet == msg.value, "You should provide the same amount of ether");
        game.status = GameStatus.MOVES;
    }

    function makeMove(uint _gameId, bytes32 _move) external onlyPlayerOnStatus(GameStatus.MOVES, _gameId) {
        require(_move != "", "Move can't be empty");
        Game storage game = games[_gameId];
        (Player storage actor, Player storage opponent) = getPlayers(_gameId);

        actor.move = _move;
        if (opponent.move != "") {
            game.status = GameStatus.REVEALING;
        }
    }

    function cancelForSlowMove(uint _gameId) external onlyPlayerOnStatus(GameStatus.MOVES, _gameId) {
        Game storage game = games[_gameId];
        require(game.updatedAt + 5 minutes > block.timestamp, "You cant abort game so fast");
        game.status = GameStatus.CANCELED;
        game.player1.addr.transfer(game.bet);
        game.player2.addr.transfer(game.bet);
    }

    function revealSecret(uint _secret, uint _gameId) external onlyPlayerOnStatus(GameStatus.REVEALING, _gameId) {
        (Player storage actor, Player storage opponent) = getPlayers(_gameId);
        require(isCorrectMove(actor.move, _secret), "incorrect move");
        actor.secret = _secret;
        if (opponent.secret > 0) {
            Game storage game = games[_gameId];
            game.status = GameStatus.FINISHED;
        }
    }

    function forceFinish(uint _gameId) external onlyPlayerOnStatus(GameStatus.REVEALING, _gameId) {
        Game storage game = games[_gameId];
        require(game.player1.secret > 0  || game.player2.secret > 0);
        require(game.updatedAt + 1 hours > block.timestamp, "You cant force game finish so fast");
        game.status = GameStatus.TIMEOUT;
    }

    function claim(uint _gameId) external onlyPlayerOnStatus(GameStatus.FINISHED, _gameId) {
        Game storage game = games[_gameId];
        (Player storage actor, Player storage opponent) = getPlayers(_gameId);
        require(actor.isClaimed == false, "Already claimed");
        uint8 module = (getFigure(actor.move, actor.secret) - getFigure(opponent.move, opponent.secret)) % 3;
        if (module == 0) actor.addr.transfer(game.bet);
        if (module == 1) actor.addr.transfer(game.bet * 2);
        if (module == 2) revert();
        actor.isClaimed = true;
    }
}