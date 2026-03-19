const { expect } = require("chai");
const { ethers } = require("hardhat");
const { decodeContractEvents, expectRevert } = require("./helpers.js");

describe("IPRegistry", function () {
  async function deployFixture() {
    const [creator, other] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("IPRegistry");
    const registry = await factory.deploy();
    await registry.waitForDeployment();
    return { creator, other, registry };
  }

  it("registers a work and emits WorkRegistered", async function () {
    const { creator, registry } = await deployFixture();
    const contentHash = "sha256:abc123";

    const tx = await registry.connect(creator).registerWork(contentHash);
    const receipt = await tx.wait();

    const events = decodeContractEvents(receipt, registry, "WorkRegistered");
    expect(events).to.have.length(1);
    expect(events[0].args.creator).to.equal(creator.address);
    expect(events[0].args.contentHash.hash).to.equal(ethers.id(contentHash));

    const [exists, storedCreator] = await registry.verifyWork(contentHash);
    expect(exists).to.equal(true);
    expect(storedCreator).to.equal(creator.address);

    const creatorWorks = await registry.getCreatorWorks(creator.address);
    expect(creatorWorks).to.deep.equal([contentHash]);
  });

  it("rejects empty content hash", async function () {
    const { registry } = await deployFixture();
    await expectRevert(
      registry.registerWork(""),
      "Content hash cannot be empty",
    );
  });

  it("rejects duplicate registration", async function () {
    const { registry } = await deployFixture();
    const contentHash = "sha256:dup";
    await registry.registerWork(contentHash);

    await expectRevert(
      registry.registerWork(contentHash),
      "Work already registered",
    );
  });

  it("returns false for unknown work", async function () {
    const { other, registry } = await deployFixture();
    const [exists, creator, timestamp] = await registry.verifyWork("sha256:missing");

    expect(exists).to.equal(false);
    expect(creator).to.equal(ethers.ZeroAddress);
    expect(timestamp).to.equal(0n);

    const creatorWorks = await registry.getCreatorWorks(other.address);
    expect(creatorWorks).to.deep.equal([]);
  });
});

