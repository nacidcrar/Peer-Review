"use client";

import { useFhevm } from "../fhevm/useFhevm";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { usePeerReview } from "@/hooks/usePeerReview";
import { errorNotDeployed } from "./ErrorNotDeployed";
import { useState, useEffect } from "react";
import { ethers } from "ethers";

type PageView = 'create' | 'manage' | 'round-detail';

export const PeerReviewPage = () => {
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

  const [currentView, setCurrentView] = useState<PageView>('create');
  const [participantInput, setParticipantInput] = useState<string>("");
  const [selectedReviewee, setSelectedReviewee] = useState<string>("");
  const [scoreInput, setScoreInput] = useState<string>("");
  const [selectedParticipant, setSelectedParticipant] = useState<string>("");
  const [roundIdInput, setRoundIdInput] = useState<string>("");
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info', message: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Auto-refresh round data when round ID changes
  useEffect(() => {
    if (peerReview.currentRoundId) {
      peerReview.refreshRoundData(peerReview.currentRoundId);
    }
  }, [peerReview.currentRoundId]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
          <div className="glass-card-solid rounded-3xl p-12 max-w-lg w-full text-center float-animation">
          <div className="mb-8">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
              <svg className="w-12 h-12 text-blue-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-4xl font-extrabold text-blue-900 mb-4 glow-text">
              Peer Review Platform
            </h1>
            <p className="text-lg text-blue-700 mb-2">
              Secure & Anonymous Review System
            </p>
            <p className="text-sm text-blue-600">
              Powered by Fully Homomorphic Encryption
            </p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-6 mb-8">
            <p className="text-blue-800 mb-4 text-left">
              <strong>🔒 Privacy First:</strong> All reviews are encrypted end-to-end
            </p>
            <p className="text-blue-800 mb-4 text-left">
              <strong>🎭 Anonymous:</strong> Your identity stays completely private
            </p>
            <p className="text-blue-800 text-left">
              <strong>⚡ Secure:</strong> Built on FHEVM technology
            </p>
          </div>
          <button
            className="btn-primary w-full py-4 px-8 rounded-xl text-xl font-bold"
            onClick={connect}
          >
            🦊 Connect MetaMask Wallet
          </button>
          <p className="text-blue-600 text-sm mt-4">
            Connect your wallet to get started with secure peer reviews
          </p>
        </div>
      </div>
    );
  }

  if (peerReview.isDeployed === false) {
    return errorNotDeployed(chainId);
  }

  const handleCreateRound = async () => {
    const addresses = participantInput
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0 && ethers.isAddress(addr));
    
    if (addresses.length === 0) {
      showNotification('error', '❌ Please enter valid participant addresses (comma-separated)');
      return;
    }
    
    if (addresses.length < 2) {
      showNotification('error', '❌ At least 2 participants are required for peer review');
      return;
    }
    
    await peerReview.createRound(addresses);
    setParticipantInput("");
    showNotification('success', '✅ Review round created successfully!');
    
    // Wait a bit for the round to be created and then switch view
    setTimeout(() => {
      if (peerReview.currentRoundId) {
        setCurrentView('round-detail');
      }
    }, 1000);
  };

  const handleSubmitScore = () => {
    const score = parseInt(scoreInput);
    if (!peerReview.currentRoundId) {
      showNotification('error', '❌ Please select or create a round first');
      return;
    }
    if (!selectedReviewee) {
      showNotification('error', '❌ Please select a peer to review');
      return;
    }
    if (isNaN(score) || score < 1 || score > 10) {
      showNotification('error', '❌ Score must be between 1 and 10');
      return;
    }
    peerReview.submitScore(peerReview.currentRoundId, selectedReviewee, score);
    setScoreInput("");
    setSelectedReviewee("");
    showNotification('success', '🔒 Encrypted score submitted successfully!');
  };

  const handleDecryptAverage = () => {
    if (!peerReview.currentRoundId) {
      showNotification('error', '❌ Please select or create a round first');
      return;
    }
    if (!selectedParticipant) {
      showNotification('error', '❌ Please select a participant to view results');
      return;
    }
    peerReview.decryptAverage(peerReview.currentRoundId, selectedParticipant);
    showNotification('info', '🔓 Decrypting average score...');
  };

  const handleSelectRound = () => {
    const roundId = parseInt(roundIdInput);
    if (isNaN(roundId) || roundId < 1) {
      showNotification('error', '❌ Please enter a valid round ID');
      return;
    }
    peerReview.setCurrentRoundId(roundId);
    peerReview.refreshRoundData(roundId);
    showNotification('success', `✅ Loaded Round #${roundId}`);
    setCurrentView('round-detail');
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const renderSidebar = () => (
    <div className="glass-card rounded-2xl p-6 h-fit lg:sticky lg:top-8 sidebar-enter">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Navigation</h2>
        <p className="text-yellow-200 text-sm">Manage your reviews</p>
      </div>
      
      <nav className="space-y-3">
        <button
          onClick={() => {
            setCurrentView('create');
            setIsMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
            currentView === 'create'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-blue-900 shadow-lg'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <span className="text-xl">➕</span>
          <span>Create Round</span>
        </button>
        
        <button
          onClick={() => {
            setCurrentView('manage');
            setIsMobileMenuOpen(false);
          }}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
            currentView === 'manage'
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-blue-900 shadow-lg'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          <span className="text-xl">📋</span>
          <span>Load Round</span>
        </button>

        {peerReview.currentRoundId && (
          <button
            onClick={() => {
              setCurrentView('round-detail');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
              currentView === 'round-detail'
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-blue-900 shadow-lg'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <span className="text-xl">🎯</span>
            <span>Round #{peerReview.currentRoundId}</span>
          </button>
        )}
      </nav>

      {peerReview.currentRoundId && (
        <div className="mt-6 bg-white/10 rounded-xl p-4 border border-white/20">
          <p className="text-yellow-200 text-sm font-semibold mb-2">Current Round</p>
          <p className="text-white text-2xl font-bold">#{peerReview.currentRoundId}</p>
          <p className="text-yellow-100 text-sm mt-1">
            {peerReview.participants.length} Participants
          </p>
        </div>
      )}
    </div>
  );

  const renderCreateRoundView = () => (
    <div className="glass-card-solid rounded-2xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
          <span className="text-2xl">➕</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-blue-900">Create New Round</h2>
          <p className="text-blue-600">Start a new peer review round</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
          <h3 className="text-lg font-bold text-blue-900 mb-3">ℹ️ How it Works</h3>
          <ul className="space-y-2 text-blue-700">
            <li>• Add participant wallet addresses (comma-separated)</li>
            <li>• All participants can review each other anonymously</li>
            <li>• Scores are encrypted using FHE technology</li>
            <li>• Average scores can be decrypted later</li>
            <li>• Only the admin can create new rounds</li>
          </ul>
        </div>

        <div>
          <label className="block text-sm font-bold text-blue-800 mb-2">
            Participant Wallet Addresses
          </label>
          <textarea
            value={participantInput}
            onChange={(e) => setParticipantInput(e.target.value)}
            placeholder="Enter addresses separated by commas&#10;Example: 0x123..., 0x456..., 0x789..."
            rows={6}
            className="input-field w-full px-4 py-3 rounded-xl font-mono text-sm resize-none"
          />
          <div className="mt-3 bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <p className="text-xs text-blue-700 font-semibold mb-2">💡 Quick Start (Local Testing):</p>
            <p className="text-xs text-blue-600 font-mono break-all">
              0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266,0x70997970C51812dc3A010C7d01b50e0d17dc79C8,0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
            </p>
          </div>
        </div>

        <button
          onClick={handleCreateRound}
          disabled={!peerReview.canCreateRound || peerReview.isSubmitting}
          className="btn-primary w-full py-4 px-6 rounded-xl text-lg font-bold"
        >
          {peerReview.isSubmitting ? "⏳ Creating Round..." : "🚀 Create Review Round"}
        </button>
      </div>
    </div>
  );

  const renderManageRoundView = () => (
    <div className="glass-card-solid rounded-2xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
          <span className="text-2xl">📋</span>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-blue-900">Load Round</h2>
          <p className="text-blue-600">Access an existing review round</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
          <h3 className="text-lg font-bold text-blue-900 mb-3">ℹ️ Instructions</h3>
          <ul className="space-y-2 text-blue-700">
            <li>• Enter the round ID you want to load</li>
            <li>• Round IDs start from 1 and increment</li>
            <li>• You'll be able to submit reviews and view results</li>
            <li>• The round details will open in a new page</li>
          </ul>
        </div>

        <div>
          <label className="block text-sm font-bold text-blue-800 mb-2">
            Round ID
          </label>
          <input
            type="number"
            value={roundIdInput}
            onChange={(e) => setRoundIdInput(e.target.value)}
            placeholder="Enter round ID (e.g. 1, 2, 3...)"
            className="input-field w-full px-4 py-3 rounded-xl font-mono text-lg"
          />
        </div>

        <button
          onClick={handleSelectRound}
          className="btn-primary w-full py-4 px-6 rounded-xl text-lg font-bold"
        >
          📂 Load Round & Continue
        </button>
      </div>
    </div>
  );

  const renderRoundDetailView = () => {
    if (!peerReview.currentRoundId) {
      return (
        <div className="glass-card-solid rounded-2xl p-8 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-blue-900 mb-2">No Round Selected</h2>
          <p className="text-blue-600">Please create or load a round to get started</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Round Header */}
        <div className="glass-card-solid rounded-2xl p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-blue-900">Round #{peerReview.currentRoundId}</h2>
                <p className="text-blue-600">Review and manage participants</p>
              </div>
            </div>
            <div className="bg-blue-50 rounded-xl px-6 py-3 border-2 border-blue-200">
              <p className="text-blue-700 font-semibold">{peerReview.participants.length} Participants 👥</p>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Submit Score */}
          <div className="glass-card-solid rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <span className="text-xl">🔒</span>
              </div>
              <h3 className="text-2xl font-bold text-blue-900">Submit Score</h3>
            </div>
            <p className="text-blue-600 mb-4 text-sm">Rate a peer anonymously - scores are fully encrypted</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-blue-800 mb-2">
                  Select Peer to Review
                </label>
                <select
                  value={selectedReviewee}
                  onChange={(e) => setSelectedReviewee(e.target.value)}
                  className="select-field w-full px-4 py-3 rounded-xl font-semibold"
                >
                  <option value="">Choose a participant...</option>
                  {peerReview.participants
                    .filter((addr) => addr !== ethersSigner?.address)
                    .map((addr) => (
                      <option key={addr} value={addr}>
                        {formatAddress(addr)}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-blue-800 mb-2">
                  Your Score (1-10)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={scoreInput}
                  onChange={(e) => setScoreInput(e.target.value)}
                  placeholder="Rate from 1 (lowest) to 10 (highest)"
                  className="input-field w-full px-4 py-3 rounded-xl font-semibold text-lg text-center"
                />
                <div className="mt-2 flex justify-between text-xs text-blue-600">
                  <span>⭐ Poor</span>
                  <span>⭐⭐⭐ Average</span>
                  <span>⭐⭐⭐⭐⭐ Excellent</span>
                </div>
              </div>
              <button
                onClick={handleSubmitScore}
                disabled={!peerReview.canSubmitScore || !selectedReviewee || !scoreInput || peerReview.isSubmitting}
                className="btn-primary w-full py-4 px-6 rounded-xl text-lg font-bold"
              >
                {peerReview.isSubmitting ? "⏳ Encrypting..." : "🔐 Submit Encrypted Score"}
              </button>
            </div>
          </div>

          {/* Decrypt Average */}
          <div className="glass-card-solid rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <span className="text-xl">🔓</span>
              </div>
              <h3 className="text-2xl font-bold text-blue-900">View Score</h3>
            </div>
            <p className="text-blue-600 mb-4 text-sm">Decrypt and reveal the average score</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-blue-800 mb-2">
                  Select Participant
                </label>
                <select
                  value={selectedParticipant}
                  onChange={(e) => setSelectedParticipant(e.target.value)}
                  className="select-field w-full px-4 py-3 rounded-xl font-semibold"
                >
                  <option value="">Choose a participant...</option>
                  {peerReview.participants.map((addr) => (
                    <option key={addr} value={addr}>
                      {formatAddress(addr)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleDecryptAverage}
                disabled={!peerReview.canDecrypt || !selectedParticipant || peerReview.isDecrypting}
                className="btn-primary w-full py-4 px-6 rounded-xl text-lg font-bold"
              >
                {peerReview.isDecrypting ? "⏳ Decrypting..." : "🔓 Decrypt Average Score"}
              </button>
              {selectedParticipant && peerReview.decryptedAverages[selectedParticipant] !== undefined && (
                <div className="bg-gradient-to-br from-yellow-50 to-blue-50 rounded-2xl p-6 border-3 border-yellow-400 shadow-lg">
                  <p className="text-sm text-blue-700 font-semibold mb-3">
                    Average Score for {formatAddress(selectedParticipant)}:
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-6xl font-extrabold bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                      {peerReview.decryptedAverages[selectedParticipant].toFixed(2)}
                    </div>
                    <div className="text-4xl">
                      {peerReview.decryptedAverages[selectedParticipant] >= 8 ? '🌟' :
                       peerReview.decryptedAverages[selectedParticipant] >= 6 ? '⭐' :
                       peerReview.decryptedAverages[selectedParticipant] >= 4 ? '✨' : '💫'}
                    </div>
                  </div>
                  <p className="text-center text-blue-600 text-sm mt-2 font-medium">
                    {peerReview.decryptedAverages[selectedParticipant] >= 8 ? 'Excellent Performance! 🎉' :
                     peerReview.decryptedAverages[selectedParticipant] >= 6 ? 'Good Work! 👍' :
                     peerReview.decryptedAverages[selectedParticipant] >= 4 ? 'Satisfactory 👌' : 'Needs Improvement 📚'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Participants List */}
        {peerReview.participants.length > 0 && (
          <div className="glass-card-solid rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
                <span className="text-xl">👥</span>
              </div>
              <h3 className="text-2xl font-bold text-blue-900">All Participants</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {peerReview.participants.map((addr, idx) => (
                <div key={idx} className="bg-gradient-to-br from-blue-50 to-white rounded-xl p-4 border-2 border-blue-200 hover:border-yellow-400 transition-all hover:shadow-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                      {idx + 1}
                    </div>
                    <span className="font-mono text-xs text-blue-700 flex-1 break-all">
                      {addr}
                    </span>
                  </div>
                  {peerReview.decryptedAverages[addr] !== undefined && (
                    <div className="mt-3 pt-3 border-t-2 border-blue-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-blue-600 font-semibold">Average:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-extrabold bg-gradient-to-r from-yellow-500 to-yellow-600 bg-clip-text text-transparent">
                            {peerReview.decryptedAverages[addr].toFixed(2)}
                          </span>
                          <span className="text-lg">
                            {peerReview.decryptedAverages[addr] >= 8 ? '🌟' :
                             peerReview.decryptedAverages[addr] >= 6 ? '⭐' : '✨'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Notification */}
        {notification && (
          <div className={`fixed top-4 right-4 z-50 glass-card-solid rounded-xl p-4 shadow-2xl max-w-md animate-bounce ${
            notification.type === 'success' ? 'border-l-4 border-green-500' :
            notification.type === 'error' ? 'border-l-4 border-red-500' :
            'border-l-4 border-blue-500'
          }`}>
            <p className="text-blue-900 font-semibold">{notification.message}</p>
          </div>
        )}

        {/* Header */}
        <div className="glass-card rounded-3xl p-8 mb-8 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-5xl font-extrabold mb-3 glow-text">
                🔐 Peer Review Platform
              </h1>
              <p className="text-yellow-200 text-lg font-medium">
                Anonymous & Encrypted Review System powered by FHEVM
              </p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4 border-2 border-white/30">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${fhevmStatus === 'ready' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`}></div>
                <span className="font-semibold">System Status</span>
              </div>
              <div className="text-sm space-y-1 text-yellow-100">
                <div>Chain: <span className="font-mono">{chainId || "N/A"}</span></div>
                <div>Account: <span className="font-mono">{accounts?.[0] ? formatAddress(accounts[0]) : "N/A"}</span></div>
                <div>FHEVM: <span className="font-bold text-yellow-300">{fhevmStatus === "ready" ? "✓ Ready" : fhevmStatus}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content with Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            {renderSidebar()}
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {currentView === 'create' && renderCreateRoundView()}
            {currentView === 'manage' && renderManageRoundView()}
            {currentView === 'round-detail' && renderRoundDetailView()}

            {/* Status Message */}
            {peerReview.message && (
              <div className="glass-card-solid rounded-2xl p-5 border-l-4 border-yellow-400 mt-6">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💬</span>
                  <p className="text-blue-800 font-medium">{peerReview.message}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

