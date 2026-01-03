"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  BrainCircuit,
  Save,
  RotateCcw,
  Send,
  Trash2,
  User,
  Bot,
  Loader2,
  Sparkles,
  BookOpen,
  MessageSquare,
  CheckCircle2,
  PenLine,
  MessageCircle,
  Mail,
  RefreshCw,
} from "lucide-react";

interface Message {
  sender: "them" | "us";
  text: string;
}

interface TestResult {
  reply: string;
  promptUsed: string;
  conversationContext: string;
}

interface Service {
  id: string;
  name: string;
  nameArabic: string | null;
  description: string | null;
  descriptionArabic: string | null;
}

export default function AITunePage() {
  // ========== CONVERSATION STATE ==========
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [servicesKnowledge, setServicesKnowledge] = useState("");
  const [conversation, setConversation] = useState<Message[]>([]);
  const [testMessage, setTestMessage] = useState("");
  const [aiReply, setAiReply] = useState<TestResult | null>(null);
  
  // ========== COMMENT STATE ==========
  const [commentDefaultPrompt, setCommentDefaultPrompt] = useState("");
  const [commentCustomPrompt, setCommentCustomPrompt] = useState("");
  const [commentUseCustom, setCommentUseCustom] = useState(false);
  const [commentPostText, setCommentPostText] = useState("");
  const [commentService, setCommentService] = useState("");
  const [generatedComment, setGeneratedComment] = useState("");
  
  // ========== FIRST DM STATE ==========
  const [dmDefaultPrompt, setDMDefaultPrompt] = useState("");
  const [dmCustomPrompt, setDMCustomPrompt] = useState("");
  const [dmUseCustom, setDMUseCustom] = useState(false);
  const [dmAuthorName, setDMAuthorName] = useState("");
  const [dmPostText, setDMPostText] = useState("");
  const [dmService, setDMService] = useState("");
  const [generatedDM, setGeneratedDM] = useState("");
  
  // ========== SHARED STATE ==========
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState("conversation");
  const [services, setServices] = useState<Service[]>([]);
  
  // Correction dialog state
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [wrongText, setWrongText] = useState("");
  const [correctText, setCorrectText] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAllPrompts();
  }, []);

  useEffect(() => {
    if (conversation.length > 0 && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [conversation.length]);

  const loadAllPrompts = async () => {
    setLoading(true);
    try {
      // Load services first
      const servicesRes = await fetch("/api/services");
      const servicesData = await servicesRes.json();
      if (servicesData.services) {
        setServices(servicesData.services);
      }

      // Load conversation prompts
      const convRes = await fetch("/api/test/ai-tune");
      const convData = await convRes.json();
      if (convData.success) {
        setDefaultPrompt(convData.defaultPrompt);
        setServicesKnowledge(convData.servicesKnowledge);
        if (convData.customPrompt) {
          setCustomPrompt(convData.customPrompt);
          setUseCustom(true);
        } else {
          setCustomPrompt(convData.defaultPrompt);
        }
      }

      // Load comment prompts
      const commentRes = await fetch("/api/ai/comment");
      const commentData = await commentRes.json();
      if (commentData.success) {
        setCommentDefaultPrompt(commentData.defaultPrompt);
        if (commentData.customPrompt) {
          setCommentCustomPrompt(commentData.customPrompt);
          setCommentUseCustom(true);
        } else {
          setCommentCustomPrompt(commentData.defaultPrompt);
        }
      }

      // Load first DM prompts
      const dmRes = await fetch("/api/ai/first-dm");
      const dmData = await dmRes.json();
      if (dmData.success) {
        setDMDefaultPrompt(dmData.defaultPrompt);
        if (dmData.customPrompt) {
          setDMCustomPrompt(dmData.customPrompt);
          setDMUseCustom(true);
        } else {
          setDMCustomPrompt(dmData.defaultPrompt);
        }
      }
    } catch (error) {
      console.error("Failed to load prompts:", error);
      toast.error("فشل في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  // ========== CONVERSATION FUNCTIONS ==========
  const saveConversationPrompt = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/test/ai-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "savePrompt", customPrompt })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("تم حفظ البرومبت بنجاح");
        setUseCustom(true);
      } else {
        toast.error("فشل في الحفظ");
      }
    } catch {
      toast.error("فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const resetConversationPrompt = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/test/ai-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPrompt" })
      });
      const data = await res.json();
      if (data.success) {
        setCustomPrompt(defaultPrompt);
        setUseCustom(false);
        toast.success("تم إعادة البرومبت للأصلي");
      }
    } catch {
      toast.error("فشل في إعادة التعيين");
    } finally {
      setSaving(false);
    }
  };

  const testConversationReply = async () => {
    if (!testMessage.trim()) return;
    
    const userMsg = testMessage;
    setConversation(prev => [...prev, { sender: "them", text: userMsg }]);
    setTestMessage("");
    setTesting(true);
    setAiReply(null);
    
    try {
      const res = await fetch("/api/test/ai-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "testReply",
          messages: [...conversation, { sender: "them", text: userMsg }],
          testMessage: userMsg,
          customPrompt: useCustom ? customPrompt : undefined
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setAiReply(data);
        setConversation(prev => [...prev, { sender: "us", text: data.reply }]);
      } else {
        toast.error(data.error || "فشل في الاختبار");
      }
    } catch {
      toast.error("فشل في الاختبار");
    } finally {
      setTesting(false);
    }
  };

  const clearConversation = () => {
    setConversation([]);
    setAiReply(null);
    setTestMessage("");
  };

  // ========== COMMENT FUNCTIONS ==========
  const saveCommentPrompt = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "savePrompt", customPrompt: commentCustomPrompt })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("تم حفظ برومبت التعليق");
        setCommentUseCustom(true);
      } else {
        toast.error("فشل في الحفظ");
      }
    } catch {
      toast.error("فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const resetCommentPrompt = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPrompt" })
      });
      const data = await res.json();
      if (data.success) {
        setCommentCustomPrompt(commentDefaultPrompt);
        setCommentUseCustom(false);
        toast.success("تم إعادة البرومبت للأصلي");
      }
    } catch {
      toast.error("فشل في إعادة التعيين");
    } finally {
      setSaving(false);
    }
  };

  const testGenerateComment = async () => {
    if (!commentPostText.trim()) {
      toast.error("اكتب نص المنشور أولاً");
      return;
    }
    
    setTesting(true);
    setGeneratedComment("");
    
    try {
      const res = await fetch("/api/ai/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          postText: commentPostText,
          matchedService: commentService || undefined,
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setGeneratedComment(data.comment);
        toast.success("تم توليد التعليق");
      } else {
        toast.error(data.error || "فشل في التوليد");
      }
    } catch {
      toast.error("فشل في التوليد");
    } finally {
      setTesting(false);
    }
  };

  // ========== FIRST DM FUNCTIONS ==========
  const saveFirstDMPrompt = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai/first-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "savePrompt", customPrompt: dmCustomPrompt })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("تم حفظ برومبت الرسالة الأولى");
        setDMUseCustom(true);
      } else {
        toast.error("فشل في الحفظ");
      }
    } catch {
      toast.error("فشل في الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const resetFirstDMPrompt = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/ai/first-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resetPrompt" })
      });
      const data = await res.json();
      if (data.success) {
        setDMCustomPrompt(dmDefaultPrompt);
        setDMUseCustom(false);
        toast.success("تم إعادة البرومبت للأصلي");
      }
    } catch {
      toast.error("فشل في إعادة التعيين");
    } finally {
      setSaving(false);
    }
  };

  const testGenerateFirstDM = async () => {
    if (!dmPostText.trim()) {
      toast.error("اكتب نص المنشور أولاً");
      return;
    }
    
    setTesting(true);
    setGeneratedDM("");
    
    try {
      const res = await fetch("/api/ai/first-dm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          authorName: dmAuthorName || "صديق",
          postText: dmPostText,
          matchedService: dmService || undefined,
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setGeneratedDM(data.message);
        toast.success("تم توليد الرسالة");
      } else {
        toast.error(data.error || "فشل في التوليد");
      }
    } catch {
      toast.error("فشل في التوليد");
    } finally {
      setTesting(false);
    }
  };

  // ========== CORRECTION FUNCTIONS ==========
  const submitCorrection = async () => {
    if (!wrongText.trim() || !correctText.trim()) {
      toast.error("يلزم تحط الكلمة الغالطة و الصحيحة");
      return;
    }

    setSubmittingCorrection(true);
    try {
      const res = await fetch("/api/test/ai-tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addCorrection",
          wrongText: wrongText.trim(),
          correctText: correctText.trim(),
          currentPrompt: customPrompt
        })
      });

      const data = await res.json();

      if (data.success) {
        setCustomPrompt(data.updatedPrompt);
        setUseCustom(true);
        toast.success("تمت إضافة التصحيح للبرومبت");
        setCorrectionDialogOpen(false);
        setWrongText("");
        setCorrectText("");
      } else {
        toast.error(data.error || "فشل في إضافة التصحيح");
      }
    } catch {
      toast.error("فشل في إضافة التصحيح");
    } finally {
      setSubmittingCorrection(false);
    }
  };

  // ========== EXAMPLE DATA ==========
  const examplePosts = [
    "نحب نعمل موقع لشركتي، كيفاش نبدا؟",
    "نلقى شكون يخدملي تطبيقة موبايل للمطعم متاعي",
    "محتاج متجر إلكتروني مع الدفع أونلاين",
    "نحب نعمل marketing لصفحتي على فيسبوك",
    "عندي فكرة مشروع و نحتاج فريق development",
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6" dir="rtl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
              <BrainCircuit className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">تعديل الذكاء الاصطناعي</h1>
              <p className="text-muted-foreground text-sm">
                عدّل البرومبتات باش الـ AI يتكلم تونسي صحيح
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="conversation" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              المحادثات
            </TabsTrigger>
            <TabsTrigger value="comment" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              التعليقات
            </TabsTrigger>
            <TabsTrigger value="first-dm" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              الرسالة الأولى
            </TabsTrigger>
          </TabsList>

          {/* ========== CONVERSATION TAB ========== */}
          <TabsContent value="conversation" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Prompt Editor */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-purple-500" />
                        <CardTitle className="text-lg">برومبت المحادثات</CardTitle>
                      </div>
                      <Badge variant={useCustom ? "default" : "secondary"} className="text-xs">
                        {useCustom ? "مخصص" : "افتراضي"}
                      </Badge>
                    </div>
                    <CardDescription>
                      هذا البرومبت يتستخدم في ردود المحادثات على الماسنجر
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      className="min-h-[350px] font-mono text-sm resize-none"
                      placeholder="اكتب البرومبت هنا..."
                      dir="rtl"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{customPrompt.length} حرف</span>
                      <div className="flex gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={saving}>
                              <RotateCcw className="h-4 w-4 ml-1" />
                              إعادة
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>إعادة البرومبت للأصلي؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                هذا سيحذف التعديلات ويرجع للأصلي.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row-reverse gap-2">
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={resetConversationPrompt}>نعم</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button onClick={saveConversationPrompt} disabled={saving} size="sm">
                          {saving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                          حفظ
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Services Knowledge */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" />
                      <CardTitle className="text-lg">معلومات الخدمات</CardTitle>
                    </div>
                    <CardDescription>
                      هذه المعلومات تتحمل تلقائياً من قاعدة البيانات
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-32 rounded-md border p-3">
                      <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">
                        {servicesKnowledge}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* Test Chat */}
              <Card className="flex flex-col" style={{ height: '560px' }}>
                <div className="flex items-center justify-between px-5 py-4 border-b bg-card/80">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-600 shadow-lg">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">اختبار المحادثة</h3>
                      <p className="text-xs text-muted-foreground">جرب الردود هنا</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={clearConversation} className="rounded-full">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="px-4 py-6 space-y-4">
                      {conversation.length === 0 && !testing ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                          <MessageSquare className="h-12 w-12 text-purple-400 mb-4" />
                          <h3 className="text-lg font-semibold mb-1">ابدأ المحادثة</h3>
                          <p className="text-sm">اكتب رسالة لتجربة الرد</p>
                        </div>
                      ) : (
                        <>
                          {conversation.map((msg, i) => (
                            <div key={i} className={`flex gap-3 ${msg.sender === "them" ? "justify-end" : "justify-start"}`}>
                              <div className={`flex gap-3 ${msg.sender === "them" ? "flex-row-reverse" : "flex-row"}`}>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                                  msg.sender === "them" ? "bg-blue-500" : "bg-green-500"
                                }`}>
                                  {msg.sender === "them" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
                                </div>
                                <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                                  msg.sender === "them" ? "bg-blue-600 text-white rounded-tr-md" : "bg-muted rounded-tl-md"
                                }`}>
                                  <p className="text-sm">{msg.text}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          {testing && (
                            <div className="flex gap-3 justify-start">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
                                <Bot className="h-4 w-4 text-white" />
                              </div>
                              <div className="px-4 py-3 rounded-2xl bg-muted rounded-tl-md">
                                <div className="flex items-center gap-1.5">
                                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                                  <span className="h-2 w-2 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                                </div>
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="border-t px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          testConversationReply();
                        }
                      }}
                      placeholder="اكتب رسالة..."
                      className="flex-1"
                      dir="rtl"
                    />
                    <Button onClick={testConversationReply} disabled={testing || !testMessage.trim()} size="icon">
                      {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* ========== COMMENT TAB ========== */}
          <TabsContent value="comment" className="space-y-4">
            {/* Services Available Section */}
            <Card className="border-blue-500/30 bg-blue-500/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-500" />
                    الخدمات المتاحة ({services.length})
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">يتم تضمينها تلقائياً في الـ AI</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {services.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {services.map((service) => (
                      <Badge key={service.id} variant="secondary" className="py-1 px-3">
                        {service.nameArabic || service.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">لا توجد خدمات. أضف خدمات من صفحة Services.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Comment Prompt Editor */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-5 w-5 text-blue-500" />
                        <CardTitle className="text-lg">برومبت التعليقات</CardTitle>
                      </div>
                      <Badge variant={commentUseCustom ? "default" : "secondary"} className="text-xs">
                        {commentUseCustom ? "مخصص" : "افتراضي"}
                      </Badge>
                    </div>
                    <CardDescription>
                      هذا البرومبت يتستخدم عند التعليق على منشورات الـ Leads
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={commentCustomPrompt}
                      onChange={(e) => setCommentCustomPrompt(e.target.value)}
                      className="min-h-[350px] font-mono text-sm resize-none"
                      placeholder="اكتب البرومبت هنا..."
                      dir="rtl"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{commentCustomPrompt.length} حرف</span>
                      <div className="flex gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={saving}>
                              <RotateCcw className="h-4 w-4 ml-1" />
                              إعادة
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>إعادة البرومبت للأصلي؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                هذا سيحذف التعديلات ويرجع للأصلي.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row-reverse gap-2">
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={resetCommentPrompt}>نعم</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button onClick={saveCommentPrompt} disabled={saving} size="sm">
                          {saving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                          حفظ
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Comment Test */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-yellow-500" />
                      <CardTitle className="text-lg">اختبار التعليق</CardTitle>
                    </div>
                    <CardDescription>
                      اكتب منشور وشوف كيفاش الـ AI يعلق عليه
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>نص المنشور</Label>
                      <Textarea
                        value={commentPostText}
                        onChange={(e) => setCommentPostText(e.target.value)}
                        className="min-h-[120px]"
                        placeholder="الصق نص منشور من مجموعة فيسبوك..."
                        dir="rtl"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>الخدمة المطلوبة (اختياري)</Label>
                      <Select value={commentService || "auto"} onValueChange={(v) => setCommentService(v === "auto" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر خدمة..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">بدون تحديد (AI يكتشف)</SelectItem>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.nameArabic || service.name}>
                              {service.nameArabic || service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {services.length === 0 && (
                        <p className="text-xs text-muted-foreground">لا توجد خدمات. أضف خدمات من صفحة الخدمات.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-muted-foreground">أمثلة:</span>
                      {examplePosts.slice(0, 3).map((post, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => setCommentPostText(post)}
                        >
                          {post.substring(0, 25)}...
                        </Button>
                      ))}
                    </div>

                    <Button onClick={testGenerateComment} disabled={testing || !commentPostText.trim()} className="w-full">
                      {testing ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Sparkles className="h-4 w-4 ml-2" />}
                      ولّد تعليق
                    </Button>
                  </CardContent>
                </Card>

                {generatedComment && (
                  <Card className="border-green-500/50 bg-green-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        التعليق المولّد
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg leading-relaxed" dir="rtl">{generatedComment}</p>
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedComment);
                            toast.success("تم النسخ");
                          }}
                        >
                          نسخ
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={testGenerateComment}
                          disabled={testing}
                        >
                          <RefreshCw className="h-4 w-4 ml-1" />
                          جرب مرة أخرى
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ========== FIRST DM TAB ========== */}
          <TabsContent value="first-dm" className="space-y-4">
            {/* Services Available Section */}
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-green-500" />
                    الخدمات المتاحة ({services.length})
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">يتم تضمينها تلقائياً في الـ AI</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {services.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {services.map((service) => (
                      <Badge key={service.id} variant="secondary" className="py-1 px-3">
                        {service.nameArabic || service.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">لا توجد خدمات. أضف خدمات من صفحة Services.</p>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* First DM Prompt Editor */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-green-500" />
                        <CardTitle className="text-lg">برومبت الرسالة الأولى</CardTitle>
                      </div>
                      <Badge variant={dmUseCustom ? "default" : "secondary"} className="text-xs">
                        {dmUseCustom ? "مخصص" : "افتراضي"}
                      </Badge>
                    </div>
                    <CardDescription>
                      هذا البرومبت يتستخدم عند إرسال أول رسالة خاصة للـ Lead
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      value={dmCustomPrompt}
                      onChange={(e) => setDMCustomPrompt(e.target.value)}
                      className="min-h-[350px] font-mono text-sm resize-none"
                      placeholder="اكتب البرومبت هنا..."
                      dir="rtl"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{dmCustomPrompt.length} حرف</span>
                      <div className="flex gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" disabled={saving}>
                              <RotateCcw className="h-4 w-4 ml-1" />
                              إعادة
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>إعادة البرومبت للأصلي؟</AlertDialogTitle>
                              <AlertDialogDescription>
                                هذا سيحذف التعديلات ويرجع للأصلي.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row-reverse gap-2">
                              <AlertDialogCancel>إلغاء</AlertDialogCancel>
                              <AlertDialogAction onClick={resetFirstDMPrompt}>نعم</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button onClick={saveFirstDMPrompt} disabled={saving} size="sm">
                          {saving ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <Save className="h-4 w-4 ml-1" />}
                          حفظ
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* First DM Test */}
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-yellow-500" />
                      <CardTitle className="text-lg">اختبار الرسالة الأولى</CardTitle>
                    </div>
                    <CardDescription>
                      اكتب منشور وشوف كيفاش الـ AI يبعث أول رسالة
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>اسم العميل</Label>
                      <Input
                        value={dmAuthorName}
                        onChange={(e) => setDMAuthorName(e.target.value)}
                        placeholder="مثال: أحمد"
                        dir="rtl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>نص المنشور</Label>
                      <Textarea
                        value={dmPostText}
                        onChange={(e) => setDMPostText(e.target.value)}
                        className="min-h-[100px]"
                        placeholder="الصق نص منشور من مجموعة فيسبوك..."
                        dir="rtl"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>الخدمة المطلوبة (اختياري)</Label>
                      <Select value={dmService || "auto"} onValueChange={(v) => setDMService(v === "auto" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر خدمة..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">بدون تحديد (AI يكتشف)</SelectItem>
                          {services.map((service) => (
                            <SelectItem key={service.id} value={service.nameArabic || service.name}>
                              {service.nameArabic || service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {services.length === 0 && (
                        <p className="text-xs text-muted-foreground">لا توجد خدمات. أضف خدمات من صفحة الخدمات.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-muted-foreground">أمثلة:</span>
                      {examplePosts.slice(0, 3).map((post, i) => (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => setDMPostText(post)}
                        >
                          {post.substring(0, 25)}...
                        </Button>
                      ))}
                    </div>

                    <Button onClick={testGenerateFirstDM} disabled={testing || !dmPostText.trim()} className="w-full">
                      {testing ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Mail className="h-4 w-4 ml-2" />}
                      ولّد رسالة أولى
                    </Button>
                  </CardContent>
                </Card>

                {generatedDM && (
                  <Card className="border-blue-500/50 bg-blue-500/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-500" />
                        الرسالة الأولى المولّدة
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-lg leading-relaxed" dir="rtl">{generatedDM}</p>
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(generatedDM);
                            toast.success("تم النسخ");
                          }}
                        >
                          نسخ
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={testGenerateFirstDM}
                          disabled={testing}
                        >
                          <RefreshCw className="h-4 w-4 ml-1" />
                          جرب مرة أخرى
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Correction Dialog */}
        <Dialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
          <DialogContent className="max-w-sm" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5 text-orange-500" />
                صحّح الكلام التونسي
              </DialogTitle>
              <DialogDescription>
                اكتب الكلمة الغالطة و كيفاش لازم تتقال بالتونسي الصحيح
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="wrongText">الكلمة/العبارة الغالطة</Label>
                <Input
                  id="wrongText"
                  value={wrongText}
                  onChange={(e) => setWrongText(e.target.value)}
                  placeholder="مثال: ماذا تريد"
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="correctText">الصحيح بالتونسي</Label>
                <Input
                  id="correctText"
                  value={correctText}
                  onChange={(e) => setCorrectText(e.target.value)}
                  placeholder="مثال: آش تحب"
                  dir="rtl"
                />
              </div>
            </div>
            <DialogFooter className="flex-row-reverse gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCorrectionDialogOpen(false);
                  setWrongText("");
                  setCorrectText("");
                }}
              >
                إلغاء
              </Button>
              <Button
                onClick={submitCorrection}
                disabled={submittingCorrection || !wrongText.trim() || !correctText.trim()}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {submittingCorrection ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
                أضف التصحيح
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
