"use client";
import React, { useState, useEffect, use } from 'react';
import { db, auth, provider } from '../../firebaseConfig'; 
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { signInWithPopup, User, onAuthStateChanged, signOut } from 'firebase/auth';

// --- Requirement 1.3: Type Definitions ---
interface CellData {
  value: string;
  bold: boolean;
  italic: boolean;
  color: string;
}

interface ActiveUser {
  uid: string;
  displayName: string;
  photoURL: string;
  currentCell?: string;
}

// --- Logic Helpers ---
const parseCoords = (coord: string) => {
  const col = coord.toUpperCase().charCodeAt(0) - 65;
  const row = parseInt(coord.substring(1)) - 1;
  return { row, col };
};

const evaluateFormula = (input: string, gridData: CellData[][]) => {
  if (!input || typeof input !== "string" || !input.startsWith("=")) return input;
  try {
    const formula = input.substring(1).toUpperCase();
    if (formula.startsWith("SUM(")) {
      const match = formula.match(/SUM\((.*):(.*)\)/);
      if (match) {
        const start = parseCoords(match[1]);
        const end = parseCoords(match[2]);
        const rowStart = Math.min(start.row, end.row);
        const rowEnd = Math.max(start.row, end.row);
        const colStart = Math.min(start.col, end.col);
        const colEnd = Math.max(start.col, end.col);
        let total = 0;
        for (let r = rowStart; r <= rowEnd; r++) {
          for (let c = colStart; c <= colEnd; c++) {
            total += Number(gridData[r]?.[c]?.value) || 0;
          }
        }
        return total.toString();
      }
    }
    const sanitized = formula.replace(/[A-Z][0-9]+/g, (match) => {
      const { row, col } = parseCoords(match);
      return gridData[row]?.[col]?.value || "0";
    });
    return eval(sanitized).toString();
  } catch {
    return "#ERROR!";
  }
};

export default function Spreadsheet({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  
  const [user, setUser] = useState<User | null>(null);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [rowCount, setRowCount] = useState(15);
  const [colCount, setColCount] = useState(6);
  const [focusedCell, setFocusedCell] = useState<{r: number, c: number} | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<CellData[][]>(
    Array.from({ length: 50 }, () => Array(20).fill({ value: "", bold: false, italic: false, color: "#000000" }))
  );

  // --- Requirement 2.1: Keyboard Navigation Logic ---
  const handleKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    const move = (nextR: number, nextC: number) => {
      e.preventDefault();
      const clampedR = Math.max(0, Math.min(nextR, rowCount - 1));
      const clampedC = Math.max(0, Math.min(nextC, colCount - 1));
      const nextInput = document.querySelector(`input[data-coord="${clampedR}-${clampedC}"]`) as HTMLInputElement;
      nextInput?.focus();
    };

    switch (e.key) {
      case "ArrowDown": move(r + 1, c); break;
      case "ArrowUp": move(r - 1, c); break;
      case "ArrowRight": move(r, c + 1); break;
      case "ArrowLeft": move(r, c - 1); break;
      case "Enter": move(r + 1, c); break;
      case "Tab": move(r, c + 1); break;
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user || !id) return;
    const userRef = doc(db, "spreadsheets", id);
    const myPresence: ActiveUser = { uid: user.uid, displayName: user.displayName || "Anonymous", photoURL: user.photoURL || "" };
    updateDoc(userRef, { activeUsers: arrayUnion(myPresence) }).catch(() => setDoc(userRef, { activeUsers: [myPresence] }, { merge: true }));
    return () => { updateDoc(userRef, { activeUsers: arrayRemove(myPresence) }); };
  }, [user, id]);

  const updatePresencePosition = async (row: number, col: number) => {
    if (!user || !id) return;
    const userRef = doc(db, "spreadsheets", id);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const users = (docSnap.data().activeUsers || []) as ActiveUser[];
      const updatedList = users.map((u) => u.uid === user.uid ? { ...u, currentCell: `${row}-${col}` } : u);
      await updateDoc(userRef, { activeUsers: updatedList });
    }
  };

  const handleLogin = async () => {
    try { await signInWithPopup(auth, provider); } catch (err) { console.error("Auth Error:", err); }
  };

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "spreadsheets", id), (doc) => {
      if (doc.exists()) {
        const cloudData = doc.data();
        if (cloudData.activeUsers) setActiveUsers(cloudData.activeUsers as ActiveUser[]);
        const newData = Array.from({ length: 50 }, () => Array(20).fill({ value: "", bold: false, italic: false, color: "#000000" }));
        Object.keys(cloudData).forEach(key => {
          if (key.includes('-')) {
            const [r, c] = key.split('-').map(Number);
            if (r < 50 && c < 20) newData[r][c] = cloudData[key];
          }
        });
        setData(newData);
      }
    });
    return () => unsub();
  }, [id]);

  const updateCell = async (row: number, col: number, updates: Partial<CellData>) => {
    setIsSaving(true);
    const newData = [...data];
    newData[row] = [...newData[row]];
    newData[row][col] = { ...newData[row][col], ...updates };
    setData(newData);
    await setDoc(doc(db, "spreadsheets", id), {
      [`${row}-${col}`]: newData[row][col],
      lastModified: Date.now(),
      lastModifiedBy: user?.displayName || "Anonymous",
      updatedAt: new Date().toLocaleString()
    }, { merge: true });
    setIsSaving(false);
  };

  return (
    <div className="p-4 md:p-10 bg-slate-50 min-h-screen text-slate-900">
      <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-200">
        
        <div className="flex justify-between items-center p-5 bg-slate-900 text-white">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="font-bold text-lg leading-tight text-white">Trademarkia Sheets Pro</h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest">Collaborative Mode</p>
            </div>
            <div className="flex -space-x-2">
              {Array.from(new Map(activeUsers.map(u => [u.uid, u])).values())
                .filter(u => u.uid !== user?.uid)
                .map((u) => (
                  <img key={u.uid} src={u.photoURL} title={u.displayName} className="w-8 h-8 rounded-full border-2 border-slate-900 ring-2 ring-emerald-500" />
                ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button onClick={() => {
                const csv = data.slice(0, rowCount).map(row => row.slice(0, colCount).map(c => `"${c.value || ''}"`).join(",")).join("\n");
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `sheet-${id.slice(0,4)}.csv`; a.click();
              }} 
              className="bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 rounded-lg text-xs transition-colors font-bold shadow-lg flex items-center gap-2">
              <span className="text-sm">⤓</span> Export CSV
            </button>
            <div className="h-6 w-[1px] bg-slate-700" />
            {user ? (
              <div className="flex items-center gap-3 bg-slate-800 py-1 px-3 rounded-full border border-slate-700">
                <img src={user.photoURL || ""} alt="avatar" className="w-6 h-6 rounded-full" />
                <span className="text-xs font-medium hidden md:inline">{user.displayName}</span>
                <button onClick={() => signOut(auth)} className="text-[10px] text-slate-400 hover:text-red-400 ml-2 font-bold uppercase">Logout</button>
              </div>
            ) : (
              <button onClick={handleLogin} className="bg-white text-slate-900 px-4 py-1 rounded text-xs font-bold">Login</button>
            )}
            <div className="h-4 w-[1px] bg-slate-700" />
            {isSaving ? <span className="text-[10px] font-bold text-blue-400 animate-pulse uppercase">Saving...</span> : <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter">● Synced</span>}
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-slate-100 border-b border-slate-200">
           <button onClick={() => focusedCell && updateCell(focusedCell.r, focusedCell.c, { bold: !data[focusedCell.r][focusedCell.c].bold })} className={`w-10 h-10 rounded border transition-all ${focusedCell && data[focusedCell.r][focusedCell.c].bold ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-200'} font-bold`}>B</button>
           <button onClick={() => focusedCell && updateCell(focusedCell.r, focusedCell.c, { italic: !data[focusedCell.r][focusedCell.c].italic })} className={`w-10 h-10 rounded border transition-all ${focusedCell && data[focusedCell.r][focusedCell.c].italic ? 'bg-slate-800 text-white' : 'bg-white hover:bg-slate-200'} italic`}>I</button>
           <div className="h-8 w-[1px] bg-slate-300 mx-1" />
           <div className="flex items-center gap-2">
             <span className="text-[8px] font-black uppercase text-slate-400">Color</span>
             <input type="color" value={focusedCell ? data[focusedCell.r][focusedCell.c].color : "#000000"} onChange={(e) => focusedCell && updateCell(focusedCell.r, focusedCell.c, { color: e.target.value })} className="w-10 h-10 p-1 bg-white border rounded cursor-pointer" />
           </div>
        </div>

        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50 border-b shadow-sm">
                <th className="w-12 border-r p-2 text-[10px] text-slate-400 font-mono">#</th>
                {Array.from({ length: colCount }).map((_, i) => (
                  /* --- Requirement 2.2: Column Resize --- */
                  <th key={i} 
                      className="border-r p-2 text-xs font-bold text-slate-600 uppercase tracking-tighter overflow-hidden whitespace-nowrap"
                      style={{ resize: 'horizontal', minWidth: '100px' }}>
                    {String.fromCharCode(65 + i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rowCount }).map((_, rIndex) => (
                <tr key={rIndex} className="border-b group hover:bg-slate-50/50 text-black">
                  <td className="bg-slate-50 border-r text-center text-[10px] text-slate-400 font-mono">{rIndex + 1}</td>
                  {Array.from({ length: colCount }).map((_, cIndex) => {
                    const cell = data[rIndex]?.[cIndex] ?? { value: "", bold: false, italic: false, color: "#000000" };
                    const isFocused = focusedCell?.r === rIndex && focusedCell?.c === cIndex;
                    const remoteUser = activeUsers.find(u => u.uid !== user?.uid && u.currentCell === `${rIndex}-${cIndex}`);

                    return (
                      <td key={cIndex} className="border-r p-0 min-w-[140px] relative" 
                          style={{ outline: remoteUser ? '2px solid #10b981' : (isFocused ? '2px solid #3b82f6' : 'none'), zIndex: remoteUser || isFocused ? 10 : 1 }}>
                        {remoteUser && (
                          <div className="absolute -top-5 left-0 bg-emerald-500 text-white text-[8px] px-1 rounded font-bold whitespace-nowrap z-30">
                            {remoteUser.displayName.split(' ')[0]} is here
                          </div>
                        )}
                        <input
                          /* --- Requirement 2.1: Navigation Hook --- */
                          data-coord={`${rIndex}-${cIndex}`}
                          onKeyDown={(e) => handleKeyDown(e, rIndex, cIndex)}
                          className="w-full h-10 px-3 outline-none text-sm text-black font-medium"
                          style={{ fontWeight: cell.bold ? 'bold' : 'normal', fontStyle: cell.italic ? 'italic' : 'normal', color: cell.color, backgroundColor: isFocused ? '#f0f9ff' : 'transparent' }}
                          value={isFocused ? cell.value : evaluateFormula(cell.value, data)}
                          onChange={(e) => updateCell(rIndex, cIndex, { value: e.target.value })}
                          onFocus={() => {
                            setFocusedCell({ r: rIndex, c: cIndex });
                            updatePresencePosition(rIndex, cIndex);
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex gap-6 p-4 bg-slate-50 border-t border-slate-200 justify-center">
          <button onClick={() => setRowCount(prev => Math.min(prev + 5, 50))} className="text-[10px] font-black uppercase text-slate-500 hover:text-blue-600 transition-colors tracking-widest">+ Add 5 Rows</button>
          <button onClick={() => setColCount(prev => Math.min(prev + 1, 20))} className="text-[10px] font-black uppercase text-slate-500 hover:text-blue-600 transition-colors tracking-widest">+ Add 1 Column</button>
        </div>
      </div>
      <p className="text-center mt-6 text-slate-400 text-[10px] font-bold uppercase tracking-widest">Trademarkia Project by Keerthana V.</p>
    </div>
  );
}