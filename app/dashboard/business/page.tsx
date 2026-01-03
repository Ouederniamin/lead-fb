'use client';

import { useState, useEffect } from 'react';
import { 
  Building2, 
  Save, 
  Plus, 
  X, 
  Globe, 
  Phone, 
  MapPin,
  Languages,
  Target,
  Sparkles,
  Loader2,
  Briefcase,
  ExternalLink,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Calendar,
  User,
  Star,
  Link as LinkIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

interface PortfolioItem {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  projectUrl: string;
  technologies: string[];
  clientName: string;
  completedDate: string;
  featured: boolean;
}

interface BusinessProfile {
  name: string;
  description: string;
  location: string;
  whatsapp: string;
  website: string;
  languages: string[];
  targetAudience: string;
  uniqueSellingPoints: string[];
  portfolio: PortfolioItem[];
}

const PORTFOLIO_CATEGORIES = [
  { value: 'web', label: 'Website' },
  { value: 'mobile', label: 'Mobile App' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
];

const emptyPortfolioItem: Omit<PortfolioItem, 'id'> = {
  title: '',
  description: '',
  category: 'web',
  imageUrl: '',
  projectUrl: '',
  technologies: [],
  clientName: '',
  completedDate: '',
  featured: false,
};

export default function BusinessPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState<BusinessProfile>({
    name: '',
    description: '',
    location: '',
    whatsapp: '',
    website: '',
    languages: [],
    targetAudience: '',
    uniqueSellingPoints: [],
    portfolio: [],
  });
  const [newLanguage, setNewLanguage] = useState('');
  const [newUSP, setNewUSP] = useState('');
  
  // Portfolio state
  const [portfolioModal, setPortfolioModal] = useState(false);
  const [editingPortfolio, setEditingPortfolio] = useState<PortfolioItem | null>(null);
  const [portfolioForm, setPortfolioForm] = useState(emptyPortfolioItem);
  const [techInput, setTechInput] = useState('');
  const [deletePortfolioDialog, setDeletePortfolioDialog] = useState(false);
  const [portfolioToDelete, setPortfolioToDelete] = useState<PortfolioItem | null>(null);

  useEffect(() => {
    loadBusiness();
  }, []);

  async function loadBusiness() {
    try {
      setLoading(true);
      const res = await fetch('/api/business');
      const data = await res.json();
      if (data.business) {
        setBusiness({
          ...data.business,
          portfolio: data.business.portfolio || [],
        });
      }
    } catch (error) {
      console.error('Failed to load business:', error);
      toast.error('Failed to load business profile');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    try {
      setSaving(true);
      const res = await fetch('/api/business', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(business),
      });

      if (res.ok) {
        toast.success('Business profile saved successfully!');
      } else {
        toast.error('Failed to save business profile');
      }
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function addLanguage() {
    if (newLanguage && !business.languages.includes(newLanguage)) {
      setBusiness(prev => ({
        ...prev,
        languages: [...prev.languages, newLanguage],
      }));
      setNewLanguage('');
    }
  }

  function removeLanguage(lang: string) {
    setBusiness(prev => ({
      ...prev,
      languages: prev.languages.filter(l => l !== lang),
    }));
  }

  function addUSP() {
    if (newUSP && !business.uniqueSellingPoints.includes(newUSP)) {
      setBusiness(prev => ({
        ...prev,
        uniqueSellingPoints: [...prev.uniqueSellingPoints, newUSP],
      }));
      setNewUSP('');
    }
  }

  function removeUSP(usp: string) {
    setBusiness(prev => ({
      ...prev,
      uniqueSellingPoints: prev.uniqueSellingPoints.filter(u => u !== usp),
    }));
  }

  // Portfolio handlers
  function openAddPortfolio() {
    setEditingPortfolio(null);
    setPortfolioForm(emptyPortfolioItem);
    setTechInput('');
    setPortfolioModal(true);
  }

  function openEditPortfolio(item: PortfolioItem) {
    setEditingPortfolio(item);
    setPortfolioForm({
      title: item.title,
      description: item.description,
      category: item.category,
      imageUrl: item.imageUrl,
      projectUrl: item.projectUrl,
      technologies: item.technologies,
      clientName: item.clientName,
      completedDate: item.completedDate,
      featured: item.featured,
    });
    setTechInput('');
    setPortfolioModal(true);
  }

  function addTechnology() {
    const tech = techInput.trim();
    if (tech && !portfolioForm.technologies.includes(tech)) {
      setPortfolioForm(prev => ({
        ...prev,
        technologies: [...prev.technologies, tech],
      }));
      setTechInput('');
    }
  }

  function removeTechnology(tech: string) {
    setPortfolioForm(prev => ({
      ...prev,
      technologies: prev.technologies.filter(t => t !== tech),
    }));
  }

  function savePortfolio() {
    if (!portfolioForm.title.trim()) {
      toast.error('Project title is required');
      return;
    }

    if (editingPortfolio) {
      // Update existing
      setBusiness(prev => ({
        ...prev,
        portfolio: prev.portfolio.map(p => 
          p.id === editingPortfolio.id 
            ? { ...portfolioForm, id: editingPortfolio.id }
            : p
        ),
      }));
      toast.success('Project updated!');
    } else {
      // Add new
      const newItem: PortfolioItem = {
        ...portfolioForm,
        id: Date.now().toString(),
      };
      setBusiness(prev => ({
        ...prev,
        portfolio: [...prev.portfolio, newItem],
      }));
      toast.success('Project added!');
    }
    setPortfolioModal(false);
  }

  function confirmDeletePortfolio(item: PortfolioItem) {
    setPortfolioToDelete(item);
    setDeletePortfolioDialog(true);
  }

  function deletePortfolio() {
    if (portfolioToDelete) {
      setBusiness(prev => ({
        ...prev,
        portfolio: prev.portfolio.filter(p => p.id !== portfolioToDelete.id),
      }));
      toast.success('Project deleted');
      setDeletePortfolioDialog(false);
      setPortfolioToDelete(null);
    }
  }

  function toggleFeatured(item: PortfolioItem) {
    setBusiness(prev => ({
      ...prev,
      portfolio: prev.portfolio.map(p =>
        p.id === item.id ? { ...p, featured: !p.featured } : p
      ),
    }));
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Business Profile</h1>
          <p className="text-muted-foreground">Define your business for better AI responses</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Profile
        </Button>
      </div>

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-500" />
            Basic Information
          </CardTitle>
          <CardDescription>Your business details for lead engagement</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Business Name</Label>
              <Input
                id="name"
                value={business.name}
                onChange={(e) => setBusiness(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your Business Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Location
              </Label>
              <Input
                id="location"
                value={business.location}
                onChange={(e) => setBusiness(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., Tunisia, Remote, Worldwide"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp" className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                WhatsApp Number
              </Label>
              <Input
                id="whatsapp"
                value={business.whatsapp}
                onChange={(e) => setBusiness(prev => ({ ...prev, whatsapp: e.target.value }))}
                placeholder="+216 XX XXX XXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="website" className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Website
              </Label>
              <Input
                id="website"
                value={business.website}
                onChange={(e) => setBusiness(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://yourwebsite.com"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="description">Business Description</Label>
            <Textarea
              id="description"
              value={business.description}
              onChange={(e) => setBusiness(prev => ({ ...prev, description: e.target.value }))}
              rows={4}
              placeholder="Describe your business, what you do, your expertise, experience, etc."
            />
          </div>
        </CardContent>
      </Card>

      {/* Target Audience */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-purple-500" />
            Target Audience
          </CardTitle>
          <CardDescription>Describe your ideal clients</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={business.targetAudience}
            onChange={(e) => setBusiness(prev => ({ ...prev, targetAudience: e.target.value }))}
            rows={3}
            placeholder="Describe your ideal clients: startups, small businesses, e-commerce stores, content creators, etc."
          />
        </CardContent>
      </Card>

      {/* Languages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="h-5 w-5 text-green-500" />
            Languages You Speak
          </CardTitle>
          <CardDescription>Languages you can communicate in with leads</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {business.languages.map((lang) => (
              <Badge key={lang} variant="secondary" className="gap-1 pr-1">
                {lang}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => removeLanguage(lang)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            {business.languages.length === 0 && (
              <p className="text-sm text-muted-foreground">No languages added yet</p>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
              placeholder="Add a language"
              className="flex-1"
            />
            <Button onClick={addLanguage} size="icon" variant="secondary">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Unique Selling Points */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            Unique Selling Points
          </CardTitle>
          <CardDescription>What makes you special?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {business.uniqueSellingPoints.map((usp, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3"
              >
                <span className="text-yellow-500">★</span>
                <span className="flex-1">{usp}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeUSP(usp)}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))}
            {business.uniqueSellingPoints.length === 0 && (
              <p className="text-sm text-muted-foreground">No selling points added yet</p>
            )}
          </div>

          <div className="flex gap-2">
            <Input
              value={newUSP}
              onChange={(e) => setNewUSP(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addUSP())}
              placeholder="e.g., 5+ years experience, Fast delivery, 24/7 support"
              className="flex-1"
            />
            <Button onClick={addUSP} size="icon" variant="secondary">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Portfolio */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-cyan-500" />
                Portfolio
              </CardTitle>
              <CardDescription>Showcase your best work to potential clients</CardDescription>
            </div>
            <Button onClick={openAddPortfolio} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Project
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {business.portfolio.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground mb-2">No projects in your portfolio yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add your best work to show potential clients what you can do
              </p>
              <Button onClick={openAddPortfolio} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Project
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {business.portfolio.map((item) => (
                <div
                  key={item.id}
                  className="group relative rounded-lg border border-border bg-card overflow-hidden transition-all hover:border-cyan-500/50 hover:shadow-lg"
                >
                  {/* Image placeholder or actual image */}
                  <div className="aspect-video bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center relative">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={item.imageUrl} 
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="h-12 w-12 text-muted-foreground/50" />
                    )}
                    {item.featured && (
                      <Badge className="absolute top-2 left-2 bg-yellow-500 text-black gap-1">
                        <Star className="h-3 w-3" />
                        Featured
                      </Badge>
                    )}
                    <Badge className="absolute top-2 right-2" variant="secondary">
                      {PORTFOLIO_CATEGORIES.find(c => c.value === item.category)?.label || item.category || 'Uncategorized'}
                    </Badge>
                  </div>
                  
                  {/* Content */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-lg line-clamp-1">{item.title}</h3>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleFeatured(item)}
                          title={item.featured ? 'Remove from featured' : 'Mark as featured'}
                        >
                          <Star className={`h-4 w-4 ${item.featured ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditPortfolio(item)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => confirmDeletePortfolio(item)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {item.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                    )}
                    
                    {/* Technologies */}
                    {item.technologies.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.technologies.slice(0, 4).map((tech) => (
                          <Badge key={tech} variant="outline" className="text-xs">
                            {tech}
                          </Badge>
                        ))}
                        {item.technologies.length > 4 && (
                          <Badge variant="outline" className="text-xs">
                            +{item.technologies.length - 4}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Meta info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                      {item.clientName && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.clientName}
                        </span>
                      )}
                      {item.completedDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {item.completedDate}
                        </span>
                      )}
                      {item.projectUrl && (
                        <a
                          href={item.projectUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-cyan-500 hover:underline ml-auto"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tips */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-blue-400">💡 How this helps</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This information helps the AI generate personalized responses when contacting leads.
            The more details you provide, the better the AI can represent your business and match
            you with the right clients. Your portfolio showcases your expertise to potential clients.
          </p>
        </CardContent>
      </Card>

      {/* Portfolio Add/Edit Modal */}
      <Dialog open={portfolioModal} onOpenChange={setPortfolioModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>
              {editingPortfolio ? 'Edit Project' : 'Add New Project'}
            </DialogTitle>
            <DialogDescription>
              {editingPortfolio 
                ? 'Update your project details' 
                : 'Showcase your work to potential clients'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-4 py-4">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="projectTitle">Project Title *</Label>
                <Input
                  id="projectTitle"
                  value={portfolioForm.title}
                  onChange={(e) => setPortfolioForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., E-commerce Website for Fashion Brand"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>Category</Label>
                <Select 
                  value={PORTFOLIO_CATEGORIES.some(c => c.value === portfolioForm.category) ? portfolioForm.category : 'other'} 
                  onValueChange={(value) => {
                    if (value === 'other') {
                      setPortfolioForm(prev => ({ ...prev, category: '' }));
                    } else {
                      setPortfolioForm(prev => ({ ...prev, category: value }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PORTFOLIO_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Show custom category input when "other" is selected or category is not in predefined list */}
                {(!PORTFOLIO_CATEGORIES.some(c => c.value === portfolioForm.category) || portfolioForm.category === '') && (
                  <Input
                    value={portfolioForm.category}
                    onChange={(e) => setPortfolioForm(prev => ({ ...prev, category: e.target.value }))}
                    placeholder="Specify category (e.g., Branding, SEO, Video Production...)"
                    className="mt-2"
                  />
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="projectDesc">Description</Label>
                <Textarea
                  id="projectDesc"
                  value={portfolioForm.description}
                  onChange={(e) => setPortfolioForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="Describe the project, your role, challenges solved, results achieved..."
                />
              </div>

              {/* URLs */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="projectUrl" className="flex items-center gap-1">
                    <LinkIcon className="h-3 w-3" />
                    Project URL
                  </Label>
                  <Input
                    id="projectUrl"
                    value={portfolioForm.projectUrl}
                    onChange={(e) => setPortfolioForm(prev => ({ ...prev, projectUrl: e.target.value }))}
                    placeholder="https://project-link.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" />
                    Image URL
                  </Label>
                  <Input
                    id="imageUrl"
                    value={portfolioForm.imageUrl}
                    onChange={(e) => setPortfolioForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                    placeholder="https://image-link.com/screenshot.jpg"
                  />
                </div>
              </div>

              {/* Client & Date */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="clientName" className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Client Name
                  </Label>
                  <Input
                    id="clientName"
                    value={portfolioForm.clientName}
                    onChange={(e) => setPortfolioForm(prev => ({ ...prev, clientName: e.target.value }))}
                    placeholder="e.g., Fashion Store Co."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="completedDate" className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Completed Date
                  </Label>
                  <Input
                    id="completedDate"
                    value={portfolioForm.completedDate}
                    onChange={(e) => setPortfolioForm(prev => ({ ...prev, completedDate: e.target.value }))}
                    placeholder="e.g., Dec 2024"
                  />
                </div>
              </div>

              {/* Technologies */}
              <div className="space-y-2">
                <Label>Technologies Used</Label>
                <div className="flex flex-wrap gap-2 min-h-8">
                  {portfolioForm.technologies.map((tech) => (
                    <Badge key={tech} variant="secondary" className="gap-1 pr-1">
                      {tech}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 hover:bg-transparent"
                        onClick={() => removeTechnology(tech)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTechnology())}
                    placeholder="e.g., Next.js, React, Node.js..."
                    className="flex-1"
                  />
                  <Button onClick={addTechnology} type="button" size="icon" variant="secondary">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Featured toggle */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label htmlFor="featured" className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-500" />
                    Featured Project
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Featured projects are highlighted to potential clients
                  </p>
                </div>
                <Switch
                  id="featured"
                  checked={portfolioForm.featured}
                  onCheckedChange={(checked) => setPortfolioForm(prev => ({ ...prev, featured: checked }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 mt-4">
            <Button variant="outline" onClick={() => setPortfolioModal(false)}>
              Cancel
            </Button>
            <Button onClick={savePortfolio} disabled={!portfolioForm.title.trim()}>
              {editingPortfolio ? 'Save Changes' : 'Add Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Portfolio Confirmation */}
      <AlertDialog open={deletePortfolioDialog} onOpenChange={setDeletePortfolioDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{portfolioToDelete?.title}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deletePortfolio}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
