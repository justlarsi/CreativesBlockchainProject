// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title LicenseAgreement
 * @dev Manages license purchases and payments for creative works
 */
contract LicenseAgreement {
    struct License {
        address licensor;
        address licensee;
        string contentHash;
        uint256 price;
        uint256 expiresAt;
        bool active;
        uint256 purchasedAt;
    }

    mapping(uint256 => License) public licenses;
    uint256 public licenseCounter;

    event LicensePurchased(
        uint256 indexed licenseId,
        address indexed licensor,
        address indexed licensee,
        string contentHash,
        uint256 price,
        uint256 expiresAt
    );

    /**
     * @dev Purchase a license for a creative work
     * @param contentHash The hash of the creative work
     * @param expiresAt The expiration timestamp (0 for perpetual)
     */
    function purchaseLicense(string memory contentHash, uint256 expiresAt)
        external
        payable
    {
        require(bytes(contentHash).length > 0, "Content hash cannot be empty");
        require(msg.value > 0, "Payment required");

        licenseCounter++;
        licenses[licenseCounter] = License({
            licensor: msg.sender, // In production, this should come from IPRegistry
            licensee: msg.sender,
            contentHash: contentHash,
            price: msg.value,
            expiresAt: expiresAt,
            active: true,
            purchasedAt: block.timestamp
        });

        // Transfer payment to licensor (simplified - in production, use pull payment pattern)
        // payable(licensor).transfer(msg.value);

        emit LicensePurchased(
            licenseCounter,
            licenses[licenseCounter].licensor,
            msg.sender,
            contentHash,
            msg.value,
            expiresAt
        );
    }

    /**
     * @dev Verify if a license is valid
     * @param licenseId The license ID to verify
     * @return valid Whether the license is valid
     */
    function verifyLicense(uint256 licenseId) external view returns (bool valid) {
        License memory license = licenses[licenseId];
        if (!license.active) return false;
        if (license.expiresAt > 0 && block.timestamp > license.expiresAt) {
            return false;
        }
        return true;
    }

    /**
     * @dev Get license details
     * @param licenseId The license ID
     */
    function getLicense(uint256 licenseId)
        external
        view
        returns (License memory)
    {
        return licenses[licenseId];
    }
}
