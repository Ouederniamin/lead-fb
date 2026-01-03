"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { 
  Users, 
  ExternalLink, 
  MessageSquare,
  Flame,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Filter,
  RefreshCw,
  User,
  Calendar,
  Hash,
  FileText,
  X,
  LayoutGrid,
  List,
  Phone,
  GripVertical,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  postId: string;
  postUrl: string;
  postText: string;
  authorId: string | null;
  authorName: string | null;
  authorProfileUrl: string | null;
  intentScore: number;
  status: string;
  stage: string;
  contactInfo: string | null;
  createdAt: string;
  group: {
    id: string;
    name: string;
  } | null;
  conversation: {
    id: string;
    leadReplied: boolean;
  } | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type ViewMode = "kanban" | "table";

const statusConfig: Record<string, { className: string }> = {
  NEW: { className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  COMMENTED: { className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  DM_SENT: { className: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  RESPONDED: { className: 'bg-green-500/10 text-green-500 border-green-500/20' },
  CONVERTED: { className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  ARCHIVED: { className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20' },
};

const stageConfig: Record<string, { 
  label: string; 
  shortLabel: string;
  className: string; 
  emoji: string;
  bgColor: string;
  borderColor: string;
  headerColor: string;
  countBg: string;
}> = {
  LEAD: { 
    label: 'Active Leads', 
    shortLabel: 'Leads',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-200 dark:border-blue-500/30', 
    emoji: '💬',
    bgColor: 'bg-blue-50/80 dark:bg-blue-950/40',
    borderColor: 'border-blue-200/80 dark:border-blue-500/30',
    headerColor: 'bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900/50 dark:to-blue-950/50',
    countBg: 'bg-blue-500 text-white dark:bg-blue-500 dark:text-white',
  },
  INTERESTED: { 
    label: 'Interested', 
    shortLabel: 'Interested',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 border-amber-200 dark:border-amber-500/30', 
    emoji: '🔥',
    bgColor: 'bg-amber-50/80 dark:bg-amber-950/40',
    borderColor: 'border-amber-200/80 dark:border-amber-500/30',
    headerColor: 'bg-gradient-to-r from-amber-100 to-amber-50 dark:from-amber-900/50 dark:to-amber-950/50',
    countBg: 'bg-amber-500 text-white dark:bg-amber-500 dark:text-white',
  },
  CTA_WHATSAPP: { 
    label: 'WhatsApp', 
    shortLabel: 'WhatsApp',
    className: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300 border-green-200 dark:border-green-500/30', 
    emoji: '📱',
    bgColor: 'bg-green-50/80 dark:bg-green-950/40',
    borderColor: 'border-green-200/80 dark:border-green-500/30',
    headerColor: 'bg-gradient-to-r from-green-100 to-green-50 dark:from-green-900/50 dark:to-green-950/50',
    countBg: 'bg-green-500 text-white dark:bg-green-500 dark:text-white',
  },
  CTA_PHONE: { 
    label: 'Phone', 
    shortLabel: 'Phone',
    className: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 border-pink-200 dark:border-pink-500/30', 
    emoji: '📞',
    bgColor: 'bg-pink-50/80 dark:bg-pink-950/40',
    borderColor: 'border-pink-200/80 dark:border-pink-500/30',
    headerColor: 'bg-gradient-to-r from-pink-100 to-pink-50 dark:from-pink-900/50 dark:to-pink-950/50',
    countBg: 'bg-pink-500 text-white dark:bg-pink-500 dark:text-white',
  },
  CONVERTED: { 
    label: 'Converted', 
    shortLabel: 'Won',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border-purple-200 dark:border-purple-500/30', 
    emoji: '✅',
    bgColor: 'bg-purple-50/80 dark:bg-purple-950/40',
    borderColor: 'border-purple-200/80 dark:border-purple-500/30',
    headerColor: 'bg-gradient-to-r from-purple-100 to-purple-50 dark:from-purple-900/50 dark:to-purple-950/50',
    countBg: 'bg-purple-500 text-white dark:bg-purple-500 dark:text-white',
  },
  LOST: { 
    label: 'Lost', 
    shortLabel: 'Lost',
    className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 border-red-200 dark:border-red-500/30', 
    emoji: '❌',
    bgColor: 'bg-red-50/80 dark:bg-red-950/40',
    borderColor: 'border-red-200/80 dark:border-red-500/30',
    headerColor: 'bg-gradient-to-r from-red-100 to-red-50 dark:from-red-900/50 dark:to-red-950/50',
    countBg: 'bg-red-500 text-white dark:bg-red-500 dark:text-white',
  },
};

const STAGE_ORDER = ['LEAD', 'INTERESTED', 'CTA_WHATSAPP', 'CTA_PHONE', 'CONVERTED', 'LOST'];

const intentConfig = [
  { value: 5, label: 'Very High', color: 'text-red-500', bgColor: 'bg-red-100 dark:bg-red-900/30', ring: 'ring-red-500' },
  { value: 4, label: 'High', color: 'text-orange-500', bgColor: 'bg-orange-100 dark:bg-orange-900/30', ring: 'ring-orange-500' },
  { value: 3, label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-100 dark:bg-yellow-900/30', ring: 'ring-yellow-500' },
  { value: 2, label: 'Low', color: 'text-blue-500', bgColor: 'bg-blue-100 dark:bg-blue-900/30', ring: 'ring-blue-500' },
  { value: 1, label: 'Very Low', color: 'text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-800', ring: 'ring-slate-400' },
];

// ============================================
// DRAGGABLE KANBAN CARD
// ============================================
function SortableKanbanCard({ 
  lead, 
  onClick,
  onDelete,
  isDragging: externalDragging 
}: { 
  lead: Lead; 
  onClick: () => void;
  onDelete: (lead: Lead) => void;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const intentCfg = intentConfig.find(c => c.value === lead.intentScore) || intentConfig[4];
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-card rounded-xl border shadow-sm transition-all duration-200",
        "hover:shadow-md hover:border-primary/30 dark:hover:border-primary/40",
        "dark:bg-zinc-900/80 dark:border-zinc-800",
        isDragging || externalDragging ? "opacity-50 shadow-lg scale-105 rotate-2" : "opacity-100"
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing rounded-l-xl hover:bg-muted/50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
      </div>

      {/* Actions Menu */}
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted dark:hover:bg-zinc-800">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onClick}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={lead.postUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Post
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
              onClick={(e) => { e.stopPropagation(); onDelete(lead); }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Card Content - Clickable */}
      <div 
        className="pl-8 pr-3 py-3 cursor-pointer"
        onClick={onClick}
      >
        {/* Header */}
        <div className="flex items-start gap-2 mb-2">
          {/* Avatar */}
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm",
            intentCfg.bgColor, intentCfg.color
          )}>
            {(lead.authorName || 'U')[0].toUpperCase()}
          </div>
          
          {/* Name & Group */}
          <div className="flex-1 min-w-0 pr-6">
            <p className="font-medium text-sm truncate leading-tight dark:text-zinc-100">
              {lead.authorName || 'Unknown'}
            </p>
            <p className="text-xs text-muted-foreground truncate dark:text-zinc-400">
              {lead.group?.name || 'Unknown Group'}
            </p>
          </div>

          {/* Intent Score */}
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
            intentCfg.bgColor, intentCfg.color
          )}>
            {lead.intentScore}
          </div>
        </div>

        {/* Post Preview */}
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed dark:text-zinc-400">
          {lead.postText.substring(0, 100)}...
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium dark:text-zinc-500">
            {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
          </span>
          
          <div className="flex items-center gap-1.5">
            {lead.contactInfo && (
              <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Phone className="h-2.5 w-2.5 text-green-600" />
              </div>
            )}
            {lead.conversation?.leadReplied && (
              <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <MessageSquare className="h-2.5 w-2.5 text-blue-600" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// DROPPABLE KANBAN COLUMN
// ============================================
function KanbanColumn({ 
  stage, 
  leads, 
  loading,
  onCardClick,
  onCardDelete,
}: { 
  stage: string; 
  leads: Lead[]; 
  loading: boolean;
  onCardClick: (lead: Lead) => void;
  onCardDelete: (lead: Lead) => void;
}) {
  const config = stageConfig[stage] || stageConfig.LEAD;
  
  const { setNodeRef, isOver } = useDroppable({
    id: stage,
  });
  
  return (
    <div className="flex flex-col w-80 min-w-80 shrink-0 h-full">
      {/* Column Header */}
      <div className={cn(
        "flex items-center justify-between px-4 py-3 rounded-t-xl border-x border-t",
        config.headerColor,
        config.borderColor
      )}>
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{config.emoji}</span>
          <span className="font-semibold dark:text-zinc-100">{config.label}</span>
        </div>
        <span className={cn(
          "text-xs font-bold px-2.5 py-1 rounded-full min-w-[28px] text-center shadow-sm",
          config.countBg
        )}>
          {leads.length}
        </span>
      </div>
      
      {/* Column Body */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 rounded-b-xl border overflow-hidden transition-all duration-200",
          config.borderColor,
          config.bgColor,
          isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background dark:ring-offset-zinc-950 bg-primary/5 dark:bg-primary/10 scale-[1.02]"
        )}
      >
        <ScrollArea className="h-full">
          <div className="p-3 space-y-3 min-h-full">
            <SortableContext 
              items={leads.map(l => l.id)} 
              strategy={verticalListSortingStrategy}
            >
              {loading ? (
                [...Array(3)].map((_, i) => (
                  <div key={i} className="bg-card dark:bg-zinc-900/80 rounded-xl border dark:border-zinc-800 p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-9 h-9 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-2.5 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-full" />
                    <div className="flex justify-between">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-5 w-5 rounded-full" />
                    </div>
                  </div>
                ))
              ) : leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div className="w-14 h-14 rounded-full bg-muted/30 dark:bg-zinc-800/50 flex items-center justify-center mb-4">
                    <Users className="h-7 w-7 opacity-50" />
                  </div>
                  <p className="text-sm font-medium dark:text-zinc-400">No leads yet</p>
                  <p className="text-xs mt-1 opacity-70 dark:text-zinc-500">Drag leads here</p>
                </div>
              ) : (
                leads.map((lead) => (
                  <SortableKanbanCard 
                    key={lead.id} 
                    lead={lead} 
                    onClick={() => onCardClick(lead)}
                    onDelete={onCardDelete}
                  />
                ))
              )}
            </SortableContext>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ============================================
// DRAG OVERLAY CARD (Ghost while dragging)
// ============================================
function DragOverlayCard({ lead }: { lead: Lead }) {
  const intentCfg = intentConfig.find(c => c.value === lead.intentScore) || intentConfig[4];
  
  return (
    <div className="w-72 bg-card rounded-xl border-2 border-primary/30 shadow-2xl rotate-3 scale-105">
      <div className="pl-8 pr-3 py-3">
        <div className="flex items-start gap-2 mb-2">
          <div className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm",
            intentCfg.bgColor, intentCfg.color
          )}>
            {(lead.authorName || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate leading-tight">
              {lead.authorName || 'Unknown'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {lead.group?.name || 'Unknown Group'}
            </p>
          </div>
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
            intentCfg.bgColor, intentCfg.color
          )}>
            {lead.intentScore}
          </div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {lead.postText.substring(0, 100)}...
        </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground font-medium">
            {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE COMPONENT
// ============================================
export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, pageSize: 15, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [stage, setStage] = useState("all");
  const [intent, setIntent] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch leads for table view
  const fetchLeads = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: meta.pageSize.toString(),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status !== "all") params.set("status", status);
      if (stage !== "all") params.set("stage", stage);
      if (intent !== "all") params.set("intent", intent);

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setMeta(data.meta || { total: 0, page: 1, pageSize: 15, totalPages: 1 });
    } catch (error) {
      console.error("Failed to fetch leads:", error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, stage, intent, meta.pageSize]);

  // Fetch all leads for kanban
  const fetchAllLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "500",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (status !== "all") params.set("status", status);
      if (intent !== "all") params.set("intent", intent);

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setAllLeads(data.leads || []);
      setMeta(data.meta || { total: 0, page: 1, pageSize: 500, totalPages: 1 });
    } catch (error) {
      console.error("Failed to fetch leads:", error);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, intent]);

  useEffect(() => {
    if (viewMode === "kanban") {
      fetchAllLeads();
    } else {
      fetchLeads(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, debouncedSearch, status, stage, intent]);

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const grouped: Record<string, Lead[]> = {};
    STAGE_ORDER.forEach(s => { grouped[s] = []; });
    
    allLeads.forEach(lead => {
      const leadStage = lead.stage || 'LEAD';
      if (grouped[leadStage]) {
        grouped[leadStage].push(lead);
      } else {
        grouped['LEAD'].push(lead);
      }
    });
    
    return grouped;
  }, [allLeads]);

  // Get active lead for drag overlay
  const activeLead = useMemo(() => {
    if (!activeId) return null;
    return allLeads.find(l => l.id === activeId) || null;
  }, [activeId, allLeads]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag over
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which stage the active item is in
    const activeStage = Object.keys(leadsByStage).find(stage => 
      leadsByStage[stage].some(l => l.id === activeId)
    );

    // Check if over is a stage (column) or a lead
    const overStage = STAGE_ORDER.includes(overId) 
      ? overId 
      : Object.keys(leadsByStage).find(stage => 
          leadsByStage[stage].some(l => l.id === overId)
        );

    if (activeStage && overStage && activeStage !== overStage) {
      // Move to different column - update local state optimistically
      setAllLeads(prev => prev.map(lead => 
        lead.id === activeId ? { ...lead, stage: overStage } : lead
      ));
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Determine the target stage
    const targetStage = STAGE_ORDER.includes(overId)
      ? overId
      : Object.keys(leadsByStage).find(stage =>
          leadsByStage[stage].some(l => l.id === overId)
        );

    if (!targetStage) return;

    // Find the lead
    const lead = allLeads.find(l => l.id === activeId);
    if (!lead || lead.stage === targetStage) return;

    // Update in database
    setUpdating(true);
    try {
      const res = await fetch(`/api/leads/${activeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage }),
      });

      if (!res.ok) {
        // Revert on error
        fetchAllLeads();
      }
    } catch (error) {
      console.error("Failed to update lead stage:", error);
      fetchAllLeads();
    } finally {
      setUpdating(false);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= meta.totalPages) {
      fetchLeads(page);
    }
  };

  const getIntentConfig = (score: number) => {
    return intentConfig.find(c => c.value === score) || intentConfig[4];
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setStage("all");
    setIntent("all");
  };

  const hasActiveFilters = search || status !== "all" || stage !== "all" || intent !== "all";

  const handleRefresh = () => {
    if (viewMode === "kanban") {
      fetchAllLeads();
    } else {
      fetchLeads(meta.page);
    }
  };

  const handleDeleteLead = async () => {
    if (!deleteTarget) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Remove from local state
        setAllLeads(prev => prev.filter(l => l.id !== deleteTarget.id));
        setLeads(prev => prev.filter(l => l.id !== deleteTarget.id));
        setMeta(prev => ({ ...prev, total: prev.total - 1 }));
        
        // Close dialogs
        if (selectedLead?.id === deleteTarget.id) {
          setSelectedLead(null);
        }
      }
    } catch (error) {
      console.error("Failed to delete lead:", error);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              Leads Pipeline
            </h1>
            <p className="text-muted-foreground mt-1">
              Drag and drop leads through your sales pipeline
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm px-3 py-1.5 rounded-lg">
              <Hash className="h-3 w-3 mr-1" />
              {meta.total} leads
            </Badge>
            
            {/* View Toggle */}
            <div className="flex items-center border rounded-lg p-1 bg-muted/30">
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 rounded-md"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Board
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-3 rounded-md"
                onClick={() => setViewMode("table")}
              >
                <List className="h-4 w-4 mr-1.5" />
                Table
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              size="icon"
              className="rounded-lg"
              onClick={handleRefresh}
              disabled={loading || updating}
            >
              <RefreshCw className={cn("h-4 w-4", (loading || updating) && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border/50 shrink-0 mb-4">
          <CardContent className="p-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search leads..."
                  className="pl-10 bg-background h-9 rounded-lg"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full sm:w-32 bg-background h-9 rounded-lg">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    {Object.entries(statusConfig).map(([key]) => (
                      <SelectItem key={key} value={key}>{key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {viewMode === "table" && (
                  <Select value={stage} onValueChange={setStage}>
                    <SelectTrigger className="w-full sm:w-32 bg-background h-9 rounded-lg">
                      <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      {STAGE_ORDER.map(s => (
                        <SelectItem key={s} value={s}>
                          {stageConfig[s].emoji} {stageConfig[s].shortLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                <Select value={intent} onValueChange={setIntent}>
                  <SelectTrigger className="w-full sm:w-36 bg-background h-9 rounded-lg">
                    <Flame className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Intent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Intent</SelectItem>
                    {intentConfig.map(i => (
                      <SelectItem key={i.value} value={i.value.toString()}>
                        <span className="flex items-center gap-2">
                          <span className={cn("font-bold", i.color)}>{i.value}</span>
                          {i.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {hasActiveFilters && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={clearFilters}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Content */}
        {viewMode === "kanban" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex-1 -mx-4 px-4 overflow-x-auto overflow-y-hidden">
              <div className="flex gap-5 h-full pb-4 pt-1" style={{ minWidth: 'max-content' }}>
                {STAGE_ORDER.map(stageKey => (
                  <KanbanColumn
                    key={stageKey}
                    stage={stageKey}
                    leads={leadsByStage[stageKey] || []}
                    loading={loading}
                    onCardClick={setSelectedLead}
                    onCardDelete={setDeleteTarget}
                  />
                ))}
              </div>
            </div>
            
            <DragOverlay>
              {activeLead && <DragOverlayCard lead={activeLead} />}
            </DragOverlay>
          </DndContext>
        ) : (
          /* Table View */
          <Card className="border-border/50 overflow-hidden flex-1 flex flex-col">
            <div className="flex-1 overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="hover:bg-transparent bg-muted/50 border-b-2">
                    <TableHead className="w-[300px] font-semibold">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        Lead
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold">Group</TableHead>
                    <TableHead className="w-[90px] font-semibold text-center">Intent</TableHead>
                    <TableHead className="w-[110px] font-semibold">Status</TableHead>
                    <TableHead className="w-[120px] font-semibold">Stage</TableHead>
                    <TableHead className="w-[130px] font-semibold">Time</TableHead>
                    <TableHead className="text-right w-[90px] font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(8)].map((_, i) => (
                      <TableRow key={i} className="animate-pulse">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Skeleton className="w-10 h-10 rounded-full" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-36" />
                              <Skeleton className="h-3 w-52" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8 rounded-full mx-auto" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8 ml-auto rounded-lg" /></TableCell>
                      </TableRow>
                    ))
                  ) : leads.length === 0 ? (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={7}>
                        <div className="flex flex-col items-center justify-center py-20">
                          <div className="p-5 rounded-2xl bg-muted/30 mb-5">
                            <Users className="h-12 w-12 text-muted-foreground/50" />
                          </div>
                          <CardTitle className="mb-2 text-xl">No Leads Found</CardTitle>
                          <CardDescription className="text-center max-w-md">
                            {hasActiveFilters 
                              ? "No leads match your current filters. Try adjusting your search criteria."
                              : "Start scraping Facebook groups to see leads here."
                            }
                          </CardDescription>
                          {hasActiveFilters && (
                            <Button variant="outline" className="mt-4" onClick={clearFilters}>
                              <X className="h-4 w-4 mr-2" />
                              Clear Filters
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((lead, index) => {
                      const intentCfg = getIntentConfig(lead.intentScore);
                      const statusCfg = statusConfig[lead.status] || statusConfig.NEW;
                      const stageCfg = stageConfig[lead.stage] || stageConfig.LEAD;
                      
                      return (
                        <TableRow 
                          key={lead.id} 
                          className={cn(
                            "group cursor-pointer transition-colors",
                            "hover:bg-muted/50",
                            index % 2 === 0 ? "bg-background" : "bg-muted/20"
                          )}
                          onClick={() => setSelectedLead(lead)}
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm ring-2 ring-offset-2 ring-offset-background",
                                intentCfg.bgColor, intentCfg.color, intentCfg.ring
                              )}>
                                {(lead.authorName || 'U')[0].toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold truncate">{lead.authorName || 'Unknown'}</p>
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                  {lead.postText.substring(0, 60)}...
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground font-medium">
                              {lead.group?.name || 'Unknown'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-center">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className={cn(
                                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold cursor-help",
                                    intentCfg.bgColor, intentCfg.color
                                  )}>
                                    {lead.intentScore}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Intent: {intentCfg.label}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-xs font-medium", statusCfg.className)}>
                              {lead.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-xs font-medium gap-1", stageCfg.className)}>
                              <span>{stageCfg.emoji}</span>
                              {stageCfg.shortLabel}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-sm text-muted-foreground cursor-help">
                                  {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{format(new Date(lead.createdAt), 'PPpp')}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={(e) => { e.stopPropagation(); setSelectedLead(lead); }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(lead); }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {!loading && leads.length > 0 && (
              <div className="border-t px-6 py-4 bg-muted/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      Showing <span className="font-semibold text-foreground">{(meta.page - 1) * meta.pageSize + 1}</span> to <span className="font-semibold text-foreground">{Math.min(meta.page * meta.pageSize, meta.total)}</span> of <span className="font-semibold text-foreground">{meta.total}</span> leads
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 mr-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-lg" 
                        onClick={() => goToPage(1)} 
                        disabled={meta.page === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-lg" 
                        onClick={() => goToPage(meta.page - 1)} 
                        disabled={meta.page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border">
                      <span className="text-sm font-medium">Page</span>
                      <span className="text-sm font-bold text-primary">{meta.page}</span>
                      <span className="text-sm text-muted-foreground">of</span>
                      <span className="text-sm font-medium">{meta.totalPages}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2">
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-lg" 
                        onClick={() => goToPage(meta.page + 1)} 
                        disabled={meta.page === meta.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-9 w-9 rounded-lg" 
                        onClick={() => goToPage(meta.totalPages)} 
                        disabled={meta.page === meta.totalPages}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Lead Detail Dialog */}
        <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {selectedLead && (
              <>
                <DialogHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    {(() => {
                      const intentCfg = getIntentConfig(selectedLead.intentScore);
                      return (
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-bold text-xl",
                          intentCfg.bgColor, intentCfg.color
                        )}>
                          {(selectedLead.authorName || 'U')[0].toUpperCase()}
                        </div>
                      );
                    })()}
                    <div className="flex-1 min-w-0">
                      <DialogTitle className="text-xl font-bold">
                        {selectedLead.authorName || 'Unknown User'}
                      </DialogTitle>
                      <DialogDescription className="flex items-center gap-2 mt-1">
                        <span>{selectedLead.group?.name || 'Unknown Group'}</span>
                        <span>•</span>
                        <span>{format(new Date(selectedLead.createdAt), 'PPp')}</span>
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                
                <ScrollArea className="flex-1 -mx-6 px-6">
                  <div className="space-y-6 pb-6">
                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={cn("px-3 py-1", statusConfig[selectedLead.status]?.className)}>
                        {selectedLead.status}
                      </Badge>
                      {(() => {
                        const stageCfg = stageConfig[selectedLead.stage] || stageConfig.LEAD;
                        return (
                          <Badge variant="outline" className={cn("px-3 py-1", stageCfg.className)}>
                            {stageCfg.emoji} {stageCfg.label}
                          </Badge>
                        );
                      })()}
                      {(() => {
                        const intentCfg = getIntentConfig(selectedLead.intentScore);
                        return (
                          <Badge variant="outline" className={cn("px-3 py-1", intentCfg.bgColor, intentCfg.color)}>
                            <Flame className="h-3 w-3 mr-1" />
                            Intent: {selectedLead.intentScore}/5
                          </Badge>
                        );
                      })()}
                      {selectedLead.conversation?.leadReplied && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 px-3 py-1">
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Replied
                        </Badge>
                      )}
                    </div>

                    {/* Contact Info */}
                    {selectedLead.contactInfo && (
                      <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
                        <h4 className="text-sm font-semibold text-green-700 dark:text-green-400 mb-1 flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          Contact Information
                        </h4>
                        <p className="text-lg font-mono text-green-800 dark:text-green-300">
                          {selectedLead.contactInfo}
                        </p>
                      </div>
                    )}

                    <Separator />

                    {/* Post Content */}
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Original Post
                      </h4>
                      <div className="bg-muted/30 rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap border">
                        {selectedLead.postText}
                      </div>
                    </div>

                    <Separator />

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      <Button asChild>
                        <a href={selectedLead.postUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Post
                        </a>
                      </Button>
                      {selectedLead.authorProfileUrl && (
                        <Button variant="outline" asChild>
                          <a href={selectedLead.authorProfileUrl} target="_blank" rel="noopener noreferrer">
                            <User className="h-4 w-4 mr-2" />
                            View Profile
                          </a>
                        </Button>
                      )}
                      <Button variant="outline">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Message
                      </Button>
                      <Button 
                        variant="outline" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 border-red-200 dark:border-red-900"
                        onClick={() => setDeleteTarget(selectedLead)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Lead
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                  <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                Delete Lead
              </AlertDialogTitle>
              <AlertDialogDescription className="pt-2">
                Are you sure you want to delete this lead? This action cannot be undone.
                {deleteTarget && (
                  <div className="mt-3 p-3 rounded-lg bg-muted/50 border">
                    <p className="font-medium text-foreground">{deleteTarget.authorName || 'Unknown'}</p>
                    <p className="text-sm mt-1 line-clamp-2">{deleteTarget.postText.substring(0, 100)}...</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteLead}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
