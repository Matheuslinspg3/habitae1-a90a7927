
CREATE TABLE public.generated_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  video_url TEXT,
  format TEXT NOT NULL DEFAULT '9:16',
  has_narration BOOLEAN NOT NULL DEFAULT false,
  voice_used TEXT,
  duration_seconds INTEGER,
  duration_per_photo INTEGER NOT NULL DEFAULT 3,
  music_style TEXT,
  final_text TEXT,
  include_logo BOOLEAN NOT NULL DEFAULT true,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  job_id TEXT,
  job_status TEXT NOT NULL DEFAULT 'pending',
  job_progress INTEGER DEFAULT 0,
  job_phase TEXT,
  job_error TEXT,
  file_size_bytes BIGINT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org videos"
  ON public.generated_videos FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own org videos"
  ON public.generated_videos FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own org videos"
  ON public.generated_videos FOR UPDATE TO authenticated
  USING (organization_id = (SELECT organization_id FROM profiles WHERE user_id = auth.uid()));

CREATE INDEX idx_generated_videos_org ON public.generated_videos(organization_id);
CREATE INDEX idx_generated_videos_property ON public.generated_videos(property_id);
CREATE INDEX idx_generated_videos_job ON public.generated_videos(job_id);
