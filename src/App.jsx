import React, { useState, useEffect, useReducer, useRef } from 'react';
import './App.css';
import { db } from './firebase-config';
import { 
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where 
} from 'firebase/firestore';
import { Plus, Trash2, Clock, Filter, Grid, Users, MessageSquare, Heart, Send, X, CheckCircle, Moon, Sun, Folder, FolderPlus, Archive } from 'lucide-react';

// --- CONSTANTS ---
const activityReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_ACTIVITY':
      return [{ id: Date.now(), message: action.payload.message, timestamp: new Date(), user: action.payload.user, type: action.payload.type }, ...state].slice(0, 100);
    default:
      return state;
  }
};

const PRIORITY_LEVELS = {
  LOW: { label: 'Low', color: '#10b981', bg: '#d1fae5' },
  MEDIUM: { label: 'Medium', color: '#f59e0b', bg: '#fef3c7' },
  HIGH: { label: 'High', color: '#ef4444', bg: '#fee2e2' },
  CRITICAL: { label: 'Critical', color: '#7f1d1d', bg: '#fecaca' }
};

// --- SUB-COMPONENTS ---

const TaskCard = ({ task, handleDragStart, deleteTask, setSelectedTask, getTeamMember }) => {
  const assignee = getTeamMember(task.assignee);
  const priorityStyle = PRIORITY_LEVELS[task.priority] || PRIORITY_LEVELS.MEDIUM;

  return (
    <div draggable onDragStart={(e) => handleDragStart(e, task)} className="task-card-modern" onClick={() => setSelectedTask(task)}>
      <div className="task-card-top">
        <h3 className="task-title">{task.text}</h3>
        <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} className="task-delete-btn"><X size={14} /></button>
      </div>
      {task.description && <p className="task-description">{task.description}</p>}
      <div className="task-meta">
        <span className="priority-tag" style={{ backgroundColor: priorityStyle.bg, color: priorityStyle.color }}>{priorityStyle.label}</span>
      </div>
      <div className="task-footer">
        {assignee && <div className="avatar-mini" style={{ backgroundColor: assignee.color }}>{assignee.initials}</div>}
        <span className="comment-badge"><MessageSquare size={12} />{(task.comments || []).length}</span>
      </div>
    </div>
  );
};

const Column = ({ status, title, getTasksByStatus, handleDragOver, handleDrop, handleDragStart, deleteTask, setSelectedTask, getTeamMember }) => {
  const statusTasks = getTasksByStatus(status);
  return (
    <div onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, status)} className="kanban-column">
      <div className="column-header">
        <h2>{title}</h2>
        <span className="task-count">{statusTasks.length}</span>
      </div>
      <div className="tasks-container">
        {statusTasks.map(task => (
          <TaskCard key={task.id} task={task} handleDragStart={handleDragStart} deleteTask={deleteTask} setSelectedTask={setSelectedTask} getTeamMember={getTeamMember} />
        ))}
        {statusTasks.length === 0 && <div className="empty-state">No tasks</div>}
      </div>
    </div>
  );
};

const TaskModal = ({ task, onClose, updateTask, moveTask, assignTask, addComment, deleteComment, likeComment, getTeamMember, teamMembers }) => {
  if (!task) return null;
  const [localDescription, setLocalDescription] = useState(task.description || '');
  const [localComment, setLocalComment] = useState('');
  const commentInputRef = useRef(null);

  // Sync local description if task changes externally
  useEffect(() => { 
    setLocalDescription(task.description || ''); 
  }, [task.id, task.description]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localDescription !== task.description) updateTask(task.id, { description: localDescription });
    }, 1000);
    return () => clearTimeout(timer);
  }, [localDescription, task.id, task.description, updateTask]);

  const handleCommentSubmit = () => {
    if (localComment.trim()) {
      addComment(task.id, localComment);
      setLocalComment('');
      if (commentInputRef.current) commentInputRef.current.focus();
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-top">
          <input type="text" value={task.text} onChange={(e) => updateTask(task.id, { text: e.target.value })} className="modal-title-input" placeholder="Task name" />
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <div className="modal-split">
          <div className="modal-left">
            <div className="form-group">
              <label>Description</label>
              <textarea value={localDescription} onChange={(e) => setLocalDescription(e.target.value)} onBlur={() => updateTask(task.id, { description: localDescription })} className="description-textarea" rows="5" placeholder="Add description..." />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select value={task.status} onChange={(e) => moveTask(task.id, e.target.value)} className="form-select" style={{width: '100%'}}>
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={task.priority} onChange={(e) => updateTask(task.id, { priority: e.target.value })} className="form-select" style={{width: '100%'}}>
                {Object.entries(PRIORITY_LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Assignee</label>
              <select 
                value={task.assignee || ''} 
                onChange={(e) => {
                  const memberId = e.target.value || null; 
                  assignTask(task.id, memberId);
                }} 
                className="form-select" 
                style={{width: '100%'}}
              >
                <option value="">Unassigned</option>
                {teamMembers && teamMembers.length > 0 ? (
                  teamMembers.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))
                ) : (
                  <option disabled>No team members</option>
                )}
              </select>
            </div>
            <div className="form-group">
              <label>Due Date</label>
              <input 
                type="date" 
                value={task.dueDate || new Date().toISOString().split('T')[0]} 
                onChange={(e) => updateTask(task.id, { dueDate: e.target.value })} 
                className="form-select" 
                style={{width: '100%'}} 
              />
            </div>
          </div>
          <div className="modal-right">
            <div className="comments-section">
              <h3>Comments ({(task.comments || []).length})</h3>
              <div className="comments-area">
                {(task.comments || []).length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px', fontSize: '13px' }}>
                    No comments yet. Be the first to comment!
                  </p>
                ) : (
                  (task.comments || []).map(c => {
                    // FIX: Use stored user details directly instead of looking up ID
                    const userName = c.userName || 'Unknown User';
                    const userInitials = c.userInitials || 'U';
                    const userColor = c.userColor || '#6366f1';

                    return (
                      <div key={c.id} className="comment-box">
                        <div className="comment-head">
                          <div className="comment-avatar" style={{ backgroundColor: userColor }}>
                            {userInitials}
                          </div>
                          <div style={{flex: 1}}>
                            <div className="comment-name">{userName}</div>
                            <div className="comment-time">
                              {new Date(c.timestamp?.seconds * 1000 || c.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              deleteComment(task.id, c.id); 
                            }} 
                            className="comment-delete-btn"
                            style={{ cursor: 'pointer', background: 'none', border: 'none', color: 'var(--text-muted)' }}
                            title="Delete comment"
                          >
                            <X size={12} />
                          </button>
                        </div>
                        <p className="comment-text">{c.text}</p>
                        <div className="comment-footer">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              likeComment(task.id, c.id);
                            }} 
                            className="like-btn"
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: c.likes > 0 ? '#ec4899' : 'var(--text-muted)' }}
                          >
                            <Heart size={14} fill={c.likes > 0 ? "#ec4899" : "none"} />
                            <span style={{fontSize: '12px', fontWeight: '600'}}>{c.likes || 0}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="comment-input">
                <textarea 
                  ref={commentInputRef} 
                  placeholder="Write your comment here..." 
                  value={localComment} 
                  onChange={(e) => setLocalComment(e.target.value)} 
                  onKeyDown={(e) => { 
                    if (e.key === 'Enter' && !e.shiftKey) { 
                      e.preventDefault(); 
                      handleCommentSubmit(); 
                    } 
                  }} 
                  className="comment-textarea" 
                  rows="3" 
                />
                <div className="comment-buttons">
                  <button onClick={handleCommentSubmit} className="send-btn"><Send size={14} /> Send</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectModal = ({ projects, setShowProjectModal, newProjectName, setNewProjectName, createProject }) => (
  <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && projects.length > 0 && setShowProjectModal(false)}>
    <div className="modal-box project-modal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal-top">
        <h2><FolderPlus size={18} /> Create Project</h2>
        {projects.length > 0 && <button onClick={() => { setShowProjectModal(false); setNewProjectName(''); }} className="close-btn"><X size={20} /></button>}
      </div>
      <div className="project-form">
        <input type="text" placeholder="Enter project name..." value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newProjectName.trim()) { createProject(newProjectName); } }} className="form-input" autoFocus />
        <div className="form-buttons">
          <button onClick={() => { if (newProjectName.trim()) createProject(newProjectName); }} className="btn-primary">Create Project</button>
          {projects.length > 0 && <button onClick={() => { setShowProjectModal(false); setNewProjectName(''); }} className="btn-secondary">Cancel</button>}
        </div>
      </div>
    </div>
  </div>
);

const DeleteConfirmModal = ({ setShowDeleteConfirm, currentProject, confirmDeleteProject }) => (
  <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowDeleteConfirm(false)}>
    <div className="modal-box delete-modal" onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal-top">
        <h2>Delete Project</h2>
        <button onClick={() => setShowDeleteConfirm(false)} className="close-btn"><X size={20} /></button>
      </div>
      <div className="delete-form">
        <p style={{fontSize: '14px', color: 'var(--text-primary)'}}>Are you sure you want to delete "{currentProject?.name}"?</p>
        <div className="form-buttons">
          <button onClick={confirmDeleteProject} className="btn-danger">Delete</button>
          <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
);

const TeamManagementModal = ({ onClose, addTeamMember, teamMembers, updateTeamMember, deleteTeamMember }) => {
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('');
  const handleAddMember = () => {
    if (!newMemberName.trim()) return;
    addTeamMember({ name: newMemberName, role: newMemberRole || 'Team Member', initials: newMemberName.slice(0, 2).toUpperCase() });
    setNewMemberName(''); setNewMemberRole('');
  };
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: '600px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-top" style={{ flexShrink: 0 }}>
          <h2><Users size={18} /> Manage Team</h2>
          <button onClick={onClose} className="close-btn"><X size={20} /></button>
        </div>
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Add New Team Member</h3>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input type="text" placeholder="Name" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} className="form-input" style={{ flex: 1 }} />
              <input type="text" placeholder="Role" value={newMemberRole} onChange={(e) => setNewMemberRole(e.target.value)} className="form-input" style={{ flex: 1 }} />
            </div>
            <button onClick={handleAddMember} className="btn-primary"><Plus size={14} /> Add Member</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Team Members ({teamMembers.length})</h3>
            {teamMembers.map(member => (
              <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div className="avatar-mini" style={{ backgroundColor: member.color, width: '36px', height: '36px', fontSize: '12px', flexShrink: 0 }}>{member.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '13px' }}>{member.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{member.role}</div>
                </div>
                <button onClick={() => { const newName = prompt('Update name:', member.name); if (newName !== null) { const newRole = prompt('Update role:', member.role); if (newRole !== null) updateTeamMember(member.id, { name: newName, role: newRole, initials: newName.slice(0, 2).toUpperCase() }); } }} className="icon-btn" style={{ width: '30px', height: '30px', flexShrink: 0 }}><CheckCircle size={14} /></button>
                <button onClick={() => deleteTeamMember(member.id)} className="icon-btn danger" style={{ width: '30px', height: '30px', flexShrink: 0 }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const ProjectsView = ({ projects, currentProject, switchProject, setShowProjectModal }) => (
  <div className="projects-grid">
    {projects.map(project => {
      const isCurrent = currentProject?.id === project.id;
      return (
        <div key={project.id} className="project-card" onClick={() => switchProject(project)}>
          <div className="project-card-header">
            <div className="project-color-dot" style={{ backgroundColor: project.color }}></div>
            <h3>{project.name} {isCurrent && <span style={{fontSize: '10px', color: 'var(--accent)', marginLeft: '8px'}}>(Active)</span>}</h3>
          </div>
          <div className="project-stats-row"><span>Created: {new Date(project.createdAt?.seconds * 1000 || project.createdAt).toLocaleDateString()}</span></div>
        </div>
      );
    })}
    <div className="project-card" onClick={() => setShowProjectModal(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed var(--border)', background: 'transparent' }}>
      <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
        <Plus size={24} style={{ margin: '0 auto 8px' }} />
        <p style={{ fontSize: '13px', fontWeight: '600' }}>Create New Project</p>
      </div>
    </div>
  </div>
);

// --- MAIN APP ---
function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('taskmates_dark') === 'true');
  const [teamMembers, setTeamMembers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [draggedTask, setDraggedTask] = useState(null);
  const [activities, dispatchActivity] = useReducer(activityReducer, []);
  const [selectedTask, setSelectedTask] = useState(null); // This holds the task currently open in Modal
  const [filterPriority, setFilterPriority] = useState('ALL');
  const [filterAssignee, setFilterAssignee] = useState('ALL');
  const [boardView, setBoardView] = useState('board'); 
  const [newTaskStatus, setNewTaskStatus] = useState('todo');
  const [editingTeamMember, setEditingTeamMember] = useState(null);

  useEffect(() => {
    localStorage.setItem('taskmates_dark', darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const teamSnap = await getDocs(collection(db, 'team'));
        let teamData = teamSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (teamData.length === 0) {
          const defaultTeam = [
            { name: 'Ru Dev', color: '#6366f1', role: 'PM/BA', initials: 'RD' },
            { name: 'Alex Code', color: '#8b5cf6', role: 'Engineer', initials: 'AC' },
            { name: 'Sarah Design', color: '#ec4899', role: 'Designer', initials: 'SD' }
          ];
          for (const member of defaultTeam) {
            const docRef = await addDoc(collection(db, 'team'), member);
            teamData.push({ id: docRef.id, ...member });
          }
        }
        setTeamMembers(teamData);

        const projSnap = await getDocs(collection(db, 'projects'));
        const projData = projSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProjects(projData);
        
        if (projData.length > 0) setCurrentProject(projData[0]);
        else setShowProjectModal(true);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching data: ", error);
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!currentProject) return;
    const fetchTasks = async () => {
      const q = query(collection(db, 'tasks'), where('projectId', '==', currentProject.id));
      const taskSnap = await getDocs(q);
      const taskData = taskSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(taskData);
    };
    fetchTasks();
  }, [currentProject]);

  const logActivity = (message) => dispatchActivity({ type: 'ADD_ACTIVITY', payload: { message, user: 1, type: 'general' } });
  const getTeamMember = (id) => teamMembers.find(m => m.id === id);

  // --- OPTIMISTIC ACTIONS ---

  const addTeamMember = async (member) => {
    const newMember = { ...member, color: member.color || '#6366f1' };
    const docRef = await addDoc(collection(db, 'team'), newMember);
    setTeamMembers(prev => [...prev, { id: docRef.id, ...newMember }]);
    logActivity(`Added new team member: ${newMember.name}`);
  };

  const updateTeamMember = async (id, updates) => {
    const docRef = doc(db, 'team', id);
    await updateDoc(docRef, updates);
    setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const deleteTeamMember = async (id) => {
    const member = getTeamMember(id);
    if (confirm('Delete this team member?')) {
      await deleteDoc(doc(db, 'team', id));
      setTeamMembers(prev => prev.filter(m => m.id !== id));
      setTasks(prev => prev.map(t => t.assignee === id ? { ...t, assignee: null } : t));
      logActivity(`Removed team member: ${member?.name}`);
    }
  };

  const createProject = async (name) => {
    if (!name.trim()) return;
    const newProject = { name: name, createdAt: new Date(), color: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][Math.floor(Math.random() * 5)] };
    const docRef = await addDoc(collection(db, 'projects'), newProject);
    const createdProject = { id: docRef.id, ...newProject };
    setProjects(prev => [...prev, createdProject]);
    setCurrentProject(createdProject);
    setShowProjectModal(false);
    setNewProjectName('');
    logActivity(`Created new project: ${name}`);
  };

  const switchProject = (project) => {
    setCurrentProject(project);
    setBoardView('board'); 
    logActivity(`Switched to project: ${project.name}`);
  };

  const confirmDeleteProject = async () => {
    if (!currentProject) return;
    await deleteDoc(doc(db, 'projects', currentProject.id));
    const q = query(collection(db, 'tasks'), where('projectId', '==', currentProject.id));
    const taskSnap = await getDocs(q);
    taskSnap.forEach(async (taskDoc) => { await deleteDoc(doc(db, 'tasks', taskDoc.id)); });
    const newProjects = projects.filter(p => p.id !== currentProject.id);
    setProjects(newProjects);
    setShowDeleteConfirm(false);
    logActivity(`Deleted project: ${currentProject.name}`);
    if (newProjects.length > 0) switchProject(newProjects[0]); 
    else { setCurrentProject(null); setShowProjectModal(true); setTasks([]); }
  };

  const addComment = async (taskId, text) => {
    if (!text.trim()) return;
    const task = tasks.find(t => t.id === taskId);
    
    // FIX: Hardcode user details for now so it doesn't show "Unknown User"
    const newComment = { 
      id: Date.now(), 
      user: 'rusiru', 
      userName: 'Rusiru', 
      userInitials: 'RU', 
      userColor: '#6366f1',
      text: text, 
      timestamp: new Date(), 
      likes: 0 
    };
    const updatedComments = [...(task.comments || []), newComment];
    
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, comments: updatedComments } : t));
    // Also update selectedTask so modal shows it immediately
    setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, comments: updatedComments } : prev);
    
    try {
      await updateDoc(doc(db, 'tasks', taskId), { comments: updatedComments, updatedAt: new Date() });
    } catch (error) { console.error("Error adding comment:", error); }
  };

  const deleteComment = async (taskId, commentId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const updatedComments = task.comments.filter(c => c.id !== commentId);
    
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, comments: updatedComments } : t));
    setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, comments: updatedComments } : prev);
    
    try {
      await updateDoc(doc(db, 'tasks', taskId), { comments: updatedComments });
    } catch (error) { console.error("Error deleting comment:", error); }
  };

  const likeComment = async (taskId, commentId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    const updatedComments = task.comments.map(c => 
      c.id === commentId ? { ...c, likes: (c.likes || 0) + 1 } : c
    );
    
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, comments: updatedComments } : t));
    setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, comments: updatedComments } : prev);
    
    try {
      await updateDoc(doc(db, 'tasks', taskId), { comments: updatedComments });
    } catch (error) { console.error("Error liking comment:", error); }
  };

  const addTask = async (title) => {
    if (!title.trim()) return false;
    const newTask = { text: title, description: '', status: newTaskStatus, priority: 'MEDIUM', assignee: null, dueDate: null, createdAt: new Date(), updatedAt: new Date(), comments: [], tags: [], projectId: currentProject.id };
    const docRef = await addDoc(collection(db, 'tasks'), newTask);
    setTasks(prev => [...prev, { id: docRef.id, ...newTask }]);
    logActivity(`Created new task: "${title}"`);
    return true;
  };

  const deleteTask = async (id) => {
    const task = tasks.find(t => t.id === id);
    await deleteDoc(doc(db, 'tasks', id));
    setTasks(prev => prev.filter(t => t.id !== id));
    if (selectedTask && selectedTask.id === id) setSelectedTask(null);
    if (task) logActivity(`Deleted task: "${task.text}"`);
  };

  const moveTask = async (taskId, newStatus) => {
    const task = tasks.find(t => t.id === taskId);
    
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, status: newStatus } : prev);
    
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status: newStatus, updatedAt: new Date() });
      const statusNames = { todo: 'To Do', inprogress: 'In Progress', done: 'Done' };
      logActivity(`Moved task "${task.text}" to ${statusNames[newStatus]}`);
    } catch (error) { console.error("Error moving task:", error); }
  };

  const updateTask = async (id, updates) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    // FIX: Update selectedTask immediately so Modal reflects changes instantly
    setSelectedTask(prev => prev && prev.id === id ? { ...prev, ...updates } : prev);
    
    try {
      await updateDoc(doc(db, 'tasks', id), updates);
    } catch (error) { console.error("Error updating task:", error); }
  };

  const assignTask = async (taskId, memberId) => {
    const member = getTeamMember(memberId);
    
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, assignee: memberId } : t));
    setSelectedTask(prev => prev && prev.id === taskId ? { ...prev, assignee: memberId } : prev);
    
    try {
      await updateDoc(doc(db, 'tasks', taskId), { assignee: memberId });
      if (member) logActivity(`Assigned task to ${member.name}`);
    } catch (error) { console.error("Error assigning task:", error); }
  };

  const filteredTasks = tasks.filter(task => {
    const priorityMatch = filterPriority === 'ALL' || task.priority === filterPriority;
    const assigneeMatch = filterAssignee === 'ALL' || task.assignee === filterAssignee;
    return priorityMatch && assigneeMatch;
  });

  const getTasksByStatus = (status) => filteredTasks.filter(t => t.status === status);

  const handleDragStart = (e, task) => { setDraggedTask(task); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleDrop = (e, status) => { e.preventDefault(); if (draggedTask && draggedTask.status !== status) moveTask(draggedTask.id, status); setDraggedTask(null); };

  if (loading) return <div className="app" style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '16px', color: 'var(--text-primary)'}}>Loading Data from Firebase...</div>;
  if (!currentProject && projects.length === 0) return <div className="app"><ProjectModal projects={projects} setShowProjectModal={setShowProjectModal} newProjectName={newProjectName} setNewProjectName={setNewProjectName} createProject={createProject} /></div>;
  if (!currentProject && projects.length > 0) return <div className="app"><ProjectModal projects={projects} setShowProjectModal={setShowProjectModal} newProjectName={newProjectName} setNewProjectName={setNewProjectName} createProject={createProject} /></div>;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <Folder size={18} style={{ color: currentProject?.color }} />
          <div className="project-info">
            <h1>{currentProject?.name}</h1>
            <p>Agile Workspace</p>
          </div>
        </div>
        <div className="header-center">
          <select value={currentProject?.id || ''} onChange={(e) => { const p = projects.find(proj => proj.id === e.target.value); if (p) switchProject(p); }} className="project-dropdown">
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={() => { setShowProjectModal(true); setNewProjectName(''); }} className="icon-btn" title="New Project"><FolderPlus size={16} /></button>
          <button onClick={() => setShowDeleteConfirm(true)} className="icon-btn danger" title="Delete Project"><Trash2 size={16} /></button>
        </div>
        <div className="header-right">
          <button onClick={() => setDarkMode(!darkMode)} className="icon-btn">{darkMode ? <Sun size={16} /> : <Moon size={16} />}</button>
          <button onClick={() => setShowTeamModal(true)} className="icon-btn" title="Manage Team"><Users size={16} /></button>
          <button onClick={() => setBoardView('board')} className={`icon-btn ${boardView === 'board' ? 'active' : ''}`} title="Board"><Grid size={16} /></button>
          <button onClick={() => setBoardView('projects')} className={`icon-btn ${boardView === 'projects' ? 'active' : ''}`} title="All Projects"><Archive size={16} /></button>
          <button onClick={() => setBoardView('team')} className={`icon-btn ${boardView === 'team' ? 'active' : ''}`} title="Team"><Users size={16} /></button>
          <button onClick={() => setBoardView('activity')} className={`icon-btn ${boardView === 'activity' ? 'active' : ''}`} title="Activity"><Clock size={16} /></button>
        </div>
      </header>

      <main className="app-main">
        {boardView === 'board' && (
          <>
            <div className="toolbar">
              <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                <Filter size={14} style={{color: 'var(--text-muted)'}} />
                <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="form-select">
                  <option value="ALL">All Priorities</option>
                  {Object.entries(PRIORITY_LEVELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <select value={filterAssignee} onChange={(e) => setFilterAssignee(e.target.value)} className="form-select">
                <option value="ALL">All Team</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="quick-add">
              <select value={newTaskStatus} onChange={(e) => setNewTaskStatus(e.target.value)} className="form-select">
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <input type="text" placeholder="New task..." id="newTaskInput" onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) { addTask(e.target.value); e.target.value = ''; } }} className="form-input" />
              <button onClick={() => { const input = document.getElementById('newTaskInput'); if (input && input.value.trim()) { addTask(input.value); input.value = ''; input.focus(); } }} className="btn-primary"><Plus size={16} /></button>
            </div>
            <div className="kanban-board">
              <Column status="todo" title=" To Do" getTasksByStatus={getTasksByStatus} handleDragOver={handleDragOver} handleDrop={handleDrop} handleDragStart={handleDragStart} deleteTask={deleteTask} setSelectedTask={setSelectedTask} getTeamMember={getTeamMember} />
              <Column status="inprogress" title="️ In Progress" getTasksByStatus={getTasksByStatus} handleDragOver={handleDragOver} handleDrop={handleDrop} handleDragStart={handleDragStart} deleteTask={deleteTask} setSelectedTask={setSelectedTask} getTeamMember={getTeamMember} />
              <Column status="done" title="✅ Done" getTasksByStatus={getTasksByStatus} handleDragOver={handleDragOver} handleDrop={handleDrop} handleDragStart={handleDragStart} deleteTask={deleteTask} setSelectedTask={setSelectedTask} getTeamMember={getTeamMember} />
            </div>
          </>
        )}

        {boardView === 'projects' && (
          <div>
            <h2 style={{fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)', maxWidth: '1200px', margin: '0 auto 20px'}}>All Projects</h2>
            <ProjectsView projects={projects} currentProject={currentProject} switchProject={switchProject} setShowProjectModal={setShowProjectModal} />
          </div>
        )}

        {boardView === 'team' && (
          <div>
            <h2 style={{fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-primary)', maxWidth: '1200px', margin: '0 auto 20px'}}>Team Overview</h2>
            <div className="team-section">
              {teamMembers.map(member => {
                const memberTasks = filteredTasks.filter(t => t.assignee === member.id);
                const done = memberTasks.filter(t => t.status === 'done').length;
                const rate = memberTasks.length > 0 ? Math.round((done / memberTasks.length) * 100) : 0;
                return (
                  <div key={member.id} className="team-card" onClick={() => setEditingTeamMember({...member})}>
                    <div className="team-avatar" style={{ backgroundColor: member.color }}>{member.initials}</div>
                    <h3>{member.name}</h3>
                    <p className="team-role">{member.role}</p>
                    <div className="team-stats">
                      <div className="stat"><span>Tasks: {memberTasks.length}</span></div>
                      <div className="stat"><span>Done: {done}</span></div>
                    </div>
                    <div className="progress"><div className="fill" style={{ width: `${rate}%`, backgroundColor: member.color }} /></div>
                    <span className="percent">{rate}%</span>
                    <p className="edit-hint">Click to edit</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {boardView === 'activity' && (
          <div className="activity-section">
            <h2>Activity Timeline</h2>
            <div className="timeline">
              {activities.length === 0 ? (
                <div className="empty-state" style={{padding: '40px'}}>No activities yet. Start moving tasks or adding comments!</div>
              ) : (
                activities.map(a => (
                  <div key={a.id} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <p>{a.message}</p>
                      <span>{new Date(a.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {selectedTask && <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} updateTask={updateTask} moveTask={moveTask} assignTask={assignTask} addComment={addComment} deleteComment={deleteComment} likeComment={likeComment} getTeamMember={getTeamMember} teamMembers={teamMembers} />}
      {showDeleteConfirm && <DeleteConfirmModal setShowDeleteConfirm={setShowDeleteConfirm} currentProject={currentProject} confirmDeleteProject={confirmDeleteProject} />}
      {showProjectModal && <ProjectModal projects={projects} setShowProjectModal={setShowProjectModal} newProjectName={newProjectName} setNewProjectName={setNewProjectName} createProject={createProject} />}
      {showTeamModal && <TeamManagementModal onClose={() => setShowTeamModal(false)} addTeamMember={addTeamMember} teamMembers={teamMembers} updateTeamMember={updateTeamMember} deleteTeamMember={deleteTeamMember} />}
      {editingTeamMember && (
        <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setEditingTeamMember(null)}>
          <div className="modal-box" style={{maxWidth: '400px'}} onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-top"><h2>Edit Member</h2><button onClick={() => setEditingTeamMember(null)} className="close-btn"><X size={20} /></button></div>
            <div className="team-edit-form">
              <div className="form-group"><label>Name</label><input type="text" value={editingTeamMember.name} onChange={(e) => setEditingTeamMember({...editingTeamMember, name: e.target.value})} className="form-input" /></div>
              <div className="form-group"><label>Role</label><input type="text" value={editingTeamMember.role} onChange={(e) => setEditingTeamMember({...editingTeamMember, role: e.target.value})} className="form-input" /></div>
              <div className="form-buttons">
                <button onClick={() => { updateTeamMember(editingTeamMember.id, editingTeamMember); setEditingTeamMember(null); }} className="btn-primary">Save</button>
                <button onClick={() => setEditingTeamMember(null)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;