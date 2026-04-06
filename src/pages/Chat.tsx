import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { Send, Image as ImageIcon, Users, Plus, Trash2, Undo2, MoreHorizontal, ArrowLeft, MessageCircle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface Conversation {
  id: string;
  is_group: boolean;
  name: string | null;
  avatar_url: string | null;
  updated_at: string;
  lastMessage?: string;
  otherUser?: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

interface Message {
  id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  sender_id: string;
  is_deleted: boolean;
  profiles: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

const Chat = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [openMenu, setOpenMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (!openMenu) return;
      if (menuRef.current && !(menuRef.current.contains(e.target as Node))) setOpenMenu(null);
    };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenMenu(null); };
    document.addEventListener("click", handleDocClick);
    document.addEventListener("keydown", handleEsc);
    return () => { document.removeEventListener("click", handleDocClick); document.removeEventListener("keydown", handleEsc); };
  }, [openMenu]);

  useEffect(() => { checkUser(); }, []);

  useEffect(() => {
    if (currentUser) {
      fetchConversations();
      fetchUsers();
      const channel = supabase.channel("chat-changes").on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        fetchConversations();
        if (selectedConversation) fetchMessages(selectedConversation);
      }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [currentUser, selectedConversation]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setCurrentUser(profile);
  };

  const fetchConversations = async () => {
    const { data: participations } = await supabase.from("conversation_participants").select(`conversation_id, conversations (id, is_group, name, avatar_url, updated_at)`).eq("user_id", currentUser?.id);
    if (participations) {
      const convos = await Promise.all(participations.map(async (p: any) => {
        const conv = p.conversations;
        if (!conv.is_group) {
          const { data: otherParticipant } = await supabase.from("conversation_participants").select(`profiles (username, full_name, avatar_url)`).eq("conversation_id", conv.id).neq("user_id", currentUser.id).single();
          return { ...conv, otherUser: otherParticipant?.profiles };
        }
        return conv;
      }));
      setConversations(convos.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from("profiles").select("id, username, full_name, avatar_url").neq("id", currentUser?.id);
    setUsers(data || []);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data } = await supabase.from("messages").select(`id, content, image_url, created_at, sender_id, is_deleted, profiles (username, full_name, avatar_url)`).eq("conversation_id", conversationId).order("created_at", { ascending: true });
    setMessages((data || []).map((m: any) => ({ ...m, is_deleted: m.is_deleted ?? false })) as Message[]);
  };

  const createConversation = async (userId: string) => {
    if (!currentUser) { toast({ title: "Please wait", description: "Loading your profile...", variant: "destructive" }); return; }
    const { data: existing } = await supabase.from("conversation_participants").select("conversation_id, conversations!inner(is_group)").eq("user_id", currentUser.id);
    if (existing) {
      for (const conv of existing) {
        if (!conv.conversations.is_group) {
          const { data: otherUser } = await supabase.from("conversation_participants").select("user_id").eq("conversation_id", conv.conversation_id).neq("user_id", currentUser.id).maybeSingle();
          if (otherUser && otherUser.user_id === userId) { setSelectedConversation(conv.conversation_id); return; }
        }
      }
    }
    const startedAt = new Date().toISOString();
    await supabase.from("conversations").insert({ is_group: false });
    const { data: newConvRow } = await supabase.from("conversation_participants").select("conversation_id, conversations!inner(id, created_at)").eq("user_id", currentUser.id).gte("conversations.created_at", startedAt).order("joined_at", { ascending: false }).limit(1).maybeSingle();
    if (!newConvRow) return;
    const convId = newConvRow.conversation_id;
    await supabase.from("conversation_participants").insert({ conversation_id: convId, user_id: userId });
    fetchConversations();
    setSelectedConversation(convId);
  };

  const createGroup = async () => {
    if (selectedUsers.length === 0 || !groupName.trim()) { toast({ title: "Please enter group name and select members", variant: "destructive" }); return; }
    setIsCreatingGroup(true);
    const startedAt = new Date().toISOString();
    await supabase.from("conversations").insert({ is_group: true, name: groupName });
    const { data: groupRow } = await supabase.from("conversation_participants").select("conversation_id, conversations!inner(id, created_at)").eq("user_id", currentUser.id).gte("conversations.created_at", startedAt).order("joined_at", { ascending: false }).limit(1).maybeSingle();
    if (!groupRow) { setIsCreatingGroup(false); return; }
    const convId = groupRow.conversation_id;
    if (selectedUsers.length > 0) {
      await supabase.from("conversation_participants").insert(selectedUsers.map(uid => ({ conversation_id: convId, user_id: uid })));
    }
    setGroupName(""); setSelectedUsers([]); setIsCreatingGroup(false);
    fetchConversations(); setSelectedConversation(convId);
    toast({ title: "Group created!" });
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !imageFile) || !selectedConversation) return;
    let imageUrl: string | null = null;
    if (imageFile) {
      const fileName = `${currentUser.id}/${Date.now()}.${imageFile.name.split(".").pop()}`;
      const { error } = await supabase.storage.from("chat-images").upload(fileName, imageFile, { upsert: true });
      if (!error) imageUrl = supabase.storage.from("chat-images").getPublicUrl(fileName).data.publicUrl;
    }
    await supabase.from("messages").insert({ conversation_id: selectedConversation, sender_id: currentUser.id, content: newMessage.trim() || null, image_url: imageUrl });
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", selectedConversation);
    setNewMessage(""); setImageFile(null);
  };

  const getStoragePathFromPublicUrl = (url: string, bucket: string) => {
    const marker = `/object/public/${bucket}/`;
    const idx = url.indexOf(marker);
    return idx === -1 ? null : url.substring(idx + marker.length);
  };

  const handleUnsendMessage = async (msg: Message) => {
    if (msg.sender_id !== currentUser?.id) return;
    if (msg.image_url) { const p = getStoragePathFromPublicUrl(msg.image_url, "chat-images"); if (p) await supabase.storage.from("chat-images").remove([p]); }
    await supabase.from("messages").update({ is_deleted: true, content: null, image_url: null }).eq("id", msg.id);
  };

  const handleDeleteMessage = async (msg: Message) => {
    if (msg.sender_id !== currentUser?.id) return;
    if (msg.image_url) { const p = getStoragePathFromPublicUrl(msg.image_url, "chat-images"); if (p) await supabase.storage.from("chat-images").remove([p]); }
    await supabase.from("messages").delete().eq("id", msg.id);
  };

  const handleRemoveImageFromMessage = async (msg: Message) => {
    if (msg.sender_id !== currentUser?.id || !msg.image_url) return;
    const p = getStoragePathFromPublicUrl(msg.image_url, "chat-images");
    if (p) await supabase.storage.from("chat-images").remove([p]);
    await supabase.from("messages").update({ image_url: null }).eq("id", msg.id);
  };

  const getConversationDisplay = (conv: Conversation) => {
    if (conv.is_group) return { name: conv.name || "Group Chat", avatar: conv.avatar_url };
    return { name: conv.otherUser?.full_name || conv.otherUser?.username || "User", avatar: conv.otherUser?.avatar_url };
  };

  const selectedConvDisplay = selectedConversation
    ? getConversationDisplay(conversations.find(c => c.id === selectedConversation)!)
    : null;

  // On mobile: show either conversation list OR messages view
  const showConversationList = !selectedConversation;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <div className="flex-1 flex flex-col md:flex-row container mx-auto md:px-4 md:py-4 md:gap-4 overflow-hidden" style={{ height: "calc(100vh - 3.5rem)" }}>
        
        {/* Conversation List */}
        <div className={`${showConversationList ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-80 lg:w-96 md:border-r md:pr-4 flex-shrink-0`}>
          <div className="flex items-center justify-between p-3 md:p-0 md:pb-3">
            <h2 className="text-lg md:text-xl font-bold">Messages</h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="icon" variant="outline" className="h-8 w-8 rounded-full">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle>New Conversation</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button onClick={() => setIsCreatingGroup(false)} variant={!isCreatingGroup ? "default" : "outline"} size="sm" className="rounded-full text-xs">Direct Message</Button>
                    <Button onClick={() => setIsCreatingGroup(true)} variant={isCreatingGroup ? "default" : "outline"} size="sm" className="rounded-full text-xs">
                      <Users className="h-3.5 w-3.5 mr-1" /> Group
                    </Button>
                  </div>
                  <Input placeholder="Search users..." className="rounded-xl text-sm" onChange={(e) => {
                    const q = e.target.value.toLowerCase();
                    document.querySelectorAll<HTMLElement>('.user-item-chat').forEach(it => {
                      it.style.display = !q || it.innerText.toLowerCase().includes(q) ? '' : 'none';
                    });
                  }} />
                  {isCreatingGroup && <Input placeholder="Group name..." value={groupName} onChange={(e) => setGroupName(e.target.value)} className="rounded-xl text-sm" />}
                  <ScrollArea className="h-52">
                    {users.map((user) => (
                      <div key={user.id} className="user-item-chat flex items-center gap-3 p-2 hover:bg-muted rounded-xl cursor-pointer" onClick={() => {
                        if (isCreatingGroup) { setSelectedUsers(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]); }
                        else { createConversation(user.id); }
                      }}>
                        {isCreatingGroup && <Checkbox checked={selectedUsers.includes(user.id)} />}
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">{user.username?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{user.full_name || user.username}</p>
                          <p className="text-xs text-muted-foreground">@{user.username}</p>
                        </div>
                      </div>
                    ))}
                  </ScrollArea>
                  {isCreatingGroup && <Button onClick={createGroup} className="w-full rounded-xl text-sm">Create Group</Button>}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <MessageCircle className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No conversations yet</p>
                <p className="text-xs text-muted-foreground mt-1">Start a new chat!</p>
              </div>
            ) : conversations.map((conv) => {
              const display = getConversationDisplay(conv);
              return (
                <div
                  key={conv.id}
                  className={`flex items-center gap-3 p-3 mx-2 rounded-xl cursor-pointer hover:bg-muted/70 transition-smooth ${selectedConversation === conv.id ? "bg-primary/10" : ""}`}
                  onClick={() => { setSelectedConversation(conv.id); fetchMessages(conv.id); }}
                >
                  <Avatar className="h-11 w-11 flex-shrink-0">
                    <AvatarImage src={display.avatar || undefined} />
                    <AvatarFallback className="text-sm">{display.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{display.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}</p>
                  </div>
                </div>
              );
            })}
          </ScrollArea>
        </div>

        {/* Messages Area */}
        <div className={`${!showConversationList ? 'flex' : 'hidden'} md:flex flex-col flex-1 min-w-0`}>
          {selectedConversation && selectedConvDisplay ? (
            <>
              {/* Chat Header */}
              <div className="border-b p-3 flex items-center gap-3 bg-card/80 backdrop-blur-sm flex-shrink-0">
                <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 rounded-full" onClick={() => setSelectedConversation(null)}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-9 w-9">
                  <AvatarImage src={selectedConvDisplay.avatar || undefined} />
                  <AvatarFallback className="text-xs">{selectedConvDisplay.name?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                </Avatar>
                <p className="font-semibold text-sm truncate">{selectedConvDisplay.name}</p>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-3">
                {messages.map((msg) => {
                  const isOwn = msg.sender_id === currentUser?.id;
                  return (
                    <div key={msg.id} className={`flex gap-2 mb-3 items-end ${isOwn ? "flex-row-reverse" : ""}`}>
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={msg.profiles.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">{msg.profiles.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                      </Avatar>
                      <div className={`max-w-[75%] relative group`} style={{ overflow: "visible" }}>
                        <div className={`rounded-2xl px-3 py-2 break-words text-sm ${isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                          {msg.is_deleted ? (
                            <p className="italic text-muted-foreground text-xs">Message deleted</p>
                          ) : (
                            <>
                              {msg.image_url && <img src={msg.image_url} alt="Chat" loading="lazy" className="rounded-lg mb-1.5 max-w-full max-h-48 object-cover" />}
                              {msg.content && <p className="whitespace-pre-wrap text-[13px]">{msg.content}</p>}
                            </>
                          )}
                        </div>
                        {isOwn && !msg.is_deleted && (
                          <button onClick={(e) => {
                            e.stopPropagation();
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setOpenMenu({ id: msg.id, x: rect.left - 200, y: rect.top });
                          }} className={`absolute top-0 ${isOwn ? "-left-8" : "-right-8"} rounded-full w-6 h-6 flex items-center justify-center bg-card/80 opacity-0 group-hover:opacity-100 transition-opacity`}>
                            <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                          </button>
                        )}
                        <p className={`text-[10px] text-muted-foreground mt-0.5 ${isOwn ? "text-right" : ""}`}>
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {openMenu && (() => {
                  const msg = messages.find(m => m.id === openMenu.id);
                  if (!msg || msg.sender_id !== currentUser?.id) return null;
                  const left = Math.max(8, Math.min(openMenu.x, window.innerWidth - 220));
                  const top = Math.max(8, Math.min(openMenu.y, window.innerHeight - 140));
                  return (
                    <div ref={menuRef} style={{ position: "fixed", top, left, zIndex: 9999 }} className="w-48 bg-card border rounded-xl shadow-large p-2 space-y-1" onClick={e => e.stopPropagation()}>
                      {msg.image_url && (
                        <button onClick={async () => { await handleRemoveImageFromMessage(msg); setOpenMenu(null); }} className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg hover:bg-muted transition-smooth">
                          <Trash2 className="h-3.5 w-3.5" /> Remove image
                        </button>
                      )}
                      <button onClick={async () => { await handleUnsendMessage(msg); setOpenMenu(null); }} className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg hover:bg-muted transition-smooth">
                        <Undo2 className="h-3.5 w-3.5" /> Unsend
                      </button>
                      <button onClick={async () => { await handleDeleteMessage(msg); setOpenMenu(null); }} className="w-full flex items-center gap-2 text-xs px-3 py-2 rounded-lg hover:bg-destructive/10 text-destructive transition-smooth">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  );
                })()}

                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Input */}
              <div className="border-t p-3 bg-card/80 backdrop-blur-sm flex-shrink-0">
                <div className="flex gap-2 items-center">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                  <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="h-9 w-9 rounded-full flex-shrink-0">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 rounded-full text-sm h-9"
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  />
                  <Button onClick={sendMessage} disabled={!newMessage.trim() && !imageFile} size="icon" className="h-9 w-9 rounded-full gradient-primary flex-shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                {imageFile && (
                  <div className="mt-2 p-2 bg-muted rounded-lg flex items-center justify-between text-xs">
                    <span className="truncate">{imageFile.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => setImageFile(null)} className="h-6 text-xs">Remove</Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Send className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Select a conversation</p>
              <p className="text-xs text-muted-foreground mt-1">or start a new one</p>
            </div>
          )}
        </div>
      </div>

      <MobileBottomNav />
    </div>
  );
};

export default Chat;
