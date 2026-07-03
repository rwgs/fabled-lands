## Task workflow

At the start of every session:
1. Read `TASKS.md`
2. Work through the first open (unchecked) task from top to bottom
3. Follow the steps exactly as written — each task is self-contained
4. When a task is complete, mark it `[x]` in `TASKS.md` and update `README.md` if the task instructs it
5. Run all tests before marking a task done

Do not skip steps. Do not combine tasks unless explicitly instructed.

If during any task you identify a model error, missing assumption, or undocumented simplification, add it as a new task at the bottom of `TASKS.md` before continuing. Do not leave findings only in conversation.

---

## Security / antivirus compatibility
This environment uses Bitdefender on Windows, and PowerShell-heavy or suspicious command lines may be blocked.

Follow these rules strictly:
- Avoid PowerShell unless absolutely necessary
- Do not use encoded PowerShell commands
- Do not generate long shell one-liners for file rewriting
- Do not chain many shell commands together
- Prefer direct file edits over shell-based search/replace
- Prefer normal file I/O over shell piping or generated scripts
- Do not touch registry, startup settings, scheduled tasks, antivirus settings, or security settings
- Do not use obfuscated scripts or suspicious automation patterns
- Prefer standard dotnet CLI and git commands when command execution is needed
- Keep commands short, explicit, and readable
- If a command is blocked or likely to trigger antivirus heuristics, stop and propose the smallest safe manual alternative