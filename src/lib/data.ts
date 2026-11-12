import { supabase } from "./supabase";
import type { Feedback, Question, Response, Topic } from "./types";

export const QUESTION_SELECT = "*, question_options(label, text, image, sort), question_sources(title, license, year)";

function normalise(q: Question): Question {
  q.question_options = [...(q.question_options ?? [])].sort((a, b) => a.sort - b.sort);
  return q;
}

export async function fetchQuestion(id: string): Promise<Question | null> {
  const { data, error } = await supabase().from("questions").select(QUESTION_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? normalise(data as Question) : null;
}

/** Returns the questions in the order of `ids`. */
export async function fetchQuestions(ids: string[]): Promise<Question[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase().from("questions").select(QUESTION_SELECT).in("id", ids);
  if (error) throw error;
  const map = new Map((data as Question[]).map((q) => [q.id, normalise(q)]));
  return ids.map((id) => map.get(id)).filter((q): q is Question => Boolean(q));
}

export async function fetchTopics(): Promise<Topic[]> {
  const { data, error } = await supabase().from("topics").select("*").order("sort");
  if (error) throw error;
  return data as Topic[];
}

export async function submitAnswer(args: { questionId: string; response: Response; sessionId?: string | null; mode: string; timeMs: number }): Promise<Feedback> {
  const { data, error } = await supabase().rpc("submit_answer", {
    p_question_id: args.questionId,
    p_response: args.response,
    p_session_id: args.sessionId ?? null,
    p_mode: args.mode,
    p_time_ms: Math.round(args.timeMs),
  });
  if (error) throw error;
  return data as Feedback;
}

export async function fetchReview(questionId: string): Promise<Feedback | null> {
  const { data, error } = await supabase().rpc("get_review", { p_question_id: questionId });
  if (error) throw error;
  return (data as Feedback) ?? null;
}

export function hasResponse(r: Response | undefined | null): boolean {
  if (!r) return false;
  return Boolean(r.choice || r.text?.trim() || r.choices?.length || r.order?.length);
}
