"use client";

import { useFhevm } from "../fhevm/useFhevm";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { usePeerReview } from "@/hooks/usePeerReview";
import { errorNotDeployed } from "./ErrorNotDeployed";
import { useState } from "react";

export const PeerReviewDemo = () => {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const {
    provider,
    chainId,
    accounts,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const peerReview = usePeerReview({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    eip1193Provider: provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  });

  const [participantInput, setParticipantInput] = useState<string>("");
  const [selectedReviewee, setSelectedReviewee] = useState<string>("");
  const [scoreInput, setScoreInput] = useState<string>("");
  const [selectedParticipant, setSelectedParticipant] = useState<string>("");

  const buttonClass =
    "inline-flex items-center justify-center rounded-xl bg-black px-4 py-4 font-semibold text-white shadow-sm " +
    "transition-colors duration-200 hover:bg-blue-700 active:bg-blue-800 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:pointer-events-none";

  const titleClass = "font-semibold text-black text-lg mt-4";

  if (!isConnected) {
    return (
      <div className="mx-auto">
        <button
          className={buttonClass}
          disabled={isConnected}
          onClick={connect}
        >
          <span className="text-4xl p-6">Connect to MetaMask</span>
        </button>
      </div>
    );
  }

  if (peerReview.isDeployed === false) {
    return errorNotDeployed(chainId);
  }

  const handleCreateRound = () => {
    const addresses = participantInput
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);
    if (addresses.length > 0) {
      peerReview.createRound(addresses);
    }
  };

  const handleSubmitScore = () => {
    const score = parseInt(scoreInput);
    if (peerReview.currentRoundId && selectedReviewee && score >= 1 && score <= 10) {
      peerReview.submitScore(peerReview.currentRoundId, selectedReviewee, score);
    }
  };

  const handleDecryptAverage = () => {
    if (peerReview.currentRoundId && selectedParticipant) {
      peerReview.decryptAverage(peerReview.currentRoundId, selectedParticipant);
    }
  };

  return (
    <div className="grid w-full gap-4">
      <div className="col-span-full mx-20 bg-black text-white">
        <p className="font-semibold text-3xl m-5">
          Peer Review - Anonymous Peer Review Platform
          <span className="font-mono font-normal text-gray-400 ml-2">
            PeerReview.sol
          </span>
        </p>
      </div>

      <div className="col-span-full mx-20 mt-4 px-5 pb-4 rounded-lg bg-white border-2 border-black">
        <p className={titleClass}>Chain Infos</p>
        {printProperty("ChainId", chainId)}
        {printProperty("Metamask accounts", accounts ? accounts.length : "undefined")}
        {printProperty("Signer", ethersSigner ? ethersSigner.address : "No signer")}
        <p className={titleClass}>Contract</p>
        {printProperty("PeerReview", peerReview.contractAddress)}
        {printProperty("isDeployed", peerReview.isDeployed)}
      </div>

      <div className="col-span-full mx-20">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white border-2 border-black pb-4 px-4">
            <p className={titleClass}>FHEVM instance</p>
            {printProperty("Fhevm Instance", fhevmInstance ? "OK" : "undefined")}
            {printProperty("Fhevm Status", fhevmStatus)}
            {printProperty("Fhevm Error", fhevmError ?? "No Error")}
          </div>
          <div className="rounded-lg bg-white border-2 border-black pb-4 px-4">
            <p className={titleClass}>Status</p>
            {printProperty("isRefreshing", peerReview.isRefreshing)}
            {printProperty("isSubmitting", peerReview.isSubmitting)}
            {printProperty("isDecrypting", peerReview.isDecrypting)}
          </div>
        </div>
      </div>

      <div className="col-span-full mx-20 px-4 pb-4 rounded-lg bg-white border-2 border-black">
        <p className={titleClass}>Current Round</p>
        {printProperty("Round ID", peerReview.currentRoundId ?? "None")}
        {printProperty("Participants", peerReview.participants.length)}
        {peerReview.participants.length > 0 && (
          <div className="mt-2">
            <p className="text-sm font-semibold">Participant Addresses:</p>
            {peerReview.participants.map((addr, idx) => (
              <p key={idx} className="text-xs font-mono">{addr}</p>
            ))}
          </div>
        )}
      </div>

      <div className="col-span-full mx-20 px-4 pb-4 rounded-lg bg-white border-2 border-black">
        <p className={titleClass}>Create Round</p>
        <input
          type="text"
          placeholder="Enter participant addresses (comma-separated)"
          value={participantInput}
          onChange={(e) => setParticipantInput(e.target.value)}
          className="w-full px-4 py-2 border-2 border-black rounded mb-2"
        />
        <button
          className={buttonClass}
          disabled={!peerReview.canCreateRound}
          onClick={handleCreateRound}
        >
          {peerReview.canCreateRound ? "Create Round" : "Cannot create round"}
        </button>
      </div>

      {peerReview.currentRoundId && (
        <>
          <div className="col-span-full mx-20 px-4 pb-4 rounded-lg bg-white border-2 border-black">
            <p className={titleClass}>Submit Score</p>
            <select
              value={selectedReviewee}
              onChange={(e) => setSelectedReviewee(e.target.value)}
              className="w-full px-4 py-2 border-2 border-black rounded mb-2"
            >
              <option value="">Select reviewee</option>
              {peerReview.participants
                .filter((addr) => addr !== ethersSigner?.address)
                .map((addr) => (
                  <option key={addr} value={addr}>
                    {addr}
                  </option>
                ))}
            </select>
            <input
              type="number"
              min="1"
              max="10"
              placeholder="Score (1-10)"
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              className="w-full px-4 py-2 border-2 border-black rounded mb-2"
            />
            <button
              className={buttonClass}
              disabled={!peerReview.canSubmitScore || !selectedReviewee || !scoreInput}
              onClick={handleSubmitScore}
            >
              {peerReview.canSubmitScore ? "Submit Encrypted Score" : "Cannot submit"}
            </button>
          </div>

          <div className="col-span-full mx-20 px-4 pb-4 rounded-lg bg-white border-2 border-black">
            <p className={titleClass}>Decrypt Average Score</p>
            <select
              value={selectedParticipant}
              onChange={(e) => setSelectedParticipant(e.target.value)}
              className="w-full px-4 py-2 border-2 border-black rounded mb-2"
            >
              <option value="">Select participant</option>
              {peerReview.participants.map((addr) => (
                <option key={addr} value={addr}>
                  {addr}
                </option>
              ))}
            </select>
            <button
              className={buttonClass}
              disabled={!peerReview.canDecrypt || !selectedParticipant}
              onClick={handleDecryptAverage}
            >
              {peerReview.canDecrypt ? "Decrypt Average" : "Cannot decrypt"}
            </button>
            {selectedParticipant && peerReview.decryptedAverages[selectedParticipant] !== undefined && (
              <p className="mt-2 text-lg font-semibold">
                Average Score: {peerReview.decryptedAverages[selectedParticipant].toFixed(2)}
              </p>
            )}
          </div>
        </>
      )}

      <div className="col-span-full mx-20 p-4 rounded-lg bg-white border-2 border-black">
        {printProperty("Message", peerReview.message)}
      </div>
    </div>
  );
};

function printProperty(name: string, value: unknown) {
  let displayValue: string;

  if (typeof value === "boolean") {
    return printBooleanProperty(name, value);
  } else if (typeof value === "string" || typeof value === "number") {
    displayValue = String(value);
  } else if (typeof value === "bigint") {
    displayValue = String(value);
  } else if (value === null) {
    displayValue = "null";
  } else if (value === undefined) {
    displayValue = "undefined";
  } else if (value instanceof Error) {
    displayValue = value.message;
  } else {
    displayValue = JSON.stringify(value);
  }
  return (
    <p className="text-black">
      {name}:{" "}
      <span className="font-mono font-semibold text-black">{displayValue}</span>
    </p>
  );
}

function printBooleanProperty(name: string, value: boolean) {
  if (value) {
    return (
      <p className="text-black">
        {name}:{" "}
        <span className="font-mono font-semibold text-green-500">true</span>
      </p>
    );
  }

  return (
    <p className="text-black">
      {name}:{" "}
      <span className="font-mono font-semibold text-red-500">false</span>
    </p>
  );
}

