// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {MinimalForwarder} from "../src/MinimalForwarder.sol";

contract Target {
    address public lastSender;
    uint256 public valueReceived;

    function ping() external payable {
        lastSender = msg.sender;
        valueReceived = msg.value;
    }
}

contract MinimalForwarderTest is Test {
    MinimalForwarder public forwarder;
    Target public target;
    uint256 relayerKey;
    uint256 userKey;
    address relayer;
    address user;

    function setUp() public {
        forwarder = new MinimalForwarder();
        target = new Target();
        relayerKey = 0xA11CE;
        userKey = 0xB0B;
        relayer = vm.addr(relayerKey);
        user = vm.addr(userKey);
    }

    function test_GetNonce_StartsAtZero() public view {
        assertEq(forwarder.getNonce(user), 0);
    }

    function test_Execute_IncrementsNonce() public {
        bytes memory data = abi.encodeWithSelector(Target.ping.selector);
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user,
            to: address(target),
            value: 0,
            gas: 100_000,
            nonce: 0,
            data: data
        });
        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userKey, digest);
        if (v < 27) v += 27;
        bytes memory signature = abi.encodePacked(r, s, v);

        forwarder.execute(req, signature);

        assertEq(forwarder.getNonce(user), 1);
    }

    function test_Execute_ForwardsCall() public {
        bytes memory data = abi.encodeWithSelector(Target.ping.selector);
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user,
            to: address(target),
            value: 1 ether,
            gas: 100_000,
            nonce: 0,
            data: data
        });
        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userKey, digest);
        if (v < 27) v += 27;
        bytes memory signature = abi.encodePacked(r, s, v);

        forwarder.execute{ value: 1 ether }(req, signature);

        assertEq(target.lastSender(), address(forwarder));
        assertEq(target.valueReceived(), 1 ether);
    }

    function test_Verify_ValidSignature_ReturnsTrue() public {
        bytes memory data = abi.encodeWithSelector(Target.ping.selector);
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user,
            to: address(target),
            value: 0,
            gas: 100_000,
            nonce: 0,
            data: data
        });
        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userKey, digest);
        if (v < 27) v += 27;
        bytes memory signature = abi.encodePacked(r, s, v);

        assertTrue(forwarder.verify(req, signature));
    }

    function test_Execute_ReplayFails() public {
        bytes memory data = abi.encodeWithSelector(Target.ping.selector);
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: user,
            to: address(target),
            value: 0,
            gas: 100_000,
            nonce: 0,
            data: data
        });
        bytes32 digest = _getDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userKey, digest);
        if (v < 27) v += 27;
        bytes memory signature = abi.encodePacked(r, s, v);

        forwarder.execute(req, signature);
        vm.expectRevert("MinimalForwarder: invalid signature or nonce");
        forwarder.execute(req, signature);
    }

    function _getDigest(MinimalForwarder.ForwardRequest memory req) internal view returns (bytes32) {
        bytes32 typeHash = forwarder.FORWARD_REQUEST_TYPEHASH();
        bytes32 structHash = keccak256(
            abi.encode(
                typeHash,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            )
        );
        bytes32 domainSeparator = _domainSeparator();
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MinimalForwarder"),
                keccak256("1"),
                block.chainid,
                address(forwarder)
            )
        );
    }
}
