"use client";
import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';

const API = 'https://barter-bridge-api.onrender.com';

export default function Home() {
  const [view, setView] = useState('landing');
  const [tab, setTab] = useState('my-trades');
  const [collapsed, setCollapsed] = useState(false);
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [users, setUsers] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  
  const [me, setMe] = useState<any>({});
  const [isLogin, setIsLogin] = useState(true);
  const [authForm, setAuthForm] = useState({ username: "", password: "", has: "", wants: "", role: "Individual", org_name: "" });
  const [profile, setProfile] = useState<any>({});
  const [inv, setInv] = useState({ has: "", wants: "" });
  
  const [direct, setDirect] = useState<any[]>([]);
  const [chain, setChain] = useState<any|null>(null);
  
  const [chatUser, setChatUser] = useState<string|null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [viewUser, setViewUser] = useState<any|null>(null);

  const [searchQuery, setSearchQuery] = useState("");

  const api = (p: string, opts: any = {}) => fetch(`${API}${p}`, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) } }).then(r => r.json());

  const loadGraph = async () => {
    const data = await api('/api/graph');
    setUsers(Object.values(data.users));
    
    const n = Object.keys(data.users).map((id, i) => {
      const u = data.users[id];
      const label = u.role === 'Organization' ? `${u.org_name} (Org)\nHas: ${u.has_items.join(", ")}\nWants: ${u.wants_items.join(", ")}` : `${u.name}\nHas: ${u.has_items.join(", ")}\nWants: ${u.wants_items.join(", ")}`;
      const border = u.role === 'Organization' ? '#3b82f6' : '#10b981'; 
      return {
        id, position: { x: 250 + Math.cos(i * 2) * 150, y: 250 + Math.sin(i * 2) * 150 },
        data: { label }, style: { background: '#1f2937', color: '#fff', border: `2px solid ${border}`, padding: 10, borderRadius: 10, textAlign: 'center' as const }
      };
    });
    setNodes(n);
    setEdges(data.trust_edges.map(([s, t]: any) => ({ id: `e-${s}-${t}`, source: s, target: t, type: "straight", style: { stroke: '#374151', opacity: 0.6 } })));
    if (me.name) { const myData = data.users[me.name]; if (myData) setProfile({ ...profile, ...myData }); }
  };

  const loadDirect = async () => { if (me.name) setDirect(await api(`/api/direct-trades/${me.name}`)); };

  useEffect(() => {
    if (tab === 'chat' && chatUser && me.name) {
      const getMsgs = async () => setMessages(await api(`/api/messages/${me.name}/${chatUser}`));
      getMsgs();
      const id = setInterval(getMsgs, 1500);
      return () => clearInterval(id);
    }
  }, [tab, chatUser, me.name]);

  const auth = async () => {
    const url = isLogin ? '/api/login' : '/api/register';
    const payload = isLogin ? { username: authForm.username, password: authForm.password } : { username: authForm.username, password: authForm.password, has_items: authForm.has ? [authForm.has] : [], wants_items: authForm.wants ? [authForm.wants] : [], role: authForm.role, org_name: authForm.org_name };
    try {
      const data = await api(url, { method: 'POST', body: JSON.stringify(payload) });
      if (data.detail) throw new Error(data.detail);
      setMe(data.user); setProfile(data.user); setView('app'); loadGraph();
    } catch (e: any) { console.error(e); }
  };

  const sendMsg = async () => {
    if (!chatInput.trim() || !chatUser) return;
    await api('/api/send-message', { method: 'POST', body: JSON.stringify({ sender: me.name, receiver: chatUser, text: chatInput, type: "text" }) });
    setChatInput("");
  };

  const handleChatUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || file.size > 64 * 1024 * 1024) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await fetch(`${API}/api/upload`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.url) await api('/api/send-message', { method: 'POST', body: JSON.stringify({ sender: me.name, receiver: chatUser, text: data.url, type: "image" }) });
    } catch (e) { console.error(e); } finally { setUploading(false); e.currentTarget.value = ""; }
  };

  const handleProfilePic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfile({ ...profile, profile_pic: reader.result as string });
    reader.readAsDataURL(file);
  };

  const saveProfile = async () => {
    await api('/api/profile', { method: 'PUT', body: JSON.stringify({ username: me.name, ...profile }) });
    loadGraph(); loadDirect(); alert("Profile Updated!");
  };

  const findTrade = async () => {
    setMsg("Searching...");
    const data = await api('/api/find-cycle');
    if (data.success) {
      setMsg(`🎉 Shortest Distance Cycle Found!`); setChain(data.cycle);
      setEdges(edges.map(e => {
        const inCycle = data.cycle.some((u: string, i: number) => e.source === u && e.target === data.cycle[(i + 1) % data.cycle.length]);
        return inCycle ? { ...e, style: { ...e.style, stroke: 'red', strokeWidth: 3, opacity: 1 }, animated: true, label: "TRADE MATCH", labelStyle: { fill: 'red', fontWeight: 700, fontSize: 12 }, zIndex: 1000 } : e;
      }));
    } else { setMsg("No cycles found."); setChain(null); }
  };

  const connectWithAI = async (receiver: string) => {
    await api(`/api/ai-draft/${me.name}/${receiver}`);
    setChatUser(receiver);
    setTab('chat');
  };

  const inputCls = "w-full p-2 mb-3 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500";
  const btnCls = "w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm";
  const cardCls = "p-6 rounded-xl shadow-sm border bg-gray-800 border-gray-700";

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <nav className="p-6 flex justify-between items-center max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-green-500">Barter Bridge</h1>
          <button onClick={() => setView('auth')} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold">Login / Register</button>
        </nav>
        <header className="text-center py-20 max-w-4xl mx-auto">
          <h2 className="text-5xl font-extrabold mb-6">Trade Without Limits. <br/> <span className="text-green-500">Trust Without Banks.</span></h2>
          <p className="text-xl mb-10 text-gray-400">In informal economies, cash is scarce but value isn't. Barter Bridge uses graph theory to unlock multi-way trades for individuals and organizations. No money required.</p>
          <button onClick={() => setView('auth')} className="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-lg">Get Started</button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-6 pb-20">
          {['Individuals & Organizations|Whether you are a farmer or an NGO, list what you have and what you need.', 'AI Matchmaker Assistant|Our AI agent links organizations together and drafts the first message.', 'SDG Impact|Driving No Poverty (1), Decent Work (8), and Reduced Inequalities (10).'].map((t, i) => (
            <div key={i} className={cardCls}>
              <h3 className="text-xl font-bold mb-2 text-green-500">{t.split('|')[0]}</h3>
              <p className="text-gray-300">{t.split('|')[1]}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className={`p-8 rounded-xl shadow-lg w-96 relative border bg-gray-800 border-gray-700`}>
          <button onClick={() => setView('landing')} className="absolute top-4 left-4 text-gray-400 hover:text-green-500">&larr;</button>
          <h1 className="text-3xl font-bold mb-6 text-center text-green-500">Barter Bridge</h1>
          <div className="flex justify-between mb-4 bg-gray-900 p-1 rounded-lg">
            <button onClick={() => setIsLogin(true)} className={`w-1/2 py-2 rounded-md ${isLogin ? 'bg-gray-800 text-green-500 font-bold' : 'text-gray-500'}`}>Login</button>
            <button onClick={() => setIsLogin(false)} className={`w-1/2 py-2 rounded-md ${!isLogin ? 'bg-gray-800 text-green-500 font-bold' : 'text-gray-500'}`}>Register</button>
          </div>
          
          {!isLogin && (
            <div className="flex gap-2 mb-3">
              <button onClick={() => setAuthForm({...authForm, role: "Individual"})} className={`flex-1 py-2 rounded-md ${authForm.role === 'Individual' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}>Individual</button>
              <button onClick={() => setAuthForm({...authForm, role: "Organization"})} className={`flex-1 py-2 rounded-md ${authForm.role === 'Organization' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}>Organization</button>
            </div>
          )}

          <input type="text" placeholder="Username" value={authForm.username} onChange={e => setAuthForm({...authForm, username: e.target.value})} className={inputCls} />
          <input type="password" placeholder="Password" value={authForm.password} onChange={e => setAuthForm({...authForm, password: e.target.value})} className={inputCls} />
          
          {!isLogin && (
            <>
              {authForm.role === 'Organization' && <input type="text" placeholder="Organization Name" value={authForm.org_name} onChange={e => setAuthForm({...authForm, org_name: e.target.value})} className={inputCls} />}
              <input type="text" placeholder="What you HAVE" value={authForm.has} onChange={e => setAuthForm({...authForm, has: e.target.value})} className={inputCls} />
              <input type="text" placeholder="What you WANT" value={authForm.wants} onChange={e => setAuthForm({...authForm, wants: e.target.value})} className={inputCls} />
            </>
          )}
          <button onClick={auth} className={btnCls}>{isLogin ? "Login" : "Create Account"}</button>
        </div>
      </div>
    );
  }

  const SidebarLink = ({ id, icon, label }: any) => (
    <li onClick={() => { setTab(id); if(id==='available-trades') loadDirect(); }} className={`cursor-pointer p-3 rounded mb-2 font-semibold flex items-center ${tab === id ? 'bg-green-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}>
      <span className="text-xl mr-3">{icon}</span> {!collapsed && label}
    </li>
  );

  const myHas = profile.has_items || [];
  const myWants = profile.wants_items || [];
  const chatContacts = users.filter(u => {
    if (u.name === me.name) return false;
    const overlapGive = myHas.filter((x: string) => u.wants_items?.includes(x)).length > 0;
    const overlapGet = myWants.filter((x: string) => u.has_items?.includes(x)).length > 0;
    const isChain = chain ? chain.includes(u.name) : false;
    return (overlapGive && overlapGet) || isChain;
  });

  const searchResults = searchQuery 
    ? users.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (u.org_name && u.org_name.toLowerCase().includes(searchQuery.toLowerCase()))
      ) 
    : [];

  const renderAvatar = (u: any, size = "w-10 h-10") => (
    <div className="relative">
      <img src={u.profile_pic || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${u.name}&backgroundColor=1f2937`} alt="avatar" className={`${size} rounded-full object-cover bg-gray-900 border-2 ${u.role === 'Organization' ? 'border-blue-500' : 'border-green-500'}`} />
      {u.role === 'Organization' && <span className="absolute -bottom-1 -right-1 text-xs bg-gray-900 rounded-full p-0.5">🏢</span>}
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className={`${collapsed ? 'w-20' : 'w-64'} bg-gray-800 p-4 flex flex-col justify-between border-r border-gray-700 transition-all`}>
        <div>
          <div className="flex justify-between items-center mb-10">
            {!collapsed && <h1 className="text-2xl font-bold text-green-500">Barter Bridge</h1>}
            <button onClick={() => setCollapsed(!collapsed)} className="p-2 bg-gray-700 rounded hover:bg-gray-600">{collapsed ? '→' : '←'}</button>
          </div>
          <div className="flex flex-col items-center mb-6">
            {renderAvatar(profile, "w-16 h-16")}
            {!collapsed && <p className="text-sm font-bold text-gray-300 mt-2">{profile.role === 'Organization' ? profile.org_name : me.name}</p>}
          </div>
          <ul>
            <SidebarLink id="my-trades" icon="📊" label="My Trades" />
            <SidebarLink id="available-trades" icon="🔍" label="Available Trades" />
            <SidebarLink id="inventory" icon="📦" label="Inventory" />
            <SidebarLink id="chat" icon="💬" label="Chat" />
            <SidebarLink id="profile" icon="👤" label="Profile" />
          </ul>
        </div>
        <button onClick={() => { setMe({}); setView('landing'); }} className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded font-semibold flex items-center justify-center">
          <span className="text-xl mr-2">⏻</span> {!collapsed && 'Logout'}
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        {tab === 'my-trades' && (
          <>
            <div className="p-4 flex justify-between items-center border-b border-gray-700 bg-gray-800 z-10">
              <h2 className="text-xl font-bold">My Trade Network</h2>
              <button onClick={findTrade} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm">Find Multi-Way Trade</button>
            </div>
            <div className="flex-1 relative overflow-hidden">
              <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView minZoom={0.1}>
                <Background color="#444" gap={20} />
                <Controls />
              </ReactFlow>
            </div>
            <div className="p-4 text-center font-bold text-lg bg-gray-800">{msg}</div>
          </>
        )}

        {tab === 'available-trades' && (
          <div className="p-8 overflow-auto">
            <h2 className="text-2xl font-bold mb-6">Direct Trades</h2>
            {direct.length === 0 ? <p className="text-gray-500 italic">No direct trades found.</p> : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {direct.map((t, i) => (
                  <div key={i} className={`${cardCls} ${t.role === 'Organization' ? 'border-blue-500' : ''}`}>
                    <div className="flex items-center gap-3 mb-4">
                      {renderAvatar(t)}
                      <h3 className={`text-xl font-bold ${t.role === 'Organization' ? 'text-blue-500' : 'text-green-500'}`}>{t.role === 'Organization' ? t.org_name : t.name}</h3>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex-1"><p className="text-xs text-gray-500 uppercase">You Give</p><p className="font-bold text-red-400">{t.i_give.join(", ")}</p></div>
                      <div className="mx-4 text-2xl">⇄</div>
                      <div className="flex-1 text-right"><p className="text-xs text-gray-500 uppercase">You Get</p><p className="font-bold text-green-400">{t.i_get.join(", ")}</p></div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => setViewUser(users.find(u => u.name === t.name))} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded">View Profile</button>
                      {t.role === 'Organization' ? (
                        <button onClick={() => connectWithAI(t.name)} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded">🤖 Connect AI</button>
                      ) : (
                        <button onClick={() => { setChatUser(t.name); setTab('chat'); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded">Message</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-gray-700 my-4"></div>
            <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-bold">Multi-Way Chain Trades</h2></div>
            {chain ? (
              <div className={`${cardCls} border-green-500 flex items-center justify-center gap-4 flex-wrap`}>
                {chain.map((u: string, i: number) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-24 h-24 rounded-full bg-gray-700 border-2 border-green-500 flex items-center justify-center text-xl font-bold text-green-400 cursor-pointer" onClick={() => setViewUser(users.find(x => x.name === u))}>{u.charAt(0)}</div>
                    {i < chain.length - 1 && <span className="text-3xl text-gray-500">→</span>}
                  </div>
                ))}
                <span className="text-3xl text-gray-500">↺</span>
              </div>
            ) : <p className="text-gray-500 italic">No chain trades found yet. Click "Find Multi-Way Trade" on the My Trades page.</p>}
          </div>
        )}

        {tab === 'inventory' && (
          <div className="p-8 max-w-3xl mx-auto w-full">
            <h2 className="text-2xl font-bold mb-6">My Inventory</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {(['has_items', 'wants_items'] as const).map((type) => (
                <div key={type} className={cardCls}>
                  <h3 className="text-xl font-bold mb-4 text-green-500">Items I {type === 'has_items' ? 'Have' : 'Want'}</h3>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={inv[type === 'has_items' ? 'has' : 'wants']} onChange={e => setInv({...inv, [type === 'has_items' ? 'has' : 'wants']: e.target.value})} className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600" placeholder="e.g., 800 Blankets" />
                    <button onClick={() => { if(inv[type === 'has_items' ? 'has' : 'wants']) { setProfile({...profile, [type]: [...profile[type], inv[type === 'has_items' ? 'has' : 'wants']]}); setInv({...inv, [type === 'has_items' ? 'has' : 'wants']: ""}); } }} className="bg-green-600 px-4 rounded">Add</button>
                  </div>
                  <ul>{profile[type]?.map((item: string, i: number) => (
                    <li key={i} className="flex justify-between items-center bg-gray-700 p-2 rounded mb-2">
                      <span>{item}</span>
                      <button onClick={() => setProfile({...profile, [type]: profile[type].filter((x: string) => x !== item)})} className="text-red-500 hover:text-red-400">✕</button>
                    </li>
                  ))}</ul>
                </div>
              ))}
            </div>
            <button onClick={saveProfile} className={btnCls}>Save Inventory</button>
          </div>
        )}

        {tab === 'chat' && (
          <div className="flex h-full">
            <div className="w-1/3 border-r border-gray-700 overflow-auto flex flex-col">
              <div className="p-4 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                <input 
                  type="text" 
                  placeholder="🔍 Search users or orgs..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500" 
                />
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {!searchQuery && (
                  <h3 className="text-xs uppercase text-gray-500 px-4 pt-4 pb-2 tracking-wider">Trade Matches</h3>
                )}
                {searchQuery && (
                  <h3 className="text-xs uppercase text-gray-500 px-4 pt-4 pb-2 tracking-wider">Search Results</h3>
                )}

                {(searchQuery ? searchResults : chatContacts).map(u => (
                  <div key={u.name} onClick={() => { setChatUser(u.name); setSearchQuery(""); }} className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-800 ${chatUser === u.name ? 'bg-gray-800' : ''}`}>
                    {renderAvatar(u)}
                    <div>
                      <p className="font-bold">{u.role === 'Organization' ? u.org_name : u.name} {u.role === 'Organization' && <span className="text-blue-400 text-xs">(Org)</span>}</p>
                      <p className="text-xs text-gray-500">Has: {u.has_items.join(", ")}</p>
                    </div>
                  </div>
                ))}
                
                {!searchQuery && chatContacts.length === 0 && (
                  <p className="text-gray-500 text-sm text-center mt-10 px-4">No direct or chain matches yet. Use the search bar to find anyone!</p>
                )}
                {searchQuery && searchResults.length === 0 && (
                  <p className="text-gray-500 text-sm text-center mt-10 px-4">No users found matching "{searchQuery}".</p>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              {chatUser ? (
                <>
                  <div className="p-4 border-b border-gray-700 bg-gray-800 flex items-center gap-3">
                    {renderAvatar(users.find(u => u.name === chatUser))}
                    <h2 className="text-xl font-bold text-green-500 flex-1">Chat with {users.find(u => u.name === chatUser)?.org_name || chatUser}</h2>
                    <button onClick={() => setViewUser(users.find(u => u.name === chatUser))} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">View Profile</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {messages.length === 0 && <p className="text-gray-500 text-center mt-10">No messages yet. Say hello!</p>}
                    {messages.map(m => (
                      <div key={m.id} className={`flex ${m.sender === me.name ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs p-3 rounded-lg ${m.sender === me.name ? 'bg-green-600 text-white' : m.sender === 'BarterAI' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                          {m.sender === 'BarterAI' && <p className="text-xs font-bold mb-1">🤖 BarterAI Assistant</p>}
                          {m.type === 'image' ? <img src={m.text} alt="upload" className="rounded-lg max-w-full object-cover" /> : m.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-gray-700 bg-gray-800 flex gap-2 items-center">
                    <input type="file" accept="image/*" hidden id="chat-file-input" onChange={handleChatUpload} />
                    <button onClick={() => document.getElementById('chat-file-input')?.click()} disabled={uploading} className="p-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50">{uploading ? '⏳' : '📎'}</button>
                    <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} className="flex-1 p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="Type a message..." />
                    <button onClick={sendMsg} className="bg-green-600 hover:bg-green-700 px-6 rounded font-bold">Send</button>
                  </div>
                </>
              ) : <div className="flex-1 flex items-center justify-center text-gray-500">Select a user to start chatting.</div>}
            </div>
          </div>
        )}

        {tab === 'profile' && (
          <div className="p-8 max-w-2xl mx-auto w-full overflow-auto">
            <h2 className="text-2xl font-bold mb-6">My Profile</h2>
            <div className={cardCls}>
              <div className="flex items-center gap-6 mb-8">
                {renderAvatar(profile, "w-24 h-24")}
                <div>
                  <label className="block mb-2 font-semibold text-gray-300">Upload Profile Picture</label>
                  <input type="file" accept="image/*" onChange={handleProfilePic} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block mb-2 font-semibold text-gray-300">Username</label><input type="text" value={me.name || ""} disabled className="w-full p-2 mb-4 rounded bg-gray-700 text-gray-400 border border-gray-600" /></div>
                <div><label className="block mb-2 font-semibold text-gray-300">Phone Number</label><input type="text" value={profile.phone || ""} onChange={e => setProfile({...profile, phone: e.target.value})} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div><label className="block mb-2 font-semibold text-gray-300">Email</label><input type="email" value={profile.email || ""} onChange={e => setProfile({...profile, email: e.target.value})} className={inputCls} /></div>
                <div><label className="block mb-2 font-semibold text-gray-300">Address</label><input type="text" value={profile.address || ""} onChange={e => setProfile({...profile, address: e.target.value})} className={inputCls} /></div>
              </div>
              <div className="mb-6"><label className="block mb-2 font-semibold text-gray-300">Business Website</label><input type="url" value={profile.website || ""} onChange={e => setProfile({...profile, website: e.target.value})} className={inputCls} placeholder="https://your-business.com" /></div>
              <button onClick={saveProfile} className={btnCls}>Save Changes</button>
            </div>
          </div>
        )}
      </div>

      {viewUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setViewUser(null)}>
          <div className="bg-gray-800 rounded-xl border border-green-500 p-8 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
            <div className="flex flex-col items-center mb-6">
              {renderAvatar(viewUser, "w-24 h-24")}
              <h2 className={`text-2xl font-bold mt-3 ${viewUser.role === 'Organization' ? 'text-blue-500' : 'text-green-500'}`}>{viewUser.role === 'Organization' ? viewUser.org_name : viewUser.name}</h2>
              {viewUser.website && <a href={viewUser.website} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline mt-1">Visit Website ↗</a>}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-700 p-3 rounded"><h4 className="text-xs uppercase text-gray-400 mb-1">Items They Have</h4><p className="text-sm font-bold">{viewUser.has_items.join(", ")}</p></div>
              <div className="bg-gray-700 p-3 rounded"><h4 className="text-xs uppercase text-gray-400 mb-1">Items They Want</h4><p className="text-sm font-bold">{viewUser.wants_items.join(", ")}</p></div>
            </div>
            <div className="space-y-3 text-sm border-t border-gray-700 pt-4">
              {viewUser.phone && <p className="flex items-center gap-2"><span className="text-gray-400">📞 Phone:</span> {viewUser.phone}</p>}
              {viewUser.email && <p className="flex items-center gap-2"><span className="text-gray-400">✉️ Email:</span> {viewUser.email}</p>}
              {viewUser.address && <p className="flex items-center gap-2"><span className="text-gray-400">📍 Address:</span> {viewUser.address}</p>}
            </div>
            <button onClick={() => { setChatUser(viewUser.name); setViewUser(null); setTab('chat'); }} className="w-full mt-6 bg-green-600 hover:bg-green-700 py-2 rounded font-bold">Message {viewUser.name}</button>
          </div>
        </div>
      )}
    </div>
  );
}