// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ERC2771Context} from "./ERC2771Context.sol";

/**
 * @title DAOVoting
 * @notice DAO con propuestas y votación. Usa ERC2771Context para soportar
 *         meta-transacciones (votar sin pagar gas con ETH nativo).
 * @dev Contratos listos para integración frontend y relayer.
 */
contract DAOVoting is ERC2771Context {
    // -------------------------------------------------------------------------
    // Tipos
    // -------------------------------------------------------------------------

    enum VoteType {
        None,    // sin voto (valor por defecto)
        For,
        Against,
        Abstain
    }

    enum ProposalStatus {
        Active,   // votación abierta
        Approved, // plazo pasado, votos a favor > contra
        Rejected, // plazo pasado, no aprobada
        Executed  // fondos ya transferidos al beneficiario
    }

    struct Proposal {
        uint256 id;
        uint256 amount;       // ETH a transferir
        address recipient;   // beneficiario
        uint256 deadline;    // timestamp límite de votación
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        ProposalStatus status;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------

    /// @notice Balance de ETH que cada usuario ha depositado en el DAO
    mapping(address => uint256) private _userBalances;

    /// @notice Balance total de ETH en el DAO (suma de todos los depósitos)
    uint256 private _totalBalance;

    /// @notice Contador para IDs de propuestas (próxima propuesta = proposalCount + 1)
    uint256 private _proposalCount;

    /// @notice Propuestas por ID (ID 1-based para simplificar)
    mapping(uint256 => Proposal) private _proposals;

    /// @notice Voto de cada usuario por propuesta (para permitir cambiar voto antes del deadline)
    mapping(uint256 => mapping(address => VoteType)) private _votesByProposal;

    /// @notice Balance mínimo en el DAO para poder votar (1 wei)
    uint256 public constant MIN_BALANCE_TO_VOTE = 1;

    /// @notice Tiempo que debe pasar tras el deadline antes de poder ejecutar (seguridad)
    uint256 public constant SECURITY_PERIOD = 1 days;

    // -------------------------------------------------------------------------
    // Eventos
    // -------------------------------------------------------------------------

    event DAOFunded(address indexed user, uint256 amount);
    event ProposalCreated(uint256 indexed proposalId, address indexed recipient, uint256 amount, uint256 deadline);
    event Voted(uint256 indexed proposalId, address indexed voter, VoteType voteType);
    event ProposalExecuted(uint256 indexed proposalId, address indexed recipient, uint256 amount);
    event ProposalRejected(uint256 indexed proposalId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address trustedForwarder_) ERC2771Context(trustedForwarder_) {}

    // -------------------------------------------------------------------------
    // Gestión de fondos (Etapa 2a)
    // -------------------------------------------------------------------------

    /**
     * @notice Deposita ETH en el DAO. Aumenta el balance del llamante y el total.
     * @dev Usa _msgSender() para que funcione tanto con tx normal como con meta-tx.
     */
    function fundDAO() external payable {
        require(msg.value > 0, "DAOVoting: amount must be > 0");
        address sender = _msgSender();
        _userBalances[sender] += msg.value;
        _totalBalance += msg.value;
        emit DAOFunded(sender, msg.value);
    }

    /**
     * @notice Balance en el DAO de un usuario (ETH depositado con fundDAO).
     */
    function getUserBalance(address user) external view returns (uint256) {
        return _userBalances[user];
    }

    /**
     * @notice Balance total de ETH custodiado por el DAO.
     */
    function totalBalance() external view returns (uint256) {
        return _totalBalance;
    }

    // -------------------------------------------------------------------------
    // Creación de propuestas (Etapa 2b)
    // -------------------------------------------------------------------------

    /**
     * @notice Crea una propuesta para transferir ETH a un beneficiario.
     * @param recipient Dirección que recibiría los fondos si se aprueba y ejecuta.
     * @param amount Cantidad de ETH a transferir.
     * @param deadline Timestamp límite para votar (debe ser futuro).
     * @dev Solo usuarios con balance > 10% del balance total del DAO pueden crear.
     */
    function createProposal(address recipient, uint256 amount, uint256 deadline) external returns (uint256 proposalId) {
        address sender = _msgSender();
        uint256 total = _getTotalBalance();
        uint256 myBalance = _getUserBalance(sender);

        require(total > 0, "DAOVoting: DAO has no funds");
        require(myBalance > total / 10, "DAOVoting: need > 10% of total balance to create proposal");
        require(recipient != address(0), "DAOVoting: recipient is zero");
        require(amount > 0, "DAOVoting: amount must be > 0");
        require(deadline > block.timestamp, "DAOVoting: deadline must be in the future");

        proposalId = _incrementProposalCount();
        Proposal storage p = _proposals[proposalId];
        p.id = proposalId;
        p.amount = amount;
        p.recipient = recipient;
        p.deadline = deadline;
        p.forVotes = 0;
        p.againstVotes = 0;
        p.abstainVotes = 0;
        p.status = ProposalStatus.Active;

        emit ProposalCreated(proposalId, recipient, amount, deadline);
    }

    // -------------------------------------------------------------------------
    // Getters de propuestas
    // -------------------------------------------------------------------------

    /**
     * @notice Devuelve los datos de una propuesta por ID.
     * @param proposalId ID de la propuesta (1-based).
     */
    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposalId > 0 && proposalId <= _proposalCount, "DAOVoting: invalid proposal id");
        return _proposals[proposalId];
    }

    /**
     * @notice Número total de propuestas creadas (último ID usado).
     */
    function proposalCount() external view returns (uint256) {
        return _proposalCount;
    }

    // -------------------------------------------------------------------------
    // Sistema de votación (Etapa 2c)
    // -------------------------------------------------------------------------

    /**
     * @notice Emite o cambia el voto en una propuesta.
     * @param proposalId ID de la propuesta.
     * @param voteType For, Against o Abstain.
     * @dev Requiere: propuesta activa, deadline no pasado, balance en DAO >= MIN_BALANCE_TO_VOTE.
     *      Un usuario tiene un solo voto por propuesta; puede cambiar de opinión antes del deadline.
     */
    function vote(uint256 proposalId, VoteType voteType) external {
        address sender = _msgSender();
        require(proposalId > 0 && proposalId <= _proposalCount, "DAOVoting: invalid proposal id");
        require(_userBalances[sender] >= MIN_BALANCE_TO_VOTE, "DAOVoting: minimum balance to vote not met");
        require(voteType != VoteType.None, "DAOVoting: vote type must be For, Against or Abstain");

        Proposal storage p = _proposals[proposalId];
        require(p.status == ProposalStatus.Active, "DAOVoting: proposal not active");
        require(block.timestamp < p.deadline, "DAOVoting: voting deadline passed");

        VoteType previous = _votesByProposal[proposalId][sender];
        if (previous == VoteType.For) p.forVotes -= 1;
        else if (previous == VoteType.Against) p.againstVotes -= 1;
        else if (previous == VoteType.Abstain) p.abstainVotes -= 1;

        if (voteType == VoteType.For) p.forVotes += 1;
        else if (voteType == VoteType.Against) p.againstVotes += 1;
        else p.abstainVotes += 1;

        _votesByProposal[proposalId][sender] = voteType;
        emit Voted(proposalId, sender, voteType);
    }

    /**
     * @notice Devuelve el voto actual de un usuario en una propuesta.
     */
    function getVote(uint256 proposalId, address voter) external view returns (VoteType) {
        require(proposalId > 0 && proposalId <= _proposalCount, "DAOVoting: invalid proposal id");
        return _votesByProposal[proposalId][voter];
    }

    // -------------------------------------------------------------------------
    // Ejecución de propuestas (Etapa 2d)
    // -------------------------------------------------------------------------

    /**
     * @notice Ejecuta una propuesta tras el deadline y el período de seguridad.
     *         Si hay más votos a favor que en contra, transfiere ETH al beneficiario.
     *         Si no, marca la propuesta como rechazada.
     * @param proposalId ID de la propuesta.
     * @dev Cualquiera puede llamar (daemon o usuario). Requiere: propuesta activa,
     *      deadline pasado, SECURITY_PERIOD pasado, y (si se aprueba) balance suficiente.
     */
    function executeProposal(uint256 proposalId) external {
        require(proposalId > 0 && proposalId <= _proposalCount, "DAOVoting: invalid proposal id");
        Proposal storage p = _proposals[proposalId];
        require(p.status == ProposalStatus.Active, "DAOVoting: proposal not active");
        require(block.timestamp >= p.deadline, "DAOVoting: voting deadline not passed");
        require(
            block.timestamp >= p.deadline + SECURITY_PERIOD,
            "DAOVoting: security period not ended"
        );

        if (p.forVotes > p.againstVotes) {
            require(_totalBalance >= p.amount, "DAOVoting: insufficient DAO balance");
            require(address(this).balance >= p.amount, "DAOVoting: insufficient contract balance");
            p.status = ProposalStatus.Executed;
            _totalBalance -= p.amount;
            (bool ok,) = p.recipient.call{ value: p.amount }("");
            require(ok, "DAOVoting: transfer failed");
            emit ProposalExecuted(proposalId, p.recipient, p.amount);
        } else {
            p.status = ProposalStatus.Rejected;
            emit ProposalRejected(proposalId);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers internos
    // -------------------------------------------------------------------------

    /// @dev Para que createProposal/vote/executeProposal puedan leer total y balances.
    function _getTotalBalance() internal view returns (uint256) {
        return _totalBalance;
    }

    function _getUserBalance(address user) internal view returns (uint256) {
        return _userBalances[user];
    }

    function _getProposalCount() internal view returns (uint256) {
        return _proposalCount;
    }

    function _getProposal(uint256 id) internal view returns (Proposal storage) {
        return _proposals[id];
    }

    function _incrementProposalCount() internal returns (uint256) {
        _proposalCount += 1;
        return _proposalCount;
    }
}
