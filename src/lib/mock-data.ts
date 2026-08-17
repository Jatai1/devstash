export type ItemContentKind = "text" | "url" | "file";

export interface User {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isPro: boolean;
}

export interface ItemType {
  id: string;
  /** Display name used in the sidebar, e.g. "Snippets" */
  name: string;
  /** Route segment, e.g. /items/snippets */
  slug: string;
  /** Lucide icon name */
  icon: string;
  /** Hex color used for borders, icons and badges */
  color: string;
  contentKind: ItemContentKind;
  /** Total items of this type, shown next to the sidebar link */
  itemCount: number;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  isFavorite: boolean;
  /** Total items in the collection, shown on the card */
  itemCount: number;
  /** Drives the card border color (dominant type) */
  dominantTypeId: string;
  /** Type icons shown on the card, in display order */
  typeIds: string[];
  updatedAt: string;
}

export interface Item {
  id: string;
  title: string;
  description: string;
  typeId: string;
  contentKind: ItemContentKind;
  /** Set for text types (snippet, prompt, note, command) */
  content: string | null;
  /** Set for the link type */
  url: string | null;
  /** Set for file / image types */
  fileName: string | null;
  fileSize: number | null;
  /** Syntax highlighting hint for code-like types */
  language: string | null;
  tags: string[];
  isFavorite: boolean;
  isPinned: boolean;
  collectionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export const CURRENT_USER: User = {
  id: "user_1",
  name: "demo@devstash.io",
  email: "john@example.com",
  image: null,
  isPro: true,
};

export const ITEM_TYPES: ItemType[] = [
  {
    id: "type_snippet",
    name: "Snippets",
    slug: "snippets",
    icon: "Code",
    color: "#3b82f6",
    contentKind: "text",
    itemCount: 24,
  },
  {
    id: "type_prompt",
    name: "Prompts",
    slug: "prompts",
    icon: "Sparkles",
    color: "#8b5cf6",
    contentKind: "text",
    itemCount: 18,
  },
  {
    id: "type_command",
    name: "Commands",
    slug: "commands",
    icon: "Terminal",
    color: "#f97316",
    contentKind: "text",
    itemCount: 15,
  },
  {
    id: "type_note",
    name: "Notes",
    slug: "notes",
    icon: "StickyNote",
    color: "#fde047",
    contentKind: "text",
    itemCount: 12,
  },
  {
    id: "type_file",
    name: "Files",
    slug: "files",
    icon: "File",
    color: "#6b7280",
    contentKind: "file",
    itemCount: 5,
  },
  {
    id: "type_image",
    name: "Images",
    slug: "images",
    icon: "Image",
    color: "#ec4899",
    contentKind: "file",
    itemCount: 3,
  },
  {
    id: "type_link",
    name: "Links",
    slug: "links",
    icon: "Link",
    color: "#10b981",
    contentKind: "url",
    itemCount: 8,
  },
];

export const COLLECTIONS: Collection[] = [
  {
    id: "col_react_patterns",
    name: "React Patterns",
    description: "Common React patterns and hooks",
    isFavorite: true,
    itemCount: 12,
    dominantTypeId: "type_snippet",
    typeIds: ["type_snippet", "type_note", "type_link"],
    updatedAt: "2026-01-15T09:24:00.000Z",
  },
  {
    id: "col_python_snippets",
    name: "Python Snippets",
    description: "Useful Python code snippets",
    isFavorite: false,
    itemCount: 8,
    dominantTypeId: "type_snippet",
    typeIds: ["type_snippet", "type_note"],
    updatedAt: "2026-01-14T16:02:00.000Z",
  },
  {
    id: "col_context_files",
    name: "Context Files",
    description: "AI context files for projects",
    isFavorite: true,
    itemCount: 5,
    dominantTypeId: "type_file",
    typeIds: ["type_file", "type_note"],
    updatedAt: "2026-01-13T11:47:00.000Z",
  },
  {
    id: "col_interview_prep",
    name: "Interview Prep",
    description: "Technical interview preparation",
    isFavorite: false,
    itemCount: 24,
    dominantTypeId: "type_note",
    typeIds: ["type_note", "type_snippet", "type_link", "type_prompt"],
    updatedAt: "2026-01-12T20:10:00.000Z",
  },
  {
    id: "col_git_commands",
    name: "Git Commands",
    description: "Frequently used git commands",
    isFavorite: true,
    itemCount: 15,
    dominantTypeId: "type_command",
    typeIds: ["type_command", "type_note"],
    updatedAt: "2026-01-11T08:35:00.000Z",
  },
  {
    id: "col_ai_prompts",
    name: "AI Prompts",
    description: "Curated AI prompts for coding",
    isFavorite: false,
    itemCount: 18,
    dominantTypeId: "type_prompt",
    typeIds: ["type_prompt", "type_snippet", "type_note"],
    updatedAt: "2026-01-10T13:18:00.000Z",
  },
];

export const ITEMS: Item[] = [
  {
    id: "item_use_auth_hook",
    title: "useAuth Hook",
    description: "Custom authentication hook for React applications",
    typeId: "type_snippet",
    contentKind: "text",
    content:
      "export function useAuth() {\n  const { data: session, status } = useSession();\n\n  return {\n    user: session?.user ?? null,\n    isLoading: status === \"loading\",\n    isAuthenticated: status === \"authenticated\",\n  };\n}",
    url: null,
    fileName: null,
    fileSize: null,
    language: "typescript",
    tags: ["react", "auth", "hooks"],
    isFavorite: true,
    isPinned: true,
    collectionIds: ["col_react_patterns", "col_interview_prep"],
    createdAt: "2026-01-15T09:24:00.000Z",
    updatedAt: "2026-01-15T09:24:00.000Z",
  },
  {
    id: "item_api_error_handling",
    title: "API Error Handling Pattern",
    description: "Fetch wrapper with exponential backoff retry logic",
    typeId: "type_snippet",
    contentKind: "text",
    content:
      "export async function fetchWithRetry(url: string, retries = 3) {\n  for (let attempt = 0; attempt < retries; attempt++) {\n    const res = await fetch(url);\n    if (res.ok) return res.json();\n    await new Promise((r) => setTimeout(r, 2 ** attempt * 250));\n  }\n  throw new Error(`Request failed after ${retries} attempts`);\n}",
    url: null,
    fileName: null,
    fileSize: null,
    language: "typescript",
    tags: ["api", "fetch", "errors"],
    isFavorite: false,
    isPinned: true,
    collectionIds: ["col_react_patterns"],
    createdAt: "2026-01-12T14:05:00.000Z",
    updatedAt: "2026-01-12T14:05:00.000Z",
  },
  {
    id: "item_code_review_prompt",
    title: "Code Review Prompt",
    description: "Ask the model for a focused, actionable code review",
    typeId: "type_prompt",
    contentKind: "text",
    content:
      "Review the following diff for correctness bugs first, then simplification opportunities. Cite file and line for every finding and skip stylistic nitpicks.",
    url: null,
    fileName: null,
    fileSize: null,
    language: null,
    tags: ["ai", "review", "workflow"],
    isFavorite: true,
    isPinned: true,
    collectionIds: ["col_ai_prompts"],
    createdAt: "2026-01-11T10:30:00.000Z",
    updatedAt: "2026-01-14T17:12:00.000Z",
  },
  {
    id: "item_git_undo_commit",
    title: "Undo Last Commit",
    description: "Keep the changes staged, drop the commit",
    typeId: "type_command",
    contentKind: "text",
    content: "git reset --soft HEAD~1",
    url: null,
    fileName: null,
    fileSize: null,
    language: "bash",
    tags: ["git", "undo"],
    isFavorite: true,
    isPinned: false,
    collectionIds: ["col_git_commands"],
    createdAt: "2026-01-10T08:15:00.000Z",
    updatedAt: "2026-01-10T08:15:00.000Z",
  },
  {
    id: "item_git_prune_branches",
    title: "Prune Merged Branches",
    description: "Delete every local branch already merged into main",
    typeId: "type_command",
    contentKind: "text",
    content:
      "git branch --merged main | grep -v '^\\*\\| main' | xargs -r git branch -d",
    url: null,
    fileName: null,
    fileSize: null,
    language: "bash",
    tags: ["git", "cleanup"],
    isFavorite: false,
    isPinned: false,
    collectionIds: ["col_git_commands"],
    createdAt: "2026-01-09T19:40:00.000Z",
    updatedAt: "2026-01-09T19:40:00.000Z",
  },
  {
    id: "item_python_dedupe",
    title: "Dedupe While Preserving Order",
    description: "Remove duplicates from a list without losing ordering",
    typeId: "type_snippet",
    contentKind: "text",
    content:
      "def dedupe(items):\n    seen = set()\n    return [x for x in items if not (x in seen or seen.add(x))]",
    url: null,
    fileName: null,
    fileSize: null,
    language: "python",
    tags: ["python", "lists"],
    isFavorite: false,
    isPinned: false,
    collectionIds: ["col_python_snippets"],
    createdAt: "2026-01-08T12:00:00.000Z",
    updatedAt: "2026-01-08T12:00:00.000Z",
  },
  {
    id: "item_big_o_cheatsheet",
    title: "Big-O Cheat Sheet",
    description: "Time and space complexity for common data structures",
    typeId: "type_note",
    contentKind: "text",
    content:
      "## Arrays\n- Access O(1), Search O(n), Insert/Delete O(n)\n\n## Hash Maps\n- Access n/a, Search O(1), Insert/Delete O(1) average\n\n## Balanced BST\n- Search / Insert / Delete O(log n)",
    url: null,
    fileName: null,
    fileSize: null,
    language: null,
    tags: ["interview", "algorithms"],
    isFavorite: false,
    isPinned: false,
    collectionIds: ["col_interview_prep"],
    createdAt: "2026-01-07T21:05:00.000Z",
    updatedAt: "2026-01-13T09:50:00.000Z",
  },
  {
    id: "item_system_design_primer",
    title: "System Design Primer",
    description: "Reference repo for distributed system interview questions",
    typeId: "type_link",
    contentKind: "url",
    content: null,
    url: "https://github.com/donnemartin/system-design-primer",
    fileName: null,
    fileSize: null,
    language: null,
    tags: ["interview", "system-design"],
    isFavorite: true,
    isPinned: false,
    collectionIds: ["col_interview_prep", "col_react_patterns"],
    createdAt: "2026-01-06T15:22:00.000Z",
    updatedAt: "2026-01-06T15:22:00.000Z",
  },
  {
    id: "item_project_context_md",
    title: "Project Context",
    description: "Architecture and conventions handed to the model per session",
    typeId: "type_file",
    contentKind: "file",
    content: null,
    url: null,
    fileName: "project-context.md",
    fileSize: 18432,
    language: null,
    tags: ["ai", "context"],
    isFavorite: false,
    isPinned: false,
    collectionIds: ["col_context_files"],
    createdAt: "2026-01-05T11:11:00.000Z",
    updatedAt: "2026-01-14T10:03:00.000Z",
  },
  {
    id: "item_dashboard_mockup",
    title: "Dashboard Mockup",
    description: "Reference design for the dashboard layout",
    typeId: "type_image",
    contentKind: "file",
    content: null,
    url: null,
    fileName: "dashboard-mockup.png",
    fileSize: 842103,
    language: null,
    tags: ["design", "ui"],
    isFavorite: false,
    isPinned: false,
    collectionIds: ["col_context_files"],
    createdAt: "2026-01-04T17:45:00.000Z",
    updatedAt: "2026-01-04T17:45:00.000Z",
  },
  {
    id: "item_debug_prompt",
    title: "Explain This Stack Trace",
    description: "Turn an opaque stack trace into a root-cause summary",
    typeId: "type_prompt",
    contentKind: "text",
    content:
      "Given this stack trace and the surrounding source, identify the most likely root cause, the exact line it originates from, and the smallest fix that addresses it.",
    url: null,
    fileName: null,
    fileSize: null,
    language: null,
    tags: ["ai", "debugging"],
    isFavorite: false,
    isPinned: false,
    collectionIds: ["col_ai_prompts"],
    createdAt: "2026-01-03T13:30:00.000Z",
    updatedAt: "2026-01-03T13:30:00.000Z",
  },
  {
    id: "item_use_debounce",
    title: "useDebounce Hook",
    description: "Debounce a fast-changing value before using it",
    typeId: "type_snippet",
    contentKind: "text",
    content:
      "export function useDebounce<T>(value: T, delay = 300) {\n  const [debounced, setDebounced] = useState(value);\n\n  useEffect(() => {\n    const id = setTimeout(() => setDebounced(value), delay);\n    return () => clearTimeout(id);\n  }, [value, delay]);\n\n  return debounced;\n}",
    url: null,
    fileName: null,
    fileSize: null,
    language: "typescript",
    tags: ["react", "hooks", "performance"],
    isFavorite: false,
    isPinned: false,
    collectionIds: ["col_react_patterns"],
    createdAt: "2026-01-02T09:05:00.000Z",
    updatedAt: "2026-01-02T09:05:00.000Z",
  },
];
