
"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Plus, Check } from 'lucide-react';
import { suggestInvoiceItemDescriptions } from '@/ai/flows/ai-invoice-item-description-suggestion';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';

interface AIDescriptionToolProps {
  itemName: string;
  onSelect: (description: string) => void;
}

export function AIDescriptionTool({ itemName, onSelect }: AIDescriptionToolProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleSuggest = async () => {
    if (!itemName) {
      toast({
        title: "Input Required",
        description: "Please enter a basic item name first.",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await suggestInvoiceItemDescriptions({ itemName });
      setSuggestions(result.suggestions);
      setOpen(true);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "AI Failed",
        description: "Could not generate suggestions. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="text-accent hover:text-accent hover:bg-accent/10 px-2 h-8 font-bold"
            onClick={handleSuggest}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1" />}
            AI Suggest
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 overflow-hidden rounded-xl shadow-2xl border-accent/20" align="end">
          <div className="bg-accent p-3">
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Professional Suggestions
            </p>
          </div>
          <div className="p-2 space-y-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                className="w-full text-left p-3 text-sm hover:bg-accent/10 rounded-lg transition-colors flex items-start gap-2 group"
                onClick={() => {
                  onSelect(suggestion);
                  setOpen(false);
                }}
              >
                <Plus className="h-4 w-4 mt-0.5 text-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="flex-1">{suggestion}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
