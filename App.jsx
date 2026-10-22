import React, { useState, useEffect } from 'react';
import { fakeApi } from './fakeApi.js';
import { CATEGORIES, PRIORITIES, STATUSES } from './initial-data-sample.js';

export default function App() {
  // --- STATES ---
  const [tasks, setTasks] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Async Detail States
  const [selectedId, setSelectedId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // Action / Mutation States
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toast, setToast] = useState(null);

  // Modals & Form States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Filter & Search States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // --- EFFECT 1: Fetching main item list ---
  useEffect(() => {
    let ignore = false;
    setListLoading(true);
    setListError(null);

    fakeApi.getAll()
      .then((data) => {
        if (!ignore) {
          setTasks(data);
          setListLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setListError(err.message);
          setListLoading(false);
        }
      });

    return () => {
      ignore = true; // Cleanup
    };
  }, [reloadToken]);

  // --- EFFECT 2: Async loading item details (RACE CONDITION PREVENTION) ---
  useEffect(() => {
    if (!selectedId) {
      setDetailData(null);
      setDetailError(null);
      return;
    }

    let ignore = false; // Flag to prevent race condition on fast switching
    setDetailLoading(true);
    setDetailError(null);

    fakeApi.getById(selectedId)
      .then((data) => {
        if (!ignore) {
          setDetailData(data);
          setDetailLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setDetailError(err.message);
          setDetailLoading(false);
        }
      });

    return () => {
      ignore = true; // Cleanup: ignores result if user clicks another item fast!
    };
  }, [selectedId]);

  // Toast Timer
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // --- HANDLERS (No stale closures: target IDs captured explicitly) ---

  const handleReload = () => {
    setReloadToken((prev) => prev + 1);
    setToast('Task list refreshed!');
  };

  const handleResetSeed = async () => {
    setListLoading(true);
    const fresh = await fakeApi.resetData();
    setTasks(fresh);
    setListLoading(false);
    setSelectedId(null);
    setToast('Reset to initial 100 records!');
  };

  // Status Change Action (Capture targetId to prevent stale closure)
  const handleToggleStatus = async (targetId, currentStatus) => {
    if (actionLoadingId) return; // Prevent concurrent actions
    setActionLoadingId(targetId);

    const nextStatus = currentStatus === 'Completed' ? 'In Progress' : 'Completed';

    try {
      const updated = await fakeApi.update(targetId, { status: nextStatus });

      // Immutable state update
      setTasks((prevTasks) =>
        prevTasks.map((t) => (t.id === targetId ? updated : t))
      );

      // If this item is currently selected in details view, update details state
      if (selectedId === targetId) {
        setDetailData(updated);
      }

      setToast(`Task ${targetId} marked as ${nextStatus}!`);
    } catch (err) {
      alert(`Error updating status: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Remove Action
  const handleDelete = async (targetId) => {
    if (!window.confirm(`Are you sure you want to delete ${targetId}?`)) return;

    setActionLoadingId(targetId);
    try {
      await fakeApi.remove(targetId);
      setTasks((prev) => prev.filter((t) => t.id !== targetId));

      if (selectedId === targetId) {
        setSelectedId(null);
      }
      setToast(`Task ${targetId} removed successfully.`);
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Create Form Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const newTask = {
      title: formData.get('title'),
      category: formData.get('category'),
      priority: formData.get('priority'),
      status: formData.get('status'),
      assignee: formData.get('assignee'),
      estimatedHours: Number(formData.get('estimatedHours')),
      description: formData.get('description')
    };

    setActionLoadingId('CREATE');
    try {
      const created = await fakeApi.create(newTask);
      setTasks((prev) => [created, ...prev]);
      setIsCreateOpen(false);
      setSelectedId(created.id);
      setToast(`Created new task ${created.id}`);
    } catch (err) {
      alert(`Creation failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Edit Form Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingTask) return;

    const formData = new FormData(e.target);
    const updatedFields = {
      title: formData.get('title'),
      category: formData.get('category'),
      priority: formData.get('priority'),
      status: formData.get('status'),
      assignee: formData.get('assignee'),
      estimatedHours: Number(formData.get('estimatedHours')),
      description: formData.get('description')
    };

    const targetId = editingTask.id;
    setActionLoadingId(targetId);

    try {
      const updated = await fakeApi.update(targetId, updatedFields);
      setTasks((prev) => prev.map((t) => (t.id === targetId ? updated : t)));

      if (selectedId === targetId) {
        setDetailData(updated);
      }
      setEditingTask(null);
      setToast(`Task ${targetId} updated!`);
    } catch (err) {
      alert(`Edit failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  // --- COMPUTED DATA (NO useMemo used as per restriction) ---
  const filteredTasks = tasks.filter((task) => {
    const matchesQuery =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.assignee.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'All' || task.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || task.status === statusFilter;

    return matchesQuery && matchesCategory && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-30 glass-card border-b border-slate-800 px-4 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-xl shadow-lg">
            D
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">DevTask Hub</h1>
            <p className="text-xs text-slate-400">Async React Effects & API Tracker</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleReload}
            disabled={listLoading}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors flex items-center space-x-1"
          >
            <span>🔄</span>
            <span>{listLoading ? 'Loading...' : 'Reload List'}</span>
          </button>

          <button
            onClick={handleResetSeed}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg"
          >
            Reset 100 Seed
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-md transition-all"
          >
            + New Task
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: List & Filters (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Filters Bar */}
          <div className="glass-card p-4 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, ID, assignee..."
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="All">All Statuses</option>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="text-[11px] text-slate-400 flex justify-between">
              <span>Showing {filteredTasks.length} of {tasks.length} tasks</span>
              {(searchQuery || categoryFilter !== 'All' || statusFilter !== 'All') && (
                <button
                  onClick={() => { setSearchQuery(''); setCategoryFilter('All'); setStatusFilter('All'); }}
                  className="text-indigo-400 hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* List Feedback States */}
          {listLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="glass-card p-4 rounded-xl animate-pulse space-y-2">
                  <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-800/60 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          )}

          {listError && (
            <div className="p-6 glass-card border-red-500/40 rounded-xl text-center">
              <p className="text-red-400 text-xs mb-3">⚠️ {listError}</p>
              <button onClick={handleReload} className="px-3 py-1 bg-red-600 text-white text-xs rounded">Retry</button>
            </div>
          )}

          {!listLoading && !listError && filteredTasks.length === 0 && (
            <div className="p-8 glass-card rounded-xl text-center text-slate-400 text-xs">
              No tasks found matching your active filters.
            </div>
          )}

          {/* Task List */}
          {!listLoading && !listError && (
            <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
              {filteredTasks.map((task) => {
                const isSelected = selectedId === task.id;
                const isActionBusy = actionLoadingId === task.id;

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedId(task.id)}
                    className={`glass-card p-3.5 rounded-xl transition-all cursor-pointer border ${
                      isSelected ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono font-bold text-indigo-400">{task.id}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {task.category}
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-white mt-1 line-clamp-1">{task.title}</h3>
                      </div>

                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        task.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {task.status}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>👤 {task.assignee}</span>
                      
                      <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleStatus(task.id, task.status)}
                          disabled={isActionBusy}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        >
                          {isActionBusy ? '...' : task.status === 'Completed' ? 'Reopen' : 'Complete'}
                        </button>
                        <button
                          onClick={() => setEditingTask(task)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-red-900/50 text-red-400 border border-slate-700"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Extended Details View (5 Cols) */}
        <div className="lg:col-span-5">
          <div className="glass-card p-5 rounded-xl sticky top-24 border border-slate-800">
            <h2 className="text-sm font-bold text-white mb-4 border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Async Detail Inspector</span>
              {selectedId && <span className="text-xs font-mono text-indigo-400">{selectedId}</span>}
            </h2>

            {!selectedId && (
              <div className="text-center py-12 text-slate-500 text-xs">
                👉 Select any task from the list to asynchronously fetch its complete extended details.
              </div>
            )}

            {detailLoading && (
              <div className="space-y-4 animate-pulse">
                <div className="h-5 bg-slate-800 rounded w-1/2"></div>
                <div className="h-4 bg-slate-800/60 rounded w-3/4"></div>
                <div className="h-20 bg-slate-800/40 rounded w-full"></div>
                <p className="text-[11px] text-indigo-400 text-center">Fetching details via async Promise...</p>
              </div>
            )}

            {detailError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">
                ⚠️ {detailError}
              </div>
            )}

            {!detailLoading && !detailError && detailData && (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Field 1: Title</span>
                  <h3 className="text-base font-bold text-white">{detailData.title}</h3>
                </div>

                {/* 7+ Displayed Fields */}
                <div className="grid grid-cols-2 gap-3 bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Field 2: Task ID</span>
                    <span className="font-mono text-indigo-300 font-bold">{detailData.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Field 3: Category</span>
                    <span className="text-slate-200 font-medium">{detailData.category}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Field 4: Priority</span>
                    <span className="text-amber-400 font-bold">{detailData.priority}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Field 5: Status</span>
                    <span className="text-emerald-400 font-bold">{detailData.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Field 6: Assignee</span>
                    <span className="text-slate-200">{detailData.assignee}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Field 7: Est. Hours</span>
                    <span className="text-slate-200 font-bold">{detailData.estimatedHours} hrs</span>
                  </div>
                  <div className="col-span-2 border-t border-slate-800 pt-1.5">
                    <span className="text-slate-500 block text-[10px]">Field 8: Created Date</span>
                    <span className="text-slate-400 font-mono">{detailData.createdAt}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] uppercase block mb-1">Field 9: Full Description</span>
                  <p className="p-3 bg-slate-900/50 rounded-lg text-slate-300 leading-relaxed border border-slate-800 text-[11px]">
                    {detailData.description}
                  </p>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <button
                    onClick={() => handleToggleStatus(detailData.id, detailData.status)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold text-xs"
                  >
                    Set Status: {detailData.status === 'Completed' ? 'Open' : 'Completed'}
                  </button>

                  <button
                    onClick={() => setSelectedId(null)}
                    className="text-slate-500 hover:text-slate-300 text-xs"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* CREATE MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-xl border border-slate-700">
            <h2 className="text-base font-bold text-white mb-4">Create New Task</h2>
            <form onSubmit={handleCreateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Title *</label>
                <input required name="title" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <select name="category" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Priority</label>
                  <select name="priority" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Status</label>
                  <select name="status" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Assignee</label>
                  <input required name="assignee" defaultValue="Medeu Seidali" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Estimated Hours</label>
                <input required type="number" name="estimatedHours" defaultValue="4" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Description</label>
                <textarea required name="description" rows="3" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="px-3 py-1.5 text-slate-400">Cancel</button>
                <button type="submit" disabled={actionLoadingId === 'CREATE'} className="px-4 py-1.5 bg-indigo-600 text-white rounded font-bold">
                  {actionLoadingId === 'CREATE' ? 'Saving...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingTask && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card max-w-md w-full p-6 rounded-xl border border-slate-700">
            <h2 className="text-base font-bold text-white mb-4">Edit Task: {editingTask.id}</h2>
            <form onSubmit={handleEditSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Title</label>
                <input required name="title" defaultValue={editingTask.title} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Category</label>
                  <select name="category" defaultValue={editingTask.category} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Priority</label>
                  <select name="priority" defaultValue={editingTask.priority} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1">Status</label>
                  <select name="status" defaultValue={editingTask.status} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white">
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">Assignee</label>
                  <input required name="assignee" defaultValue={editingTask.assignee} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
                </div>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Estimated Hours</label>
                <input required type="number" name="estimatedHours" defaultValue={editingTask.estimatedHours} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Description</label>
                <textarea required name="description" rows="3" defaultValue={editingTask.description} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white" />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button type="button" onClick={() => setEditingTask(null)} className="px-3 py-1.5 text-slate-400">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-indigo-600 text-white rounded font-bold">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 glass-card border border-emerald-500/50 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-bold shadow-2xl flex items-center space-x-2">
          <span>✅</span>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
