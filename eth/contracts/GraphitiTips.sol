// SPDX-License-Identifier: MIT
pragma solidity >=0.4.21 <0.8.0;

import "./IERC20.sol";
import "./SafeMath.sol";

contract GraphitiTips {
    IERC20 public token;

    constructor(address tokenAddr) {
        token = IERC20(tokenAddr);
    }

    uint256
        private constant MAX_S = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    function recover(
        bytes32 hash,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) internal pure returns (address) {
        require(uint256(s) <= MAX_S, "Invalid signature 's' value");
        require(v == 27 || v == 28, "Invalid signature 'v' value");

        address signer = ecrecover(hash, v, r, s);
        require(signer != address(0), "Invalid signature");

        return signer;
    }

    function claimTips(
        bytes32 wallId,
        uint256 threshold,
        address[] memory userList,
        uint256[] memory amountList,
        bytes32[] memory rList,
        bytes32[] memory sList,
        uint8[] memory vList
    ) public returns (bool) {
        uint256 length = userList.length;
        require(length == amountList.length, "amountList length mismatch");
        require(length == rList.length, "rList length mismatch");
        require(length == sList.length, "sList length mismatch");
        require(length == vList.length, "vList length mismatch");

        bytes memory sigPrefix = abi.encodePacked(
            msg.sender,
            wallId,
            threshold
        );

        for (uint256 i = 0; i < length; i++) {
            address signer = recover(
                keccak256(abi.encodePacked(sigPrefix, amountList[i])),
                rList[i],
                sList[i],
                vList[i]
            );

            require(signer == userList[i], "Signer mismatch");

            threshold = SafeMath.sub(
                threshold,
                amountList[i],
                "Amount sum below threshold"
            );
            token.transferFrom(userList[i], msg.sender, amountList[i]);
        }

        return true;
    }
}
