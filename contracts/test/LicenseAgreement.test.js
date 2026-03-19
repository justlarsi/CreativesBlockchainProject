const { expect } = require("chai");
const { ethers } = require("hardhat");
const { decodeContractEvents, expectRevert } = require("./helpers.js");

describe("LicenseAgreement", function () {
  async function deployFixture() {
    const [licensor, licensee] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("LicenseAgreement");
    const agreement = await factory.deploy();
    await agreement.waitForDeployment();
    return { licensor, licensee, agreement };
  }

  it("stores a purchase and emits LicensePurchased", async function () {
    const { licensor, licensee, agreement } = await deployFixture();
    const contentHash = "sha256:licenseable";
    const payment = ethers.parseEther("0.1");

    const tx = await agreement
      .connect(licensee)
      .purchaseLicense(licensor.address, contentHash, 0, { value: payment });
    const receipt = await tx.wait();

    const events = decodeContractEvents(receipt, agreement, "LicensePurchased");
    expect(events).to.have.length(1);
    expect(events[0].args.licenseId).to.equal(1n);
    expect(events[0].args.licensor).to.equal(licensor.address);
    expect(events[0].args.licensee).to.equal(licensee.address);

    const license = await agreement.getLicense(1);
    expect(license.licensor).to.equal(licensor.address);
    expect(license.licensee).to.equal(licensee.address);
    expect(license.contentHash).to.equal(contentHash);
    expect(license.price).to.equal(payment);
    expect(license.active).to.equal(true);

    expect(await agreement.verifyLicense(1)).to.equal(true);
    expect(await agreement.licenseCounter()).to.equal(1n);
  });

  it("returns false for unknown license", async function () {
    const { agreement } = await deployFixture();
    expect(await agreement.verifyLicense(777)).to.equal(false);
  });

  it("returns false when expired", async function () {
    const { licensor, licensee, agreement } = await deployFixture();
    const latest = await ethers.provider.getBlock("latest");
    const expiresAt = BigInt(latest.timestamp + 1);

    await agreement
      .connect(licensee)
      .purchaseLicense(licensor.address, "sha256:expiring", expiresAt, {
        value: ethers.parseEther("0.01"),
      });

    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(expiresAt + 1n)]);
    await ethers.provider.send("evm_mine", []);

    expect(await agreement.verifyLicense(1)).to.equal(false);
  });

  it("rejects invalid purchase params", async function () {
    const { licensor, licensee, agreement } = await deployFixture();

    await expectRevert(
      agreement
        .connect(licensee)
        .purchaseLicense(ethers.ZeroAddress, "sha256:test", 0, { value: 1n }),
      "Licensor cannot be zero address",
    );

    await expectRevert(
      agreement
        .connect(licensee)
        .purchaseLicense(licensor.address, "", 0, { value: 1n }),
      "Content hash cannot be empty",
    );

    await expectRevert(
      agreement
        .connect(licensee)
        .purchaseLicense(licensor.address, "sha256:test", 0, { value: 0n }),
      "Payment required",
    );
  });
});

