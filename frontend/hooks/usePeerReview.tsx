"use client";

import { ethers } from "ethers";
import {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";

import { PeerReviewAddresses } from "@/abi/PeerReviewAddresses";
import { PeerReviewABI } from "@/abi/PeerReviewABI";

export type ClearValueType = {
  handle: string;
  clear: string | bigint | boolean;
};

type PeerReviewInfoType = {
  abi: typeof PeerReviewABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

function getPeerReviewByChainId(
  chainId: number | undefined
): PeerReviewInfoType {
  if (!chainId) {
    return { abi: PeerReviewABI.abi };
  }

  const entry =
    PeerReviewAddresses[chainId.toString() as keyof typeof PeerReviewAddresses];

  // 如果 entry 不存在或没有有效的地址，返回没有地址的结果
  if (!entry || !("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: PeerReviewABI.abi, chainId };
  }

  return {
    address: entry.address as `0x${string}` | undefined,
    chainId: entry.chainId ?? chainId,
    chainName: entry.chainName,
    abi: PeerReviewABI.abi,
  };
}

export const usePeerReview = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  eip1193Provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<
    (ethersSigner: ethers.JsonRpcSigner | undefined) => boolean
  >;
}) => {
  const {
    instance,
    fhevmDecryptionSignatureStorage,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  } = parameters;

  const [rounds, setRounds] = useState<number[]>([]);
  const [currentRoundId, setCurrentRoundId] = useState<number | undefined>(undefined);
  const [participants, setParticipants] = useState<string[]>([]);
  const [encryptedTotals, setEncryptedTotals] = useState<Record<string, string>>({});
  const [encryptedCounts, setEncryptedCounts] = useState<Record<string, string>>({});
  const [decryptedAverages, setDecryptedAverages] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");

  const peerReviewRef = useRef<PeerReviewInfoType | undefined>(undefined);
  const isSubmittingRef = useRef<boolean>(false);
  const isDecryptingRef = useRef<boolean>(false);
  const isRefreshingRef = useRef<boolean>(false);

  const peerReview = useMemo(() => {
    const c = getPeerReviewByChainId(chainId);
    peerReviewRef.current = c;
    // 仅当 chainId 已知且该网络未配置合约地址时才提示未部署的信息
    if (chainId !== undefined && !c.address) {
      setMessage(`PeerReview deployment not found for chainId=${chainId}.`);
    } else if (chainId === undefined || c.address) {
      // 当 chainId 未定义或已有地址时清除消息，防止误报
      setMessage("");
    }
    return c;
  }, [chainId]);

  const isDeployed = useMemo(() => {
    if (!peerReview) {
      return undefined;
    }
    // 如果 chainId 未定义，返回 undefined（未知状态，不应该显示错误）
    if (chainId === undefined) {
      return undefined;
    }
    // 仅当 chainId 已知时，检查是否有地址
    return Boolean(peerReview.address) && peerReview.address !== ethers.ZeroAddress;
  }, [peerReview, chainId]);

  const canCreateRound = useMemo(() => {
    return peerReview.address && ethersSigner && !isSubmitting && !isRefreshing;
  }, [peerReview.address, ethersSigner, isSubmitting, isRefreshing]);

  const canSubmitScore = useMemo(() => {
    return peerReview.address && instance && ethersSigner && !isSubmitting && !isRefreshing && currentRoundId !== undefined;
  }, [peerReview.address, instance, ethersSigner, isSubmitting, isRefreshing, currentRoundId]);

  const canDecrypt = useMemo(() => {
    return peerReview.address && instance && ethersSigner && !isDecrypting && !isRefreshing;
  }, [peerReview.address, instance, ethersSigner, isDecrypting, isRefreshing]);

  const createRound = useCallback(
    async (participantAddresses: string[]) => {
      if (isSubmittingRef.current || isRefreshingRef.current) {
        return;
      }

      if (!peerReview.address || !ethersSigner) {
        return;
      }

      const thisChainId = chainId;
      const thisPeerReviewAddress = peerReview.address;
      const thisEthersSigner = ethersSigner;

      const thisPeerReviewContract = new ethers.Contract(
        thisPeerReviewAddress,
        peerReview.abi,
        thisEthersSigner
      );

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setMessage("Creating round...");

      try {
        const tx = await thisPeerReviewContract.createRound(participantAddresses);
        setMessage(`Waiting for tx: ${tx.hash}...`);

        const receipt = await tx.wait();

        if (
          thisPeerReviewAddress !== peerReviewRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner)
        ) {
          return;
        }

        // Get the round ID from events
        const roundCreatedEvent = receipt.logs.find((log: ethers.Log) => {
          try {
            const parsed = thisPeerReviewContract.interface.parseLog(log);
            return parsed?.name === "RoundCreated";
          } catch {
            return false;
          }
        });

        if (roundCreatedEvent) {
          const parsed = thisPeerReviewContract.interface.parseLog(roundCreatedEvent);
          const roundId = parsed?.args[0];
          if (roundId) {
            const roundIdNumber = Number(roundId);
            setCurrentRoundId(roundIdNumber);
            setRounds((prev) => [...prev, roundIdNumber]);
            setParticipants(participantAddresses);
            setMessage(`Round created successfully! Round ID: ${roundIdNumber}. Status: ${receipt?.status}`);
          } else {
            setMessage(`Round created! Status: ${receipt?.status} (Round ID not found in event)`);
          }
        } else {
          setMessage(`Round created! Status: ${receipt?.status} (RoundCreated event not found)`);
        }
      } catch (error) {
        setMessage(`Failed to create round: ${error}`);
      } finally {
        isSubmittingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [ethersSigner, peerReview.address, peerReview.abi, chainId, sameChain, sameSigner]
  );

  const submitScore = useCallback(
    async (roundId: number, reviewee: string, score: number) => {
      if (isSubmittingRef.current || isRefreshingRef.current) {
        return;
      }

      if (!peerReview.address || !instance || !ethersSigner || score < 1 || score > 10) {
        return;
      }

      const thisChainId = chainId;
      const thisPeerReviewAddress = peerReview.address;
      const thisEthersSigner = ethersSigner;
      const thisPeerReviewContract = new ethers.Contract(
        thisPeerReviewAddress,
        peerReview.abi,
        thisEthersSigner
      );

      isSubmittingRef.current = true;
      setIsSubmitting(true);
      setMessage(`Encrypting score ${score}...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisPeerReviewAddress !== peerReviewRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          const input = instance.createEncryptedInput(
            thisPeerReviewAddress,
            thisEthersSigner.address
          );
          input.add32(score);

          const enc = await input.encrypt();

          if (isStale()) {
            setMessage("Ignore submit score");
            return;
          }

          setMessage(`Submitting encrypted score...`);

          const tx = await thisPeerReviewContract.submitScore(
            roundId,
            reviewee,
            enc.handles[0],
            enc.inputProof
          );

          setMessage(`Waiting for tx: ${tx.hash}...`);

          const receipt = await tx.wait();

          setMessage(`Score submitted! Status: ${receipt?.status}`);

          if (isStale()) {
            return;
          }

          // Refresh encrypted totals and counts
          refreshRoundData(roundId);
        } catch (error) {
          setMessage(`Failed to submit score: ${error}`);
        } finally {
          isSubmittingRef.current = false;
          setIsSubmitting(false);
        }
      };

      run();
    },
    [
      ethersSigner,
      peerReview.address,
      peerReview.abi,
      instance,
      chainId,
      sameChain,
      sameSigner,
    ]
  );

  const refreshRoundData = useCallback(
    async (roundId: number) => {
      if (isRefreshingRef.current) {
        return;
      }

      if (
        !peerReviewRef.current ||
        !peerReviewRef.current?.chainId ||
        !peerReviewRef.current?.address ||
        !ethersReadonlyProvider
      ) {
        return;
      }

      isRefreshingRef.current = true;
      setIsRefreshing(true);

      const thisChainId = peerReviewRef.current.chainId;
      const thisPeerReviewAddress = peerReviewRef.current.address;

      const thisPeerReviewContract = new ethers.Contract(
        thisPeerReviewAddress,
        peerReviewRef.current.abi,
        ethersReadonlyProvider
      );

      try {
        const participantsList = await thisPeerReviewContract.getParticipants(roundId);
        setParticipants(participantsList);

        const totals: Record<string, string> = {};
        const counts: Record<string, string> = {};

        for (const participant of participantsList) {
          const totalHandle = await thisPeerReviewContract.getEncryptedTotalScore(roundId, participant);
          const countHandle = await thisPeerReviewContract.getEncryptedCount(roundId, participant);
          totals[participant] = totalHandle;
          counts[participant] = countHandle;
        }

        if (
          sameChain.current(thisChainId) &&
          thisPeerReviewAddress === peerReviewRef.current?.address
        ) {
          setEncryptedTotals(totals);
          setEncryptedCounts(counts);
        }
      } catch (error) {
        setMessage(`Failed to refresh round data: ${error}`);
      } finally {
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    },
    [ethersReadonlyProvider, sameChain]
  );

  const decryptAverage = useCallback(
    async (roundId: number, participant: string) => {
      if (isDecryptingRef.current || isRefreshingRef.current) {
        return;
      }

      if (!peerReview.address || !instance || !ethersSigner) {
        return;
      }

      const totalHandle = encryptedTotals[participant];
      const countHandle = encryptedCounts[participant];

      if (!totalHandle || !countHandle || totalHandle === ethers.ZeroHash || countHandle === ethers.ZeroHash) {
        setMessage("No encrypted data to decrypt");
        return;
      }

      const thisChainId = chainId;
      const thisPeerReviewAddress = peerReview.address;
      const thisEthersSigner = ethersSigner;

      isDecryptingRef.current = true;
      setIsDecrypting(true);
      setMessage("Decrypting average score...");

      const run = async () => {
        const isStale = () =>
          thisPeerReviewAddress !== peerReviewRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          const sig: FhevmDecryptionSignature | null =
            await FhevmDecryptionSignature.loadOrSign(
              instance,
              [peerReview.address as `0x${string}`],
              ethersSigner,
              fhevmDecryptionSignatureStorage
            );

          if (!sig) {
            setMessage("Unable to build FHEVM decryption signature");
            return;
          }

          if (isStale()) {
            setMessage("Ignore FHEVM decryption");
            return;
          }

          // Decrypt both total and count
          const totalRes = await instance.userDecrypt(
            [{ handle: totalHandle, contractAddress: thisPeerReviewAddress }],
            sig.privateKey,
            sig.publicKey,
            sig.signature,
            sig.contractAddresses,
            sig.userAddress,
            sig.startTimestamp,
            sig.durationDays
          );

          const countRes = await instance.userDecrypt(
            [{ handle: countHandle, contractAddress: thisPeerReviewAddress }],
            sig.privateKey,
            sig.publicKey,
            sig.signature,
            sig.contractAddresses,
            sig.userAddress,
            sig.startTimestamp,
            sig.durationDays
          );

          if (isStale()) {
            setMessage("Ignore FHEVM decryption");
            return;
          }

          // The SDK returns a ClearValues-like map keyed by decrypt handles.
          // Cast to a string-indexed record to safely access by handle.
          const totalMap = totalRes as unknown as Record<string, string | number | bigint | boolean>;
          const countMap = countRes as unknown as Record<string, string | number | bigint | boolean>;
          const total = Number(totalMap[totalHandle]);
          const count = Number(countMap[countHandle]);
          const average = count > 0 ? total / count : 0;

          setDecryptedAverages((prev) => ({
            ...prev,
            [participant]: average,
          }));

          setMessage(`Average score: ${average.toFixed(2)}`);
        } catch (error) {
          setMessage(`Failed to decrypt: ${error}`);
        } finally {
          isDecryptingRef.current = false;
          setIsDecrypting(false);
        }
      };

      run();
    },
    [
      fhevmDecryptionSignatureStorage,
      ethersSigner,
      peerReview.address,
      instance,
      chainId,
      encryptedTotals,
      encryptedCounts,
      sameChain,
      sameSigner,
    ]
  );

  return {
    contractAddress: peerReview.address,
    isDeployed,
    canCreateRound,
    canSubmitScore,
    canDecrypt,
    createRound,
    submitScore,
    refreshRoundData,
    decryptAverage,
    rounds,
    currentRoundId,
    setCurrentRoundId,
    participants,
    encryptedTotals,
    encryptedCounts,
    decryptedAverages,
    isSubmitting,
    isDecrypting,
    isRefreshing,
    message,
  };
};

