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
          setIsRegistered(false);
        } else {
          setAccount(accounts[0]);
          fetchUserData(accounts[0]);
        }
      });
    }
  }, [fetchUserData]);

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
    <div className="min-h-screen bg-[#0a0a0f] text-cyan-100 font-mono">
      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <header className="mb-8 pb-6 border-b border-cyan-500/30">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold tracking-wider text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
                ACRS // Campus Gossip
              </h1>
              <p className="text-sm text-cyan-200/60 mt-1">P2P Rumor Feed · TrustGraph Verified · No Admin</p>
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
                    <button onClick={registerUser} disabled={isRegistering}
                      className="flex items-center gap-2 px-4 py-2 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 font-medium transition-all disabled:opacity-50">
                      <UserPlus className="w-4 h-4" />
                      {isRegistering ? 'Registering...' : `Register (${bootstrapSlotsLeft} slots)`}
                    </button>
                  )}
                </>
              ) : (
                <button onClick={connectWallet}
                  className="flex items-center gap-2 px-5 py-2.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-medium transition-all hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]">
                  <Wallet className="w-4 h-4" />
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <ConnectionStatus />
            {account && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-cyan-500/60" />
                <span className="text-xs text-cyan-500/60">
                  Epoch {currentEpoch}
                  {epochTimeLeft > 0 ? ` · ${formatTime(epochTimeLeft)} left` : ' · Ready to advance'}
                </span>
                {canAdvance && (
                  <button onClick={advanceEpoch} disabled={isAdvancing}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 disabled:opacity-50 transition-colors">
                    <SkipForward className="w-3 h-3" />
                    {isAdvancing ? '...' : 'Advance'}
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ── Error Display ── */}
        {error && (
          <div className="flex items-center gap-2 mb-6 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
            <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-300">×</button>
          </div>
        )}

        {/* ── Rumor Input ── */}
        <div className="flex gap-2 mb-8">
          <input
            className="flex-1 bg-[#0d0d14] border border-cyan-500/30 rounded px-4 py-3 text-cyan-100 placeholder-cyan-500/50 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40"
            value={newRumor} onChange={(e) => setNewRumor(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && postRumor()}
            placeholder="What's the tea? Broadcast to P2P network..."
          />
          <button onClick={postRumor} disabled={!newRumor.trim()}
            className="flex items-center gap-2 px-5 py-3 rounded bg-cyan-500/30 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            <Send className="w-4 h-4" /> Broadcast
          </button>
        </div>

        {/* ── Registration Notice ── */}
        {account && !isRegistered && (
          <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200">
            <p className="text-sm">
              You must <strong>register</strong> to vote on rumors.
              {bootstrapSlotsLeft > 0
                ? ` ${bootstrapSlotsLeft} bootstrap slots remaining for free registration.`
                : ' Bootstrap period ended — you need an invite from an existing member.'}
            </p>
          </div>
        )}

        {/* ── Invite Panel ── */}
        {account && isRegistered && (
          <InvitePanel account={account} trustScore={trustScore} getContract={getContract} onInviteSuccess={() => fetchUserData(account)} />
        )}

        {/* ── Rumor Feed ── */}
        <div className="space-y-4">
          {rumors.map((r) => (
            <RumorCard
              key={r.id} id={r.id} text={r.text} time={r.time}
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
          ))}
        </div>

        {rumors.length === 0 && (
          <div className="text-center py-16">
            <p className="text-cyan-500/50 mb-2">No rumors yet.</p>
            <p className="text-cyan-500/30 text-sm">Be the first to broadcast something.</p>
          </div>
        )}

        {/* ── How It Works ── */}
        <div className="mt-10 border border-cyan-500/20 rounded-lg overflow-hidden">
          <button onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="w-full flex items-center justify-between p-4 text-left text-cyan-400 hover:bg-cyan-500/5 transition-colors">
            <span className="font-semibold text-sm">How It Works — Edge Cases Covered</span>
            {showHowItWorks ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showHowItWorks && (
            <div className="px-4 pb-4 space-y-3 text-sm text-cyan-200/70">
              <div>
                <h4 className="font-medium text-cyan-300">1. Bot Accounts (Sybil Resistance)</h4>
                <p>Each invite costs 5 trust points. Creating bots depletes the inviter&apos;s influence. Quadratic voting means 10 bots with trust 10 have less power than 1 honest user with trust 100.</p>
              </div>
              <div>
                <h4 className="font-medium text-cyan-300">2. Double Voting (Without Collecting Identities)</h4>
                <p>Per-address, per-rumor, per-epoch nullifier prevents double votes. Ethereum addresses are pseudonymous — no names, emails, or IDs collected.</p>
              </div>
              <div>
                <h4 className="font-medium text-cyan-300">3. Popular Lies Shouldn&apos;t Auto-Win</h4>
                <p>Quadratic voting: weight = √(trust). High-trust veteran voters have more influence than a mob of new accounts. Quality over quantity.</p>
              </div>
              <div>
                <h4 className="font-medium text-cyan-300">4. Historical Scores Changing</h4>
                <p>Epoch isolation: each epoch&apos;s votes are stored independently. Past tallies are frozen and immutable — verified facts from last month can&apos;t change.</p>
              </div>
              <div>
                <h4 className="font-medium text-cyan-300">5. Ghost Rumor Bug</h4>
                <p>Epoch-scoped storage: votes keyed by (rumorHash, epoch). Deleting a rumor off-chain has zero effect on on-chain data. No cross-contamination.</p>
              </div>
              <div>
                <h4 className="font-medium text-cyan-300">6. No Central Authority</h4>
                <p>All functions are permissionless — no admin, no owner. Epochs advance by time (anyone can trigger). Trust adjusts via community consensus, not admin decree.</p>
              </div>
              <div>
                <h4 className="font-medium text-cyan-300">7. Mathematical Proof (Sybil Attack Cost)</h4>
                <p>Creating K fake accounts costs 5K trust. Each fake has weight √10 ≈ 3.16. After 10 consensus rounds of voting wrong, they hit 0 trust and are expelled. Meanwhile honest users grow to max trust. Attack is self-defeating. ∎</p>
              </div>
              <div>
                <h4 className="font-medium text-cyan-300">8. Trust Growth & Decay</h4>
                <p>After a rumor is resolved by community consensus, voters aligned with majority gain +2 trust, voters against lose -1 trust. Honest participation is rewarded; liars are gradually expelled.</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <footer className="mt-12 pt-6 border-t border-cyan-500/20 text-center text-xs text-cyan-500/40">
          <p>ACRS — Anonymous Campus Rumor System</p>
          <p className="mt-1">Decentralized · Sybil-Resistant · Trust-Weighted · No Admin</p>
        </footer>
      </div>
    </div>
  );
}
