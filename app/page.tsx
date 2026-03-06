"use client";
import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig'; 
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// This Interface tells TypeScript exactly what a "Cell" looks like.
// This fixes the 'any' errors you saw.
interface CellData {
  value: string;
  bold: boolean;
  italic: boolean;
  color: string;
}

const ROWS = 15;
const COLS = 6;

// --- Logic Helpers ---
const parseCoords = (coord: string) => {
  const col = coord.toUpperCase().charCodeAt(0) - 65;
  const row = parseInt(coord.substring(1)) - 1;
  return { row, col };
};

const evaluateFormula = (input: string, gridData: CellData[][]) => {
  if (!input || typeof input !== 'string' || !input.startsWith('=')) return input;
  try {
    const formula = input.substring(1).toUpperCase();
    if (formula.startsWith('SUM(')) {
      const match = formula.match(/SUM\((.*):(.*)\)/);
      if (match) {
        const start = parseCoords(match[1]);
        const end = parseCoords(match[2]);
        let total = 0;
        for (let r = start.row; r <= end.row; r++) {
          for (let c = start.col; c <= end.col; c++) {
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

export default function Spreadsheet() {
  const [data, setData] = useState<CellData[][]>(
    Array.from({ length: ROWS }, () => Array(COLS).fill({ value: "", bold: false, italic: false, color: "#000000" }))
  );
  const [focusedCell, setFocusedCell] = useState<{r: number, c: number} | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "spreadsheets", "sheet_1"), (doc) => {
      if (doc.exists()) {
        const cloudData = doc.data();
        const newData = Array.from({ length: ROWS }, () => Array(COLS).fill({ value: "", bold: false, italic: false, color: "#000000" }));
        Object.keys(cloudData).forEach(key => {
          const [r, c] = key.split('-').map(Number);
          if (r < ROWS && c < COLS) newData[r][c] = cloudData[key];
        });
        setData(newData);
      }
    });
    return () => unsub();
  }, []);

  const updateCell = async (row: number, col: number, updates: Partial<CellData>) => {
    setIsSaving(true);
    const newData = [...data];
    // Create a fresh copy of the row to trigger React's re-render
    newData[row] = [...newData[row]];
    newData[row][col] = { ...newData[row][col], ...updates };
    setData(newData);

    await setDoc(doc(db, "spreadsheets", "sheet_1"), {
      [`${row}-${col}`]: newData[row][col]
    }, { merge: true });
    setIsSaving(false);
  };

  return (
    <div className="p-4 md:p-10 bg-slate-50 min-h-screen text-slate-900">
      <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-xl overflow-hidden border border-slate-200">
        
        {/* Modern Header */}
        <div className="flex justify-between items-center p-5 bg-slate-900 text-white">
          <div>
            <h1 className="font-bold text-lg">Trademarkia Sheets Pro</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Real-time Frontend Assignment</p>
          </div>
          <div className="flex items-center gap-4">
             {isSaving ? <span className="text-xs text-blue-400 animate-pulse">Saving...</span> : <span className="text-xs text-emerald-400">● Synced</span>}
             <button onClick={() => {
                const csv = data.map(row => row.map(c => c.value).join(",")).join("\n");
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'sheet.csv';
                a.click();
             }} className="bg-emerald-600 hover:bg-emerald-700 px-3 py-1 rounded text-xs transition-colors">Export CSV</button>
          </div>
        </div>

        {/* Improved Toolbar */}
        <div className="flex items-center gap-3 p-3 bg-slate-100 border-b border-slate-200">
           <button 
             onClick={() => focusedCell && updateCell(focusedCell.r, focusedCell.c, { bold: !data[focusedCell.r][focusedCell.c].bold })} 
             className={`w-10 h-10 rounded border transition-all ${focusedCell && data[focusedCell.r][focusedCell.c].bold ? 'bg-slate-800 text-white shadow-inner' : 'bg-white hover:bg-slate-200'} font-bold`}
           >B</button>
           <button 
             onClick={() => focusedCell && updateCell(focusedCell.r, focusedCell.c, { italic: !data[focusedCell.r][focusedCell.c].italic })} 
             className={`w-10 h-10 rounded border transition-all ${focusedCell && data[focusedCell.r][focusedCell.c].italic ? 'bg-slate-800 text-white shadow-inner' : 'bg-white hover:bg-slate-200'} italic`}
           >I</button>
           
           <div className="h-8 w-[1px] bg-slate-300 mx-2" />
           
           <div className="flex items-center gap-2">
             <label className="text-[10px] font-bold text-slate-500 uppercase">Text Color</label>
             <input 
               type="color" 
               value={focusedCell ? data[focusedCell.r][focusedCell.c].color : "#000000"}
               onChange={(e) => focusedCell && updateCell(focusedCell.r, focusedCell.c, { color: e.target.value })} 
               className="w-10 h-10 p-1 bg-white border rounded cursor-pointer" 
             />
           </div>
        </div>

        {/* Grid Container */}
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-20">
              <tr className="bg-slate-50 border-b shadow-sm">
                <th className="w-12 border-r p-2 text-[10px] text-slate-400 font-mono">#</th>
                {Array.from({ length: COLS }).map((_, i) => (
                  <th key={i} className="border-r p-2 text-xs font-bold text-slate-600 uppercase tracking-tighter">{String.fromCharCode(65 + i)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rIndex) => (
                <tr key={rIndex} className="border-b group hover:bg-slate-50/50">
                  <td className="bg-slate-50 border-r text-center text-[10px] text-slate-400 font-mono group-hover:bg-slate-100">{rIndex + 1}</td>
                  {row.map((cell, cIndex) => {
                    const isFocused = focusedCell?.r === rIndex && focusedCell?.c === cIndex;
                    return (
                      <td key={cIndex} className="border-r p-0 min-w-[140px]">
                        <input
                          className="w-full h-10 px-3 outline-none text-sm transition-all text-black"
                          style={{ 
                            fontWeight: cell.bold ? 'bold' : 'normal', 
                            fontStyle: cell.italic ? 'italic' : 'normal',
                            color: cell.color, // This applies the color from the RGB picker!
                            backgroundColor: isFocused ? '#f0f9ff' : 'transparent'
                          }}
                          value={isFocused ? cell.value : evaluateFormula(cell.value, data)}
                          onChange={(e) => updateCell(rIndex, cIndex, { value: e.target.value })}
                          onFocus={() => setFocusedCell({ r: rIndex, c: cIndex })}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-center mt-6 text-slate-400 text-xs">Developed by Keerthana V. for Trademarkia Internship</p>
    </div>
  );
}