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
import RumorCard from './components/RumorCard';
import FloatingDock from './components/FloatingDock';
import DecryptingText from './components/DecryptingText';

type Rumor = { id: string; text: string; time: number };

export default function Home() {
  const [rumors, setRumors] = useState<Rumor[]>([]);
  const [newRumor, setNewRumor] = useState('');
  const [account, setAccount] = useState<string | null>(null);
  const [trustScore, setTrustScore] = useState<number>(0);
  const [votingRumorId, setVotingRumorId] = useState<string | null>(null);

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

  const connectWallet = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet.');
      return;
    }
    await switchToSepolia();
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    const addr = accounts[0] as string;
    setAccount(addr);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(contractAddress, TrustGraphAbi.abi, provider);
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

  const postRumor = (text: string) => {
    if (!gun || !text.trim()) return;
    const rumor = { text, time: Date.now() };
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
      const contract = new ethers.Contract(contractAddress, TrustGraphAbi.abi, signer);
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
    <div className="min-h-screen bg-oled text-text-primary selection:bg-accent-purple/30">
      <div className="max-w-xl mx-auto px-6 pt-16 pb-32">
        <header className="mb-12 text-center">
          <h1 className="text-4xl font-extrabold tracking-tighter mb-2 bg-gradient-to-b from-white to-text-secondary bg-clip-text text-transparent">
            ACRS
          </h1>
          <div className="flex items-center justify-center gap-2 text-xs font-mono text-accent-purple opacity-70 tracking-widest uppercase">
            <span className="animate-pulse">●</span> Anonymous Campus Rumor System
          </div>
        </header>

        <div className="space-y-6">
          {rumors.length > 0 ? (
            rumors.map((r) => (
              <RumorCard
                key={r.id}
                rumor={r}
                onVote={castVote}
                isVoting={votingRumorId === r.id}
              />
            ))
          ) : (
            <div className="py-24 text-center">
              <p className="text-text-secondary font-mono text-sm">
                <DecryptingText text="Scanning P2P network for rumors..." />
              </p>
            </div>
          )}
        </div>
      </div>

      <FloatingDock
        account={account}
        trustScore={trustScore}
        onConnect={connectWallet}
        onPost={postRumor}
        inputValue={newRumor}
        onInputChange={setNewRumor}
      />

      {/* Grid Overlay for aesthetic */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
    </div>
  );
}

