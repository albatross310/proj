import { useEffect, useState } from "react";
import { API_URL, authHeaders, getToken } from "./api.js";

// Loads the public top answers for the current prompt while on the results
// page, re-fetching when the prompt, sort, or answersVersion changes. Aborts
// an in-flight request when it re-runs so a stale response can't overwrite a
// fresh list (e.g. when the just-submitted answer finishes saving).
export function useTopAnswers(page, promptKey, sortBy, answersVersion) {
  const [topAnswers, setTopAnswers] = useState([]);

  useEffect(() => {
    if (page !== "results") return;
    const controller = new AbortController();
    fetch(`${API_URL}/api/prompts/${promptKey}/top-answers?sort=${sortBy}`, {
      signal: controller.signal,
      headers: authHeaders()
    })
      .then((res) => res.json())
      .then((data) => setTopAnswers(data.answers || []))
      .catch((err) => {
        if (err.name !== "AbortError") setTopAnswers([]);
      });
    return () => controller.abort();
  }, [page, promptKey, sortBy, answersVersion]);

  // Toggle a like; returns a note string for the UI (empty on success).
  const likeAnswer = (answerId) => {
    if (!getToken()) return "Sign in to like answers.";
    fetch(`${API_URL}/api/answers/${answerId}/like`, {
      method: "POST",
      headers: authHeaders()
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) =>
        setTopAnswers((prev) =>
          prev.map((a) =>
            a.id === answerId
              ? { ...a, likes: data.likes, likedByMe: data.liked ? 1 : 0 }
              : a
          )
        )
      )
      .catch(() => {});
    return "";
  };

  return { topAnswers, setTopAnswers, likeAnswer };
}
