"use client";
import React, { useEffect, useState } from 'react';
import ReactFlow, { Background, Controls, Node, Edge, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';

// Custom Node Component (Circle that expands into a box)
const CustomNode = ({ data, selected }: any) => {
  if (selected) {
    return (
      <div className="bg-gray-800/90 backdrop-blur-sm border-2 border-green-500 rounded-xl p-3 text-center shadow-lg z-10" style={{ width: '150px' }}>
        <div className="font-bold text-green-500 mb-1">{data.name}</div>
        <div className="text-xs text-gray-400">Has: {data.has}</div>
        <div className="text-xs text-gray-400">Wants: {data.wants}</div>
      </div>
    );
  }
  return (
    <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow-md cursor-pointer hover:bg-green-400"></div>
  );
};

const nodeTypes = { custom: CustomNode };

export default function Home() {
  const [view, setView] = useState<'landing' | 'auth' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<'my-trades' | 'available-trades' | 'inventory' | 'chat' | 'profile' | 'settings'>('my-trades');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'distance' | 'network'>('network');

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [cycleMessage, setCycleMessage] = useState("");
  
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [hasItems, setHasItems] = useState<string[]>([]);
  const [wantsItems, setWantsItems] = useState<string[]>([]);
  const [profilePic, setProfilePic] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [newHas, setNewHas] = useState("");
  const [newWants, setNewWants] = useState("");

  const [directTrades, setDirectTrades] = useState<any[]>([]);
  const [chainTrades, setChainTrades] = useState<any | null>(null);

  const [chatTarget, setChatTarget] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [viewingUser, setViewingUser] = useState<any | null>(null);

  const loadGraph = () => {
    fetch('https://barter-bridge-api.onrender.com/api/graph')
      .then(res => res.json())
      .then(data => {
        const userList = Object.values(data.users);
        setAllUsers(userList);
        
        const newNodes = Object.keys(data.users).map((id) => {
          const user = data.users[id];
          let x, y;
          
          if (layoutMode === 'distance') {
            // EXACT MAPPING to the iframe bbox (83.5 to 85.6 Lng, 27.5 to 28.1 Lat)
            // Map is 3500px wide, 1000px tall to match the 3.5:1 aspect ratio of the bbox
            x = ((user.lng - 83.5) / 2.1) * 3500;
            y = ((28.1 - user.lat) / 0.6) * 1000;
          } else {
            const index = Object.keys(data.users).indexOf(id);
            x = 250 + Math.cos(index * 2) * 150;
            y = 250 + Math.sin(index * 2) * 150;
          }
          
          return {
            id,
            type: 'custom',
            position: { x, y },
            data: { name: user.name, has: user.has_items.join(", "), wants: user.wants_items.join(", ") },
          };
        });
        
        const newEdges = data.trust_edges.map(([source, target]: [string, string]) => ({
          id: `e-${source}-${target}`,
          source,
          target,
          type: "straight",
          animated: false,
          style: { stroke: layoutMode === 'distance' ? '#10b981' : '#374151', cursor: 'pointer', opacity: 0.6 },
        }));

        setNodes(newNodes);
        setEdges(newEdges);
        
        if (loggedInUser) {
            const me = data.users[loggedInUser];
            if (me) { 
              setHasItems(me.has_items); setWantsItems(me.wants_items); setProfilePic(me.profile_pic); 
              setPhone(me.phone || ""); setEmail(me.email || ""); setAddress(me.address || ""); setWebsite(me.website || "");
            }
        }
      });
  };

  useEffect(() => {
    loadGraph();
  }, [layoutMode]);

  const loadDirectTrades = () => {
    if (!loggedInUser) return;
    fetch(`https://barter-bridge-api.onrender.com/api/direct-trades/${loggedInUser}`)
      .then(res => res.json())
      .then(data => setDirectTrades(data));
  };

  useEffect(() => {
    if (activeTab === 'chat' && chatTarget && loggedInUser) {
      const fetchMessages = () => {
        fetch(`https://barter-bridge-api.onrender.com/api/messages/${loggedInUser}/${chatTarget}`)
          .then(res => res.json())
          .then(data => setChatMessages(data));
      };
      fetchMessages();
      const interval = setInterval(fetchMessages, 1500);
      return () => clearInterval(interval);
    }
  }, [activeTab, chatTarget, loggedInUser]);

  const handleAuth = async () => {
    setErrorMessage("");
    const url = isLogin ? 'https://barter-bridge-api.onrender.com/api/login' : 'https://barter-bridge-api.onrender.com/api/register';
    const payload = isLogin ? { username, password } : { username, password, has_items: hasItems, wants_items: wantsItems };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something went wrong");
      
      setLoggedInUser(username);
      setHasItems(data.user.has_items || []);
      setWantsItems(data.user.wants_items || []);
      setProfilePic(data.user.profile_pic || "");
      setPhone(data.user.phone || "");
      setEmail(data.user.email || "");
      setAddress(data.user.address || "");
      setWebsite(data.user.website || "");
      setView('app');
      loadGraph();
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim() || !chatTarget) return;
    await fetch('https://barter-bridge-api.onrender.com/api/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: loggedInUser, receiver: chatTarget, text: chatInput, type: "text" })
    });
    setChatInput("");
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 64 * 1024 * 1024) {
      alert("File too large! Max 64MB.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch('https://barter-bridge-api.onrender.com/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        await fetch('https://barter-bridge-api.onrender.com/api/send-message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: loggedInUser, receiver: chatTarget, text: data.url, type: "image" })
        });
      }
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      e.currentTarget.value = "";
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePic(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addHasItem = () => { if(newHas) { setHasItems([...hasItems, newHas]); setNewHas(""); } };
  const removeHasItem = (item: string) => { setHasItems(hasItems.filter(i => i !== item)); };
  const addWantsItem = () => { if(newWants) { setWantsItems([...wantsItems, newWants]); setNewWants(""); } };
  const removeWantsItem = (item: string) => { setWantsItems(wantsItems.filter(i => i !== item)); };

  const handleUpdateProfile = async () => {
    await fetch('https://barter-bridge-api.onrender.com/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInUser, has_items: hasItems, wants_items: wantsItems, profile_pic: profilePic, phone, email, address, website })
    });
    loadGraph();
    loadDirectTrades();
    alert("Profile & Inventory updated!");
  };

  const findTrade = async () => {
    setCycleMessage("Searching for multi-way trades...");
    const res = await fetch('https://barter-bridge-api.onrender.com/api/find-cycle');
    const data = await res.json();
    
    if (data.success) {
      setCycleMessage(`🎉 Shortest Distance Trade Cycle Found!`);
      setChainTrades(data.cycle);
      
      const newEdges = [...edges];
      data.cycle.forEach((u: string, i: number) => {
        const next = data.cycle[(i + 1) % data.cycle.length];
        const edge = newEdges.find(e => e.source === u && e.target === next);
        if (edge) {
          edge.style = { stroke: 'red', strokeWidth: 3, cursor: 'pointer', opacity: 1 };
          edge.animated = true;
          edge.label = "TRADE MATCH";
          edge.labelStyle = { fill: 'red', fontWeight: 700, fontSize: 12 };
        }
      });
      setEdges([...newEdges]);
    } else {
      setCycleMessage("No cycles found.");
      setChainTrades(null);
    }
  };

  const handleLogout = () => {
    setLoggedInUser(null);
    setView('landing');
    setUsername(""); setPassword(""); setHasItems([]); setWantsItems([]); setProfilePic(""); setPhone(""); setEmail(""); setAddress(""); setWebsite("");
  }

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <nav className="p-6 flex justify-between items-center max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-green-500">Barter Bridge</h1>
          <button onClick={() => setView('auth')} className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-semibold text-white shadow-sm">Login / Register</button>
        </nav>
        <header className="text-center py-20 max-w-4xl mx-auto">
          <h2 className="text-5xl font-extrabold mb-6">Trade Without Limits. <br/> <span className="text-green-500">Trust Without Banks.</span></h2>
          <p className="text-xl mb-10 text-gray-400">In informal economies, cash is scarce but value isn't. Barter Bridge uses a Web-of-Vouches and graph theory to unlock multi-way trades in your community. No money required.</p>
          <button onClick={() => setView('auth')} className="bg-green-600 hover:bg-green-700 px-8 py-4 rounded-lg font-bold text-white text-lg shadow-md">Get Started</button>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto px-6 pb-20">
          <div className="p-6 rounded-xl shadow-sm border bg-gray-800 border-gray-700">
            <h3 className="text-xl font-bold mb-2 text-green-500">Direct & Chain Trades</h3>
            <p className="text-gray-300">Find direct swaps or let our algorithm find complex multi-way cycles so everyone gets what they want.</p>
          </div>
          <div className="p-6 rounded-xl shadow-sm border bg-gray-800 border-gray-700">
            <h3 className="text-xl font-bold mb-2 text-green-500">Integrated Chat</h3>
            <p className="text-gray-300">Found a match? Message them directly in-app to finalize the details of your barter.</p>
          </div>
          <div className="p-6 rounded-xl shadow-sm border bg-gray-800 border-gray-700">
            <h3 className="text-xl font-bold mb-2 text-green-500">SDG Impact</h3>
            <p className="text-gray-300">Driving No Poverty (1), Decent Work (8), and Reduced Inequalities (10) in informal economies.</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'auth') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="p-8 rounded-xl shadow-lg w-96 relative border bg-gray-800 border-gray-700">
          <button onClick={() => setView('landing')} className="absolute top-4 left-4 hover:text-green-500 text-gray-400">&larr; Back</button>
          <h1 className="text-3xl font-bold mb-6 text-center text-green-500">Barter Bridge</h1>
          <div className="flex justify-between mb-4 bg-gray-900 p-1 rounded-lg">
            <button onClick={() => setIsLogin(true)} className={`w-1/2 py-2 rounded-md transition-all ${isLogin ? 'bg-gray-800 text-green-500 shadow-sm font-bold' : 'text-gray-500'}`}>Login</button>
            <button onClick={() => setIsLogin(false)} className={`w-1/2 py-2 rounded-md transition-all ${!isLogin ? 'bg-gray-800 text-green-500 shadow-sm font-bold' : 'text-gray-500'}`}>Register</button>
          </div>
          <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-2 mb-3 rounded border focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-700 text-white border-gray-600" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-2 mb-3 rounded border focus:outline-none focus:ring-2 focus:ring-green-500 bg-gray-700 text-white border-gray-600" />
          {errorMessage && <p className="text-red-500 text-sm mb-3 text-center">{errorMessage}</p>}
          <button onClick={handleAuth} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm">
            {isLogin ? "Login" : "Create Account"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-gray-800 p-4 flex flex-col justify-between border-r border-gray-700 transition-all duration-300`}>
        <div>
          <div className="flex justify-between items-center mb-10">
            {!sidebarCollapsed && <h1 className="text-2xl font-bold text-green-500">Barter Bridge</h1>}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-2 bg-gray-700 rounded hover:bg-gray-600 text-gray-300">
              {sidebarCollapsed ? '→' : '←'}
            </button>
          </div>
          
          <div className="flex flex-col items-center mb-6">
            <img src={profilePic || "https://api.dicebear.com/7.x/pixel-art/svg?seed=U&backgroundColor=1f2937"} alt="Profile" className="w-16 h-16 rounded-full border-2 border-green-500 object-cover mb-2 bg-gray-900" />
            {!sidebarCollapsed && <p className="text-sm font-bold text-gray-300">{loggedInUser}</p>}
          </div>

          <ul>
            <li onClick={() => setActiveTab('my-trades')} className={`cursor-pointer p-3 rounded mb-2 font-semibold transition-colors flex items-center ${activeTab === 'my-trades' ? 'bg-green-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}>
              <span className="text-xl mr-3">📊</span> {!sidebarCollapsed && 'My Trades'}
            </li>
            <li onClick={() => { setActiveTab('available-trades'); loadDirectTrades(); }} className={`cursor-pointer p-3 rounded mb-2 font-semibold transition-colors flex items-center ${activeTab === 'available-trades' ? 'bg-green-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}>
              <span className="text-xl mr-3">🔍</span> {!sidebarCollapsed && 'Available Trades'}
            </li>
            <li onClick={() => setActiveTab('inventory')} className={`cursor-pointer p-3 rounded mb-2 font-semibold transition-colors flex items-center ${activeTab === 'inventory' ? 'bg-green-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}>
              <span className="text-xl mr-3">📦</span> {!sidebarCollapsed && 'Inventory'}
            </li>
            <li onClick={() => setActiveTab('chat')} className={`cursor-pointer p-3 rounded mb-2 font-semibold transition-colors flex items-center ${activeTab === 'chat' ? 'bg-green-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}>
              <span className="text-xl mr-3">💬</span> {!sidebarCollapsed && 'Chat'}
            </li>
            <li onClick={() => setActiveTab('profile')} className={`cursor-pointer p-3 rounded mb-2 font-semibold transition-colors flex items-center ${activeTab === 'profile' ? 'bg-green-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}>
              <span className="text-xl mr-3">👤</span> {!sidebarCollapsed && 'Profile'}
            </li>
            <li onClick={() => setActiveTab('settings')} className={`cursor-pointer p-3 rounded mb-2 font-semibold transition-colors flex items-center ${activeTab === 'settings' ? 'bg-green-600 text-white' : 'hover:bg-gray-700 text-gray-300'}`}>
              <span className="text-xl mr-3">⚙️</span> {!sidebarCollapsed && 'Settings'}
            </li>
          </ul>
        </div>
        <button onClick={handleLogout} className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded font-semibold shadow-sm flex items-center justify-center">
          <span className="text-xl mr-2">⏻</span> {!sidebarCollapsed && 'Logout'}
        </button>
      </div>

      <div className="flex-1 flex flex-col">
        
        {activeTab === 'my-trades' && (
          <>
            <div className="p-4 flex justify-between items-center border-b border-gray-700 bg-gray-800 z-10">
              <h2 className="text-xl font-bold">My Trade Network ({layoutMode === 'distance' ? 'Distance View' : 'Network View'})</h2>
              <div className="flex gap-2 items-center">
                <button onClick={findTrade} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm">Find Multi-Way Trade</button>
              </div>
            </div>
            
            <div className="flex-1 relative overflow-hidden">
              {/* NEW: Black & White Map Background perfectly connected to coordinates */}
              {layoutMode === 'distance' && (
                <iframe
                  title="map-background"
                  className="absolute top-0 left-0 w-[3500px] h-[1000px] pointer-events-none"
                  style={{ filter: 'grayscale(100%) contrast(1.1) brightness(0.9)', transformOrigin: '0 0' }}
                  src="https://www.openstreetmap.org/export/embed.html?bbox=83.5%2C27.5%2C85.6%2C28.1&layer=mapnik"
                />
              )}
              
              <div className="absolute inset-0">
                <ReactFlow 
                  nodes={nodes} 
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  nodeTypes={nodeTypes}
                  fitView
                >
                  {layoutMode !== 'distance' && <Background color="#444" gap={20} />}
                  <Controls />
                </ReactFlow>
              </div>
            </div>
            
            <div className="p-4 text-center font-bold text-lg bg-gray-800">{cycleMessage}</div>
          </>
        )}

        {activeTab === 'available-trades' && (
          <div className="p-8 overflow-auto flex flex-col gap-8">
            <div>
              <h2 className="text-2xl font-bold mb-6">Direct Trades</h2>
              <p className="text-gray-400 mb-4">People you can trade with directly right now.</p>
              {directTrades.length === 0 ? (
                <p className="text-gray-500 italic">No direct trades found. Try adding more items to your inventory.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {directTrades.map((trade, index) => (
                    <div key={index} className="p-6 rounded-xl shadow-sm border bg-gray-800 border-gray-700">
                      <h3 className="text-xl font-bold text-green-500 mb-4">{trade.name}</h3>
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex-1">
                          <p className="text-xs text-gray-500 uppercase mb-1">You Give</p>
                          <p className="font-bold text-red-400">{trade.i_give.join(", ")}</p>
                        </div>
                        <div className="mx-4 text-2xl">⇄</div>
                        <div className="flex-1 text-right">
                          <p className="text-xs text-gray-500 uppercase mb-1">You Get</p>
                          <p className="font-bold text-green-400">{trade.i_get.join(", ")}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button onClick={() => setViewingUser(allUsers.find(u => u.name === trade.name))} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 rounded">View Profile</button>
                        <button onClick={() => { setChatTarget(trade.name); setActiveTab('chat'); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded">Message</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-700 my-4"></div>

            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Multi-Way Chain Trades</h2>
                <button onClick={findTrade} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow-sm">Search for Chains</button>
              </div>
              <p className="text-gray-400 mb-4">Complex trades involving 3 or more people to make everyone happy.</p>
              
              {chainTrades ? (
                <div className="p-6 rounded-xl shadow-sm border bg-gray-800 border-green-500 flex items-center justify-center gap-4 flex-wrap">
                  {chainTrades.map((user: string, index: number) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="w-24 h-24 rounded-full bg-gray-700 border-2 border-green-500 flex items-center justify-center text-xl font-bold text-green-400 cursor-pointer" onClick={() => setViewingUser(allUsers.find(u => u.name === user))}>
                        {user.charAt(0)}
                      </div>
                      {index < chainTrades.length - 1 && <span className="text-3xl text-gray-500">→</span>}
                    </div>
                  ))}
                  <span className="text-3xl text-gray-500">↺</span>
                </div>
              ) : (
                <p className="text-gray-500 italic">No chain trades found yet. Click "Search for Chains" to find multi-way cycles.</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'inventory' && (
          <div className="p-8 max-w-3xl mx-auto w-full">
            <h2 className="text-2xl font-bold mb-6">My Inventory</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              <div className="p-6 rounded-xl shadow-sm border bg-gray-800 border-gray-700">
                <h3 className="text-xl font-bold mb-4 text-green-500">Items I Have</h3>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newHas} onChange={e => setNewHas(e.target.value)} className="w-full p-2 rounded border bg-gray-700 text-white border-gray-600" placeholder="e.g., Web Design" />
                  <button onClick={addHasItem} className="bg-green-600 px-4 rounded">Add</button>
                </div>
                <ul>
                  {hasItems.map((item, i) => (
                    <li key={i} className="flex justify-between items-center bg-gray-700 p-2 rounded mb-2">
                      <span>{item}</span>
                      <button onClick={() => removeHasItem(item)} className="text-red-500 hover:text-red-400">✕</button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-6 rounded-xl shadow-sm border bg-gray-800 border-gray-700">
                <h3 className="text-xl font-bold mb-4 text-green-500">Items I Want</h3>
                <div className="flex gap-2 mb-4">
                  <input type="text" value={newWants} onChange={e => setNewWants(e.target.value)} className="w-full p-2 rounded border bg-gray-700 text-white border-gray-600" placeholder="e.g., Fresh Produce" />
                  <button onClick={addWantsItem} className="bg-green-600 px-4 rounded">Add</button>
                </div>
                <ul>
                  {wantsItems.map((item, i) => (
                    <li key={i} className="flex justify-between items-center bg-gray-700 p-2 rounded mb-2">
                      <span>{item}</span>
                      <button onClick={() => removeWantsItem(item)} className="text-red-500 hover:text-red-400">✕</button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button onClick={handleUpdateProfile} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded shadow-sm">Save Inventory</button>
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="flex h-full">
            <div className="w-1/3 border-r border-gray-700 overflow-auto">
              <h2 className="text-xl font-bold p-4 border-b border-gray-700">Contacts</h2>
              {allUsers.filter(u => u.name !== loggedInUser).map(user => (
                <div key={user.name} onClick={() => setChatTarget(user.name)} className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-800 ${chatTarget === user.name ? 'bg-gray-800' : ''}`}>
                  <img src={user.profile_pic || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.name}&backgroundColor=1f2937`} alt="avatar" className="w-10 h-10 rounded-full object-cover bg-gray-900" />
                  <div>
                    <p className="font-bold">{user.name}</p>
                    <p className="text-xs text-gray-500">Has: {user.has_items.join(", ")}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex-1 flex flex-col">
              {chatTarget ? (
                <>
                  <div className="p-4 border-b border-gray-700 bg-gray-800 flex items-center gap-3">
                    <img src={allUsers.find(u => u.name === chatTarget)?.profile_pic || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${chatTarget}&backgroundColor=1f2937`} alt="avatar" className="w-10 h-10 rounded-full object-cover bg-gray-900" />
                    <h2 className="text-xl font-bold text-green-500 flex-1">Chat with {chatTarget}</h2>
                    <button onClick={() => setViewingUser(allUsers.find(u => u.name === chatTarget))} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded">View Profile</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {chatMessages.length === 0 && <p className="text-gray-500 text-center mt-10">No messages yet. Say hello to finalize a trade!</p>}
                    {chatMessages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === loggedInUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs p-3 rounded-lg ${msg.sender === loggedInUser ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                          {msg.type === 'image' ? <img src={msg.text} alt="upload" className="rounded-lg max-w-full object-cover" /> : msg.text}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border-t border-gray-700 bg-gray-800 flex gap-2 items-center">
                    <input 
                      type="file" 
                      accept="image/*" 
                      hidden 
                      id="chat-file-input" 
                      onChange={handleChatFileUpload} 
                    />
                    <button onClick={() => {
                      const input = document.getElementById('chat-file-input');
                      if (input) (input as HTMLInputElement).click();
                    }} disabled={isUploading} className="p-2 bg-gray-700 rounded hover:bg-gray-600 disabled:opacity-50">
                      {isUploading ? '⏳' : '📎'}
                    </button>
                    <input 
                      type="text" 
                      value={chatInput} 
                      onChange={e => setChatInput(e.target.value)} 
                      onKeyDown={e => e.key === 'Enter' && sendMessage()}
                      className="flex-1 p-2 rounded border bg-gray-700 text-white border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500" 
                      placeholder="Type a message..." 
                    />
                    <button onClick={sendMessage} className="bg-green-600 hover:bg-green-700 px-6 rounded font-bold">Send</button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  Select a user to start chatting.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="p-8 max-w-2xl mx-auto w-full overflow-auto">
            <h2 className="text-2xl font-bold mb-6">My Profile</h2>
            <div className="p-8 rounded-xl shadow-sm border bg-gray-800 border-gray-700">
              <div className="flex items-center gap-6 mb-8">
                <img src={profilePic || "https://api.dicebear.com/7.x/pixel-art/svg?seed=U&backgroundColor=1f2937"} alt="Profile" className="w-24 h-24 rounded-full border-2 border-green-500 object-cover bg-gray-900" />
                <div>
                  <label className="block mb-2 font-semibold text-gray-300">Upload Profile Picture</label>
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-600 file:text-white hover:file:bg-green-700" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2 font-semibold text-gray-300">Username</label>
                  <input type="text" value={loggedInUser || ""} disabled className="w-full p-2 rounded border bg-gray-700 text-gray-400 border-gray-600" />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-gray-300">Phone Number</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2 rounded border bg-gray-700 text-white border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2 font-semibold text-gray-300">Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-2 rounded border bg-gray-700 text-white border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block mb-2 font-semibold text-gray-300">Address</label>
                  <input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full p-2 rounded border bg-gray-700 text-white border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="mb-6">
                <label className="block mb-2 font-semibold text-gray-300">Business Website (e.g., pasal.com)</label>
                <input type="url" value={website} onChange={e => setWebsite(e.target.value)} className="w-full p-2 rounded border bg-gray-700 text-white border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500" placeholder="https://your-business.com" />
              </div>

              <button onClick={handleUpdateProfile} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded shadow-sm">Save Changes</button>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="p-8 max-w-2xl mx-auto w-full">
            <h2 className="text-2xl font-bold mb-6">Settings</h2>
            
            <div className="p-8 rounded-xl shadow-sm border flex justify-between items-center bg-gray-800 border-gray-700 mb-4">
              <div>
                <h3 className="text-xl font-semibold">Distance Layout</h3>
                <p className="text-gray-400">Group the graph by physical distance instead of network.</p>
              </div>
              <button onClick={() => setLayoutMode(layoutMode === 'distance' ? 'network' : 'distance')} className={`w-16 h-8 rounded-full p-1 transition-colors ${layoutMode === 'distance' ? 'bg-green-600' : 'bg-gray-600'}`}>
                <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform ${layoutMode === 'distance' ? 'translate-x-8' : ''}`}></div>
              </button>
            </div>

            <div className="p-8 rounded-xl shadow-sm border flex justify-between items-center bg-gray-800 border-gray-700">
              <div>
                <h3 className="text-xl font-semibold">Notifications</h3>
                <p className="text-gray-400">Manage your trade alerts.</p>
              </div>
              <button className="w-16 h-8 rounded-full p-1 transition-colors bg-gray-600">
                <div className="w-6 h-6 bg-white rounded-full shadow-md transform translate-x-0"></div>
              </button>
            </div>
          </div>
        )}
      </div>

      {viewingUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setViewingUser(null)}>
          <div className="bg-gray-800 rounded-xl border border-green-500 p-8 max-w-md w-full relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewingUser(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl">&times;</button>
            <div className="flex flex-col items-center mb-6">
              <img src={viewingUser.profile_pic || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${viewingUser.name}&backgroundColor=1f2937`} alt={viewingUser.name} className="w-24 h-24 rounded-full border-2 border-green-500 object-cover mb-3 bg-gray-900" />
              <h2 className="text-2xl font-bold text-green-500">{viewingUser.name}</h2>
              {viewingUser.website && <a href={viewingUser.website} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline mt-1">Visit Business Website ↗</a>}
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-700 p-3 rounded">
                <h4 className="text-xs uppercase text-gray-400 mb-1">Items They Have</h4>
                <p className="text-sm font-bold">{viewingUser.has_items.join(", ")}</p>
              </div>
              <div className="bg-gray-700 p-3 rounded">
                <h4 className="text-xs uppercase text-gray-400 mb-1">Items They Want</h4>
                <p className="text-sm font-bold">{viewingUser.wants_items.join(", ")}</p>
              </div>
            </div>

            <div className="space-y-3 text-sm border-t border-gray-700 pt-4">
              {viewingUser.phone && <p className="flex items-center gap-2"><span className="text-gray-400">📞 Phone:</span> {viewingUser.phone}</p>}
              {viewingUser.email && <p className="flex items-center gap-2"><span className="text-gray-400">✉️ Email:</span> {viewingUser.email}</p>}
              {viewingUser.address && <p className="flex items-center gap-2"><span className="text-gray-400">📍 Address:</span> {viewingUser.address}</p>}
            </div>

            <button onClick={() => { setChatTarget(viewingUser.name); setViewingUser(null); setActiveTab('chat'); }} className="w-full mt-6 bg-green-600 hover:bg-green-700 py-2 rounded font-bold">Message {viewingUser.name}</button>
          </div>
        </div>
      )}
    </div>
  );
}