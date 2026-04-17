import { useEffect, useState, FormEvent } from 'react';
import { createClient, Session } from '@supabase/supabase-js';
import {
  Kanban,
  Calendar,
  Archive,
  Settings,
  Search,
  Filter,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  LogOut
} from 'lucide-react';

const supabase = createClient(
  'https://ivfwxcxdazvhuvdxklhi.supabase.co',
  'sb_publishable_JMgZ58cAeMWuPYPGiIqsrA_PMh0VeaC'
);

type Task = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  status: 'todo' | 'doing' | 'done';
  created_at: string;
};

const getPriorityStyles = (priority: string) => {
  switch (priority) {
    case 'HIGH':
      return { container: 'border-tertiary-container', badge: 'bg-tertiary-fixed text-on-tertiary-fixed', label: 'ƯU TIÊN CAO' };
    case 'MEDIUM':
      return { container: 'border-secondary', badge: 'bg-secondary-container text-on-secondary-container', label: 'ƯU TIÊN TRUNG BÌNH' };
    case 'LOW':
      return { container: 'border-surface-tint', badge: 'bg-primary-fixed text-on-primary-fixed-variant', label: 'ƯU TIÊN THẤP' };
    default:
      return { container: 'border-outline', badge: 'bg-surface-container-highest text-outline', label: priority };
  }
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('ALL');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'MEDIUM' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setTasks(data as Task[]);
      }
    };

    fetchTasks();

    const channel = supabase
      .channel('custom-all-channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          if (payload.new.user_id === session.user.id) {
            setTasks((prev) => [payload.new as Task, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.user_id === session.user.id) {
            setTasks((prev) => prev.map((t) => (t.id === payload.new.id ? payload.new as Task : t)));
          }
        } else if (payload.eventType === 'DELETE') {
          setTasks((prev) => prev.filter((t) => t.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleAddTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!session?.user?.id || !newTask.title.trim()) return;

    const { error } = await supabase.from('tasks').insert([
      {
        user_id: session.user.id,
        title: newTask.title,
        description: newTask.description,
        priority: newTask.priority,
        status: 'todo'
      }
    ]);

    if (!error) {
      setShowAddModal(false);
      setNewTask({ title: '', description: '', priority: 'MEDIUM' });
    } else {
      console.error(error);
      alert('Đã xảy ra lỗi khi tạo công việc. Vui lòng kiểm tra lại rule trên Supabase (RLS).');
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
  };

  const deleteTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center font-body text-outline">Đang tải...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-surface flex flex-col font-body">
        <header className="bg-primary-container text-on-primary shadow-sm p-4 text-center">
            <span className="text-xl font-bold tracking-tight text-white font-headline">Quản lý Công việc Kanban</span>
        </header>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-lg border border-outline-variant max-w-sm w-full text-center">
               <div className="w-16 h-16 bg-primary-container text-white rounded-full flex items-center justify-center mx-auto mb-4">
                 <Kanban size={32} />
               </div>
               <h1 className="text-2xl font-bold tracking-tight text-primary font-headline mb-2">Đăng nhập</h1>
               <p className="text-on-surface-variant text-sm mb-8">Truy cập vào ứng dụng không gian làm việc Architectural Ledger của bạn.</p>
               <button onClick={handleLogin} className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white text-primary font-bold rounded-lg border border-outline hover:bg-slate-50 transition-colors shadow-sm">
                  <span className="font-black text-xl">G</span>
                  <span>Đăng nhập với Google</span>
               </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPriority = filterPriority === 'ALL' || t.priority === filterPriority;
    return matchesSearch && matchesPriority;
  });

  const todoTasks = filteredTasks.filter(t => t.status === 'todo');
  const doingTasks = filteredTasks.filter(t => t.status === 'doing');
  const doneTasks = filteredTasks.filter(t => t.status === 'done');

  const userMeta = session.user.user_metadata;
  const userName = userMeta?.full_name || session.user.email?.split('@')[0] || 'User';
  const userInitial = userName.charAt(0).toUpperCase();

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-background font-body">
      {/* TopNavBar */}
      <header className="bg-primary-container flex-shrink-0 text-on-primary sticky top-0 z-40 shadow-sm">
        <div className="flex justify-between items-center w-full px-8 py-4 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold tracking-tight text-white font-headline">
              Quản lý Công việc Kanban
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-on-primary-fixed-variant/50 text-white font-semibold rounded-lg hover:bg-on-primary-fixed-variant transition-colors shadow-sm">
              <LogOut size={18} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* SideNavBar */}
        <aside className="hidden md:flex flex-col h-full py-6 px-4 gap-4 bg-slate-100 w-64 border-r-0">
          <div className="px-2 mb-4">
            <h2 className="text-lg font-black text-[#003366] font-headline">Ledger Pro</h2>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Task Management</p>
          </div>
          <nav className="flex flex-col gap-1">
            <a className="flex items-center gap-3 px-4 py-3 text-[#003366] font-semibold bg-white/50 rounded-md transition-all active:scale-95 duration-150" href="#">
              <Kanban size={20} />
              <span>Bảng công việc</span>
            </a>
            <a className="flex items-center gap-3 px-4 py-3 text-slate-600 font-medium hover:text-[#003366] hover:bg-slate-200 transition-all active:scale-95 duration-150" href="#">
              <Calendar size={20} />
              <span>Lịch</span>
            </a>
            <a className="flex items-center gap-3 px-4 py-3 text-slate-600 font-medium hover:text-[#003366] hover:bg-slate-200 transition-all active:scale-95 duration-150" href="#">
              <Archive size={20} />
              <span>Lưu trữ</span>
            </a>
            <a className="flex items-center gap-3 px-4 py-3 text-slate-600 font-medium hover:text-[#003366] hover:bg-slate-200 transition-all active:scale-95 duration-150" href="#">
              <Settings size={20} />
              <span>Cài đặt</span>
            </a>
          </nav>
          <div className="mt-auto p-4 bg-surface-container-low rounded-xl">
            <div className="flex items-center gap-3">
              {userMeta?.avatar_url ? (
                 <img src={userMeta.avatar_url} alt="avatar" className="w-10 h-10 rounded-full border-2 border-primary-container object-cover" />
              ) : (
                <div className="w-10 h-10 flex-shrink-0 rounded-full bg-primary-container flex items-center justify-center text-white font-bold">
                  {userInitial}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-on-surface truncate">{userName}</p>
                <p className="text-xs text-outline truncate">{session.user.email}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-surface relative">
          {/* Toolbar */}
          <section className="px-8 py-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 max-w-2xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-surface-container-high border-none rounded-lg focus:ring-2 focus:ring-primary-container text-sm outline-none"
                  placeholder="Tìm kiếm công việc..."
                />
              </div>
              <div className="relative">
                <select 
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-2 bg-surface-container-high border-none rounded-lg focus:ring-2 outline-none focus:ring-primary-container text-sm font-medium text-on-surface-variant cursor-pointer"
                >
                  <option value="ALL">Tất cả mức độ ưu tiên</option>
                  <option value="HIGH">ƯU TIÊN CAO</option>
                  <option value="MEDIUM">ƯU TIÊN TRUNG BÌNH</option>
                  <option value="LOW">ƯU TIÊN THẤP</option>
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-outline pointer-events-none" size={16} />
              </div>
            </div>
            <button 
              onClick={() => setShowAddModal(true)}
              className="bg-primary-gradient text-on-primary px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:brightness-110 active:scale-95 transition-all"
            >
              <Plus size={20} />
              <span>Thêm công việc mới</span>
            </button>
          </section>

          {/* Kanban Board */}
          <section className="flex-1 overflow-x-auto px-8 pb-8 flex gap-8">
            
            {/* TO-DO COLUMN */}
            <div className="flex-1 min-w-[320px] flex flex-col gap-4">
              <div className="flex items-center justify-between py-2 border-b-2 border-primary-container/10">
                <h3 className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-xs">CẦN LÀM</h3>
                <span className="bg-surface-container-highest px-2 py-0.5 rounded text-[10px] font-bold text-outline">{todoTasks.length}</span>
              </div>
              <div className="flex-1 bg-surface-container-low rounded-xl p-4 flex flex-col gap-4 overflow-y-auto">
                {todoTasks.map(task => {
                  const styles = getPriorityStyles(task.priority);
                  return (
                    <div key={task.id} className={`bg-surface-container-lowest p-5 rounded-xl border-l-4 ${styles.container} shadow-sm hover:shadow-md transition-shadow group relative`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`${styles.badge} px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter`}>{styles.label}</span>
                        <button onClick={() => deleteTask(task.id)} className="text-outline hover:text-error transition-colors cursor-pointer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <h4 className="font-headline font-bold text-primary mb-1">{task.title}</h4>
                      {task.description && <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-3">{task.description}</p>}
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[10px] text-outline font-medium">{formatDate(task.created_at)}</span>
                        <div className="flex items-center gap-1">
                          <button disabled className="p-1 hover:bg-surface-container rounded-md text-outline disabled:opacity-30">
                            <ChevronLeft size={20} />
                          </button>
                          <button onClick={() => updateStatus(task.id, 'doing')} className="p-1 hover:bg-surface-container rounded-md text-primary-container cursor-pointer">
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DOING COLUMN */}
            <div className="flex-1 min-w-[320px] flex flex-col gap-4">
              <div className="flex items-center justify-between py-2 border-b-2 border-primary-container/10">
                <h3 className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-xs">ĐANG LÀM</h3>
                <span className="bg-primary-container px-2 py-0.5 rounded text-[10px] font-bold text-white">{doingTasks.length}</span>
              </div>
              <div className="flex-1 bg-surface-container-low rounded-xl p-4 flex flex-col gap-4 overflow-y-auto">
                {doingTasks.map(task => {
                  const styles = getPriorityStyles(task.priority);
                  return (
                    <div key={task.id} className={`bg-surface-container-lowest p-5 rounded-xl border-l-4 ${styles.container} shadow-sm hover:shadow-md transition-shadow group relative`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`${styles.badge} px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter`}>{styles.label}</span>
                        <button onClick={() => deleteTask(task.id)} className="text-outline hover:text-error transition-colors cursor-pointer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <h4 className="font-headline font-bold text-primary mb-1">{task.title}</h4>
                      {task.description && <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-3">{task.description}</p>}
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-[10px] text-outline font-medium">{formatDate(task.created_at)}</span>
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateStatus(task.id, 'todo')} className="p-1 hover:bg-surface-container rounded-md text-primary-container cursor-pointer">
                            <ChevronLeft size={20} />
                          </button>
                          <button onClick={() => updateStatus(task.id, 'done')} className="p-1 hover:bg-surface-container rounded-md text-primary-container cursor-pointer">
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DONE COLUMN */}
            <div className="flex-1 min-w-[320px] flex flex-col gap-4">
              <div className="flex items-center justify-between py-2 border-b-2 border-primary-container/10">
                <h3 className="font-headline font-bold text-on-surface-variant uppercase tracking-widest text-xs">HOÀN THÀNH</h3>
                <span className="bg-surface-container-highest px-2 py-0.5 rounded text-[10px] font-bold text-outline">{doneTasks.length}</span>
              </div>
              <div className="flex-1 bg-surface-container-low rounded-xl p-4 flex flex-col gap-4 overflow-y-auto">
                {doneTasks.map(task => {
                  return (
                    <div key={task.id} className="bg-surface-container-lowest/70 p-5 rounded-xl border-l-4 border-outline shadow-sm opacity-80 grayscale-[0.3]">
                      <div className="flex justify-between items-start mb-2">
                        <span className="bg-surface-container-highest text-outline px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter">ĐÃ HOÀN THÀNH</span>
                        <button onClick={() => deleteTask(task.id)} className="text-outline hover:text-error transition-colors cursor-pointer">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <h4 className="font-headline font-bold text-primary mb-1 line-through opacity-60">{task.title}</h4>
                      {task.description && <p className="text-xs text-on-surface-variant leading-relaxed opacity-60 line-through">{task.description}</p>}
                      <div className="mt-4 flex items-center justify-between">
                        <CheckCircle2 className="text-primary-container fill-primary-container/20" size={24} />
                        <div className="flex items-center gap-1">
                          <button onClick={() => updateStatus(task.id, 'doing')} className="p-1 hover:bg-surface-container rounded-md text-primary-container cursor-pointer">
                            <ChevronLeft size={20} />
                          </button>
                          <button disabled className="p-1 hover:bg-surface-container rounded-md text-outline disabled:opacity-30 cursor-not-allowed">
                            <ChevronRight size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </section>
        </main>
      </div>

      {/* Floating Action Button (Mobile) */}
      <button onClick={() => setShowAddModal(true)} className="md:hidden fixed bottom-6 right-6 w-14 h-14 bg-primary-gradient text-on-primary rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform z-40">
        <Plus size={32} />
      </button>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-secondary-fixed/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xl shadow-2xl p-6 w-full max-w-md border border-outline-variant">
            <h2 className="text-xl font-headline font-bold text-primary mb-4">Thêm công việc mới</h2>
            <form onSubmit={handleAddTask} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-semibold text-on-surface-variant mb-1">Tiêu đề</label>
                <input required type="text" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-md focus:ring-2 focus:ring-primary-container outline-none text-on-surface" placeholder="Nhập tiêu đề công việc..." />
              </div>
              <div>
                <label className="block text-sm font-semibold text-on-surface-variant mb-1">Mô tả</label>
                <textarea value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-md focus:ring-2 focus:ring-primary-container outline-none text-on-surface" rows={3} placeholder="Mô tả chi tiết..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-semibold text-on-surface-variant mb-1">Mức độ ưu tiên</label>
                <select value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})} className="w-full px-3 py-2 bg-surface-container border border-outline-variant rounded-md focus:ring-2 focus:ring-primary-container outline-none text-on-surface">
                  <option value="HIGH">Ưu tiên cao</option>
                  <option value="MEDIUM">Ưu tiên trung bình</option>
                  <option value="LOW">Ưu tiên thấp</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-md font-semibold text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer">Hủy</button>
                <button type="submit" className="bg-primary-gradient text-on-primary px-4 py-2 rounded-md font-bold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer">Lưu công việc</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
