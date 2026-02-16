// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {MinimalForwarder} from "../src/MinimalForwarder.sol";
import {DAOVoting} from "../src/DAOVoting.sol";

contract DeployDAOScript is Script {
    function run() public {
        vm.startBroadcast();

        MinimalForwarder forwarder = new MinimalForwarder();
        DAOVoting dao = new DAOVoting(address(forwarder));

        vm.stopBroadcast();

        console.log("MinimalForwarder:", address(forwarder));
        console.log("DAOVoting:", address(dao));
    }
}
