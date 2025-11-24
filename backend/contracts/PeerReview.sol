// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Peer Review - Anonymous Peer Review and Encrypted Scoring Platform
/// @notice A FHEVM-based anonymous peer review system where members can encrypt scores for each other
contract PeerReview is ZamaEthereumConfig {
    // Round structure
    struct ReviewRound {
        uint256 roundId;
        address[] participants;
        mapping(address => bool) hasSubmitted;
        mapping(address => euint32) encryptedTotalScores; // Total encrypted score for each participant
        mapping(address => euint32) encryptedCounts; // Number of reviews received (encrypted)
        bool isActive;
        bool isFinalized;
    }

    // Mapping from roundId to ReviewRound
    mapping(uint256 => ReviewRound) public rounds;
    
    // Mapping from roundId => participant => reviewer => hasReviewed
    mapping(uint256 => mapping(address => mapping(address => bool))) public hasReviewed;
    
    uint256 public nextRoundId;
    address public admin;

    event RoundCreated(uint256 indexed roundId, address[] participants);
    event ScoreSubmitted(uint256 indexed roundId, address indexed reviewer, address indexed reviewee);
    event RoundFinalized(uint256 indexed roundId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier validRound(uint256 _roundId) {
        require(rounds[_roundId].isActive, "Round not active");
        _;
    }

    constructor() {
        admin = msg.sender;
        nextRoundId = 1;
    }

    /// @notice Create a new review round
    /// @param _participants Array of participant addresses
    function createRound(address[] calldata _participants) external onlyAdmin returns (uint256) {
        require(_participants.length > 0, "Participants required");
        
        uint256 roundId = nextRoundId++;
        ReviewRound storage round = rounds[roundId];
        round.roundId = roundId;
        round.participants = _participants;
        round.isActive = true;
        round.isFinalized = false;

        emit RoundCreated(roundId, _participants);
        return roundId;
    }

    /// @notice Submit encrypted scores for a participant in a round
    /// @param _roundId The round ID
    /// @param _reviewee The address of the participant being reviewed
    /// @param _encryptedScore The encrypted score (1-10)
    /// @param _inputProof The input proof for the encrypted score
    function submitScore(
        uint256 _roundId,
        address _reviewee,
        externalEuint32 _encryptedScore,
        bytes calldata _inputProof
    ) external validRound(_roundId) {
        ReviewRound storage round = rounds[_roundId];
        require(!round.isFinalized, "Round finalized");
        require(!round.hasSubmitted[msg.sender], "Already submitted");
        require(_isParticipant(_roundId, _reviewee), "Reviewee not in round");
        require(_reviewee != msg.sender, "Cannot review yourself");

        // Convert external encrypted input to internal euint32
        euint32 encryptedScore = FHE.fromExternal(_encryptedScore, _inputProof);

        // Record that this reviewer has reviewed this reviewee
        hasReviewed[_roundId][_reviewee][msg.sender] = true;

        // Add the encrypted score to the reviewee's total
        round.encryptedTotalScores[_reviewee] = FHE.add(
            round.encryptedTotalScores[_reviewee],
            encryptedScore
        );

        // Increment the encrypted count for this reviewee
        euint32 one = FHE.asEuint32(1);
        round.encryptedCounts[_reviewee] = FHE.add(
            round.encryptedCounts[_reviewee],
            one
        );

        // Allow contract, sender (reviewer), and reviewee to access the encrypted values
        // The reviewer needs access to submit the score
        // The reviewee needs access to decrypt their own average score later
        FHE.allowThis(round.encryptedTotalScores[_reviewee]);
        FHE.allow(round.encryptedTotalScores[_reviewee], msg.sender);
        FHE.allow(round.encryptedTotalScores[_reviewee], _reviewee);
        FHE.allowThis(round.encryptedCounts[_reviewee]);
        FHE.allow(round.encryptedCounts[_reviewee], msg.sender);
        FHE.allow(round.encryptedCounts[_reviewee], _reviewee);

        emit ScoreSubmitted(_roundId, msg.sender, _reviewee);
    }

    /// @notice Get the encrypted total score for a participant
    /// @param _roundId The round ID
    /// @param _participant The participant address
    /// @return The encrypted total score
    function getEncryptedTotalScore(uint256 _roundId, address _participant)
        external
        view
        returns (euint32)
    {
        return rounds[_roundId].encryptedTotalScores[_participant];
    }

    /// @notice Get the encrypted count of reviews for a participant
    /// @param _roundId The round ID
    /// @param _participant The participant address
    /// @return The encrypted count
    function getEncryptedCount(uint256 _roundId, address _participant)
        external
        view
        returns (euint32)
    {
        return rounds[_roundId].encryptedCounts[_participant];
    }

    /// @notice Get the encrypted average score (total / count) for a participant
    /// @param _roundId The round ID
    /// @param _participant The participant address
    /// @return The encrypted average score
    function getEncryptedAverageScore(uint256 _roundId, address _participant)
        external
        view
        returns (euint32)
    {
        ReviewRound storage round = rounds[_roundId];
        euint32 total = round.encryptedTotalScores[_participant];
        
        // Note: Division in FHE is complex, so we return both total and count
        // The frontend will decrypt both and calculate the average
        // For now, we return the total and count separately
        // Frontend can also call getEncryptedCount() to get the count
        return total; // Frontend will need to decrypt both total and count
    }

    /// @notice Get all participants in a round
    /// @param _roundId The round ID
    /// @return Array of participant addresses
    function getParticipants(uint256 _roundId)
        external
        view
        returns (address[] memory)
    {
        return rounds[_roundId].participants;
    }

    /// @notice Check if a reviewer has reviewed a reviewee
    /// @param _roundId The round ID
    /// @param _reviewee The reviewee address
    /// @param _reviewer The reviewer address
    /// @return Whether the reviewer has reviewed the reviewee
    function checkReviewStatus(
        uint256 _roundId,
        address _reviewee,
        address _reviewer
    ) external view returns (bool) {
        return hasReviewed[_roundId][_reviewee][_reviewer];
    }

    /// @notice Finalize a round (prevent further submissions)
    /// @param _roundId The round ID
    function finalizeRound(uint256 _roundId) external onlyAdmin validRound(_roundId) {
        rounds[_roundId].isFinalized = true;
        rounds[_roundId].isActive = false;
        emit RoundFinalized(_roundId);
    }

    /// @notice Check if an address is a participant in a round
    /// @param _roundId The round ID
    /// @param _participant The address to check
    /// @return Whether the address is a participant
    function _isParticipant(uint256 _roundId, address _participant)
        internal
        view
        returns (bool)
    {
        address[] memory participants = rounds[_roundId].participants;
        for (uint256 i = 0; i < participants.length; i++) {
            if (participants[i] == _participant) {
                return true;
            }
        }
        return false;
    }
}

