/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Delete, History, Zap, Settings2, Menu, X, Book, ChevronRight, Maximize2, Search, Sun, Moon, Atom, Thermometer, RefreshCw, Binary, Hash, Cpu, ShieldCheck, Scale, Heart } from 'lucide-react';
import { create, all } from 'mathjs';

const math = create(all);

const COMMON_FUNCTIONS = [
  // Algebra & Basic
  'abs', 'ceil', 'floor', 'round', 'sqrt', 'cbrt', 'exp', 'log', 'log10', 'sign',
  // Trigonometry
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sec', 'csc', 'cot',
  // Probability & Stats
  'factorial', 'random', 'mean', 'median', 'mode', 'std', 'var', 'sum', 'prod',
  // Matrix & Vector
  'det', 'inv', 'transpose', 'dot', 'cross', 'norm',
  // Bitwise
  'bitAnd', 'bitOr', 'bitXor', 'bitNot', 'leftShift', 'rightShift',
  // Constants
  'pi', 'e', 'phi', 'tau', 'i'
];

const PHYSICAL_CONSTANTS = [
  { name: 'c', val: '299792458', desc: 'Speed of Light (m/s)' },
  { name: 'G', val: '6.6743e-11', desc: 'Gravitational Constant (m³/kg·s²)' },
  { name: 'h', val: '6.62607015e-34', desc: 'Planck Constant (J·s)' },
  { name: 'k', val: '1.380649e-23', desc: 'Boltzmann Constant (J/K)' },
  { name: 'Na', val: '6.02214076e23', desc: 'Avogadro Constant (mol⁻¹)' },
  { name: 'R', val: '8.314462618', desc: 'Molar Gas Constant (J/mol·K)' },
  { name: 'me', val: '9.1093837e-31', desc: 'Electron Mass (kg)' },
  { name: 'mp', val: '1.6726219e-27', desc: 'Proton Mass (kg)' },
];

type Operator = '+' | '-' | '*' | '/' | null;

export default function App() {
  // Crunch Mode State
  const [activeOverlay, setActiveOverlay] = useState<'log' | 'vars' | 'funcs' | 'history' | 'constants' | 'settings' | 'bits' | 'privacy'>('log');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfirmingAC, setIsConfirmingAC] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [crunchInput, setCrunchInput] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  
  // Settings State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('crunch_theme');
    return (saved as any) || 'light';
  });
  const [trigMode, setTrigMode] = useState<'deg' | 'rad' | 'grad'>(() => {
    const saved = localStorage.getItem('crunch_trig');
    return (saved as any) || 'rad';
  });
  const [precision, setPrecision] = useState<number>(() => {
    const saved = localStorage.getItem('crunch_precision');
    return saved ? parseInt(saved) : 8;
  });
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('crunch_haptics');
    return saved !== 'false'; // Default to true
  });
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [bitfieldValue, setBitfieldValue] = useState<bigint>(0n);
  const [bitSize, setBitSize] = useState<8 | 16 | 32 | 64>(32);
  const [displayBase, setDisplayBase] = useState<'dec' | 'hex' | 'bin' | 'oct'>('dec');
  const [crunchHistory, setCrunchHistory] = useState<{ expr: string; result: string }[]>(() => {
    const saved = localStorage.getItem('crunch_history');
    return saved ? JSON.parse(saved) : [];
  });
  
  const inputRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const panRef = useRef(0);

  // MathJS computation scope
  const [scope, setScope] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem('crunch_scope');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return {};
      }
    }
    return {};
  });

  // Persist history, scope, and settings
  useEffect(() => {
    localStorage.setItem('crunch_history', JSON.stringify(crunchHistory.slice(-50)));
  }, [crunchHistory]);

  useEffect(() => {
    localStorage.setItem('crunch_scope', JSON.stringify(scope));
  }, [scope]);

  useEffect(() => {
    localStorage.setItem('crunch_theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('crunch_trig', trigMode);
  }, [trigMode]);

  useEffect(() => {
    localStorage.setItem('crunch_precision', precision.toString());
  }, [precision]);

  useEffect(() => {
    localStorage.setItem('crunch_haptics', hapticsEnabled.toString());
  }, [hapticsEnabled]);

  const fetchWithFallback = async (manual = false) => {
    const lastFetch = localStorage.getItem('crunch_rates_ts');
    const now = Date.now();
    
    // Rate limiter: 10 minutes (600,000 ms) for manual sync
    if (manual && lastFetch && (now - parseInt(lastFetch) < 10 * 60 * 1000)) {
      setIsSyncing(true);
      setTimeout(() => setIsSyncing(false), 500);
      return;
    }

    if (manual) setIsSyncing(true);
    
    const applyRates = (rates: Record<string, number>) => {
      setExchangeRates(rates);
      const unitExists = (name: string) => {
        try { math.unit(name); return true; } catch (e) { return false; }
      };

      try {
        if (!unitExists('usd')) math.createUnit('usd');
        Object.entries(rates).forEach(([currency, rate]) => {
          const lower = currency.toLowerCase();
          if (!unitExists(lower)) {
            math.createUnit(lower, { definition: `${1/rate} usd`, aliases: [currency] });
          }
        });
      } catch (e) { console.warn("MathJS units registration warning", e); }
    };

    const apis = [
      'https://open.er-api.com/v6/latest/USD',
      'https://api.frankfurter.app/latest?from=USD'
    ];
    
    let success = false;
    for (const url of apis) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const data = await res.json();
        const rates = data.rates;
        if (rates) {
          applyRates(rates);
          localStorage.setItem('crunch_rates', JSON.stringify(rates));
          localStorage.setItem('crunch_rates_ts', now.toString());
          success = true;
          break;
        }
      } catch (e) { console.warn(`Failed to fetch from ${url}`, e); }
    }
    
    if (!success && manual) {
      // If manual sync fails and no previous rates, use fallback
      const fallbackRates = { EUR: 0.93, GBP: 0.80, INR: 83.5, JPY: 154.0, CAD: 1.38, AUD: 1.53, CHF: 0.91 };
      applyRates(fallbackRates);
    }

    if (manual) {
      setTimeout(() => setIsSyncing(false), 800);
    }
  };

  // Fetch Currency Rates once per day
  useEffect(() => {
    const lastFetch = localStorage.getItem('crunch_rates_ts');
    const savedRates = localStorage.getItem('crunch_rates');
    const now = Date.now();
    
    if (lastFetch && savedRates && (now - parseInt(lastFetch) < 24 * 60 * 60 * 1000)) {
      // Re-register units from saved rates
      const rates = JSON.parse(savedRates);
      setExchangeRates(rates);
      const unitExists = (name: string) => {
        try { math.unit(name); return true; } catch (e) { return false; }
      };
      try {
        if (!unitExists('usd')) math.createUnit('usd');
        Object.entries(rates).forEach(([currency, rate]: [string, any]) => {
          const lower = currency.toLowerCase();
          if (!unitExists(lower)) {
            math.createUnit(lower, { definition: `${1/rate} usd`, aliases: [currency] });
          }
        });
      } catch (e) {}
    } else {
      fetchWithFallback();
    }
  }, []);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.scrollLeft = inputRef.current.scrollWidth;
    }
  }, [crunchInput]);

  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [crunchHistory]);

  const suggestions = useMemo(() => {
    // Only match alphabetic characters at the end of the input
    const match = crunchInput.match(/[a-zA-Z]+$/);
    const lastWord = match ? match[0] : '';
    if (!lastWord || lastWord.length < 1) return [];
    
    const combinedSuggestions = [...COMMON_FUNCTIONS, ...Object.keys(scope), ...Object.keys(exchangeRates).map(c => c.toLowerCase())];
    return Array.from(new Set(combinedSuggestions)).filter(f => 
      f.startsWith(lastWord.toLowerCase()) && f !== lastWord.toLowerCase()
    ).slice(0, 8);
  }, [crunchInput, scope, exchangeRates]);

  const applySuggestion = (sug: string) => {
    triggerHaptic('light');
    // We assume suggestions always happen at the end or based on the word under cursor
    // For simplicity with this current UI, let's keep it based on full crunchInput match
    // but update cursorPos to the end
    const lastWordMatch = crunchInput.match(/[a-zA-Z]+$/);
    const base = lastWordMatch 
      ? crunchInput.slice(0, crunchInput.length - lastWordMatch[0].length)
      : crunchInput;
      
    const isConst = ['pi', 'e', 'phi', 'tau', 'i'].includes(sug) || 
                   (scope && scope[sug] !== undefined) || 
                   (exchangeRates && exchangeRates[sug.toUpperCase()] !== undefined);
    const newValue = base + sug + (isConst ? '' : '(');
    setCrunchInput(newValue);
    setCursorPos(newValue.length);
  };

  const triggerHaptic = (style: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!hapticsEnabled || !window.navigator.vibrate) return;
    
    switch (style) {
      case 'light': window.navigator.vibrate(10); break;
      case 'medium': window.navigator.vibrate(25); break;
      case 'heavy': window.navigator.vibrate([20, 40, 20]); break;
    }
  };

  const [validationError, setValidationError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  const isInputValid = useMemo(() => {
    if (!crunchInput.trim()) {
      setValidationError(null);
      return true;
    }
    try {
      math.parse(crunchInput);
      setValidationError(null);
      return true;
    } catch (e: any) {
      setValidationError(e.message || 'Invalid syntax');
      return false;
    }
  }, [crunchInput]);

  useEffect(() => {
    setShowError(false);
  }, [crunchInput]);

  const inputFontSize = useMemo(() => {
    const len = crunchInput.length;
    if (len < 15) return '1.25rem'; // text-xl
    if (len < 22) return '1.125rem'; // text-lg
    if (len < 30) return '1rem'; // text-base
    if (len < 40) return '0.875rem'; // text-sm
    return '0.75rem'; // text-xs
  }, [crunchInput]);

  // Logic Helpers
  const insertAtCursor = (text: string) => {
    triggerHaptic('light');
    const start = crunchInput.slice(0, cursorPos);
    const end = crunchInput.slice(cursorPos);
    const newVal = start + text + end;
    setCrunchInput(newVal);
    setCursorPos(cursorPos + text.length);
  };

  const deleteAtCursor = () => {
    if (cursorPos === 0) return;
    const start = crunchInput.slice(0, cursorPos - 1);
    const end = crunchInput.slice(cursorPos);
    setCrunchInput(start + end);
    setCursorPos(cursorPos - 1);
  };

  const clearAll = () => {
    setCrunchInput('');
    setCursorPos(0);
  };

  const handleNumber = (num: string) => {
    insertAtCursor(num);
  };

  const handleDecimal = () => {
    const currentPart = crunchInput.slice(0, cursorPos).split(/[^0-9.]/).pop() || '';
    if (!currentPart.includes('.')) insertAtCursor('.');
  };

  const handleCrunchEval = () => {
    triggerHaptic('medium');
    if (!crunchInput) return;
    try {
      const constantsScope: Record<string, any> = {};
      PHYSICAL_CONSTANTS.forEach(c => {
        constantsScope[c.name] = math.evaluate(c.val);
      });

      // Special handling for trig modes
      // We wrap trig functions in the local scope to apply the trig factor
      const trigFunctions = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'];
      const trigScope: Record<string, any> = {};
      
      if (trigMode !== 'rad') {
        const factor = trigMode === 'deg' ? Math.PI / 180 : Math.PI / 200;
        trigFunctions.forEach(fn => {
          trigScope[fn] = (x: any) => math[fn](math.multiply(x, factor));
        });
        
        // Inverse trig functions
        const invTrig = { asin: 'asin', acos: 'acos', atan: 'atan' };
        Object.entries(invTrig).forEach(([fn, raw]) => {
          trigScope[fn] = (x: any) => math.divide(math[raw](x), factor);
        });
      }

      const evalScope = { ...constantsScope, ...trigScope, ...scope };
      const res = math.evaluate(crunchInput, evalScope);
      
      // Update bitfield if result is numeric
      if (typeof res === 'number') {
        setBitfieldValue(BigInt(Math.floor(res)));
      } else if (typeof res === 'bigint') {
        setBitfieldValue(res);
      }

      let formattedRes = '';
      if (typeof res === 'number') {
        if (displayBase === 'hex') formattedRes = '0x' + res.toString(16).toUpperCase();
        else if (displayBase === 'bin') formattedRes = '0b' + res.toString(2);
        else if (displayBase === 'oct') formattedRes = '0o' + res.toString(8);
        else formattedRes = Number(res.toFixed(precision)).toString();
      } else {
        formattedRes = res && res.toString ? res.toString() : String(res);
      }
      
      setCrunchHistory(prev => [...prev, { expr: crunchInput, result: formattedRes }]);
      setCrunchInput(formattedRes);
      setCursorPos(formattedRes.length);
      
      // Update scope if an assignment happened
      const assignmentMatch = crunchInput.match(/^\s*([a-zA-Z][a-zA-Z0-9]*)\s*=/);
      if (assignmentMatch) {
        const varName = assignmentMatch[1];
        setScope(prev => ({ ...prev, [varName]: res }));
      }
    } catch (err) {
      setShowError(true);
      setCrunchHistory(prev => [...prev, { expr: crunchInput, result: 'Error' }]);
    }
  };

  const handleOperator = (op: Operator) => {
    const sym = op === '*' ? '*' : op === '/' ? '/' : op;
    insertAtCursor(` ${sym} `);
  };

  const deleteLast = () => {
    triggerHaptic('light');
    deleteAtCursor();
  };

  const moveCursorLeft = () => setCursorPos(p => Math.max(0, p - 1));
  const moveCursorRight = () => setCursorPos(p => Math.min(crunchInput.length, p + 1));

  const toggleBit = (index: number) => {
    const newValue = bitfieldValue ^ (1n << BigInt(index));
    // Mask based on bitSize
    const mask = (1n << BigInt(bitSize)) - 1n;
    const maskedValue = newValue & mask;
    
    setBitfieldValue(maskedValue);
    const valString = maskedValue.toString();
    setCrunchInput(valString);
    setCursorPos(valString.length);
  };

  const BitField = () => {
    const totalBits = 64;
    const bitsPerRow = 8;
    const rows = [];
    
    for (let r = 0; r < 8; r++) {
      const rowBits = [];
      const rowStartBit = totalBits - (r * bitsPerRow) - 1;
      
      for (let i = rowStartBit; i > rowStartBit - bitsPerRow; i--) {
        const isOn = (bitfieldValue & (1n << BigInt(i))) !== 0n;
        const isDisabled = i >= bitSize;
        const showLabel = i % 4 === 0;
        
        rowBits.push(
          <div key={i} className="flex flex-col items-center relative flex-1">
            <motion.button
              whileTap={isDisabled ? {} : { scale: 0.8 }}
              onClick={() => !isDisabled && toggleBit(i)}
              disabled={isDisabled}
              className={`text-[14px] font-mono font-bold py-1 w-full text-center transition-all ${
                isDisabled 
                  ? 'text-slate-300 opacity-30 cursor-not-allowed' 
                  : isOn 
                    ? 'text-blue-600' 
                    : 'text-slate-900 hover:text-blue-400'
              }`}
            >
              {isOn ? '1' : '0'}
            </motion.button>
            {showLabel && (
              <span className={`text-[7px] font-black absolute top-7 w-full text-center tracking-tighter ${isDisabled ? 'text-slate-200' : 'text-slate-400'}`}>
                {i}
              </span>
            )}
          </div>
        );
      }
      rows.push(
        <div key={r} className="flex justify-between items-start h-10 border-b border-slate-100 last:border-0">
          {rowBits}
        </div>
      );
    }

    return (
      <div className="flex flex-col bg-[#F3F4F6] p-4 h-full overflow-hidden">
        <div className="flex justify-between items-start mb-4 shrink-0">
          <div className="flex flex-col">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-800">Visual Bitfield</h2>
            <div className="flex flex-col gap-1 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-slate-400 uppercase w-6">Hex</span>
                <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded shadow-sm">0x{bitfieldValue.toString(16).toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-bold text-slate-400 uppercase w-6">Dec</span>
                <span className="text-[10px] font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded shadow-sm">{bitfieldValue.toString()}</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
             <button 
              onClick={() => setActiveOverlay('log')}
              className="p-1 px-3 rounded-lg border border-slate-200 text-slate-400 hover:bg-white transition-colors text-[9px] font-bold uppercase tracking-widest bg-white/50"
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex bg-white rounded-xl p-1 shadow-sm gap-1 mb-4 shrink-0">
          {[64, 32, 16, 8].map(size => (
            <button
              key={size}
              onClick={() => setBitSize(size as any)}
              className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${
                bitSize === size 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              {size} BIT
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col gap-1 grow overflow-hidden">
          {rows}
        </div>
      </div>
    );
  };

  const PrivacyOverlay = () => (
    <div className="flex flex-col bg-white h-full overflow-y-auto custom-scrollbar">
      <div className="sticky top-0 bg-white p-6 border-b border-slate-100 flex justify-between items-center z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">Privacy & License</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Legal Documentation</p>
          </div>
        </div>
        <button 
          onClick={() => setActiveOverlay('log')}
          className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-6 space-y-8">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-blue-600">
            <ShieldCheck size={16} />
            <h3 className="text-[11px] font-black uppercase tracking-wider">Privacy Statement</h3>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              We take your data privacy seriously. **Crunch Calculator does not collect, track, or share your personal data.**
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  **Local Processing:** All calculations, history, and variables are stored exclusively on your device (LocalStorage).
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  **Network Usage:** The only network requests made by this app are to public currency conversion APIs (OpenER API / Frankfurter) to fetch real-time exchange rates.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  **No Analytics:** There are no trackers, cookies, or analytics scripts capturing your usage patterns.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-purple-600">
            <Scale size={16} />
            <h3 className="text-[11px] font-black uppercase tracking-wider">Open Source License</h3>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-black rounded uppercase">GPL-3.0</span>
              <span className="text-[10px] font-bold text-slate-400">GNU General Public License</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              This software is released under the GPL. You are free to use, modify, and redistribute this software, provided that any derivative works are also released under the same license.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-[9px] font-bold text-slate-400 uppercase italic">
                "Software for the people, by the people."
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-red-500">
            <Heart size={16} fill="currentColor" />
            <h3 className="text-[11px] font-black uppercase tracking-wider">Human Kindness Protocol</h3>
          </div>
          <div className="bg-red-50/50 p-4 rounded-2xl border border-red-100 italic shrink-0">
            <p className="text-xs text-red-800 leading-relaxed font-medium">
              By using this application, you agree to the "Kindness Covenant": You promise to be a kind human being, treat others with respect, and spread positivity whenever possible in your interactions.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">— The Crunch Philosophy</span>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-auto p-8 text-center bg-slate-50/50">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Crunch Workspace Precision v1.1</p>
      </div>
    </div>
  );

  const btnBase = "flex items-center justify-center text-2xl font-normal transition-all duration-200 cursor-pointer select-none active:opacity-70 h-[60px]";
  const numBtn = `${btnBase} bg-white text-[#111827] rounded-full aspect-square`;
  const actionBtn = `${btnBase} bg-[#F3F4F6] text-[#6B7280] font-medium rounded-full aspect-square`;
  const opBtn = `${btnBase} bg-[#4B5563] text-white rounded-full aspect-square`;

  const Button = ({ children, onClick, className }: any) => (
    <motion.button whileTap={{ scale: 0.95 }} className={className} onClick={onClick}>
      {children}
    </motion.button>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative font-sans overflow-hidden">
      {/* Phone Mockup */}
      <div className="w-[320px] h-[650px] bg-white rounded-[44px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] relative overflow-hidden flex flex-col border-[8px] border-[#1F2937]">
        
        {/* Status Bar */}
        <div className="h-[44px] flex justify-between items-center px-6 text-[12px] font-semibold text-[var(--text-primary)]">
          <span>9:41</span>
          <div className="flex gap-1.5 items-center">
             {Object.keys(exchangeRates).length > 0 && (
               <div className="px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/30 text-[8px] font-black text-blue-600 uppercase tracking-tighter" title="Currency Rates Active">
                  FX
               </div>
             )}
             <div className="px-1.5 py-0.5 rounded-md bg-orange-100 dark:bg-orange-900/30 text-[8px] font-black text-orange-600 uppercase tracking-tighter">
                {trigMode}
             </div>
            <Zap size={12} className="text-orange-500" />
            <div className="w-[18px] h-[10px] border border-current rounded-[3px] py-[1px] px-[2px]">
               <div className="w-full h-full bg-current rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-[var(--mockup-bg)]">
          {/* Header with Hamburger */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--keypad-border)] bg-[var(--header-bg)]">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-black uppercase tracking-widest text-slate-800">
                Crunch Calculator
              </span>
            </div>
            <div className="flex gap-1">
              <button 
                onClick={() => setActiveOverlay(activeOverlay === 'bits' ? 'log' : 'bits')}
                title="Programmer Mode (Bitfield)"
                aria-label="Toggle Programmer Mode Bitfield"
                className={`p-1.5 rounded-lg transition-colors ${activeOverlay === 'bits' ? 'bg-orange-500 text-white shadow-sm' : 'hover:bg-slate-100 text-slate-400'}`}
              >
                <Cpu size={18} />
              </button>
              <button 
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                title="Main Menu"
                aria-label="Toggle Main Menu"
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
              >
                {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>

          {/* CPU Bitfield Overlay */}
          <AnimatePresence>
            {activeOverlay === 'bits' && (
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0, right: 0.5 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 100) {
                    setActiveOverlay('log');
                    triggerHaptic('light');
                  }
                }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute inset-0 z-[60] bg-[#F3F4F6] flex flex-col overflow-hidden touch-none"
              >
                <BitField />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hamburger Menu Overlay */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-0 z-50 bg-[var(--mockup-bg)] flex flex-col p-6 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Main Menu</h2>
                  <button onClick={() => setIsMenuOpen(false)} className="p-2 text-[var(--text-muted)]"><X size={24} /></button>
                </div>

                <div className="space-y-4">
                  {[
                    { id: 'history', label: 'Full History', icon: <History size={18} />, color: 'text-[var(--text-primary)]' },
                    { id: 'vars', label: 'Variables', icon: <Settings2 size={18} />, color: 'text-orange-500' },
                    { id: 'funcs', label: 'Formulas', icon: <Book size={18} />, color: 'text-blue-500' },
                    { id: 'constants', label: 'Constants', icon: <Atom size={18} />, color: 'text-purple-500' },
                    { id: 'settings', label: 'Preferences', icon: <Settings2 size={18} />, color: 'text-[var(--text-muted)]' },
                    { id: 'privacy', label: 'Privacy & License', icon: <ShieldCheck size={18} />, color: 'text-green-500' },
                  ].map(item => (
                    <button 
                      key={item.id}
                      onClick={() => { setActiveOverlay(item.id as any); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl transition-all hover:bg-[var(--keypad-border)] border border-transparent hover:border-[var(--keypad-border)] text-[var(--text-primary)]"
                    >
                      <div className={`${item.color}`}>{item.icon}</div>
                      <span className="text-sm font-bold">{item.label}</span>
                    </button>
                  ))}
                  
                  <button 
                    onClick={() => { triggerHaptic('medium'); fetchWithFallback(true); }}
                    disabled={isSyncing}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all border border-transparent text-[var(--text-primary)] group ${isSyncing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500/10 hover:border-blue-500/20'}`}
                  >
                    <div className="text-blue-500">
                      {isSyncing ? (
                        <motion.div
                          animate={{ scale: [1, 1.3, 1] }}
                          transition={{ repeat: Infinity, duration: 0.8 }}
                        >
                          <RefreshCw size={18} className="animate-spin-slow" />
                        </motion.div>
                      ) : (
                        <RefreshCw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
                      )}
                    </div>
                    <div className="flex flex-col items-start text-left">
                      <span className="text-sm font-bold">
                        {isSyncing ? (localStorage.getItem('crunch_rates_ts') && (Date.now() - parseInt(localStorage.getItem('crunch_rates_ts')!) < 10 * 60 * 1000) ? 'Recently Sync' : 'Syncing...') : 'Sync Rates'}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-tighter">
                        {localStorage.getItem('crunch_rates_ts') && (Date.now() - parseInt(localStorage.getItem('crunch_rates_ts')!) < 10 * 60 * 1000) 
                          ? 'Up to date' 
                          : `Last Update: ${localStorage.getItem('crunch_rates_ts') ? new Date(parseInt(localStorage.getItem('crunch_rates_ts')!)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}`}
                      </span>
                    </div>
                  </button>
                </div>

                <div className="mt-auto pt-6 border-t border-[var(--keypad-border)]">
                  <p className="text-[10px] text-[var(--text-muted)] font-bold uppercase tracking-widest text-center">Crunch Workspace v1.1</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Expandive Pages (History / Variables / Formulas) */}
          <AnimatePresence>
            {activeOverlay !== 'log' && activeOverlay !== 'bits' && (
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0, right: 0.5 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 100) {
                    setActiveOverlay('log');
                    triggerHaptic('light');
                  }
                }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="absolute inset-0 z-[40] bg-[var(--mockup-bg)] flex flex-col overflow-hidden touch-none"
              >
                {/* Overlay Header */}
                <div className="bg-[var(--header-bg)] border-b border-[var(--keypad-border)] p-4 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-3">
                    {activeOverlay === 'vars' ? <Settings2 size={16} className="text-orange-500" /> : 
                     activeOverlay === 'funcs' ? <Book size={16} className="text-blue-500" /> :
                     activeOverlay === 'constants' ? <Atom size={16} className="text-purple-500" /> :
                     activeOverlay === 'settings' ? <Settings2 size={16} className="text-slate-500" /> :
                     <History size={16} className="text-slate-600" />}
                    <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">
                      {activeOverlay === 'vars' ? 'Variables' : 
                       activeOverlay === 'funcs' ? 'Formulas' : 
                       activeOverlay === 'constants' ? 'Constants' :
                       activeOverlay === 'settings' ? 'Settings' :
                       'Full Session History'}
                    </h2>
                  </div>
                  <button 
                    onClick={() => setActiveOverlay('log')}
                    className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 shadow-sm border border-[#e5e7eb] dark:border-slate-700 flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Search Bar for History/Formulas/Constants */}
                {(activeOverlay === 'history' || activeOverlay === 'funcs' || activeOverlay === 'constants') && (
                  <div className="px-4 pt-4 shrink-0">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input 
                        type="text" 
                        placeholder={`Search ${activeOverlay}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[var(--app-bg)] border border-[var(--keypad-border)] rounded-xl py-2.5 pl-9 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 text-[var(--text-primary)]"
                      />
                    </div>
                  </div>
                )}

                {/* Overlay Content */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {activeOverlay === 'vars' ? (
                    <div className="space-y-4">
                      {Object.keys(scope).length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 text-center py-20 gap-3 text-[var(--text-primary)]">
                          <Settings2 size={48} />
                          <p className="max-w-[180px] text-sm font-medium">No variables defined yet.<br/>Define one in the log: <span className="text-orange-600 italic">x = 100</span></p>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 gap-3">
                            {Object.entries(scope).map(([key, val]) => (
                                <motion.button 
                                  key={key} 
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => { setCrunchInput(p => p + key); setActiveOverlay('log'); }}
                                  className="bg-[var(--btn-num-bg)] border-2 border-[var(--keypad-border)] p-4 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-3 shadow-sm hover:border-orange-500/30 transition-all text-left group"
                                >
                                  <div>
                                    <div className="text-lg font-mono font-bold text-[var(--text-primary)] group-hover:text-orange-500">{key}</div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-mono font-bold text-[var(--text-primary)] bg-[var(--app-bg)] px-3 py-1 rounded-lg border border-[var(--keypad-border)] break-all">{String(val)}</div>
                                  </div>
                                </motion.button>
                            ))}
                          </div>
                          <button 
                            onClick={() => { 
                              setScope({}); 
                              localStorage.removeItem('crunch_scope'); 
                              setActiveOverlay('log'); 
                            }}
                            className="w-full py-4 text-[10px] font-bold text-red-500 uppercase tracking-[0.2em] border-2 border-dashed border-red-500/20 rounded-2xl mt-6 hover:bg-red-500/5 active:scale-[0.98] transition-all"
                          >
                            Purge All Variables
                          </button>
                        </>
                      )}
                    </div>
                  ) : activeOverlay === 'funcs' ? (
                    <div className="space-y-2 pb-10">
                      {COMMON_FUNCTIONS
                        .filter(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
                        .sort()
                        .map(f => (
                        <motion.button 
                          key={f}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { applySuggestion(f); setActiveOverlay('log'); setSearchQuery(''); }}
                          className="w-full flex items-center gap-4 p-4 bg-[var(--btn-num-bg)] border-b border-[var(--keypad-border)] hover:bg-blue-500/10 transition-all text-left group first:rounded-t-2xl last:rounded-b-2xl last:border-0"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors shrink-0">
                            <Zap size={14} className="text-blue-500 group-hover:text-white" />
                          </div>
                          <div className="flex-1">
                            <span className="text-base font-mono font-black text-[var(--text-primary)] tracking-tight">{f}</span>
                            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                              {['pi', 'e', 'phi', 'tau', 'i'].includes(f) ? 'Mathematical Constant' : 'Algebraic Function'}
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-blue-400" />
                        </motion.button>
                      ))}
                    </div>
                  ) : activeOverlay === 'constants' ? (
                    <div className="space-y-2 pb-10">
                      {PHYSICAL_CONSTANTS
                        .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.desc.toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(c => (
                        <motion.button 
                          key={c.name}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => { setCrunchInput(p => p + c.name); setActiveOverlay('log'); setSearchQuery(''); }}
                          className="w-full flex items-center gap-4 p-4 bg-[var(--btn-num-bg)] border-b border-[var(--keypad-border)] hover:bg-purple-500/10 transition-all text-left group first:rounded-t-2xl last:rounded-b-2xl last:border-0"
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500 group-hover:text-white transition-colors shrink-0">
                            <Atom size={14} className="text-purple-500 group-hover:text-white" />
                          </div>
                          <div className="flex-1">
                            <span className="text-base font-mono font-black text-[var(--text-primary)] tracking-tight">{c.name}</span>
                            <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter">
                              {c.desc}
                            </div>
                          </div>
                          <div className="text-[10px] font-mono font-bold text-[var(--text-muted)] group-hover:text-purple-400">{c.val}</div>
                        </motion.button>
                      ))}
                    </div>
                  ) : activeOverlay === 'settings' ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-4">Appearance</h3>
                        <div className="grid grid-cols-2 gap-2">
                           {[
                             { id: 'light', label: 'Light Mode', icon: <Sun size={14}/> },
                             { id: 'dark', label: 'Dark Mode', icon: <Moon size={14}/> }
                           ].map(item => (
                             <button 
                               key={item.id}
                               onClick={() => setTheme(item.id as any)}
                               className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all ${theme === item.id ? 'border-orange-500 bg-orange-500/10 text-orange-500' : 'border-[var(--keypad-border)] bg-[var(--app-bg)] text-[var(--text-muted)]'}`}
                             >
                               {item.icon}
                               <span className="text-xs font-bold">{item.label}</span>
                             </button>
                           ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-4">Tactile Response</h3>
                        <button 
                          onClick={() => { triggerHaptic('medium'); setHapticsEnabled(!hapticsEnabled); }}
                          className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${hapticsEnabled ? 'border-orange-500 bg-orange-500/5' : 'border-[var(--keypad-border)] bg-[var(--app-bg)]'}`}
                        >
                          <div className="flex items-center gap-3">
                            <Zap size={18} className={hapticsEnabled ? 'text-orange-500' : 'text-slate-400'} />
                            <div className="text-left">
                              <span className={`block text-xs font-black uppercase tracking-wider ${hapticsEnabled ? 'text-orange-600' : 'text-slate-600'}`}>Haptic Feedback</span>
                              <span className="text-[10px] font-bold text-slate-400">Vibrate on key press</span>
                            </div>
                          </div>
                          <div className={`w-10 h-6 rounded-full transition-all p-1 ${hapticsEnabled ? 'bg-orange-500' : 'bg-slate-200'}`}>
                            <motion.div 
                              animate={{ x: hapticsEnabled ? 16 : 0 }}
                              className="w-4 h-4 bg-white rounded-full shadow-sm" 
                            />
                          </div>
                        </button>
                      </div>
                      
                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-4">Trigonometry Mode</h3>
                        <div className="grid grid-cols-3 gap-2">
                           {['deg', 'rad', 'grad'].map(m => (
                             <button 
                               key={m}
                               onClick={() => setTrigMode(m as any)}
                               className={`p-3 rounded-xl border-2 transition-all text-xs font-bold uppercase tracking-widest ${trigMode === m ? 'border-blue-500 bg-blue-500/10 text-blue-500' : 'border-[var(--keypad-border)] bg-[var(--app-bg)] text-[var(--text-muted)]'}`}
                             >
                               {m}
                             </button>
                           ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] mb-4">Decimal Precision ({precision})</h3>
                        <input 
                          type="range" 
                          min="0" 
                          max="16" 
                          step="1" 
                          value={precision} 
                          onChange={(e) => setPrecision(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-[var(--keypad-border)] rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <div className="flex justify-between mt-2 text-[9px] font-mono text-[var(--text-muted)]">
                           <span>0</span>
                           <span>8</span>
                           <span>16</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4 pb-10">
                       {crunchHistory
                        .filter(entry => 
                          entry.expr.includes(searchQuery) || 
                          entry.result.includes(searchQuery)
                        )
                        .map((entry, idx) => (
                          <div key={idx} className="bg-[var(--btn-num-bg)] border border-[var(--keypad-border)] p-4 rounded-2xl group flex flex-col gap-2">
                             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tight text-[var(--text-muted)]">
                                <span>Entry #{idx + 1}</span>
                                <button 
                                  onClick={() => { 
                                    setCrunchInput(entry.expr); 
                                    setActiveOverlay('log');
                                    setSearchQuery('');
                                  }}
                                  className="text-orange-500 font-bold hover:scale-110 transition-transform"
                                >Reuse</button>
                             </div>
                             <div className="text-sm font-mono text-[var(--text-secondary)] bg-[var(--app-bg)] p-2 rounded-lg border border-[var(--keypad-border)] break-all truncate-none">› {entry.expr}</div>
                             <div 
                               onClick={() => {
                                 setCrunchInput(entry.result);
                                 setActiveOverlay('log');
                                 setSearchQuery('');
                               }}
                               className="text-lg font-mono font-bold text-[var(--text-primary)] flex items-start gap-2 cursor-pointer hover:bg-orange-500/10 p-1 rounded-md transition-colors group/res"
                             >
                                <span className="text-orange-500 shrink-0">=</span>
                                <span className="flex-1 break-all">{entry.result}</span>
                                <span className="text-[8px] font-black uppercase text-orange-500 ml-auto shrink-0 mt-2">Use Result</span>
                             </div>
                          </div>
                        ))}
                       {crunchHistory.length > 0 && (
                          <button 
                            onClick={() => { 
                              setCrunchHistory([]); 
                              setActiveOverlay('log'); 
                              setSearchQuery(''); 
                            }}
                            className="w-full py-4 text-[10px] font-bold text-red-500 uppercase tracking-[0.2em] border-2 border-dashed border-red-500/20 rounded-2xl mt-6 hover:bg-red-500/5 active:scale-[0.98] transition-all"
                          >
                            Purge History Log
                          </button>
                       )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
 
          {/* Privacy Overlay */}
          <AnimatePresence>
            {activeOverlay === 'privacy' && (
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute inset-0 z-[70] bg-white flex flex-col"
              >
                <PrivacyOverlay />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Session Log / History Area (Always visible as background) */}
          <div className="flex-1 bg-[var(--mockup-bg)] mx-2 mb-2 rounded-2xl border border-[var(--keypad-border)] overflow-hidden flex flex-col mt-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
            <div className="bg-[var(--keypad-border)]/30 px-3 py-1.5 flex justify-between items-center border-b border-[var(--keypad-border)]">
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Session Stream</span>
                <div className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-orange-500 animate-pulse" />
                  <div className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />
                  <div className="w-1 h-1 rounded-full bg-[var(--text-muted)]" />
                </div>
              </div>
              {crunchHistory.length > 0 && (
                <button 
                  onClick={() => setActiveOverlay('history')}
                  className="p-1 rounded-md hover:bg-orange-500/10 text-[var(--text-muted)] hover:text-orange-500 transition-all flex items-center justify-center"
                  title="Expand History"
                >
                  <Maximize2 size={10} />
                </button>
              )}
            </div>
            <div ref={historyRef} className="flex-1 p-3 overflow-y-auto custom-scrollbar">
              <motion.div 
                className="space-y-3 font-mono text-[11px]"
              >
                {crunchHistory.slice(-10).map((entry, idx) => (
                  <div key={idx} className="border-b border-[var(--keypad-border)] pb-2 last:border-0" onClick={() => { setCrunchInput(entry.result); setCursorPos(entry.result.length); }}>
                    <div className="text-[var(--text-muted)] px-1 break-all">› {entry.expr}</div>
                    <div className="text-[var(--text-primary)] font-bold px-1 flex justify-between items-start group/item cursor-pointer gap-2">
                      <span className="flex-1 break-all">= {entry.result}</span>
                      <ChevronRight size={10} className="text-orange-500 opacity-0 group-hover/item:opacity-100 transition-opacity mt-1 shrink-0" />
                    </div>
                  </div>
                ))}
                {crunchHistory.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-10 text-center py-10 px-8">
                    <Zap size={32} className="mb-3" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Ready</p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>

          {/* Formula Bar */}
          <div className="px-2 mb-3">
            <motion.div 
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left; 
                const y = e.clientY - rect.top;
                e.currentTarget.style.setProperty('--x', `${x}px`);
                e.currentTarget.style.setProperty('--y', `${y}px`);
              }}
              className="bg-black rounded-xl p-3 text-white font-mono text-base min-h-[48px] flex items-center shadow-lg border border-white/10 relative group overflow-hidden"
              style={{
                backgroundColor: '#000000',
                backgroundImage: 'radial-gradient(600px circle at var(--x, 50%) var(--y, 50%), rgba(255,255,255,0.06), transparent 40%)'
              } as any}
            >
              <div className="flex flex-col flex-1 overflow-hidden">
                <div className="flex items-center min-h-[24px]">
                  <span className={`mr-2 font-bold shrink-0 transition-colors duration-500 rounded-sm px-1 ${isInputValid ? 'text-orange-500' : 'text-red-500 bg-red-500/10'}`}>ƒ</span>
                  <div 
                    ref={inputRef}
                    className={`flex-1 overflow-x-auto no-scrollbar flex items-center cursor-text transition-all duration-500 tabular-numeric ${isInputValid ? 'text-white' : 'text-white/60'}`}
                    style={{ fontSize: inputFontSize }}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setCursorPos(crunchInput.length);
                    }}
                  >
                    <span className="whitespace-nowrap">{crunchInput.slice(0, cursorPos)}</span>
                    <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-[2px] h-5 bg-orange-500 shrink-0 mx-[1px]" />
                    <span className="whitespace-nowrap opacity-40">{crunchInput.slice(cursorPos)}</span>
                  </div>
                </div>
                <AnimatePresence>
                  {validationError && showError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-[9px] font-black uppercase tracking-widest text-red-500/60 mt-0.5 ml-6 truncate"
                    >
                      {validationError.split(' (')[0]}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex gap-1 ml-2 shrink-0">
                <button 
                  onClick={() => { triggerHaptic('medium'); handleCrunchEval(); }}
                  className={`${isInputValid ? 'bg-orange-500 hover:bg-orange-400' : 'bg-slate-800 text-slate-500 cursor-not-allowed'} p-2 rounded-lg transition-all active:scale-90 flex items-center justify-center shrink-0`}
                  disabled={!isInputValid}
                  title="Crunch it!"
                >
                  <Zap size={16} fill={isInputValid ? 'white' : 'currentColor'} />
                </button>
              </div>
            </motion.div>
          </div>

          {/* Refined Crunch Keyboard */}
          <div className="bg-[var(--keypad-bg)] border-t border-[var(--keypad-border)] select-none relative">
            {/* Reserved space for Suggestions to keep layout fixed */}
            <div className="h-9 bg-[var(--header-bg)] border-b border-[var(--keypad-border)] flex items-center overflow-hidden">
              <AnimatePresence initial={false}>
                {suggestions.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="w-full"
                  >
                    <div className="flex gap-2 px-3 overflow-x-auto no-scrollbar whitespace-nowrap">
                      {suggestions.map(sug => (
                        <button 
                          key={sug}
                          onClick={() => applySuggestion(sug)}
                          className="px-2.5 py-1 bg-[#F9FAFB] rounded-md text-[9px] font-bold text-orange-500 uppercase tracking-wider border border-orange-100/50 shadow-sm active:bg-orange-50"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-2 pb-6 flex flex-col gap-2.5 items-center">
              {/* Row 1: Operators */}
              <div className="flex gap-1.5 w-full justify-center">
                {['(', '+', '-', '*', '/', '%', '^', '=', ')'].map(k => (
                  <button key={k} onClick={() => insertAtCursor(k)} className="flex-1 max-w-[36px] bg-[var(--btn-action-bg)] h-11 rounded-lg shadow-sm text-base font-bold text-[var(--text-secondary)] btn-physical">{k}</button>
                ))}
              </div>
              {/* Row 2: Numbers */}
              <div className="flex gap-1.5 w-full justify-center">
                {['1','2','3','4','5','6','7','8','9','0'].map(k => (
                  <button key={k} onClick={() => insertAtCursor(k)} className="flex-1 max-w-[32px] bg-[var(--btn-num-bg)] h-11 rounded-lg shadow-sm text-base font-bold text-[var(--text-primary)] btn-physical">{k}</button>
                ))}
              </div>
              {/* Row 3: QWERTY */}
              <div className="flex gap-1.5 w-full justify-center">
                {['q','w','e','r','t','y','u','i','o','p'].map(k => (
                  <button key={k} onClick={() => insertAtCursor(k)} className="flex-1 max-w-[32px] bg-[var(--btn-num-bg)] h-11 rounded-lg shadow-sm text-base font-semibold text-[var(--text-secondary)] btn-physical">{k}</button>
                ))}
              </div>
              {/* Row 4: ASDF */}
              <div className="flex gap-1.5 w-full justify-center px-1">
                {['a','s','d','f','g','h','j','k','l'].map(k => (
                  <button key={k} onClick={() => insertAtCursor(k)} className="flex-1 max-w-[32px] bg-[var(--btn-num-bg)] h-11 rounded-lg shadow-sm text-base font-semibold text-[var(--text-secondary)] btn-physical">{k}</button>
                ))}
              </div>
              {/* Row 5: Bottom Row Alpha with padding Adjustment */}
              <div className="flex gap-1.5 w-full justify-center px-6">
                {['z','x','c','v','b','n','m'].map(k => (
                  <button key={k} onClick={() => insertAtCursor(k)} className="flex-1 max-w-[32px] bg-[var(--btn-num-bg)] h-11 rounded-lg shadow-sm text-base font-semibold text-[var(--text-secondary)] btn-physical">{k}</button>
                ))}
                <button onClick={deleteLast} className="flex-1 max-w-[36px] bg-[var(--btn-action-bg)] h-11 rounded-lg shadow-sm flex items-center justify-center text-[var(--text-secondary)] btn-physical transition-colors"><Delete size={18} /></button>
              </div>
              {/* Row 6: Master Action Row */}
              <div className="flex gap-1.5 px-2 w-full justify-center items-center">
                <button 
                  onClick={() => setIsConfirmingAC(true)} 
                  className="w-10 bg-[#FEF2F2] dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 h-11 rounded-lg shadow-sm text-[10px] font-black text-red-500 btn-physical transition-colors uppercase shrink-0"
                >
                  AC
                </button>
                <button onClick={() => insertAtCursor(',')} className="w-10 bg-[var(--btn-num-bg)] h-11 rounded-lg shadow-sm text-lg font-bold text-[var(--text-primary)] btn-physical transition-colors uppercase shrink-0">,</button>
                
                <motion.button 
                  onPanStart={() => { panRef.current = 0; }}
                  onPan={(_, info) => {
                    panRef.current += info.delta.x;
                    const threshold = 15;
                    if (panRef.current > threshold) {
                      moveCursorRight();
                      panRef.current = 0;
                    } else if (panRef.current < -threshold) {
                      moveCursorLeft();
                      panRef.current = 0;
                    }
                  }}
                  onClick={() => insertAtCursor(' ')}
                  className="flex-1 bg-[var(--btn-num-bg)] h-11 rounded-lg shadow-sm text-[var(--text-muted)] font-bold text-[10px] uppercase tracking-[0.3em] active:scale-95 transition-transform touch-none"
                >
                  Space
                </motion.button>
 
                <button onClick={handleDecimal} className="w-10 bg-[var(--btn-num-bg)] h-11 rounded-lg shadow-sm text-lg font-bold text-[var(--text-primary)] btn-physical transition-colors uppercase shrink-0">.</button>
                <button 
                  onClick={() => clearAll()} 
                  className="w-10 bg-[var(--btn-action-bg)] h-11 rounded-lg shadow-sm text-[10px] font-black text-[var(--text-secondary)] btn-physical uppercase transition-colors shrink-0"
                >
                  CE
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[120px] h-1 bg-black opacity-10 rounded-full" />

        {/* AC Confirmation Modal */}
        <AnimatePresence>
          {isConfirmingAC && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-[var(--mockup-bg)] w-full rounded-3xl shadow-2xl p-6 border-2 border-red-100 dark:border-red-900/20"
              >
                <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-4 mx-auto">
                  <X size={24} />
                </div>
                <h3 className="text-center text-lg font-black text-[var(--text-primary)] mb-2">Crunch Wipe?</h3>
                <p className="text-center text-xs font-medium text-[var(--text-secondary)] mb-6 leading-relaxed">
                  This will purge your entire history log, variables, and unsaved work. You cannot undo this.
                </p>
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      setCrunchHistory([]);
                      localStorage.removeItem('crunch_history');
                      setScope({});
                      localStorage.removeItem('crunch_scope');
                      setCrunchInput('');
                      setSearchQuery('');
                      setActiveOverlay('log');
                      setIsConfirmingAC(false);
                    }}
                    className="w-full py-3.5 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
                  >
                    Confirm Wipe
                  </button>
                  <button 
                    onClick={() => setIsConfirmingAC(false)}
                    className="w-full py-3.5 bg-[var(--btn-action-bg)] text-[var(--text-primary)] rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-transform border border-[var(--keypad-border)]"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
