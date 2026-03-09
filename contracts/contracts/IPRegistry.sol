// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPRegistry
 * @dev Registry for recording creative works on the blockchain
 */
contract IPRegistry {
    struct Work {
        address creator;
        string contentHash;
        uint256 timestamp;
        bool exists;
    }

    mapping(string => Work) public works;
    mapping(address => string[]) public creatorWorks;

    event WorkRegistered(
        address indexed creator,
        string indexed contentHash,
        uint256 timestamp
    );

    /**
     * @dev Register a creative work on the blockchain
     * @param contentHash The hash of the creative work content
     */
    function registerWork(string memory contentHash) external {
        require(bytes(contentHash).length > 0, "Content hash cannot be empty");
        require(!works[contentHash].exists, "Work already registered");

        works[contentHash] = Work({
            creator: msg.sender,
            contentHash: contentHash,
            timestamp: block.timestamp,
            exists: true
        });

        creatorWorks[msg.sender].push(contentHash);

        emit WorkRegistered(msg.sender, contentHash, block.timestamp);
    }

    /**
     * @dev Verify if a work exists in the registry
     * @param contentHash The hash to verify
     * @return exists Whether the work exists
     * @return creator The creator's address
     * @return timestamp The registration timestamp
     */
    function verifyWork(string memory contentHash)
        external
        view
        returns (
            bool exists,
            address creator,
            uint256 timestamp
        )
    {
        Work memory work = works[contentHash];
        return (work.exists, work.creator, work.timestamp);
    }

    /**
     * @dev Get all works by a creator
     * @param creator The creator's address
     * @return An array of content hashes
     */
    function getCreatorWorks(address creator)
        external
        view
        returns (string[] memory)
    {
        return creatorWorks[creator];
    }
}
