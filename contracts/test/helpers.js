const { expect } = require("chai");

async function expectRevert(txPromise, expectedMessage) {
  try {
    await txPromise;
    expect.fail("Expected transaction to revert");
  } catch (error) {
    const message = error?.message || "";
    expect(message).to.include(expectedMessage);
  }
}

function decodeContractEvents(receipt, contract, eventName) {
  return receipt.logs
    .map((log) => {
      try {
        return contract.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .filter((parsed) => parsed && parsed.name === eventName);
}

module.exports = {
  expectRevert,
  decodeContractEvents,
};

