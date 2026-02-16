// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/**
 * @title ERC2771Context
 * @notice Permite que un contrato reciba meta-transacciones: cuando la llamada
 *         viene del forwarder de confianza, usamos el "sender" real (quien firmó)
 *         en lugar de msg.sender (que sería el forwarder).
 * @dev EIP-2771: el forwarder adjunta los últimos 20 bytes del calldata con la
 *      dirección del firmante. Aquí extraemos ese sender y el calldata original.
 */
abstract contract ERC2771Context {
    address private immutable _trustedForwarder;

    event MetaTxForwarderSet(address indexed forwarder);

    constructor(address trustedForwarder_) {
        _trustedForwarder = trustedForwarder_;
        emit MetaTxForwarderSet(trustedForwarder_);
    }

    function isTrustedForwarder(address forwarder) public view virtual returns (bool) {
        return forwarder == _trustedForwarder;
    }

    /**
     * @dev En llamadas normales: devuelve msg.sender.
     *      En meta-tx (llamada desde el forwarder): devuelve la dirección
     *      que firmó (últimos 20 bytes del calldata).
     */
    function _msgSender() internal view virtual returns (address sender) {
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            assembly {
                sender := shr(96, calldataload(sub(calldatasize(), 20)))
            }
        } else {
            sender = msg.sender;
        }
    }

    /**
     * @dev En llamadas normales: devuelve msg.data.
     *      En meta-tx: devuelve el calldata original (sin los últimos 20 bytes).
     */
    function _msgData() internal view virtual returns (bytes calldata) {
        if (isTrustedForwarder(msg.sender) && msg.data.length >= 20) {
            return msg.data[0:msg.data.length - 20];
        }
        return msg.data;
    }
}
