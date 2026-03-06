"use client";
import React, { useState, useEffect } from 'react';
import { db, auth, provider } from './firebaseConfig';
import { collection, onSnapshot, addDoc, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User, signInWithPopup, signOut } from 'firebase/auth';

// 1. Defined specific types to prevent 'any' errors
interface ActiveUser {
  uid: string;
  displayName: string;
  photoURL: string;
}

interface Sheet {
  id: string;
  title: string;
  owner: string;
  createdAt: number;
  updatedAt?: string;
  lastModifiedBy?: string;
  activeUsers?: ActiveUser[]; 
}

export default function Dashboard() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Added for smoother UX
  const router = useRouter();

  useEffect(() => {
    // 2. Auth listener with loading state
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    
    // 3. Real-time listener for the dashboard grid
    const q = query(collection(db, "spreadsheets"), orderBy("createdAt", "desc"));
    const unsubSheets = onSnapshot(q, (snapshot) => {
      setSheets(snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Sheet)));
    });

    return () => { 
      unsubAuth(); 
      unsubSheets(); 
    };
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const resetPresence = async (e: React.MouseEvent, sheetId: string) => {
    e.stopPropagation(); 
    const userRef = doc(db, "spreadsheets", sheetId);
    try {
      await updateDoc(userRef, { activeUsers: [] });
    } catch (err) {
      console.error("Reset failed:", err);
    }
  };

  const createNewSheet = async () => {
    if (!user) return;
    try {
      const docRef = await addDoc(collection(db, "spreadsheets"), {
        title: `${user.displayName}'s Sheet`,
        owner: user.displayName,
        createdAt: Date.now(),
        lastModifiedBy: user.displayName, 
        updatedAt: new Date().toLocaleString(),
        activeUsers: [], 
        data: {} 
      });
      router.push(`/sheet/${docRef.id}`);
    } catch (err) {
      console.error("Error creating sheet:", err);
    }
  };

  // Prevent UI flickering during auth check
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-300 animate-pulse">Initializing Engine...</p>
    </div>
  );

  return (
    <div className="p-4 md:p-12 bg-slate-50 min-h-screen text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto">
        
        {/* Header Section */}
        <div className="flex justify-between items-center mb-12 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-slate-900 uppercase">My Documents</h1>
            <p className="text-slate-500 text-sm font-medium">Real-time Collaboration Engine</p>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3 bg-slate-50 p-1 pr-4 rounded-full border border-slate-100">
                <img src={user.photoURL || ""} alt="User" className="w-10 h-10 rounded-full border-2 border-emerald-500 shadow-sm" />
                <div className="text-left hidden sm:block">
                  <p className="text-[10px] font-black uppercase text-slate-400">Welcome</p>
                  <p className="text-xs font-bold leading-tight">{user.displayName?.split(' ')[0]}</p>
                </div>
                <button onClick={() => signOut(auth)} className="ml-2 text-[10px] font-black text-red-500 uppercase hover:text-red-700 transition-colors">Exit</button>
              </div>
            ) : (
              <button onClick={handleLogin} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
                Login with Google
              </button>
            )}
          </div>
        </div>

        {/* --- CONDITIONAL RENDERING: Login Wall --- */}
        {!user ? (
          <div className="flex flex-col items-center justify-center h-96 bg-white border border-dashed border-slate-200 rounded-3xl p-10 text-center shadow-sm">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
               <span className="text-4xl">🔒</span>
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-slate-800 mb-2">Authenticated Access Only</h2>
            <p className="text-slate-400 text-sm max-w-xs mb-8">Sign in with Google to view and manage your collaborative spreadsheets.</p>
            <button onClick={handleLogin} className="border-2 border-slate-900 px-8 py-3 rounded-xl text-xs font-black uppercase tracking-[0.2em] hover:bg-slate-900 hover:text-white transition-all">
              Unlock Workspace
            </button>
          </div>
        ) : (
          /* --- DASHBOARD GRID: Visible only when logged in --- */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <button 
              onClick={createNewSheet}
              className="h-64 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 text-slate-300 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50/30 transition-all group bg-white"
            >
              <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                <span className="text-3xl font-light">+</span>
              </div>
              <span className="font-black text-[10px] tracking-[0.2em] uppercase">Create New Sheet</span>
            </button>

            {sheets.map(sheet => {
              const uniqueActiveCount = sheet.activeUsers 
                ? new Set(sheet.activeUsers.map(u => u.uid)).size 
                : 0;

              return (
                <div 
                  key={sheet.id} 
                  onClick={() => router.push(`/sheet/${sheet.id}`)}
                  className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-2xl cursor-pointer transition-all hover:-translate-y-2 relative overflow-hidden group flex flex-col justify-between h-64"
                >
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>
                  
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-slate-800 text-lg truncate group-hover:text-emerald-600 transition-colors pr-2">
                        {sheet.title}
                      </h3>
                      {uniqueActiveCount > 0 && (
                        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          {uniqueActiveCount} Active
                        </div>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-[9px] text-slate-300 font-mono uppercase tracking-widest">#{sheet.id.slice(0, 8)}</p>
                      {uniqueActiveCount > 0 && (
                        <button 
                          onClick={(e) => resetPresence(e, sheet.id)}
                          className="text-[8px] font-black text-slate-300 hover:text-red-500 uppercase tracking-widest transition-colors"
                        >
                          [Clear]
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Last Editor</span>
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                        @{sheet.lastModifiedBy?.split(' ')[0].toLowerCase() || 'creator'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Timestamp</span>
                      <p className="text-[10px] text-slate-500 font-bold">{sheet.updatedAt?.split(',')[1] || 'Pending'}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-4 bg-slate-50 p-2 rounded-xl">
                       <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                       <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.1em]">Owner: {sheet.owner}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <footer className="text-center mt-20 pb-10">
         <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.3em]">Trademarkia Collaborative Engine</p>
         <p className="text-slate-400 text-[9px] mt-1 font-bold">Built by Keerthana V. © 2026</p>
      </footer>
    </div>
  );
}