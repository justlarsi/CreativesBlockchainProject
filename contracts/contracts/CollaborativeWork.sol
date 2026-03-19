// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title CollaborativeWork
 * @dev Phase 1 collaboration registry with split invariants and events only.
 */
contract CollaborativeWork {
    uint16 public constant TOTAL_BPS = 10_000;

    struct Collaboration {
        address creator;
        string contentHash;
        uint256 createdAt;
        bool exists;
    }

    uint256 public collaborationCounter;
    mapping(uint256 => Collaboration) public collaborations;
    mapping(uint256 => address[]) private collaborationMembers;
    mapping(uint256 => mapping(address => uint16)) private collaborationMemberBps;
    mapping(uint256 => mapping(address => bool)) private hasMember;

    event CollaborationCreated(
        uint256 indexed collaborationId,
        address indexed creator,
        string indexed contentHash,
        uint256 timestamp
    );

    event SplitAssigned(
        uint256 indexed collaborationId,
        address indexed collaborator,
        uint16 splitBps
    );

    function createCollaboration(
        string memory contentHash,
        address[] memory collaborators,
        uint16[] memory splitBps
    ) external returns (uint256 collaborationId) {
        require(bytes(contentHash).length > 0, "Content hash cannot be empty");
        require(collaborators.length > 0, "At least one collaborator required");
        require(
            collaborators.length == splitBps.length,
            "Collaborator and split lengths mismatch"
        );

        uint256 totalBps;
        for (uint256 i = 0; i < collaborators.length; i++) {
            address collaborator = collaborators[i];
            uint16 bps = splitBps[i];

            require(collaborator != address(0), "Collaborator cannot be zero address");
            for (uint256 j = 0; j < i; j++) {
                require(collaborators[j] != collaborator, "Duplicate collaborator");
            }
            require(bps > 0, "Split must be greater than zero");

            totalBps += bps;
        }

        require(totalBps == TOTAL_BPS, "Split total must equal 100%");

        collaborationCounter++;
        collaborationId = collaborationCounter;

        collaborations[collaborationId] = Collaboration({
            creator: msg.sender,
            contentHash: contentHash,
            createdAt: block.timestamp,
            exists: true
        });

        emit CollaborationCreated(collaborationId, msg.sender, contentHash, block.timestamp);

        for (uint256 i = 0; i < collaborators.length; i++) {
            address collaborator = collaborators[i];
            uint16 bps = splitBps[i];

            hasMember[collaborationId][collaborator] = true;
            collaborationMembers[collaborationId].push(collaborator);
            collaborationMemberBps[collaborationId][collaborator] = bps;

            emit SplitAssigned(collaborationId, collaborator, bps);
        }
    }

    function getCollaborators(uint256 collaborationId)
        external
        view
        returns (address[] memory)
    {
        return collaborationMembers[collaborationId];
    }

    function getSplitBps(uint256 collaborationId, address collaborator)
        external
        view
        returns (uint16)
    {
        return collaborationMemberBps[collaborationId][collaborator];
    }
}
