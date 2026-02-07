'use client';

declare global {
  interface Window {
    ethereum?: {
      request: (args: unknown) => Promise<unknown>;
      on?: (event: string, cb: (accounts: string[]) => void) => void;
    };
  }
}

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import gun from '@/src/lib/gun';
import TrustGraphAbi from '@/src/lib/TrustGraph.json';
import { TRUST_GRAPH_ADDRESS as contractAddress } from '@/src/lib/contractAddress';
import { ConnectionStatus } from './components/ConnectionStatus';
import { RumorCard, RumorVotes } from './components/RumorCard';
import { Wallet, UserPlus, Send, AlertCircle } from 'lucide-react';

type Rumor = { id: string; text: string; time: number };

export default function Home() {
  const [rumors, setRumors] = useState<Rumor[]>([]);
  const [rumorVotes, setRumorVotes] = useState<Record<string, RumorVotes>>({});
  const [newRumor, setNewRumor] = useState('');
  const [account, setAccount] = useState<string | null>(null);
  const [trustScore, setTrustScore] = useState<number>(0);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [votingRumorId, setVotingRumorId] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [bootstrapSlotsLeft, setBootstrapSlotsLeft] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const switchToSepolia = async () => {
    if (typeof window === 'undefined' || !window.ethereum) return;
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0xaa36a7' }],
      });
    } catch (err: unknown) {
      const code = (err as { code?: number })?.code;
      if (code === 4902) {
        await window.ethereum!.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: '0xaa36a7',
            chainName: 'Sepolia Test Network',
            nativeCurrency: { name: 'Sepolia Ether', symbol: 'SEP', decimals: 18 },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          }],
        });
      } else {
        throw err;
      }
    }
  };


  const getContract = useCallback(async (needsSigner = false) => {
    if (typeof window === 'undefined' || !window.ethereum) return null;
    const provider = new ethers.BrowserProvider(window.ethereum);
    // TrustGraphAbi is the full artifact, extract the abi array
    const abi = (TrustGraphAbi as { abi: ethers.InterfaceAbi }).abi;
    if (needsSigner) {
      const signer = await provider.getSigner();
      return new ethers.Contract(contractAddress, abi, signer);
    }
    return new ethers.Contract(contractAddress, abi, provider);
  }, []);

  const fetchUserData = useCallback(async (addr: string) => {
    try {
      const contract = await getContract();
      if (!contract) return;

      const [score, registered, slotsLeft] = await Promise.all([
        contract.trustScore(addr),
        contract.isRegistered(addr),
        contract.remainingBootstrapSlots(),
      ]);

      setTrustScore(Number(score));
      setIsRegistered(registered);
      setBootstrapSlotsLeft(Number(slotsLeft));
    } catch (err) {
      console.error('Error fetching user data:', err);
      setTrustScore(0);
      setIsRegistered(false);
    }
  }, [getContract]);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      setError('Please install MetaMask or another Web3 wallet.');
      return;
    }
    setError(null);

    try {
      await switchToSepolia();
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const addr = accounts[0] as string;
      setAccount(addr);
      await fetchUserData(addr);
    } catch (err) {
      console.error('Wallet connection error:', err);
      setError('Failed to connect wallet. Please try again.');
    }
  }, [fetchUserData]);

  const registerUser = useCallback(async () => {
    if (!account) return;
    setIsRegistering(true);
    setError(null);

    try {
      const contract = await getContract(true);
      if (!contract) return;

      // Generate a commitment from a random secret
      const secret = ethers.randomBytes(32);
      const commitment = ethers.keccak256(secret);

      // Store secret locally (in production, this would be more secure)
      localStorage.setItem(`acrs_secret_${account}`, ethers.hexlify(secret));

      const tx = await contract.bootstrapRegister(commitment);
      await tx.wait();

      await fetchUserData(account);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('BootstrapPeriodEnded')) {
        setError('Bootstrap period ended. You need an invite to join.');
      } else if (msg.includes('AlreadyRegistered')) {
        setError('You are already registered!');
        await fetchUserData(account);
      } else {
        setError('Registration failed: ' + msg.slice(0, 80));
      }
    } finally {
      setIsRegistering(false);
    }
  }, [account, getContract, fetchUserData]);

  // Fetch vote data for a rumor
  const fetchRumorVotes = useCallback(async (rumorText: string, rumorId: string) => {
    try {
      const contract = await getContract();
      if (!contract) return;

      const rumorHash = ethers.id(rumorText);
      const [weightedTrue, weightedFalse, trueCount, falseCount] = await contract.getRumorVotes(rumorHash);
      const trustScore = await contract.getRumorTrustScore(rumorHash);

      let hasVoted = false;
      if (account) {
        hasVoted = await contract.hasVoted(rumorHash, account);
      }

      setRumorVotes(prev => ({
        ...prev,
        [rumorId]: {
          weightedTrue: Number(weightedTrue),
          weightedFalse: Number(weightedFalse),
          trueCount: Number(trueCount),
          falseCount: Number(falseCount),
          trustScore: Number(trustScore),
          hasVoted,
        },
      }));
    } catch (err) {
      console.error('Error fetching rumor votes:', err);
    }
  }, [getContract, account]);

  // Subscribe to P2P rumors
  useEffect(() => {
    if (!gun) return;
    gun.get('acrs-channel').map().on((data: { text?: string; time?: number } | null, id: string) => {
      if (data && data.text) {
        setRumors((prev) => {
          if (prev.find((r) => r.id === id)) return prev;
          const newRumor = { id, text: data.text ?? '', time: data.time ?? Date.now() };
          // Fetch votes for the new rumor
          fetchRumorVotes(newRumor.text, newRumor.id);
          return [newRumor, ...prev];
        });
      }
    });
  }, [fetchRumorVotes]);

  // Refresh votes when account changes
  useEffect(() => {
    if (account && rumors.length > 0) {
      rumors.forEach(r => fetchRumorVotes(r.text, r.id));
    }
  }, [account, rumors.length, fetchRumorVotes]);

  // Handle account changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on?.('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          setAccount(null);
          setTrustScore(0);
          setIsRegistered(false);
        } else {
          setAccount(accounts[0]);
          fetchUserData(accounts[0]);
        }
      });
    }
  }, [fetchUserData]);

  const postRumor = async () => {
    if (!gun || !newRumor.trim()) return;

    const rumor = { text: newRumor, time: Date.now() };
    gun.get('acrs-channel').set(rumor);

    // Optionally register on-chain if user is registered
    if (isRegistered && account) {
      try {
        const contract = await getContract(true);
        if (contract) {
          const rumorHash = ethers.id(newRumor);
          // Note: This is optional - could be done lazily on first vote
          // await contract.registerRumor(rumorHash, newRumor);
        }
      } catch (err) {
        console.error('Error registering rumor on-chain:', err);
      }
    }

    setNewRumor('');
  };

  const castVote = async (rumorText: string, rumorId: string, isTrue: boolean) => {
    if (!account || typeof window === 'undefined' || !window.ethereum) {
      setError('Connect your wallet first.');
      return;
    }

    if (!isRegistered) {
      setError('You must be registered to vote.');
      return;
    }

    const rumorHash = ethers.id(rumorText);
    setVotingRumorId(rumorId);
    setError(null);

    try {
      const contract = await getContract(true);
      if (!contract) return;

      const tx = await contract.castVote(rumorHash, isTrue);
      await tx.wait();

      // Refresh data
      await fetchRumorVotes(rumorText, rumorId);
      await fetchUserData(account);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotRegistered')) {
        setError('You must be registered to vote.');
      } else if (msg.includes('AlreadyVoted')) {
        setError('You already voted on this rumor.');
        // Refresh to update UI
        await fetchRumorVotes(rumorText, rumorId);
      } else {
        setError('Vote failed: ' + msg.slice(0, 80));
      }
    } finally {
      setVotingRumorId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-cyan-100 font-mono">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8 pb-6 border-b border-cyan-500/30">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-wider text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                ACRS // Campus Gossip
              </h1>
              <p className="text-sm text-cyan-200/60 mt-1">P2P Rumor Feed · TrustGraph Verified</p>
            </div>

            <div className="flex items-center gap-3">
              {account ? (
                <>
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-300 text-sm border border-cyan-500/40">
                      Trust: {trustScore}
                    </span>
                    <span className="text-xs text-cyan-200/50 truncate max-w-[120px]">{account}</span>
                  </div>

                  {!isRegistered && (
                    <button
                      onClick={registerUser}
                      disabled={isRegistering}
                      className="flex items-center gap-2 px-4 py-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 font-medium transition-all disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4" />
                      {isRegistering ? 'Registering...' : `Register (${bootstrapSlotsLeft} slots)`}
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={connectWallet}
                  className="flex items-center gap-2 px-5 py-2.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-medium transition-all hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]"
                >
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </button>
              )}
            </div>
          </div>

          {/* Connection Status */}
          <ConnectionStatus />
        </header>

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-rose-400 hover:text-rose-300"
            >
              ×
            </button>
          </div>
        )}

        {/* Rumor Input */}
        <div className="flex gap-2 mb-8">
          <input
            className="flex-1 bg-[#0d0d14] border border-cyan-500/30 rounded px-4 py-3 text-cyan-100 placeholder-cyan-500/50 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40"
            value={newRumor}
            onChange={(e) => setNewRumor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && postRumor()}
            placeholder="What's the tea? Broadcast to P2P network..."
          />
          <button
            onClick={postRumor}
            disabled={!newRumor.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded bg-cyan-500/30 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send className="w-4 h-4" />
            Broadcast
          </button>
        </div>

        {/* Registration Notice */}
        {account && !isRegistered && (
          <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
            <p className="text-sm">
              ⚠️ You must <strong>register</strong> to vote on rumors.
              {bootstrapSlotsLeft > 0
                ? ` ${bootstrapSlotsLeft} bootstrap slots remaining for free registration.`
                : ' Bootstrap period ended - you need an invite from an existing member.'}
            </p>
          </div>
        )}

        {/* Rumors Feed */}
        <div className="space-y-4">
          {rumors.map((r) => (
            <RumorCard
              key={r.id}
              id={r.id}
              text={r.text}
              time={r.time}
              votes={rumorVotes[r.id] || null}
              isConnected={!!account && isRegistered}
              isVoting={votingRumorId === r.id}
              onVerify={() => castVote(r.text, r.id, true)}
              onDispute={() => castVote(r.text, r.id, false)}
            />
          ))}
        </div>

        {rumors.length === 0 && (
          <div className="text-center py-16">
            <p className="text-cyan-500/50 mb-2">No rumors yet.</p>
            <p className="text-cyan-500/30 text-sm">Be the first to broadcast something.</p>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-cyan-500/20 text-center text-xs text-cyan-500/40">
          <p>ACRS - Anonymous Campus Rumor System</p>
          <p className="mt-1">Decentralized · Sybil-Resistant · Trust-Weighted</p>
        </footer>
      </div>
    </div>
  );
}
