import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface KeyFeature {
  icon: string;
  title: string;
  description: string;
}

export interface LandingContent {
  id: string;
  property_id: string;
  headline: string;
  subheadline: string | null;
  description_persuasive: string;
  key_features: KeyFeature[];
  cta_primary: string;
  cta_secondary: string | null;
  seo_title: string | null;
  seo_description: string | null;
  generated_at: string;
  model_used: string | null;
}

export function useLandingContent(propertyId: string | undefined) {
  const [content, setContent] = useState<LandingContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContent = useCallback(async () => {
    if (!propertyId) return;

    setIsLoading(true);
    setError(null);

    try {
      // First, try to get cached content from the database
      const { data: cachedContent, error: fetchError } = await supabase
        .from('property_landing_content')
        .select('*')
        .eq('property_id', propertyId)
        .single();

      if (cachedContent && !fetchError) {
        setContent({
          ...cachedContent,
          key_features: (cachedContent.key_features as unknown as KeyFeature[]) || [],
        });
        setIsLoading(false);
        return;
      }

      // If no cached content, generate new content
      await generateContent();
    } catch (err) {
      console.error('Error fetching landing content:', err);
      setError(err instanceof Error ? err.message : 'Failed to load content');
      setIsLoading(false);
    }
  }, [propertyId]);

  const generateContent = useCallback(async (forceRegenerate = false) => {
    if (!propertyId) return;

    setIsGenerating(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'generate-landing-content',
        {
          body: { propertyId, forceRegenerate },
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.content) {
        setContent({
          ...data.content,
          key_features: (data.content.key_features as KeyFeature[]) || [],
        });
      }
    } catch (err) {
      console.error('Error generating landing content:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate content');
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  return {
    content,
    isLoading,
    isGenerating,
    error,
    regenerate: () => generateContent(true),
  };
}
