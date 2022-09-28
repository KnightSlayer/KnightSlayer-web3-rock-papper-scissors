// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.17;
import "@openzeppelin/contracts/utils/Strings.sol";

contract RockPaperScissors {
    enum GameStatus { OFFER, REVOKED, DECLINED, MOVES, CANCELED, REVEALING, FINISHED, TIMEOUT }

    event Offer(address player1, address player2, uint bet);

    uint nextGameId = 1;

    modifier noSmartContract() {
        require(msg.sender != tx.origin);
        _;
    }

    modifier onlyPlayerOnStatus(GameStatus _status, uint _gameId) {
        Game storage game = games[msg.sender][_gameId];
        require(game.status == _status);
        require(msg.sender == game.player1.addr || msg.sender == game.player2.addr, 'Only players can make a move');
        _;
        game.updatedAt = block.timestamp;
    }

    struct Player {
        address payable addr;
        string move;
        uint secret;
    }

    struct Game {
        uint id;
        Player player1; // initiator (offer maker)
        Player player2;
        uint bet;
        GameStatus status;
        uint updatedAt;
        uint createdAt;
    }

    // playerAddress -> gameId -> gameState
    mapping (address => mapping(uint => Game)) games;

    // https://stackoverflow.com/a/40939341
    function isContract(address _address) private view returns (bool) {
        uint size;
        assembly { size := extcodesize(_address) }
        return size > 0;
    }

    function isSameStrings(string memory _str1, string memory  _str2) private pure returns (bool) {
        return keccak256(abi.encodePacked(_str1)) == keccak256(abi.encodePacked(_str2));
    }

    function isEmptyStrings(string memory  _str) private pure returns (bool) {
        return isSameStrings(_str, '');
    }

    function getMove(string memory _figure, uint _secret) private pure returns (string memory) {
        string memory secretAsString = Strings.toString(_secret);
        string memory fullMove = string.concat(_figure, secretAsString);
        return string(abi.encodePacked(keccak256(abi.encodePacked(fullMove))));
    }

    function isCorrectMove(string memory _move, uint _secret) private pure returns (bool) {
        string memory rockMove = getMove("Rock", _secret);
        string memory paperMove = getMove("Paper", _secret);
        string memory scissorsMove = getMove("Scissors", _secret);
        return isSameStrings(rockMove, _move) || isSameStrings(paperMove, _move) || isSameStrings(scissorsMove, _move);
    }

    function makeOffer(address payable _opponent) external payable noSmartContract {
        require(nextGameId != 0, "This contract reached maximum games count. Fork this contract for new games"); // overflow happen
        require(!isContract(_opponent), "You can't challenge smart contract address");
        uint gameId = nextGameId;
        nextGameId++;

        Game memory newGame = Game(
            gameId, // id
            Player(payable(msg.sender), '', 0), // initiator (offer maker)
            Player(_opponent, '', 0), // opponent
            msg.value, // bet
            GameStatus.OFFER, // status
            block.timestamp, // updatedAt
            block.timestamp // createdAt
        );

        games[newGame.player1.addr][gameId] = newGame;
        games[newGame.player2.addr][gameId] = newGame;
    }

    function revokeOffer(uint _gameId) external onlyPlayerOnStatus(GameStatus.OFFER, _gameId){
        Game storage game = games[msg.sender][_gameId];
        require(game.player1.addr == msg.sender, 'Only offer maker can revoke the offer');
        game.status = GameStatus.REVOKED;
        game.player1.addr.transfer(game.bet);
    }

    function declineOffer(uint _gameId) external onlyPlayerOnStatus(GameStatus.OFFER, _gameId) {
        Game storage game = games[msg.sender][_gameId];
        require(game.player2.addr == msg.sender, 'Only opponent can decline the offer');
        game.status = GameStatus.DECLINED;
        game.player1.addr.transfer(game.bet);
    }

    function acceptOffer(uint _gameId) external payable onlyPlayerOnStatus(GameStatus.OFFER, _gameId) {
        Game storage game = games[msg.sender][_gameId];
        require(game.player2.addr == msg.sender, 'Only opponent can accept the offer');
        require(game.bet == msg.value, 'You should provide the same amount of ether');
        game.status = GameStatus.MOVES;
    }

    function makeMove(uint _gameId, string calldata move) external onlyPlayerOnStatus(GameStatus.MOVES, _gameId) {
        Game storage game = games[msg.sender][_gameId];
        require(!isEmptyStrings(move), "Move can't be empty");

        if (msg.sender == game.player1.addr) {
            game.player1.move = move;
            if (!isEmptyStrings(game.player2.move)) {
                game.status = GameStatus.REVEALING;
            }
        } else {
            game.player2.move = move;
            if (!isEmptyStrings(game.player1.move)) {
                game.status = GameStatus.REVEALING;
            }
        }
    }

    function cancelForSlowMove(uint _gameId) external onlyPlayerOnStatus(GameStatus.MOVES, _gameId) {
        Game storage game = games[msg.sender][_gameId];
        require(game.updatedAt + 5 minutes > block.timestamp, 'You cant abort game so fast');
        game.status = GameStatus.CANCELED;
        game.player1.addr.transfer(game.bet);
        game.player2.addr.transfer(game.bet);
    }

    function revealSecret(uint _secret, uint _gameId) external onlyPlayerOnStatus(GameStatus.REVEALING, _gameId) {
        Game storage game = games[msg.sender][_gameId];
        if (msg.sender == game.player1.addr) {
            require(isCorrectMove(game.player1.move, _secret), "incorrect move");
            game.player1.secret = _secret;
            if (game.player2.secret > 0) {
                game.status = GameStatus.FINISHED;
            }
        } else {
            require(isCorrectMove(game.player2.move, _secret), "incorrect move");
            game.player2.secret = _secret;
            if (game.player1.secret > 0) {
                game.status = GameStatus.FINISHED;
            }
        }
    }

    function forceFinish(uint _gameId) external onlyPlayerOnStatus(GameStatus.REVEALING, _gameId) {
        Game storage game = games[msg.sender][_gameId];
        require(game.player1.secret > 0  || game.player2.secret > 0);
        require(game.updatedAt + 1 hours > block.timestamp, 'You cant force game finish so fast');
        game.status = GameStatus.TIMEOUT;
    }
}