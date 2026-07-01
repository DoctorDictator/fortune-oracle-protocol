// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";

contract VRFCoordinatorV2PlusMock {
    struct SubscriptionConfig {
        uint96 balance;
        uint96 nativeBalance;
        uint64 reqCount;
        address owner;
        address[] consumers;
        mapping(address => bool) isConsumer;
    }

    struct Request {
        address sender;
        VRFV2PlusClient.RandomWordsRequest req;
    }

    uint256 private _nextSubId = 1;
    uint256 private _nextRequestId = 1;
    mapping(uint256 => SubscriptionConfig) private _subscriptions;
    mapping(uint256 => Request) private _requests;

    uint256 public s_baseFee;
    uint256 public s_gasPrice;

    event SubscriptionCreated(uint256 indexed subId, address owner);
    event SubscriptionFunded(uint256 indexed subId, uint256 amount, bool native);
    event ConsumerAdded(uint256 indexed subId, address consumer);
    event ConsumerRemoved(uint256 indexed subId, address consumer);
    event RandomWordsRequested(
        bytes32 keyHash,
        uint256 indexed requestId,
        uint256 preSeed,
        uint256 indexed subId,
        uint16 minimumRequestConfirmations,
        uint32 callbackGasLimit,
        uint32 numWords,
        bytes extraArgs,
        address sender
    );
    event RandomWordsFulfilled(uint256 indexed requestId, uint256 outputSeed, uint256 payment, bool success);

    constructor(uint256 baseFee, uint256 gasPrice) {
        s_baseFee = baseFee;
        s_gasPrice = gasPrice;
    }

    function createSubscription() external returns (uint256 subId) {
        subId = _nextSubId++;
        SubscriptionConfig storage sub = _subscriptions[subId];
        sub.owner = msg.sender;
        emit SubscriptionCreated(subId, msg.sender);
        return subId;
    }

    function fundSubscriptionWithNative(uint256 subId) external payable {
        SubscriptionConfig storage sub = _subscriptions[subId];
        require(sub.owner != address(0), "Sub does not exist");
        sub.nativeBalance += uint96(msg.value);
        emit SubscriptionFunded(subId, msg.value, true);
    }

    function getSubscription(uint256 subId) external view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address owner, address[] memory consumers) {
        SubscriptionConfig storage sub = _subscriptions[subId];
        return (sub.balance, sub.nativeBalance, sub.reqCount, sub.owner, sub.consumers);
    }

    function addConsumer(uint256 subId, address consumer) external {
        SubscriptionConfig storage sub = _subscriptions[subId];
        require(sub.owner != address(0), "Sub does not exist");
        require(!sub.isConsumer[consumer], "Already consumer");
        sub.isConsumer[consumer] = true;
        sub.consumers.push(consumer);
        emit ConsumerAdded(subId, consumer);
    }

    function removeConsumer(uint256 subId, address consumer) external {
        SubscriptionConfig storage sub = _subscriptions[subId];
        require(sub.isConsumer[consumer], "Not a consumer");
        sub.isConsumer[consumer] = false;
        address[] storage consumers = sub.consumers;
        for (uint256 i = 0; i < consumers.length; i++) {
            if (consumers[i] == consumer) {
                consumers[i] = consumers[consumers.length - 1];
                consumers.pop();
                break;
            }
        }
        emit ConsumerRemoved(subId, consumer);
    }

    function requestRandomWords(VRFV2PlusClient.RandomWordsRequest calldata req) external returns (uint256 requestId) {
        SubscriptionConfig storage sub = _subscriptions[req.subId];
        require(sub.isConsumer[msg.sender], "Not a registered consumer");
        require(sub.nativeBalance >= s_baseFee, "Insufficient native balance");

        requestId = _nextRequestId++;
        _requests[requestId] = Request({sender: msg.sender, req: req});

        emit RandomWordsRequested(
            req.keyHash,
            requestId,
            uint256(keccak256(abi.encodePacked(requestId, block.timestamp, block.prevrandao))),
            req.subId,
            req.requestConfirmations,
            req.callbackGasLimit,
            req.numWords,
            req.extraArgs,
            msg.sender
        );

        return requestId;
    }

    function fulfillRandomWords(uint256 requestId, address consumer) external {
        Request storage request = _requests[requestId];
        require(request.sender != address(0), "Request not found");
        require(consumer == request.sender, "Wrong consumer");

        uint256[] memory randomWords = new uint256[](request.req.numWords);
        for (uint32 i = 0; i < request.req.numWords; i++) {
            randomWords[i] = uint256(keccak256(abi.encodePacked(requestId, i, block.timestamp, block.prevrandao)));
        }

        SubscriptionConfig storage sub = _subscriptions[request.req.subId];
        uint256 payment = s_baseFee + s_gasPrice * tx.gasprice;
        uint256 deduction = payment > sub.nativeBalance ? sub.nativeBalance : payment;
        sub.nativeBalance -= uint96(deduction);

        (bool success, ) = consumer.call{gas: request.req.callbackGasLimit}(
            abi.encodeWithSelector(VRFConsumerBaseV2Plus.rawFulfillRandomWords.selector, requestId, randomWords)
        );

        emit RandomWordsFulfilled(requestId, randomWords[0], deduction, success);
    }
}

interface VRFConsumerBaseV2Plus {
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external;
}
