const { expect } = require("chai");
const { ethers } = require("hardhat");
const { decodeContractEvents, expectRevert } = require("./helpers.js");

describe("CollaborativeWork", function () {
  async function deployFixture() {
    const [creator, collaboratorA, collaboratorB, collaboratorC] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("CollaborativeWork");
    const collaborativeWork = await factory.deploy();
    await collaborativeWork.waitForDeployment();
    return { creator, collaboratorA, collaboratorB, collaboratorC, collaborativeWork };
  }

  it("creates a collaboration and emits expected events", async function () {
    const { creator, collaboratorA, collaboratorB, collaborativeWork } = await deployFixture();
    const hash = "sha256:collab";

    const tx = await collaborativeWork.connect(creator).createCollaboration(
      hash,
      [collaboratorA.address, collaboratorB.address],
      [6000, 4000],
    );
    const receipt = await tx.wait();

    const createdEvents = decodeContractEvents(receipt, collaborativeWork, "CollaborationCreated");
    expect(createdEvents).to.have.length(1);
    expect(createdEvents[0].args.collaborationId).to.equal(1n);
    expect(createdEvents[0].args.creator).to.equal(creator.address);
    expect(createdEvents[0].args.contentHash.hash).to.equal(ethers.id(hash));

    const splitEvents = decodeContractEvents(receipt, collaborativeWork, "SplitAssigned");
    expect(splitEvents).to.have.length(2);

    const collaboration = await collaborativeWork.collaborations(1);
    expect(collaboration.creator).to.equal(creator.address);
    expect(collaboration.contentHash).to.equal(hash);
    expect(collaboration.exists).to.equal(true);

    const members = await collaborativeWork.getCollaborators(1);
    expect(members).to.deep.equal([collaboratorA.address, collaboratorB.address]);
    expect(await collaborativeWork.getSplitBps(1, collaboratorA.address)).to.equal(6000n);
    expect(await collaborativeWork.getSplitBps(1, collaboratorB.address)).to.equal(4000n);
    expect(await collaborativeWork.collaborationCounter()).to.equal(1n);
  });

  it("returns empty defaults for unknown collaboration", async function () {
    const { collaboratorC, collaborativeWork } = await deployFixture();
    const unknown = await collaborativeWork.collaborations(404);

    expect(unknown.creator).to.equal(ethers.ZeroAddress);
    expect(unknown.contentHash).to.equal("");
    expect(unknown.createdAt).to.equal(0n);
    expect(unknown.exists).to.equal(false);

    expect(await collaborativeWork.getCollaborators(404)).to.deep.equal([]);
    expect(await collaborativeWork.getSplitBps(404, collaboratorC.address)).to.equal(0n);
  });

  it("rejects invalid collaboration payloads", async function () {
    const { creator, collaboratorA, collaboratorB, collaborativeWork } = await deployFixture();

    await expectRevert(
      collaborativeWork.connect(creator).createCollaboration("", [collaboratorA.address], [10000]),
      "Content hash cannot be empty",
    );

    await expectRevert(
      collaborativeWork.connect(creator).createCollaboration("sha256:test", [], []),
      "At least one collaborator required",
    );

    await expectRevert(
      collaborativeWork
        .connect(creator)
        .createCollaboration("sha256:test", [collaboratorA.address], [6000, 4000]),
      "Collaborator and split lengths mismatch",
    );

    await expectRevert(
      collaborativeWork
        .connect(creator)
        .createCollaboration("sha256:test", [ethers.ZeroAddress], [10000]),
      "Collaborator cannot be zero address",
    );

    await expectRevert(
      collaborativeWork
        .connect(creator)
        .createCollaboration("sha256:test", [collaboratorA.address], [0]),
      "Split must be greater than zero",
    );

    await expectRevert(
      collaborativeWork
        .connect(creator)
        .createCollaboration("sha256:test", [collaboratorA.address, collaboratorB.address], [5000, 4999]),
      "Split total must equal 100%",
    );

    await expectRevert(
      collaborativeWork
        .connect(creator)
        .createCollaboration("sha256:test", [collaboratorA.address, collaboratorA.address], [5000, 5000]),
      "Duplicate collaborator",
    );
  });
});

