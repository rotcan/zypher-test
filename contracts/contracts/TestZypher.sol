// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.20;
import {ZgShuffleVerifier, ZgRevealVerifier, Point, MaskedCard} from '@zypher-game/secret-engine/Verifiers.sol';
import {ShuffleService} from "./shuffle/ShuffleService.sol";

contract TestZypher{
    uint256 private constant VALID_DECK_SIZE = 20;
    ShuffleService public _shuffleService;
    ZgRevealVerifier public _reveal;
    Point public jointkey;
    uint256[] public pkc;
    constructor(ShuffleService shuffleService,ZgRevealVerifier reveal) 
    {
        _shuffleService=shuffleService;
        _reveal=reveal;
    }

    function initKey(Point memory publicKey1,Point memory publicKey2) external{
        Point[] memory keys = new Point[](2);
        keys[0]=publicKey1;
        keys[1]=publicKey2;
        jointkey = _reveal.aggregateKeys(keys);
        
    }

    function setPkc(uint256[24] calldata _pkc) external{
        pkc=_pkc;
        _shuffleService.setPkc(pkc);
    }


    function shuffle(
        uint256[4][] calldata maskedDeck,
        uint256[4][] calldata shuffledDeck,
        bytes calldata proof) external{
        uint256[] memory maskedDeckInput = new uint256[](VALID_DECK_SIZE*4);
        uint256[] memory shuffledDeckInput = new uint256[](VALID_DECK_SIZE*4);
        
        for (uint256 i = 0; i < VALID_DECK_SIZE; i++) {
            maskedDeckInput[i * 4 + 0] = maskedDeck[i][0];
            maskedDeckInput[i * 4 + 1] = maskedDeck[i][1];
            maskedDeckInput[i * 4 + 2] = maskedDeck[i][2];
            maskedDeckInput[i * 4 + 3] = maskedDeck[i][3];

            shuffledDeckInput[i * 4 + 0] = shuffledDeck[i][0];
            shuffledDeckInput[i * 4 + 1] = shuffledDeck[i][1];
            shuffledDeckInput[i * 4 + 2] = shuffledDeck[i][2];
            shuffledDeckInput[i * 4 + 3] = shuffledDeck[i][3];
        }
        _shuffleService.setDeck(maskedDeckInput);
        _shuffleService.verify(shuffledDeckInput, proof);
    }
}