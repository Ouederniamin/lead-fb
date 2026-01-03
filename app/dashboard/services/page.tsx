'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Briefcase,
  Tag,
  DollarSign,
  MessageSquare,
  Power,
  Search,
  Loader2,
  Clock,
  Target,
  HelpCircle,
  Shield,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Languages,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ObjectionHandler {
  objection: string;
  response: string;
}

interface Service {
  id: string;
  name: string;
  nameFrench: string;
  nameArabic: string;
  description: string;
  descriptionFrench: string;
  descriptionArabic: string;
  category: string;
  keywords: string[];
  keywordsArabic: string[];
  priceRange: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  deliveryTime: string;
  features: string[];
  targetAudience: string;
  responseTemplate: string;
  qualifyingQuestions: string[];
  objectionHandlers: ObjectionHandler[];
  isActive: boolean;
}

const CATEGORIES = [
  { value: 'web', label: 'Web Development', labelFr: 'Développement Web' },
  { value: 'mobile', label: 'Mobile Apps', labelFr: 'Applications Mobiles' },
  { value: 'ecommerce', label: 'E-commerce', labelFr: 'E-commerce' },
  { value: 'marketing', label: 'Digital Marketing', labelFr: 'Marketing Digital' },
  { value: 'design', label: 'Design', labelFr: 'Design' },
  { value: 'consulting', label: 'Consulting', labelFr: 'Conseil' },
  { value: 'other', label: 'Other', labelFr: 'Autre' },
];

const CURRENCIES = ['TND', 'EUR', 'USD'];

const emptyFormData = {
  name: '',
  nameFrench: '',
  nameArabic: '',
  description: '',
  descriptionFrench: '',
  descriptionArabic: '',
  category: 'web',
  keywords: [] as string[],
  keywordsArabic: [] as string[],
  priceRange: '',
  priceMin: 0,
  priceMax: 0,
  currency: 'TND',
  deliveryTime: '',
  features: [] as string[],
  targetAudience: '',
  responseTemplate: '',
  qualifyingQuestions: [] as string[],
  objectionHandlers: [] as ObjectionHandler[],
  isActive: true,
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Input states for array fields
  const [keywordInput, setKeywordInput] = useState('');
  const [keywordArabicInput, setKeywordArabicInput] = useState('');
  const [featureInput, setFeatureInput] = useState('');
  const [questionInput, setQuestionInput] = useState('');
  const [objectionInput, setObjectionInput] = useState('');
  const [responseInput, setResponseInput] = useState('');
  
  const [formData, setFormData] = useState(emptyFormData);
  const [expandedSections, setExpandedSections] = useState({
    names: true,
    pricing: true,
    keywords: true,
    features: false,
    ai: false,
    objections: false,
  });

  useEffect(() => {
    loadServices();
  }, []);

  async function loadServices() {
    try {
      setLoading(true);
      const res = await fetch('/api/services');
      const data = await res.json();
      setServices(data.services || []);
    } catch (error) {
      console.error('Failed to load services:', error);
      toast.error('Failed to load services');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error('Service name is required');
      return;
    }
    
    try {
      setSaving(true);
      const method = editingService ? 'PUT' : 'POST';
      const body = editingService 
        ? { id: editingService.id, ...formData }
        : formData;

      const res = await fetch('/api/services', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowModal(false);
        setEditingService(null);
        resetForm();
        loadServices();
        toast.success(editingService ? 'Service updated' : 'Service added');
      } else {
        const error = await res.json();
        toast.error(error.error || 'Failed to save');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!serviceToDelete) return;

    try {
      const res = await fetch(`/api/services?id=${serviceToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        loadServices();
        toast.success('Service deleted');
      } else {
        toast.error('Failed to delete service');
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete service');
    } finally {
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
    }
  }

  async function toggleActive(service: Service) {
    try {
      const res = await fetch('/api/services', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: service.id, isActive: !service.isActive }),
      });

      if (res.ok) {
        loadServices();
        toast.success(service.isActive ? 'Service deactivated' : 'Service activated');
      }
    } catch (error) {
      console.error('Failed to toggle:', error);
      toast.error('Failed to update service');
    }
  }

  function resetForm() {
    setFormData({ ...emptyFormData });
    setKeywordInput('');
    setKeywordArabicInput('');
    setFeatureInput('');
    setQuestionInput('');
    setObjectionInput('');
    setResponseInput('');
  }

  function openEditModal(service: Service) {
    setEditingService(service);
    setFormData({
      name: service.name || '',
      nameFrench: service.nameFrench || '',
      nameArabic: service.nameArabic || '',
      description: service.description || '',
      descriptionFrench: service.descriptionFrench || '',
      descriptionArabic: service.descriptionArabic || '',
      category: service.category || 'web',
      keywords: service.keywords || [],
      keywordsArabic: service.keywordsArabic || [],
      priceRange: service.priceRange || '',
      priceMin: service.priceMin || 0,
      priceMax: service.priceMax || 0,
      currency: service.currency || 'TND',
      deliveryTime: service.deliveryTime || '',
      features: service.features || [],
      targetAudience: service.targetAudience || '',
      responseTemplate: service.responseTemplate || '',
      qualifyingQuestions: service.qualifyingQuestions || [],
      objectionHandlers: service.objectionHandlers || [],
      isActive: service.isActive ?? true,
    });
    setShowModal(true);
  }

  function openAddModal() {
    setEditingService(null);
    resetForm();
    setShowModal(true);
  }

  // Array field handlers
  function addKeyword() {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !formData.keywords.includes(kw)) {
      setFormData(prev => ({ ...prev, keywords: [...prev.keywords, kw] }));
      setKeywordInput('');
    }
  }

  function addKeywordArabic() {
    const kw = keywordArabicInput.trim();
    if (kw && !formData.keywordsArabic.includes(kw)) {
      setFormData(prev => ({ ...prev, keywordsArabic: [...prev.keywordsArabic, kw] }));
      setKeywordArabicInput('');
    }
  }

  function addFeature() {
    const feat = featureInput.trim();
    if (feat && !formData.features.includes(feat)) {
      setFormData(prev => ({ ...prev, features: [...prev.features, feat] }));
      setFeatureInput('');
    }
  }

  function addQuestion() {
    const q = questionInput.trim();
    if (q && !formData.qualifyingQuestions.includes(q)) {
      setFormData(prev => ({ ...prev, qualifyingQuestions: [...prev.qualifyingQuestions, q] }));
      setQuestionInput('');
    }
  }

  function addObjectionHandler() {
    if (objectionInput.trim() && responseInput.trim()) {
      const handler = { objection: objectionInput.trim(), response: responseInput.trim() };
      setFormData(prev => ({ ...prev, objectionHandlers: [...prev.objectionHandlers, handler] }));
      setObjectionInput('');
      setResponseInput('');
    }
  }

  function removeFromArray(field: 'keywords' | 'keywordsArabic' | 'features' | 'qualifyingQuestions', value: string) {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter(item => item !== value),
    }));
  }

  function removeObjectionHandler(index: number) {
    setFormData(prev => ({
      ...prev,
      objectionHandlers: prev.objectionHandlers.filter((_, i) => i !== index),
    }));
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }

  const stats = {
    total: services.length,
    active: services.filter(s => s.isActive).length,
    keywords: services.reduce((acc, s) => acc + (s.keywords?.length || 0) + (s.keywordsArabic?.length || 0), 0),
  };

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? cat.label : category;
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Services</h1>
            <p className="text-muted-foreground">Define your services for AI responses and lead detection</p>
          </div>
          <Button onClick={openAddModal}>
            <Plus className="mr-2 h-4 w-4" />
            Add Service
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Services</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active</CardDescription>
              <CardTitle className="text-3xl text-green-500">{stats.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Keywords Tracked</CardDescription>
              <CardTitle className="text-3xl text-blue-500">{stats.keywords}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Services List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Services</CardTitle>
            <CardDescription>Services and keywords for post detection</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 rounded-lg border p-4">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-4 w-full" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : services.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Briefcase className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No services yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add services so the AI can respond accurately
                </p>
                <Button className="mt-4" onClick={openAddModal}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Service
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-start justify-between rounded-lg border border-border p-4 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className={`h-3 w-3 rounded-full ${service.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                        <span className="font-semibold">{service.name}</span>
                        {service.nameFrench && (
                          <span className="text-muted-foreground text-sm">• {service.nameFrench}</span>
                        )}
                        {service.nameArabic && (
                          <span className="text-muted-foreground text-sm" dir="rtl">• {service.nameArabic}</span>
                        )}
                        {service.category && (
                          <Badge variant="outline" className="text-xs">
                            {getCategoryLabel(service.category)}
                          </Badge>
                        )}
                        {service.priceMin > 0 && (
                          <Badge variant="outline" className="gap-1 text-green-500">
                            <DollarSign className="h-3 w-3" />
                            Starting from {service.priceMin} {service.currency}
                          </Badge>
                        )}
                      </div>
                      
                      {(service.description || service.descriptionFrench) && (
                        <p className="ml-6 mt-1 text-sm text-muted-foreground">
                          {service.descriptionFrench || service.description}
                        </p>
                      )}

                      <div className="ml-6 mt-3 flex flex-wrap items-center gap-1">
                        <Search className="mr-1 h-4 w-4 text-muted-foreground" />
                        {(service.keywords?.length > 0 || service.keywordsArabic?.length > 0) ? (
                          <>
                            {service.keywords?.map((keyword) => (
                              <Badge key={keyword} variant="secondary" className="text-xs">
                                {keyword}
                              </Badge>
                            ))}
                            {service.keywordsArabic?.map((keyword) => (
                              <Badge key={keyword} variant="secondary" className="text-xs bg-purple-500/20" dir="rtl">
                                {keyword}
                              </Badge>
                            ))}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">No keywords</span>
                        )}
                      </div>

                      {service.features?.length > 0 && (
                        <div className="ml-6 mt-2 flex flex-wrap gap-1">
                          {service.features.slice(0, 3).map((feat) => (
                            <Badge key={feat} variant="outline" className="text-xs">
                              ✓ {feat}
                            </Badge>
                          ))}
                          {service.features.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{service.features.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActive(service)}
                            className={service.isActive ? 'text-green-500' : 'text-muted-foreground'}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {service.isActive ? 'Deactivate' : 'Activate'}
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(service)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setServiceToDelete(service);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-purple-400">💡 Tips for better AI responses</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Add keywords in French and Arabic for better post detection</li>
              <li>Set accurate prices so the AI can answer pricing questions</li>
              <li>Add service features so the AI can promote them</li>
              <li>Write qualifying questions for the AI to ask clients</li>
              <li>Add objection handlers so the AI knows how to respond</li>
              <li className="text-purple-400">Note: The AI always responds in Tunisian Arabic dialect</li>
            </ul>
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>
                {editingService ? 'Edit Service' : 'Add New Service'}
              </DialogTitle>
              <DialogDescription>
                {editingService 
                  ? 'Update service details' 
                  : 'Define a new service for AI responses'}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2">
              <div className="space-y-6 py-4">
                
                {/* Service Names Section */}
                <Collapsible open={expandedSections.names} onOpenChange={() => toggleSection('names')}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                      <span className="flex items-center gap-2 font-semibold">
                        <Languages className="h-4 w-4 text-purple-500" />
                        Service Names & Descriptions
                      </span>
                      {expandedSections.names ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    {/* Names - Each on its own line */}
                    <div className="space-y-2">
                      <Label htmlFor="serviceName" className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        Name (English) *
                      </Label>
                      <Input
                        id="serviceName"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., Web Development"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="serviceNameFr">
                        Nom (Français)
                      </Label>
                      <Input
                        id="serviceNameFr"
                        value={formData.nameFrench}
                        onChange={(e) => setFormData(prev => ({ ...prev, nameFrench: e.target.value }))}
                        placeholder="ex: Développement Web"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="serviceNameAr">
                        الاسم (عربي)
                      </Label>
                      <Input
                        id="serviceNameAr"
                        value={formData.nameArabic}
                        onChange={(e) => setFormData(prev => ({ ...prev, nameArabic: e.target.value }))}
                        placeholder="مثال: تطوير المواقع"
                        dir="rtl"
                        className="text-right"
                      />
                    </div>

                    {/* Category */}
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select 
                        value={formData.category} 
                        onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label} ({cat.labelFr})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Descriptions */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Description (English)</Label>
                        <Textarea
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                          rows={2}
                          placeholder="Brief description in English"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description (Français)</Label>
                        <Textarea
                          value={formData.descriptionFrench}
                          onChange={(e) => setFormData(prev => ({ ...prev, descriptionFrench: e.target.value }))}
                          rows={2}
                          placeholder="Description en français"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>الوصف (عربي) - Used by AI for responses</Label>
                        <Textarea
                          value={formData.descriptionArabic}
                          onChange={(e) => setFormData(prev => ({ ...prev, descriptionArabic: e.target.value }))}
                          rows={2}
                          placeholder="وصف الخدمة بالعربي... الـ AI يستعمل هذا في الردود"
                          dir="rtl"
                          className="text-right"
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Pricing Section */}
                <Collapsible open={expandedSections.pricing} onOpenChange={() => toggleSection('pricing')}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                      <span className="flex items-center gap-2 font-semibold">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        Pricing & Delivery
                      </span>
                      {expandedSections.pricing ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    {/* Starting Price */}
                    <div className="space-y-2">
                      <Label>Starting From</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={formData.priceMin}
                          onChange={(e) => setFormData(prev => ({ ...prev, priceMin: parseInt(e.target.value) || 0 }))}
                          placeholder="500"
                          className="flex-1"
                        />
                        <Select 
                          value={formData.currency} 
                          onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value }))}
                        >
                          <SelectTrigger className="w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((cur) => (
                              <SelectItem key={cur} value={cur}>{cur}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        💡 Final price is adjusted based on project complexity
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Estimated Delivery Time
                      </Label>
                      <Input
                        value={formData.deliveryTime}
                        onChange={(e) => setFormData(prev => ({ ...prev, deliveryTime: e.target.value }))}
                        placeholder="e.g., 2-3 weeks"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Price Display Text (for AI)</Label>
                      <Input
                        value={formData.priceRange}
                        onChange={(e) => setFormData(prev => ({ ...prev, priceRange: e.target.value }))}
                        placeholder="e.g., Starting at 500 TND, adjusted by complexity"
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Keywords Section */}
                <Collapsible open={expandedSections.keywords} onOpenChange={() => toggleSection('keywords')}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                      <span className="flex items-center gap-2 font-semibold">
                        <Tag className="h-4 w-4 text-blue-500" />
                        Detection Keywords
                      </span>
                      {expandedSections.keywords ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Posts containing these keywords will be flagged as potential leads
                    </p>
                    
                    {/* French/English Keywords */}
                    <div className="space-y-2">
                      <Label>Keywords (Français / English)</Label>
                      <div className="flex flex-wrap gap-2 min-h-[32px]">
                        {formData.keywords.map((keyword) => (
                          <Badge key={keyword} variant="secondary" className="gap-1 pr-1">
                            {keyword}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 hover:bg-transparent"
                              onClick={() => removeFromArray('keywords', keyword)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                          placeholder="website, site web, développeur..."
                          className="flex-1"
                        />
                        <Button onClick={addKeyword} type="button" size="icon" variant="secondary">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Arabic Keywords */}
                    <div className="space-y-2">
                      <Label>الكلمات المفتاحية (عربي)</Label>
                      <div className="flex flex-wrap gap-2 min-h-[32px]">
                        {formData.keywordsArabic.map((keyword) => (
                          <Badge key={keyword} variant="secondary" className="gap-1 pl-1 bg-purple-500/20" dir="rtl">
                            {keyword}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 hover:bg-transparent"
                              onClick={() => removeFromArray('keywordsArabic', keyword)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={keywordArabicInput}
                          onChange={(e) => setKeywordArabicInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeywordArabic())}
                          placeholder="موقع، تطبيق، تصميم..."
                          className="flex-1 text-right"
                          dir="rtl"
                        />
                        <Button onClick={addKeywordArabic} type="button" size="icon" variant="secondary">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Features Section */}
                <Collapsible open={expandedSections.features} onOpenChange={() => toggleSection('features')}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                      <span className="flex items-center gap-2 font-semibold">
                        <Sparkles className="h-4 w-4 text-yellow-500" />
                        Features & Target Audience
                      </span>
                      {expandedSections.features ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Target Audience (for AI context)
                      </Label>
                      <Input
                        value={formData.targetAudience}
                        onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                        placeholder="e.g., Small business owners, startups..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Service Features</Label>
                      <div className="flex flex-wrap gap-2 min-h-[32px]">
                        {formData.features.map((feat) => (
                          <Badge key={feat} variant="outline" className="gap-1 pr-1">
                            ✓ {feat}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-4 w-4 hover:bg-transparent"
                              onClick={() => removeFromArray('features', feat)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={featureInput}
                          onChange={(e) => setFeatureInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                          placeholder="e.g., Responsive design, 24/7 support..."
                          className="flex-1"
                        />
                        <Button onClick={addFeature} type="button" size="icon" variant="secondary">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* AI Section */}
                <Collapsible open={expandedSections.ai} onOpenChange={() => toggleSection('ai')}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                      <span className="flex items-center gap-2 font-semibold">
                        <HelpCircle className="h-4 w-4 text-cyan-500" />
                        AI Qualifying Questions & Response Template
                      </span>
                      {expandedSections.ai ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Qualifying Questions (in Arabic for AI)</Label>
                      <p className="text-xs text-muted-foreground">
                        Questions the AI will ask to understand client needs
                      </p>
                      <div className="space-y-2">
                        {formData.qualifyingQuestions.map((q, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 bg-accent/50 rounded-lg" dir="rtl">
                            <span className="text-sm flex-1 text-right">{q}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeFromArray('qualifyingQuestions', q)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={questionInput}
                          onChange={(e) => setQuestionInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addQuestion())}
                          placeholder="شنية نوع المشروع اللي تحب تعملو؟"
                          className="flex-1 text-right"
                          dir="rtl"
                        />
                        <Button onClick={addQuestion} type="button" size="icon" variant="secondary">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="template" className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        Response Template (Arabic)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Custom response template for this service. Use {'{name}'} for client name.
                      </p>
                      <Textarea
                        id="template"
                        value={formData.responseTemplate}
                        onChange={(e) => setFormData(prev => ({ ...prev, responseTemplate: e.target.value }))}
                        rows={4}
                        className="font-mono text-sm text-right"
                        dir="rtl"
                        placeholder={`أهلا {name}! شفت اللي تحتاج [الخدمة]. أنا متخصص في هذا المجال وممكن نعاونك. شنو رأيك نتواصلو على الخاص؟`}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Objection Handlers Section */}
                <Collapsible open={expandedSections.objections} onOpenChange={() => toggleSection('objections')}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                      <span className="flex items-center gap-2 font-semibold">
                        <Shield className="h-4 w-4 text-red-500" />
                        Objection Handlers (Arabic)
                      </span>
                      {expandedSections.objections ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Teach the AI how to respond to common objections in Tunisian Arabic
                    </p>
                    
                    <div className="space-y-3">
                      {formData.objectionHandlers.map((handler, i) => (
                        <div key={i} className="p-3 bg-accent/50 rounded-lg space-y-2" dir="rtl">
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <p className="text-xs text-red-400 mb-1">الاعتراض:</p>
                              <p className="text-sm text-right">{handler.objection}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeObjectionHandler(i)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          <div>
                            <p className="text-xs text-green-400 mb-1">الرد:</p>
                            <p className="text-sm text-right">{handler.response}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 p-3 border border-dashed rounded-lg">
                      <div className="space-y-2">
                        <Label className="text-xs">Objection (Arabic)</Label>
                        <Input
                          value={objectionInput}
                          onChange={(e) => setObjectionInput(e.target.value)}
                          placeholder="غالي برشة..."
                          dir="rtl"
                          className="text-right"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Response (Arabic)</Label>
                        <Textarea
                          value={responseInput}
                          onChange={(e) => setResponseInput(e.target.value)}
                          rows={2}
                          placeholder="نفهم، بالصح الجودة تستاهل..."
                          dir="rtl"
                          className="text-right"
                        />
                      </div>
                      <Button 
                        onClick={addObjectionHandler} 
                        type="button" 
                        variant="secondary" 
                        size="sm"
                        disabled={!objectionInput.trim() || !responseInput.trim()}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Separator />

                {/* Active Switch */}
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label htmlFor="isActive">Active</Label>
                    <p className="text-xs text-muted-foreground">
                      Inactive services won&apos;t be used for detection
                    </p>
                  </div>
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 flex-shrink-0">
              <Button variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formData.name || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingService ? 'Save Changes' : 'Add Service'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Service</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &quot;{serviceToDelete?.name}&quot;? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
