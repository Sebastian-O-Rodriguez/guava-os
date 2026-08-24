// trees.mjs — per-domain decision trees (question → branch → ordered sub-chain).
// Shared by gen.mjs (renders mermaid in the manual) and inject.mjs (injects the
// routing map into agents). One source of truth for the workflow shape.

export const TREES = {
  pm: {
    question: "Where are we in the manager loop?",
    branches: [
      { label: "plan", skills: ["grilling", "planning"] },
      { label: "write", skills: ["to-tickets", "linear"] },
      { label: "dispatch", skills: ["dispatch"] },
      { label: "review / promote", skills: ["review"] },
      { label: "handoff", skills: ["handoff"] },
    ],
  },
  qa: {
    question: "What QA activity?",
    branches: [
      { label: "verify a change", skills: ["verify"] },
      { label: "review a diff", skills: ["code-review"] },
      { label: "promote / reject", skills: ["review"] },
      { label: "plan testing", skills: ["test-strategy"] },
    ],
  },
  security: {
    question: "Authoring or auditing?",
    branches: [
      { label: "author secure code", skills: ["secure-coding"] },
      { label: "audit a diff", skills: ["security-review"] },
    ],
  },
  backend: {
    question: "What kind of backend work?",
    branches: [
      { label: "new / changed API", skills: ["api-design", "python-backend"] },
      { label: "schema / query / migration", skills: ["sql-postgres", "supabase", "supabase-postgres-best-practices"] },
    ],
  },
  frontend: {
    question: "What kind of frontend work?",
    branches: [
      { label: "app UI / components", skills: ["react-nextjs"] },
      { label: "animation", skills: ["gsap-core", "gsap-timeline", "gsap-scrolltrigger", "rive"] },
      { label: "presentation", skills: ["reveal-presentation"] },
      { label: "component API design", skills: ["vercel-composition-patterns", "vercel-react-best-practices"] },
    ],
  },
  devops: {
    question: "What kind of DevOps work?",
    branches: [
      { label: "CI/CD", skills: ["ci-cd"] },
      { label: "infra as code", skills: ["terraform"] },
      { label: "observability", skills: ["observability"] },
      { label: "deploy / platform", skills: ["deploy-to-vercel", "vercel", "vercel-cli-with-tokens"] },
    ],
  },
  "ai-ml": {
    question: "What kind of AI/ML work?",
    branches: [
      { label: "retrieval / RAG", skills: ["rag"] },
      { label: "prompt / eval", skills: ["prompt-engineering"] },
      { label: "data / analysis", skills: ["pandas-data"] },
    ],
  },
};