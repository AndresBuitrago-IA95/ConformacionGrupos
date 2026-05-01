/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, signInWithGoogle } from './firebase';
import { STUDENTS } from './constants';
import { 
  Users, 
  Save, 
  History as HistoryIcon, 
  User as UserIcon,
  LogOut,
  ClipboardList,
  Loader2,
  Calendar,
  ChevronDown,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Types ---

interface Group {
  name: string;
  topic: string;
  members: string[]; // Fixed to 5 length in UI
}

interface GroupSession {
  id?: string;
  title: string;
  createdAt: any;
  groups: Group[];
  createdBy: string;
}

// --- Main App Component ---

export default function App() {
  const [loading, setLoading] = useState(true);
  const [currentGroups, setCurrentGroups] = useState<Group[]>([]);
  const [sessions, setSessions] = useState<GroupSession[]>([]);
  const [view, setView] = useState<'generator' | 'history'>('generator');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch {}
      await fetchSessions();
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (view === 'history') {
      fetchSessions();
    }
  }, [view]);

  const fetchSessions = async () => {
    const path = 'sessions';
    try {
      const q = query(
        collection(db, path),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const fetchedSessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as GroupSession[];
      setSessions(fetchedSessions);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  };

  const addNewGroup = () => {
    setCurrentGroups([...currentGroups, {
      name: `${currentGroups.length + 1}`,
      topic: '',
      members: ['', '', '', '', ''] // 5 slots
    }]);
  };

  const removeGroup = (index: number) => {
    const newGroups = currentGroups.filter((_, i) => i !== index);
    // Re-index group names
    const reindexedGroups = newGroups.map((g, i) => ({
      ...g,
      name: `${i + 1}`
    }));
    setCurrentGroups(reindexedGroups);
  };

  const updateGroupTopic = (index: number, topic: string) => {
    const newGroups = [...currentGroups];
    newGroups[index].topic = topic;
    setCurrentGroups(newGroups);
  };

  const updateMember = (groupIndex: number, memberIndex: number, value: string) => {
    const newGroups = [...currentGroups];
    newGroups[groupIndex].members[memberIndex] = value;
    setCurrentGroups(newGroups);
  };

  const getAllSelectedMembers = () => {
    return currentGroups.flatMap(g => g.members).filter(m => m !== '');
  };

  const saveSession = async () => {
    if (currentGroups.length === 0) return;
    
    // Filter out groups with no members and no topic
    const validGroups = currentGroups.filter(g => g.topic !== '' || g.members.some(m => m !== ''));
    if (validGroups.length === 0) {
      alert("Por favor, completa al menos un grupo.");
      return;
    }

    setSaving(true);
    const path = 'sessions';
    try {
      const newSession = {
        title: `Sesión del ${new Date().toLocaleString()}`,
        createdAt: serverTimestamp(),
        groups: validGroups.map(g => ({
          ...g,
          members: g.members.filter(m => m !== '') // Save only selected members
        })),
        createdBy: 'public'
      };
      await addDoc(collection(db, path), newSession);
      alert('Registro guardado correctamente en la base de datos (Persistente).');
      setCurrentGroups([]);
      await fetchSessions();
      setView('history');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const selectedMembers = getAllSelectedMembers();

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-[1500px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-[#1e4e79] p-2 rounded-lg">
               <Users className="text-white w-5 h-5" />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-gray-800">Gestión de Equipos Académicos</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-700">Acceso Público</p>
              <p className="text-[10px] text-gray-400 font-mono tracking-widest uppercase text-right">Modo Colaborativo</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto px-6 py-8">
        {/* Actions Bar */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
          <div>
            <p className="text-sm text-gray-500 font-medium italic">
              Los datos se guardan en la base de datos. <span className="font-bold text-gray-700">No se permiten duplicados.</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <button 
              onClick={addNewGroup}
              className="flex-1 lg:flex-none bg-[#22c55e] text-white px-5 py-2.5 rounded-md font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#16a34a] shadow-sm transition-all active:scale-95"
            >
              + Nuevo Grupo
            </button>
            <button 
              onClick={saveSession}
              disabled={saving || currentGroups.length === 0}
              className="flex-1 lg:flex-none bg-[#f59e0b] text-white px-5 py-2.5 rounded-md font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#d97706] shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button 
              onClick={() => setView(view === 'generator' ? 'history' : 'generator')}
              className="flex-1 lg:flex-none bg-[#334155] text-white px-5 py-2.5 rounded-md font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#1e293b] shadow-sm transition-all"
            >
              <ClipboardList size={16} />
              {view === 'generator' ? 'Listar Finalizados' : 'Volver al Editor'}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {view === 'generator' ? (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="border border-gray-200 rounded-lg overflow-hidden shadow-sm overflow-x-auto"
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#1e4e79] text-white divide-x divide-white/10 uppercase tracking-wider text-[11px] font-bold">
                    <th className="p-4 w-16 text-center">Grup.</th>
                    <th className="p-4 w-64 text-left">Tema a Abordar</th>
                    <th className="p-4 text-left">Integrante 1</th>
                    <th className="p-4 text-left">Integrante 2</th>
                    <th className="p-4 text-left">Integrante 3</th>
                    <th className="p-4 text-left">Integrante 4</th>
                    <th className="p-4 text-left">Integrante 5</th>
                    <th className="p-4 w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {currentGroups.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-20 text-center text-gray-400 italic bg-gray-50/50">
                        Haga clic en "+ Nuevo Grupo" para comenzar a conformar los equipos.
                      </td>
                    </tr>
                  ) : (
                    currentGroups.map((group, groupIdx) => (
                      <tr key={groupIdx} className="divide-x divide-gray-100 hover:bg-blue-50/30 transition-colors">
                        <td className="p-4 text-center font-bold text-gray-700 bg-gray-50/50">{group.name}</td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            placeholder="Tema..."
                            value={group.topic}
                            onChange={(e) => updateGroupTopic(groupIdx, e.target.value)}
                            className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none transition-all placeholder:text-gray-300"
                          />
                        </td>
                        {[0, 1, 2, 3, 4].map((memberIdx) => (
                          <td key={memberIdx} className="p-3">
                            <div className="relative group">
                              <select
                                value={group.members[memberIdx]}
                                onChange={(e) => updateMember(groupIdx, memberIdx, e.target.value)}
                                className="w-full appearance-none border border-gray-200 rounded px-3 py-2 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none bg-white transition-all pr-8 truncate"
                                style={{ borderLeft: '4px solid #ef4444' }}
                              >
                                <option value="">Seleccionar...</option>
                                {STUDENTS.map(student => (
                                  <option 
                                    key={student} 
                                    value={student}
                                    disabled={selectedMembers.includes(student) && group.members[memberIdx] !== student}
                                  >
                                    {student}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                            </div>
                          </td>
                        ))}
                        <td className="p-3 text-center">
                          <button
                            onClick={() => removeGroup(groupIdx)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Eliminar Grupo"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              {sessions.length === 0 ? (
                <div className="bg-white p-20 text-center rounded-xl border border-gray-200 shadow-sm">
                  <HistoryIcon className="w-16 h-16 text-gray-200 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No se han encontrado registros finalizados.</p>
                </div>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden group">
                    <div className="bg-gray-50 p-5 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="font-bold text-gray-800 text-lg">{session.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                          <Calendar size={12} />
                          <span>{session.createdAt?.toDate ? session.createdAt.toDate().toLocaleString() : 'Cargando...'}</span>
                        </div>
                      </div>
                      <div className="flex gap-4">
                         <div className="text-right">
                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Grupos</p>
                           <p className="text-sm font-bold text-blue-600">{session.groups.length}</p>
                         </div>
                      </div>
                    </div>
                    <div className="p-0 overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-[#1e4e79] text-white">
                            <th className="p-3 text-left text-[10px] uppercase border border-white/10 w-16 text-center">Grup.</th>
                            <th className="p-3 text-left text-[10px] uppercase border border-white/10 w-64">Tema Abordado</th>
                            <th className="p-3 text-left text-[10px] uppercase border border-white/10">Integrantes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {session.groups.map((g, gi) => (
                            <tr key={gi} className="hover:bg-gray-50 transition-colors">
                              <td className="p-3 text-sm font-bold text-gray-500 text-center bg-gray-50/50">{g.name}</td>
                              <td className="p-3 text-sm text-gray-700 italic">{g.topic || <span className="text-gray-300">N/A</span>}</td>
                              <td className="p-3">
                                <div className="flex flex-wrap gap-1.5">
                                  {g.members.map((m, mi) => (
                                    <span key={mi} className="text-[10px] bg-white text-gray-600 px-3 py-1.5 rounded border border-gray-200 shadow-sm border-l-4 border-l-blue-600 font-medium">
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="mt-20 border-t border-gray-100 py-10 px-6">
        <div className="max-w-[1500px] mx-auto flex flex-col md:flex-row justify-between items-center text-gray-400 text-xs gap-4">
          <p>© 2024 Gestor de Equipos Académicos | Universidad Libre</p>
          <div className="flex gap-4">
            <span>Privacidad</span>
            <span>Términos</span>
            <span className="text-blue-500 font-bold uppercase tracking-tighter">Firebase Cloud DB</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
