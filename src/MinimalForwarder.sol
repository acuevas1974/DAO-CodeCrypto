// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

contract MinimalForwarder {
    struct ForwardRequest {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        bytes data;
    }

    mapping(address => uint256) private _nonces;

    event ForwardResult(address indexed from, bool success, bytes returnData);

    function getNonce(address from) external view returns (uint256) {
        return _nonces[from];
    }

    function verify(ForwardRequest calldata req, bytes calldata signature) external view returns (bool) {
        address signer = _recoverForwardRequest(req, signature);
        return signer == req.from && _nonces[req.from] == req.nonce;
    }

    function execute(ForwardRequest calldata req, bytes calldata signature)
        external
        payable
        returns (bool success, bytes memory returnData)
    {
        require(_verifyAndConsumeNonce(req, signature), "MinimalForwarder: invalid signature or nonce");
        // EIP-2771: adjuntar el sender al calldata para que el contrato destino pueda usar _msgSender()
        (success, returnData) = req.to.call{ gas: req.gas, value: req.value }(
            bytes.concat(req.data, abi.encodePacked(req.from))
        );
        emit ForwardResult(req.from, success, returnData);
        return (success, returnData);
    }

    function _verifyAndConsumeNonce(ForwardRequest calldata req, bytes calldata signature) private returns (bool) {
        address signer = _recoverForwardRequest(req, signature);
        if (signer != req.from || _nonces[req.from] != req.nonce) return false;
        _nonces[req.from] = req.nonce + 1;
        return true;
    }

    bytes32 public constant FORWARD_REQUEST_TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data)"
    );

    function _recoverForwardRequest(ForwardRequest calldata req, bytes calldata signature)
        internal
        view
        returns (address)
    {
        bytes32 digest = _hashTypedDataV4(req);
        return _recover(digest, signature);
    }

    function _hashTypedDataV4(ForwardRequest calldata req) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                FORWARD_REQUEST_TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                keccak256(req.data)
            )
        );
        return _hashEIP712Message(structHash);
    }

    function _hashEIP712Message(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(
            abi.encodePacked(
                "\x19\x01",
                _domainSeparatorV4(),
                structHash
            )
        );
    }

    bytes32 private immutable _TYPE_HASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    function _domainSeparatorV4() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                _TYPE_HASH,
                keccak256("MinimalForwarder"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        require(signature.length == 65, "MinimalForwarder: invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        bytes memory sig = signature;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "MinimalForwarder: invalid signature");
        return signer;
    }
}
