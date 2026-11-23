import { createClient } from "@supabase/supabase-js";

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
