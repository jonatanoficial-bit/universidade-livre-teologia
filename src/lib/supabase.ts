import { createClient } from "@supabase/supabase-js";
import type { ContentBlock } from "../data";

export type AppRole = "student" | "teacher" | "editor" | "admin";

export type RemoteProfile = {
  full_name: string;
  role: AppRole;
};

export type TeacherAttempt = {
  id: string;
  student_id: string;
  student_name: string;
  course_id: string;
  score: number;
  passed: boolean;
  submitted_at: string;
  teacher_feedback: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
};

export type EditorialModule = {
  id: string;
  course_id: string;
  title: string;
  summary: string;
  position: number;
  created_by: string;
  updated_at: string;
};

export type EditorialLesson = {
  id: string;
  course_id: string;
  module_id: string;
  position: number;
  slug: string;
  title: string;
  intro: string;
  objectives: string[];
  content_blocks: ContentBlock[];
  source_references: string[];
  estimated_minutes: number;
  youtube_url: string | null;
  status: "draft" | "published";
  author_id: string;
  updated_at: string;
};

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(url && publishableKey);

export const supabase = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
