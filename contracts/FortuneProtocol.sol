// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract FortuneProtocol is VRFConsumerBaseV2Plus, Pausable, ReentrancyGuard {

    enum ReadingStatus { Pending, Fulfilled, Refunded }

    struct Reading {
        address user;
        uint32 packId;
        ReadingStatus status;
        uint256 fee;
        uint256 requestId;
        uint256 requestedAt;
        uint256 fulfilledAt;
        string fortune;
    }

    struct FortunePack {
        string name;
        string[] fortunes;
        uint256 price;
        bool active;
    }

    uint256 private _nextReadingId;
    mapping(uint256 => Reading) private _readings;
    mapping(address => uint256[]) private _userReadings;
    mapping(uint256 => uint256) private _requestIdToReading;

    FortunePack[] private _packs;
    address public treasury;

    uint64 private _subscriptionId;
    bytes32 private _keyHash;
    uint32 private _callbackGasLimit = 2_500_000;
    uint16 private _requestConfirmations = 3;
    uint32 private _numWords = 1;
    bool private _nativePayment = true;

    uint256 public refundTimeout = 1 days;

    uint256 public dailyFortuneInterval = 1 days;
    uint256 public lastDailyFortuneTime;
    uint256 public dailyFortuneReadingId;
    bool public dailyFortuneActive = true;

    event ReadingRequested(uint256 indexed readingId, address indexed user, uint256 requestId);
    event ReadingFulfilled(uint256 indexed readingId, address indexed user, string fortune);
    event ReadingRefunded(uint256 indexed readingId, address indexed user);
    event DailyFortuneRequested(uint256 readingId);
    event DailyFortunePublished(uint256 readingId, string fortune);
    event FeeUpdated(uint32 indexed packId, uint256 oldFee, uint256 newFee);
    event PackUpdated(uint32 indexed packId, string name, uint256 price, bool active, uint256 fortuneCount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RefundTimeoutUpdated(uint256 timeout);
    event DailyFortuneIntervalUpdated(uint256 interval);
    event VRFConfigUpdated(bytes32 keyHash, uint64 subId, uint32 callbackGasLimit, uint16 confirmations, uint32 numWords, bool nativePayment);
    event DailyFortuneToggled(bool active);
    event FundsWithdrawn(address indexed recipient, uint256 amount);

    error InvalidPack();
    error InvalidPayment(uint256 required, uint256 received);
    error InvalidVRFConfig();
    error EmptyFortunePack();
    error ReadingNotFound();
    error NotReadingOwner();
    error ReadingNotPending();
    error RefundTimeoutNotMet();
    error TooManyPending();
    error DailyFortuneNotReady();
    error DailyFortuneAlreadyToday();
    error NoFulfilledReadings();
    error TransferFailed();
    error PackNotActive();

    modifier readingExists(uint256 readingId) {
        if (_readings[readingId].requestedAt == 0) revert ReadingNotFound();
        _;
    }

    modifier onlyReadingOwner(uint256 readingId) {
        if (_readings[readingId].user != msg.sender) revert NotReadingOwner();
        _;
    }

    constructor(
        uint64 subscriptionId,
        address vrfCoordinator,
        bytes32 keyHash,
        address treasury_
    ) VRFConsumerBaseV2Plus(vrfCoordinator) {
        if (subscriptionId == 0) revert InvalidVRFConfig();
        if (vrfCoordinator == address(0)) revert InvalidVRFConfig();
        if (keyHash == bytes32(0)) revert InvalidVRFConfig();
        if (treasury_ == address(0)) revert ZeroAddress();
        if (_callbackGasLimit == 0) revert InvalidVRFConfig();
        if (_requestConfirmations == 0) revert InvalidVRFConfig();
        if (_numWords == 0) revert InvalidVRFConfig();
        _subscriptionId = subscriptionId;
        _keyHash = keyHash;
        treasury = treasury_;
        _createDefaultPacks();
    }

    function _createDefaultPacks() private {
        string[] memory classic = new string[](8);
        classic[0] = "A beautiful mind is never alone.";
        classic[1] = "You will soon embark on a great adventure.";
        classic[2] = "Trust the timing of your life.";
        classic[3] = "An unexpected opportunity will arise.";
        classic[4] = "Your patience will be rewarded tenfold.";
        classic[5] = "The blockchain smiles upon your journey.";
        classic[6] = "A faithful friend is a strong defense.";
        classic[7] = "You are going to be a blockchain developer.";

        _packs.push(FortunePack({name: "Classic", fortunes: classic, price: 0.001 ether, active: true}));
    }

    function requestReading(uint32 packId) external payable whenNotPaused nonReentrant returns (uint256) {
        if (packId >= _packs.length) revert InvalidPack();
        FortunePack storage pack = _packs[packId];
        if (!pack.active) revert PackNotActive();
        if (msg.value != pack.price) revert InvalidPayment(pack.price, msg.value);

        uint256[] storage userReadingIds = _userReadings[msg.sender];
        uint256 pendingCount;
        for (uint256 i = 0; i < userReadingIds.length; i++) {
            if (_readings[userReadingIds[i]].status == ReadingStatus.Pending) {
                pendingCount++;
                if (pendingCount >= 5) revert TooManyPending();
            }
        }

        uint256 readingId = _nextReadingId++;

        VRFV2PlusClient.ExtraArgsV1 memory extraArgs;
        extraArgs.nativePayment = _nativePayment;

        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: _keyHash,
            subId: _subscriptionId,
            requestConfirmations: _requestConfirmations,
            callbackGasLimit: _callbackGasLimit,
            numWords: _numWords,
            extraArgs: VRFV2PlusClient._argsToBytes(extraArgs)
        });

        uint256 requestId = s_vrfCoordinator.requestRandomWords(req);

        _readings[readingId] = Reading({
            user: msg.sender,
            packId: packId,
            status: ReadingStatus.Pending,
            fee: msg.value,
            requestId: requestId,
            requestedAt: block.timestamp,
            fulfilledAt: 0,
            fortune: ""
        });

        _userReadings[msg.sender].push(readingId);
        _requestIdToReading[requestId] = readingId;

        emit ReadingRequested(readingId, msg.sender, requestId);
        return readingId;
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal override {
        uint256 readingId = _requestIdToReading[requestId];
        if (_readings[readingId].status != ReadingStatus.Pending) return;

        Reading storage reading = _readings[readingId];
        reading.status = ReadingStatus.Fulfilled;
        reading.fulfilledAt = block.timestamp;

        FortunePack storage pack = _packs[reading.packId];
        uint256 fortuneIndex = randomWords[0] % pack.fortunes.length;
        reading.fortune = pack.fortunes[fortuneIndex];

        if (reading.user == address(0)) {
            emit DailyFortunePublished(readingId, reading.fortune);
        }
        emit ReadingFulfilled(readingId, reading.user, reading.fortune);
    }

    function claimRefund(uint256 readingId) external readingExists(readingId) onlyReadingOwner(readingId) nonReentrant {
        Reading storage reading = _readings[readingId];
        if (reading.status != ReadingStatus.Pending) revert ReadingNotPending();
        if (block.timestamp < reading.requestedAt + refundTimeout) revert RefundTimeoutNotMet();

        reading.status = ReadingStatus.Refunded;
        uint256 refundAmount = reading.fee;

        emit ReadingRefunded(readingId, msg.sender);

        (bool success, ) = payable(msg.sender).call{value: refundAmount}("");
        if (!success) revert TransferFailed();
    }

    function getReading(uint256 readingId) external view returns (Reading memory) {
        if (_readings[readingId].requestedAt == 0) revert ReadingNotFound();
        return _readings[readingId];
    }

    function getUserReadingIds(address user) external view returns (uint256[] memory) {
        return _userReadings[user];
    }

    function getUserReadings(address user) external view returns (Reading[] memory) {
        uint256[] storage ids = _userReadings[user];
        Reading[] memory userReadings = new Reading[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            userReadings[i] = _readings[ids[i]];
        }
        return userReadings;
    }

    function getUserReadingIdsPage(address user, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, uint256 total)
    {
        uint256[] storage allIds = _userReadings[user];
        total = allIds.length;
        if (offset >= total) {
            ids = new uint256[](0);
            return (ids, total);
        }
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 pageSize = end - offset;
        ids = new uint256[](pageSize);
        for (uint256 i = 0; i < pageSize; i++) {
            ids[i] = allIds[offset + i];
        }
        return (ids, total);
    }

    function getPendingRefundCount(address user) external view returns (uint256) {
        uint256[] storage ids = _userReadings[user];
        uint256 count;
        for (uint256 i = 0; i < ids.length; i++) {
            Reading storage r = _readings[ids[i]];
            if (r.status == ReadingStatus.Pending && block.timestamp >= r.requestedAt + refundTimeout) {
                count++;
            }
        }
        return count;
    }

    function getPack(uint32 packId) external view returns (FortunePack memory) {
        if (packId >= _packs.length) revert InvalidPack();
        return _packs[packId];
    }

    function getPackCount() external view returns (uint256) {
        return _packs.length;
    }

    function getAllPacks() external view returns (FortunePack[] memory) {
        return _packs;
    }

    function getVRFConfig() external view returns (bytes32 keyHash, uint64 subId, uint32 callbackGasLimit, uint16 confirmations, uint32 numWords, bool nativePayment) {
        return (_keyHash, _subscriptionId, _callbackGasLimit, _requestConfirmations, _numWords, _nativePayment);
    }

    function requestDailyFortune() external whenNotPaused returns (uint256) {
        if (!dailyFortuneActive) revert DailyFortuneNotReady();
        if (block.timestamp < lastDailyFortuneTime + dailyFortuneInterval) revert DailyFortuneAlreadyToday();

        VRFV2PlusClient.ExtraArgsV1 memory extraArgs;
        extraArgs.nativePayment = _nativePayment;

        VRFV2PlusClient.RandomWordsRequest memory req = VRFV2PlusClient.RandomWordsRequest({
            keyHash: _keyHash,
            subId: _subscriptionId,
            requestConfirmations: _requestConfirmations,
            callbackGasLimit: _callbackGasLimit,
            numWords: _numWords,
            extraArgs: VRFV2PlusClient._argsToBytes(extraArgs)
        });

        uint256 requestId = s_vrfCoordinator.requestRandomWords(req);
        uint256 readingId = _nextReadingId++;

        _readings[readingId] = Reading({
            user: address(0),
            packId: 0,
            status: ReadingStatus.Pending,
            fee: 0,
            requestId: requestId,
            requestedAt: block.timestamp,
            fulfilledAt: 0,
            fortune: ""
        });

        _requestIdToReading[requestId] = readingId;
        dailyFortuneReadingId = readingId;
        lastDailyFortuneTime = block.timestamp;

        emit DailyFortuneRequested(readingId);
        return readingId;
    }

    function getDailyFortune() external view returns (Reading memory) {
        Reading memory r = _readings[dailyFortuneReadingId];
        if (r.requestedAt == 0) revert NoFulfilledReadings();
        return r;
    }

    function getLastDailyFortune() external view returns (string memory) {
        Reading memory r = _readings[dailyFortuneReadingId];
        if (r.requestedAt == 0 || r.status != ReadingStatus.Fulfilled) revert NoFulfilledReadings();
        return r.fortune;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setFee(uint32 packId, uint256 newFee) external onlyOwner {
        if (packId >= _packs.length) revert InvalidPack();
        uint256 oldFee = _packs[packId].price;
        _packs[packId].price = newFee;
        emit FeeUpdated(packId, oldFee, newFee);
    }

    function setPack(uint32 packId, string calldata name, string[] calldata fortunes, uint256 price, bool active) external onlyOwner {
        if (fortunes.length == 0) revert EmptyFortunePack();
        if (packId < _packs.length) {
            FortunePack storage pack = _packs[packId];
            pack.name = name;
            pack.fortunes = fortunes;
            pack.price = price;
            pack.active = active;
        } else {
            _packs.push(FortunePack({name: name, fortunes: fortunes, price: price, active: active}));
        }
        emit PackUpdated(packId, name, price, active, fortunes.length);
    }

    function addPack(string calldata name, string[] calldata fortunes, uint256 price, bool active) external onlyOwner {
        if (fortunes.length == 0) revert EmptyFortunePack();
        _packs.push(FortunePack({name: name, fortunes: fortunes, price: price, active: active}));
        emit PackUpdated(uint32(_packs.length - 1), name, price, active, fortunes.length);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        address oldTreasury = treasury;
        treasury = treasury_;
        emit TreasuryUpdated(oldTreasury, treasury_);
    }

    function setRefundTimeout(uint256 timeout) external onlyOwner {
        refundTimeout = timeout;
        emit RefundTimeoutUpdated(timeout);
    }

    function setDailyFortuneInterval(uint256 interval_) external onlyOwner {
        dailyFortuneInterval = interval_;
        emit DailyFortuneIntervalUpdated(interval_);
    }

    function setDailyFortuneActive(bool active) external onlyOwner {
        dailyFortuneActive = active;
        emit DailyFortuneToggled(active);
    }

    function setVRFConfig(bytes32 keyHash, uint64 subId, uint32 callbackGasLimit, uint16 confirmations, uint32 numWords, bool nativePayment) external onlyOwner {
        _keyHash = keyHash;
        _subscriptionId = subId;
        _callbackGasLimit = callbackGasLimit;
        _requestConfirmations = confirmations;
        _numWords = numWords;
        _nativePayment = nativePayment;
        emit VRFConfigUpdated(keyHash, subId, callbackGasLimit, confirmations, numWords, nativePayment);
    }

    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        (bool success, ) = payable(treasury).call{value: balance}("");
        if (!success) revert TransferFailed();
        emit FundsWithdrawn(treasury, balance);
    }

    function withdrawTo(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 balance = address(this).balance;
        (bool success, ) = payable(recipient).call{value: balance}("");
        if (!success) revert TransferFailed();
        emit FundsWithdrawn(recipient, balance);
    }

    receive() external payable {}
}
