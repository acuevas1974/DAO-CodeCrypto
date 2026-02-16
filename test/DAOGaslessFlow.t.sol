// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {MinimalForwarder} from "../src/MinimalForwarder.sol";
import {DAOVoting} from "../src/DAOVoting.sol";

/**
 * @title DAOGaslessFlowTest
 * @notice Tests del flujo gasless: usuario firma off-chain, relayer llama a MinimalForwarder.execute().
 *         El DAO recibe la llamada con _msgSender() = firmante (no el relayer).
 */
contract DAOGaslessFlowTest is Test {
    MinimalForwarder public forwarder;
    DAOVoting public dao;

    address public alice;
    address public bob;
    address public relayer;
    uint256 public aliceKey = 0xA11CE;
    uint256 public bobKey = 0xB0B;
    uint256 public relayerKey = 0xC0FFEE;

    function setUp() public {
        forwarder = new MinimalForwarder();
        dao = new DAOVoting(address(forwarder));
        alice = vm.addr(aliceKey);
        bob = vm.addr(bobKey);
        relayer = vm.addr(relayerKey);
        vm.deal(relayer, 10 ether); // relayer paga gas
    }

    /// @dev Crea una propuesta activa: alice con >10% fondos, bob con 1 wei para poder votar
    function _setupProposal() internal returns (uint256 proposalId, uint256 deadline) {
        vm.deal(alice, 20 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 10 ether }();
        deadline = block.timestamp + 7 days;
        vm.prank(alice);
        proposalId = dao.createProposal(bob, 1 ether, deadline);

        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();
    }

    /// @dev Firma y ejecuta una meta-tx de vote(proposalId, voteType) en nombre de `voterKey`
    function _voteViaForwarder(uint256 proposalId, DAOVoting.VoteType voteType, uint256 voterKey)
        internal
        returns (bool success)
    {
        address voter = vm.addr(voterKey);
        uint256 nonce = forwarder.getNonce(voter);
        bytes memory data = abi.encodeWithSelector(DAOVoting.vote.selector, proposalId, voteType);

        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: voter,
            to: address(dao),
            value: 0,
            gas: 200_000,
            nonce: nonce,
            data: data
        });

        bytes32 digest = _getForwardRequestDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(voterKey, digest);
        if (v < 27) v += 27;
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(relayer);
        (success,) = forwarder.execute(req, signature);
    }

    /// @dev Digest EIP-712 para ForwardRequest (mismo que MinimalForwarder)
    function _getForwardRequestDigest(MinimalForwarder.ForwardRequest memory req)
        internal
        view
        returns (bytes32)
    {
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
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("MinimalForwarder"),
                keccak256("1"),
                block.chainid,
                address(forwarder)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    // -------------------------------------------------------------------------
    // Flujo gasless: votar
    // -------------------------------------------------------------------------

    function test_Gasless_Vote_For_RelayerPaysGas_BobCountedAsVoter() public {
        (uint256 proposalId,) = _setupProposal();

        bool success = _voteViaForwarder(proposalId, DAOVoting.VoteType.For, bobKey);
        assertTrue(success);

        assertEq(uint256(dao.getVote(proposalId, bob)), uint256(DAOVoting.VoteType.For));
        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(p.forVotes, 1);
        assertEq(p.againstVotes, 0);
        assertEq(p.abstainVotes, 0);
    }

    function test_Gasless_Vote_Against_CountedCorrectly() public {
        (uint256 proposalId,) = _setupProposal();

        bool success = _voteViaForwarder(proposalId, DAOVoting.VoteType.Against, bobKey);
        assertTrue(success);

        assertEq(uint256(dao.getVote(proposalId, bob)), uint256(DAOVoting.VoteType.Against));
        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(p.againstVotes, 1);
    }

    function test_Gasless_Vote_ChangeVote_BeforeDeadline() public {
        (uint256 proposalId,) = _setupProposal();

        assertTrue(_voteViaForwarder(proposalId, DAOVoting.VoteType.For, bobKey));
        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(p.forVotes, 1);

        assertTrue(_voteViaForwarder(proposalId, DAOVoting.VoteType.Against, bobKey));
        p = dao.getProposal(proposalId);
        assertEq(p.forVotes, 0);
        assertEq(p.againstVotes, 1);
        assertEq(uint256(dao.getVote(proposalId, bob)), uint256(DAOVoting.VoteType.Against));
    }

    function test_Gasless_Vote_ReplayFails_NonceConsumed() public {
        (uint256 proposalId,) = _setupProposal();

        address voter = bob;
        uint256 nonce = forwarder.getNonce(voter);
        bytes memory data = abi.encodeWithSelector(DAOVoting.vote.selector, proposalId, DAOVoting.VoteType.For);
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: voter,
            to: address(dao),
            value: 0,
            gas: 200_000,
            nonce: nonce,
            data: data
        });
        bytes32 digest = _getForwardRequestDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(bobKey, digest);
        if (v < 27) v += 27;
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(relayer);
        (bool first,) = forwarder.execute(req, signature);
        assertTrue(first);

        vm.prank(relayer);
        vm.expectRevert("MinimalForwarder: invalid signature or nonce");
        forwarder.execute(req, signature);
    }

    function test_Gasless_Vote_AfterDeadline_Reverts() public {
        (uint256 proposalId, uint256 deadline) = _setupProposal();
        vm.warp(deadline + 1);

        bool success = _voteViaForwarder(proposalId, DAOVoting.VoteType.For, bobKey);
        // La llamada al DAO revierte (deadline pasado), el forwarder devuelve success=false
        assertFalse(success);
        assertEq(uint256(dao.getVote(proposalId, bob)), uint256(DAOVoting.VoteType.None));
        assertEq(dao.getProposal(proposalId).forVotes, 0);
    }

    function test_Gasless_FundDAO_ThenVote_BobFundsViaMetaTx() public {
        vm.deal(alice, 20 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 10 ether }();
        uint256 deadline = block.timestamp + 7 days;
        vm.prank(alice);
        uint256 proposalId = dao.createProposal(bob, 1 ether, deadline);

        // Bob no ha depositado aún. Primero hace fundDAO() via meta-tx.
        vm.deal(bob, 1 ether);
        uint256 nonce = forwarder.getNonce(bob);
        bytes memory fundData = abi.encodeWithSelector(DAOVoting.fundDAO.selector);
        MinimalForwarder.ForwardRequest memory req = MinimalForwarder.ForwardRequest({
            from: bob,
            to: address(dao),
            value: 1 wei,
            gas: 150_000,
            nonce: nonce,
            data: fundData
        });
        bytes32 digest = _getForwardRequestDigest(req);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(bobKey, digest);
        if (v < 27) v += 27;
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(relayer);
        (bool ok,) = forwarder.execute{ value: 1 wei }(req, signature);
        assertTrue(ok);

        assertEq(dao.getUserBalance(bob), 1 wei);
        assertEq(dao.totalBalance(), 10 ether + 1 wei);

        // Ahora vota gasless
        assertTrue(_voteViaForwarder(proposalId, DAOVoting.VoteType.For, bobKey));
        assertEq(uint256(dao.getVote(proposalId, bob)), uint256(DAOVoting.VoteType.For));
        assertEq(dao.getProposal(proposalId).forVotes, 1);
    }
}
