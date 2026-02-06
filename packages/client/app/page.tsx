'use client';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string }) => Promise<string[]>;
      on?: (event: string, cb: (accounts: string[]) => void) => void;
    };
  }
}

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import gun from '@/src/lib/gun';
import TrustGraphAbi from '@/src/lib/TrustGraph.json';
import { TRUST_GRAPH_ADDRESS } from '@/src/lib/contractAddress';

type Rumor = { id: string; text: string; time: number };

export default function Home() {
  const [rumors, setRumors] = useState<Rumor[]>([]);
  const [newRumor, setNewRumor] = useState('');
  const [account, setAccount] = useState<string | null>(null);
  const [trustScore, setTrustScore] = useState<number>(0);
  const [votingRumorId, setVotingRumorId] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet.');
      return;
    }
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    const addr = accounts[0] as string;
    setAccount(addr);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(TRUST_GRAPH_ADDRESS, TrustGraphAbi as ethers.InterfaceAbi, provider);
      const score = await contract.trustScore(addr);
      setTrustScore(Number(score));
    } catch {
      setTrustScore(0);
    }
  }, []);

  useEffect(() => {
    if (!gun) return;
    gun.get('acrs-channel').map().on((data: { text?: string; time?: number } | null, id: string) => {
      if (data && data.text) {
        setRumors((prev) => {
          if (prev.find((r) => r.id === id)) return prev;
          return [{ id, text: data.text ?? '', time: data.time ?? Date.now() }, ...prev];
        });
      }
    });
  }, []);

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

  const postRumor = () => {
    if (!gun) return;
    const rumor = { text: newRumor, time: Date.now() };
    gun.get('acrs-channel').set(rumor);
    setNewRumor('');
  };

  const castVote = async (rumorText: string, rumorId: string, isTrue: boolean) => {
    if (!account || typeof window === 'undefined' || !window.ethereum) {
      alert('Connect your wallet first.');
      return;
    }

    const rumorHash = ethers.id(rumorText);
    setVotingRumorId(rumorId);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(TRUST_GRAPH_ADDRESS, TrustGraphAbi as ethers.InterfaceAbi, signer);
      await contract.castVote(rumorHash, isTrue);

      const score = await contract.trustScore(account);
      setTrustScore(Number(score));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotRegistered')) alert('You must be invited to vote.');
      else if (msg.includes('AlreadyVoted')) alert('You already voted on this rumor.');
      else alert('Vote failed: ' + msg.slice(0, 80));
    } finally {
      setVotingRumorId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-cyan-100 font-mono">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-cyan-500/30">
          <div>
            <h1 className="text-2xl font-bold tracking-wider text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
              ACRS // Campus Gossip
            </h1>
            <p className="text-sm text-cyan-200/60 mt-1">P2P Rumor Feed · TrustGraph Verified</p>
          </div>
          <div className="flex items-center gap-4">
            {account ? (
              <>
                <span className="px-3 py-1.5 rounded bg-cyan-500/20 text-cyan-300 text-sm border border-cyan-500/40">
                  Trust Score: {trustScore}
                </span>
                <span className="text-xs text-cyan-200/50 truncate max-w-[120px]">{account}</span>
              </>
            ) : (
              <button
                onClick={connectWallet}
                className="px-5 py-2.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 font-medium transition-all hover:shadow-[0_0_12px_rgba(34,211,238,0.3)]"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </header>

        <div className="flex gap-2 mb-8">
          <input
            className="flex-1 bg-[#0d0d14] border border-cyan-500/30 rounded px-4 py-3 text-cyan-100 placeholder-cyan-500/50 focus:outline-none focus:border-cyan-400/60 focus:ring-1 focus:ring-cyan-400/40"
            value={newRumor}
            onChange={(e) => setNewRumor(e.target.value)}
            placeholder="What's the tea? Broadcast to P2P network..."
          />
          <button
            onClick={postRumor}
            disabled={!newRumor.trim()}
            className="px-5 py-3 rounded bg-cyan-500/30 hover:bg-cyan-500/40 border border-cyan-400/50 text-cyan-200 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Broadcast
          </button>
        </div>

        <div className="space-y-4">
          {rumors.map((r) => (
            <article
              key={r.id}
              className="rounded-lg border border-cyan-500/20 bg-[#0d0d14] p-5 hover:border-cyan-500/40 transition-colors"
            >
              <p className="text-cyan-100 leading-relaxed mb-4">{r.text}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-cyan-500/70">
                  {new Date(r.time).toLocaleTimeString()} · P2P
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => castVote(r.text, r.id, true)}
                    disabled={!account || votingRumorId === r.id}
                    className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Verify
                  </button>
                  <button
                    onClick={() => castVote(r.text, r.id, false)}
                    disabled={!account || votingRumorId === r.id}
                    className="px-3 py-1.5 rounded text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Dispute
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {rumors.length === 0 && (
          <p className="text-center text-cyan-500/50 py-12">No rumors yet. Be the first to broadcast.</p>
        )}
      </div>
    </div>
  );
}
