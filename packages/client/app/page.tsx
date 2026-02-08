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
import { InvitePanel } from './components/InvitePanel';
import FloatingDock from './components/FloatingDock';
import DecryptingText from './components/DecryptingText';
import { Wallet, UserPlus, Send, AlertCircle, Clock, ChevronDown, ChevronUp, SkipForward } from 'lucide-react';

type Rumor = { id: string; text: string; time: number };

export default function Home() {
  // ── Wallet State ──
  const [account, setAccount] = useState<string | null>(null);
  const [trustScore, setTrustScore] = useState<number>(0);
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [bootstrapSlotsLeft, setBootstrapSlotsLeft] = useState<number>(0);

  // ── Rumor State ──
  const [rumors, setRumors] = useState<Rumor[]>([]);
  const [rumorVotes, setRumorVotes] = useState<Record<string, RumorVotes>>({});
  const [newRumor, setNewRumor] = useState('');

  // ── UI State ──
  const [votingRumorId, setVotingRumorId] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Epoch State ──
  const [currentEpoch, setCurrentEpoch] = useState(0);
  const [epochTimeLeft, setEpochTimeLeft] = useState(0);
  const [canAdvance, setCanAdvance] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // ── How It Works Toggle ──
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  // ═══════════════════════════════════════════════════════
  // CONTRACT HELPER
  // ═══════════════════════════════════════════════════════

  const getContract = useCallback(async (needsSigner = false) => {
    if (typeof window === 'undefined' || !window.ethereum) return null;
    const provider = new ethers.BrowserProvider(window.ethereum);
    const abi = Array.isArray(TrustGraphAbi)
      ? (TrustGraphAbi as unknown as ethers.InterfaceAbi)
      : (TrustGraphAbi as unknown as { abi: ethers.InterfaceAbi }).abi;
    if (needsSigner) {
      const signer = await provider.getSigner();
      return new ethers.Contract(contractAddress, abi, signer);
    }
    return new ethers.Contract(contractAddress, abi, provider);
  }, []);

  // ═══════════════════════════════════════════════════════
  // NETWORK SWITCH
  // ═══════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════
  // USER DATA
  // ═══════════════════════════════════════════════════════

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

  // ═══════════════════════════════════════════════════════
  // EPOCH DATA
  // ═══════════════════════════════════════════════════════

  const fetchEpochInfo = useCallback(async () => {
    try {
      const contract = await getContract();
      if (!contract) return;
      const [epoch, timeLeft, canAdv] = await Promise.all([
        contract.currentEpoch(),
        contract.timeUntilNextEpoch(),
        contract.canAdvanceEpoch(),
      ]);
      setCurrentEpoch(Number(epoch));
      setEpochTimeLeft(Number(timeLeft));
      setCanAdvance(canAdv);
    } catch (err) {
      console.error('Error fetching epoch:', err);
    }
  }, [getContract]);

  // ═══════════════════════════════════════════════════════
  // WALLET CONNECTION
  // ═══════════════════════════════════════════════════════

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet.');
      return;
    }
    setError(null);
    try {
      await switchToSepolia();
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const addr = accounts[0] as string;
      setAccount(addr);
      await fetchUserData(addr);
      await fetchEpochInfo();
    } catch (err) {
      console.error('Wallet connection error:', err);
      setError('Failed to connect wallet. Please try again.');
    }
  }, [fetchUserData, fetchEpochInfo]);

  // ═══════════════════════════════════════════════════════
  // REGISTRATION
  // ═══════════════════════════════════════════════════════

  const registerUser = useCallback(async () => {
    if (!account) return;
    setIsRegistering(true);
    setError(null);
    try {
      const contract = await getContract(true);
      if (!contract) return;
      const secret = ethers.randomBytes(32);
      const commitment = ethers.keccak256(secret);
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

  // ═══════════════════════════════════════════════════════
  // RUMOR VOTE DATA
  // ═══════════════════════════════════════════════════════

  const fetchRumorVotes = useCallback(async (rumorText: string, rumorId: string) => {
    try {
      const contract = await getContract();
      if (!contract) return;

      const rumorHash = ethers.id(rumorText);
      const [votes, score, canResolveResult, epoch] = await Promise.all([
        contract.getRumorVotes(rumorHash),
        contract.getRumorTrustScore(rumorHash),
        contract.canResolve(rumorHash),
        contract.currentEpoch(),
      ]);

      const [weightedTrue, weightedFalse, trueCount, falseCount] = votes;
      const epochNum = Number(epoch);
      const [resolved, consensus] = await contract.getRumorResolution(rumorHash, epochNum);

      let hasVotedResult = false;
      let hasClaimed = false;
      let votedWithConsensus = false;
      if (account) {
        const [voted, , claimed, vwc] = await contract.getVoterRewardStatus(rumorHash, epochNum, account);
        hasVotedResult = voted;
        hasClaimed = claimed;
        votedWithConsensus = vwc;
      }

      setRumorVotes(prev => ({
        ...prev,
        [rumorId]: {
          weightedTrue: Number(weightedTrue),
          weightedFalse: Number(weightedFalse),
          trueCount: Number(trueCount),
          falseCount: Number(falseCount),
          trustScore: Number(score),
          hasVoted: hasVotedResult,
          canResolve: canResolveResult,
          isResolved: resolved,
          consensus,
          hasClaimed,
          votedWithConsensus,
          epoch: epochNum,
        },
      }));
    } catch (err) {
      console.error('Error fetching rumor votes:', err);
    }
  }, [getContract, account]);

  // ═══════════════════════════════════════════════════════
  // P2P SUBSCRIPTION
  // ═══════════════════════════════════════════════════════

  useEffect(() => {
    if (!gun) return;
    gun.get('acrs-channel').map().on((data: { text?: string; time?: number } | null, id: string) => {
      if (data && data.text) {
        setRumors((prev) => {
          if (prev.find((r) => r.id === id)) return prev;
          const newRumor = { id, text: data.text ?? '', time: data.time ?? Date.now() };
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  // Handle MetaMask account switching
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on?.('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          setAccount(null);
          setTrustScore(0);
        } else {
          setAccount(accounts[0]);
          connectWallet();
        }
      });
    }
  }, [connectWallet]);

  // Epoch countdown timer
  useEffect(() => {
    if (epochTimeLeft <= 0) return;
    const interval = setInterval(() => {
      setEpochTimeLeft(prev => {
        if (prev <= 1) {
          setCanAdvance(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [epochTimeLeft]);

  // Periodic epoch info refresh
  useEffect(() => {
    if (!account) return;
    const interval = setInterval(fetchEpochInfo, 30000);
    return () => clearInterval(interval);
  }, [account, fetchEpochInfo]);

  // ═══════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════

  const postRumor = () => {
    if (!gun || !newRumor.trim()) return;
    gun.get('acrs-channel').set({ text: newRumor, time: Date.now() });
    setNewRumor('');
  };

  const castVote = async (rumorText: string, rumorId: string, isTrue: boolean) => {
    if (!account) { setError('Connect your wallet first.'); return; }
    if (!isRegistered) { setError('You must be registered to vote.'); return; }

    setVotingRumorId(rumorId);
    setError(null);
    try {
      const contract = await getContract(true);
      if (!contract) return;
      const rumorHash = ethers.id(rumorText);
      const tx = await contract.castVote(rumorHash, isTrue);
      await tx.wait();
      await fetchRumorVotes(rumorText, rumorId);
      await fetchUserData(account);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotRegistered')) setError('You must be registered to vote.');
      else if (msg.includes('AlreadyVoted')) { setError('You already voted on this rumor.'); await fetchRumorVotes(rumorText, rumorId); }
      else if (msg.includes('ZeroTrust')) setError('Your trust score is 0. You cannot vote.');
      else setError('Vote failed: ' + msg.slice(0, 80));
    } finally {
      setVotingRumorId(null);
    }
  };

  const resolveRumor = async (rumorText: string, rumorId: string) => {
    setError(null);
    try {
      const contract = await getContract(true);
      if (!contract) return;
      const rumorHash = ethers.id(rumorText);
      const tx = await contract.resolveRumor(rumorHash);
      await tx.wait();
      await fetchRumorVotes(rumorText, rumorId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('AlreadyResolved')) setError('Rumor already resolved.');
      else if (msg.includes('NotEnoughVotes')) setError('Not enough votes to resolve (need 2+).');
      else setError('Resolution failed: ' + msg.slice(0, 80));
    }
  };

  const claimReward = async (rumorText: string, rumorId: string, epoch: number) => {
    setError(null);
    try {
      const contract = await getContract(true);
      if (!contract) return;
      const rumorHash = ethers.id(rumorText);
      const tx = await contract.claimReward(rumorHash, epoch);
      await tx.wait();
      await fetchRumorVotes(rumorText, rumorId);
      if (account) await fetchUserData(account);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('AlreadyClaimed')) setError('Already claimed reward for this rumor.');
      else if (msg.includes('NotResolved')) setError('Rumor not resolved yet.');
      else setError('Claim failed: ' + msg.slice(0, 80));
    }
  };

  const advanceEpoch = async () => {
    setIsAdvancing(true);
    setError(null);
    try {
      const contract = await getContract(true);
      if (!contract) return;
      const tx = await contract.advanceEpoch();
      await tx.wait();
      await fetchEpochInfo();
      rumors.forEach(r => fetchRumorVotes(r.text, r.id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('EpochNotEndedYet')) setError('Epoch has not ended yet. Wait for the timer.');
      else setError('Failed to advance epoch: ' + msg.slice(0, 80));
    } finally {
      setIsAdvancing(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <div className="min-h-screen bg-oled text-text-primary selection:bg-accent-purple/30 font-mono">
      <div className="max-w-2xl mx-auto px-6 pt-12 pb-32">

        {/* ── Header ── */}
        <header className="mb-12 border-b border-white/5 pb-8">
          <div className="flex flex-wrap items-center justify-between gap-6 mb-6">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tighter mb-2 bg-gradient-to-b from-white to-text-secondary bg-clip-text text-transparent">
                ACRS
              </h1>
              <div className="flex items-center gap-2 text-xs font-mono text-accent-purple opacity-70 tracking-widest uppercase">
                <span className="animate-pulse">●</span> Campus Rumor Matrix
              </div>
            </div>

            <div className="flex items-center gap-4">
              {account ? (
                <div className="flex flex-col items-end gap-1.5">
                  <div className="px-4 py-2 rounded-full glass-dark border border-white/10 text-sm font-bold text-accent-purple transition-all hover:border-accent-purple/40">
                    TRUST: {trustScore}
                  </div>
                  <span className="text-[10px] text-text-secondary/60 font-mono tracking-tighter truncate max-w-[140px]">
                    {account}
                  </span>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  className="group flex items-center gap-2 px-6 py-3 rounded-xl bg-accent-purple/10 border border-accent-purple/30 text-accent-purple font-bold text-sm tracking-wide transition-all hover:bg-accent-purple/20 hover:scale-105 active:scale-95"
                >
                  <Wallet className="w-4 h-4" />
                  INITIALIZE_WALLET
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <ConnectionStatus />
            {account && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-[11px] text-text-secondary/60 font-mono uppercase tracking-widest">
                  <Clock className="w-3.5 h-3.5" />
                  EPOCH {currentEpoch}
                  <span className="opacity-40">|</span>
                  {epochTimeLeft > 0 ? `${formatTime(epochTimeLeft)}_UNTIL_SYNC` : 'SYNC_READY'}
                </div>
                {canAdvance && (
                  <button
                    onClick={advanceEpoch}
                    disabled={isAdvancing}
                    className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 transition-all disabled:opacity-30"
                  >
                    <SkipForward className="w-3 h-3" />
                    {isAdvancing ? 'SYNCING...' : 'ADVANCE'}
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ── Error Display ── */}
        {error && (
          <div className="flex items-center gap-3 mb-8 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-400 animate-in fade-in slide-in-from-top-4">
            <AlertCircle size={18} className="flex-shrink-0" />
            <p className="text-xs font-mono">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto opacity-40 hover:opacity-100 transition-opacity">×</button>
          </div>
        )}

        {/* ── Registration & Invites ── */}
        <div className="space-y-6 mb-12">
          {account && !isRegistered && (
            <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 glass-dark">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-amber-400 text-sm font-bold uppercase mb-1">Access Required</h3>
                  <p className="text-xs text-amber-200/60 leading-relaxed font-mono">
                    Node {account.slice(0, 6)} is not yet registered on the TrustGraph.
                    {bootstrapSlotsLeft > 0
                      ? `${bootstrapSlotsLeft} genesis slots remaining for autonomous entry.`
                      : 'Bootstrap phase depleted. Encrypted invite required for registration.'}
                  </p>
                </div>
                <button
                  onClick={registerUser}
                  disabled={isRegistering || (bootstrapSlotsLeft === 0)}
                  className="flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold text-xs hover:bg-amber-500/30 transition-all disabled:opacity-20"
                >
                  <UserPlus size={14} />
                  {isRegistering ? 'PROCESSING...' : 'REGISTER'}
                </button>
              </div>
            </div>
          )}

          {account && isRegistered && (
            <InvitePanel
              account={account}
              trustScore={trustScore}
              getContract={getContract}
              onInviteSuccess={() => fetchUserData(account)}
            />
          )}
        </div>

        {/* ── Rumor Feed ── */}
        <div className="space-y-6">
          {rumors.length > 0 ? (
            rumors.map((r) => (
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
                onResolve={() => resolveRumor(r.text, r.id)}
                onClaim={() => {
                  const v = rumorVotes[r.id];
                  if (v) claimReward(r.text, r.id, v.epoch);
                }}
              />
            ))
          ) : (
            <div className="py-32 text-center">
              <p className="text-text-secondary font-mono text-sm opacity-50">
                <DecryptingText text="Scanning P2P relay nodes for encrypted packets..." speed={30} />
              </p>
            </div>
          )}
        </div>

        {/* ── How It Works ── */}
        <div className="mt-20 border border-white/5 rounded-2xl overflow-hidden glass-dark">
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="w-full flex items-center justify-between p-5 text-left text-text-secondary hover:bg-white/5 transition-colors"
          >
            <span className="font-bold text-xs uppercase tracking-widest">Protocol Documentation</span>
            {showHowItWorks ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showHowItWorks && (
            <div className="px-6 pb-6 space-y-4 text-xs text-text-secondary/70 font-mono leading-relaxed">
              <div>
                <h4 className="font-bold text-accent-purple mb-1">01_SYBIL_RESISTANCE</h4>
                <p>Invitations require a 5-point trust stake. Bot farms deplete the inviter's influence. Quadratic weighting makes mass account creation self-defeating.</p>
              </div>
              <div>
                <h4 className="font-bold text-accent-purple mb-1">02_PSEUDONYMOUS_VOID</h4>
                <p>Zero identity collection. Nullifiers prevent double-voting without linking packets to physical identities.</p>
              </div>
              <div>
                <h4 className="font-bold text-accent-purple mb-1">03_QUADRATIC_WEIGHTING</h4>
                <p>Weight = √(Trust). Quality of participation over quantity of accounts. Veteran nodes hold more sway than the mob.</p>
              </div>
              <div>
                <h4 className="font-bold text-accent-purple mb-1">04_EPOCH_ISOLATION</h4>
                <p>Consensus is scoped by time. Historical tallies are immutable, preventing retroactive truth manipulation.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="mt-16 pt-8 border-t border-white/5 text-center">
          <p className="text-[10px] font-mono text-text-secondary/30 uppercase tracking-[0.2em]">
            ACRS // Anonymous Campus Rumor System
          </p>
          <p className="mt-2 text-[8px] font-mono text-text-secondary/20 uppercase tracking-[0.1em]">
            Permissionless · Trust-Weighted · Fully Decentralized
          </p>
        </footer>
      </div>

      <FloatingDock
        account={account}
        trustScore={trustScore}
        onConnect={connectWallet}
        onPost={postRumor}
        inputValue={newRumor}
        onInputChange={setNewRumor}
      />

      {/* Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
    </div>
  );
}

