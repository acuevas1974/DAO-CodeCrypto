// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {MinimalForwarder} from "../src/MinimalForwarder.sol";
import {DAOVoting} from "../src/DAOVoting.sol";

contract DAOVotingTest is Test {
    MinimalForwarder public forwarder;
    DAOVoting public dao;

    address public alice;
    address public bob;
    uint256 public aliceKey = 0xA11CE;
    uint256 public bobKey = 0xB0B;

    function setUp() public {
        forwarder = new MinimalForwarder();
        dao = new DAOVoting(address(forwarder));
        alice = vm.addr(aliceKey);
        bob = vm.addr(bobKey);
    }

    // -------------------------------------------------------------------------
    // fundDAO / balances
    // -------------------------------------------------------------------------

    function test_FundDAO_UpdatesUserAndTotalBalance() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 3 ether }();

        assertEq(dao.getUserBalance(alice), 3 ether);
        assertEq(dao.totalBalance(), 3 ether);
    }

    function test_FundDAO_AccumulatesMultipleDeposits() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 1 ether }();
        vm.prank(alice);
        dao.fundDAO{ value: 2 ether }();

        assertEq(dao.getUserBalance(alice), 3 ether);
        assertEq(dao.totalBalance(), 3 ether);
    }

    function test_FundDAO_RevertsWhenAmountZero() public {
        vm.prank(alice);
        vm.expectRevert("DAOVoting: amount must be > 0");
        dao.fundDAO{ value: 0 }();
    }

    function test_GetUserBalance_ReturnsZeroForNonDepositor() public view {
        assertEq(dao.getUserBalance(bob), 0);
    }

    function test_ProposalCount_StartsAtZero() public view {
        assertEq(dao.proposalCount(), 0);
    }

    function test_GetProposal_RevertsForZeroId() public {
        vm.expectRevert("DAOVoting: invalid proposal id");
        dao.getProposal(0);
    }

    function test_GetProposal_RevertsForNonExistentId() public {
        vm.expectRevert("DAOVoting: invalid proposal id");
        dao.getProposal(1);
    }

    // -------------------------------------------------------------------------
    // createProposal (Etapa 2b)
    // -------------------------------------------------------------------------

    function test_CreateProposal_Success_WhenBalanceOver10Percent() public {
        vm.deal(alice, 20 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 10 ether }();
        // Total 10 ether, alice 10 ether = 100% > 10%

        uint256 deadline = block.timestamp + 7 days;
        vm.prank(alice);
        uint256 id = dao.createProposal(bob, 1 ether, deadline);

        assertEq(id, 1);
        assertEq(dao.proposalCount(), 1);

        DAOVoting.Proposal memory p = dao.getProposal(1);
        assertEq(p.id, 1);
        assertEq(p.amount, 1 ether);
        assertEq(p.recipient, bob);
        assertEq(p.deadline, deadline);
        assertEq(p.forVotes, 0);
        assertEq(p.againstVotes, 0);
        assertEq(p.abstainVotes, 0);
        assertEq(uint256(p.status), uint256(DAOVoting.ProposalStatus.Active));
    }

    function test_CreateProposal_RevertsWhenBalanceNotOver10Percent() public {
        vm.deal(alice, 20 ether);
        vm.deal(bob, 20 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 1 ether }(); // 10% of 10
        vm.prank(bob);
        dao.fundDAO{ value: 9 ether }(); // total 10 ether, alice = 1 ether = exactly 10%

        uint256 deadline = block.timestamp + 7 days;
        vm.prank(alice);
        vm.expectRevert("DAOVoting: need > 10% of total balance to create proposal");
        dao.createProposal(bob, 1 ether, deadline);
    }

    function test_CreateProposal_RevertsWhenDaoHasNoFunds() public {
        vm.deal(alice, 10 ether);
        uint256 deadline = block.timestamp + 7 days;
        vm.prank(alice);
        vm.expectRevert("DAOVoting: DAO has no funds");
        dao.createProposal(bob, 1 ether, deadline);
    }

    function test_CreateProposal_RevertsWhenRecipientZero() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 5 ether }();
        uint256 deadline = block.timestamp + 7 days;
        vm.prank(alice);
        vm.expectRevert("DAOVoting: recipient is zero");
        dao.createProposal(address(0), 1 ether, deadline);
    }

    function test_CreateProposal_RevertsWhenAmountZero() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 5 ether }();
        uint256 deadline = block.timestamp + 7 days;
        vm.prank(alice);
        vm.expectRevert("DAOVoting: amount must be > 0");
        dao.createProposal(bob, 0, deadline);
    }

    function test_CreateProposal_RevertsWhenDeadlineNotInFuture() public {
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 5 ether }();
        uint256 pastDeadline = block.timestamp - 1;
        vm.prank(alice);
        vm.expectRevert("DAOVoting: deadline must be in the future");
        dao.createProposal(bob, 1 ether, pastDeadline);
    }

    function test_CreateProposal_IncrementsId() public {
        vm.deal(alice, 20 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 10 ether }();
        uint256 deadline = block.timestamp + 7 days;

        vm.prank(alice);
        uint256 id1 = dao.createProposal(bob, 1 ether, deadline);
        vm.prank(alice);
        uint256 id2 = dao.createProposal(bob, 2 ether, deadline + 1 days);

        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(dao.proposalCount(), 2);
    }

    // -------------------------------------------------------------------------
    // vote (Etapa 2c)
    // -------------------------------------------------------------------------

    function _createActiveProposal() internal returns (uint256 proposalId, uint256 deadline) {
        vm.deal(alice, 20 ether);
        vm.prank(alice);
        dao.fundDAO{ value: 10 ether }();
        deadline = block.timestamp + 7 days;
        vm.prank(alice);
        proposalId = dao.createProposal(bob, 1 ether, deadline);
    }

    function test_Vote_For_UpdatesCountsAndGetVote() public {
        (uint256 proposalId,) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();

        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.For);

        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(p.forVotes, 1);
        assertEq(p.againstVotes, 0);
        assertEq(p.abstainVotes, 0);
        assertEq(uint256(dao.getVote(proposalId, bob)), uint256(DAOVoting.VoteType.For));
    }

    function test_Vote_Against_UpdatesCounts() public {
        (uint256 proposalId,) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();

        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.Against);

        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(p.forVotes, 0);
        assertEq(p.againstVotes, 1);
        assertEq(p.abstainVotes, 0);
    }

    function test_Vote_Abstain_UpdatesCounts() public {
        (uint256 proposalId,) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();

        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.Abstain);

        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(p.forVotes, 0);
        assertEq(p.againstVotes, 0);
        assertEq(p.abstainVotes, 1);
    }

    function test_Vote_ChangeVote_BeforeDeadline() public {
        (uint256 proposalId,) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();

        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.For);
        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(p.forVotes, 1);
        assertEq(p.againstVotes, 0);

        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.Against);
        p = dao.getProposal(proposalId);
        assertEq(p.forVotes, 0);
        assertEq(p.againstVotes, 1);
        assertEq(uint256(dao.getVote(proposalId, bob)), uint256(DAOVoting.VoteType.Against));
    }

    function test_Vote_RevertsWhenBalanceBelowMinimum() public {
        (uint256 proposalId,) = _createActiveProposal();
        // bob has not funded DAO, balance = 0
        vm.prank(bob);
        vm.expectRevert("DAOVoting: minimum balance to vote not met");
        dao.vote(proposalId, DAOVoting.VoteType.For);
    }

    function test_Vote_RevertsWhenDeadlinePassed() public {
        (uint256 proposalId, uint256 deadline) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();

        vm.warp(deadline + 1);
        vm.prank(bob);
        vm.expectRevert("DAOVoting: voting deadline passed");
        dao.vote(proposalId, DAOVoting.VoteType.For);
    }

    function test_Vote_RevertsWhenVoteTypeNone() public {
        (uint256 proposalId,) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();

        vm.prank(bob);
        vm.expectRevert("DAOVoting: vote type must be For, Against or Abstain");
        dao.vote(proposalId, DAOVoting.VoteType.None);
    }

    function test_GetVote_ReturnsNone_WhenNotVoted() public {
        (uint256 proposalId,) = _createActiveProposal();
        assertEq(uint256(dao.getVote(proposalId, bob)), uint256(DAOVoting.VoteType.None));
    }

    function test_Vote_MultipleVoters_AccumulatesCounts() public {
        (uint256 proposalId,) = _createActiveProposal();
        address charlie = makeAddr("charlie");
        vm.deal(bob, 1 ether);
        vm.deal(charlie, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();
        vm.prank(charlie);
        dao.fundDAO{ value: 1 wei }();

        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.For);
        vm.prank(charlie);
        dao.vote(proposalId, DAOVoting.VoteType.For);

        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(p.forVotes, 2);
        assertEq(p.againstVotes, 0);
        assertEq(p.abstainVotes, 0);
    }

    // -------------------------------------------------------------------------
    // executeProposal (Etapa 2d)
    // -------------------------------------------------------------------------

    function test_ExecuteProposal_Approved_TransfersToRecipient() public {
        (uint256 proposalId, uint256 deadline) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();
        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.For);

        vm.warp(deadline + dao.SECURITY_PERIOD() + 1);
        uint256 recipientBalanceBefore = address(bob).balance;
        uint256 daoTotalBefore = dao.totalBalance();

        vm.prank(alice);
        dao.executeProposal(proposalId);

        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(uint256(p.status), uint256(DAOVoting.ProposalStatus.Executed));
        assertEq(address(bob).balance, recipientBalanceBefore + 1 ether);
        assertEq(dao.totalBalance(), daoTotalBefore - 1 ether);
    }

    function test_ExecuteProposal_Rejected_WhenAgainstVotesGreaterOrEqual() public {
        (uint256 proposalId, uint256 deadline) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();
        uint256 totalBefore = dao.totalBalance(); // 10 ether + 1 wei
        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.Against);

        vm.warp(deadline + dao.SECURITY_PERIOD() + 1);
        vm.prank(alice);
        dao.executeProposal(proposalId);

        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(uint256(p.status), uint256(DAOVoting.ProposalStatus.Rejected));
        assertEq(dao.totalBalance(), totalBefore); // sin transferencia
    }

    function test_ExecuteProposal_RevertsWhenDeadlineNotPassed() public {
        (uint256 proposalId, uint256 deadline) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();
        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.For);

        vm.warp(deadline - 1);
        vm.prank(alice);
        vm.expectRevert("DAOVoting: voting deadline not passed");
        dao.executeProposal(proposalId);
    }

    function test_ExecuteProposal_RevertsWhenSecurityPeriodNotEnded() public {
        (uint256 proposalId, uint256 deadline) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();
        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.For);

        vm.warp(deadline + 1); // past deadline but before security period
        vm.prank(alice);
        vm.expectRevert("DAOVoting: security period not ended");
        dao.executeProposal(proposalId);
    }

    function test_ExecuteProposal_RevertsWhenProposalNotActive() public {
        (uint256 proposalId, uint256 deadline) = _createActiveProposal();
        vm.deal(bob, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();
        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.For);
        vm.warp(deadline + dao.SECURITY_PERIOD() + 1);
        vm.prank(alice);
        dao.executeProposal(proposalId);

        vm.expectRevert("DAOVoting: proposal not active");
        dao.executeProposal(proposalId);
    }

    function test_ExecuteProposal_Tie_Rejects() public {
        (uint256 proposalId, uint256 deadline) = _createActiveProposal();
        address charlie = makeAddr("charlie");
        vm.deal(bob, 1 ether);
        vm.deal(charlie, 1 ether);
        vm.prank(bob);
        dao.fundDAO{ value: 1 wei }();
        vm.prank(charlie);
        dao.fundDAO{ value: 1 wei }();
        vm.prank(bob);
        dao.vote(proposalId, DAOVoting.VoteType.For);
        vm.prank(charlie);
        dao.vote(proposalId, DAOVoting.VoteType.Against);

        vm.warp(deadline + dao.SECURITY_PERIOD() + 1);
        vm.prank(alice);
        dao.executeProposal(proposalId);

        DAOVoting.Proposal memory p = dao.getProposal(proposalId);
        assertEq(uint256(p.status), uint256(DAOVoting.ProposalStatus.Rejected));
    }
}
