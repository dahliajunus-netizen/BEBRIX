export type Block =
  | { type: "p" | "h" | "li"; text: string }
  | { type: "img"; src: string; w: number; h: number; alt?: string }
  | { type: "table"; rows: string[][] };

export type Format = "single_choice" | "multiple_choice" | "short_answer" | "ordering" | "grid_select";
export type Difficulty = "mudah" | "sedang" | "sulit" | "lanjutan";
export type Status = "draft" | "needs_review" | "published" | "archived";

export interface Option {
  label: string;
  text: string;
  image: { src: string; w: number; h: number } | null;
  sort: number;
}

export interface Question {
  id: string;
  origin: "historical" | "original";
  year: number | null;
  number: number | null;
  code: string | null;
  code_note: string | null;
  title: string;
  country: string | null;
  category: string;
  topic: string;
  difficulty: Difficulty;
  format: Format;
  stem: Block[];
  config: { rows?: number; cols?: number };
  input_hint: string | null;
  original: { src: string; w: number; h: number }[];
  pages: number[];
  credit: string | null;
  status: Status;
  review_note: string | null;
  question_options: Option[];
  question_sources: { title: string; license: string; year: number } | null;
}

export type QuestionSummary = Pick<Question, "id" | "year" | "number" | "code" | "title" | "topic" | "difficulty" | "format" | "origin" | "status">;

/** What the student sends back. Exactly one field is used, depending on the format. */
export interface Response {
  choice?: string;
  choices?: string[];
  text?: string;
  order?: string[];
}

export interface AnswerKey {
  correct?: string[];
  accepted?: string[];
  caseSensitive?: boolean;
  proposed?: boolean;
}

export interface Unlocked {
  code: string;
  name: string;
  description: string;
  icon: string;
}

export interface Feedback {
  is_correct: boolean;
  key: AnswerKey | null;
  explanation: Block[];
  informatics: Block[];
  xp_awarded?: number;
  achievements?: Unlocked[];
  response?: Response;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  grade: number | null;
  avatar_url: string | null;
  role: "student" | "admin";
  xp: number;
  streak: number;
  longest_streak: number;
  last_active: string | null;
  leaderboard_visible: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Topic {
  slug: string;
  name: string;
  description: string;
  sort: number;
}

export interface Competition {
  id: string;
  title: string;
  description: string;
  mode: "latihan" | "berwaktu" | "penuh";
  duration_minutes: number | null;
  question_count: number;
  difficulty_mix: Record<string, number>;
  topics: string[];
  years: number[];
  score_correct: number;
  score_wrong: number;
  score_blank: number;
  is_active: boolean;
  created_at: string;
}

export interface CompetitionSession {
  id: string;
  competition_id: string;
  user_id: string;
  question_ids: string[];
  answers: Record<string, Response>;
  marked: string[];
  started_at: string;
  deadline: string | null;
  submitted_at: string | null;
  status: "in_progress" | "submitted";
}

export interface CompetitionResult {
  session_id: string;
  competition_id: string;
  score: number;
  max_score: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
  time_spent_seconds: number;
  topic_breakdown: Record<string, { total: number; correct: number }>;
  created_at: string;
}
