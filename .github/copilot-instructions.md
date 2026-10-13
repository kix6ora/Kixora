Project: Kixora. Node 22, npm only (never bun).
Never print, request, or commit secrets. Never push to main.
Work on a branch; PR into develop; test-and-build must be green.
Windows PowerShell: never use && ; run one command per line.
Before finishing run, one per line: npx tsc --noEmit, then npx eslint . --max-warnings 0, then npm run test, then npm run build.
Source of truth is the code, not docs claiming "complete".
Do not touch unrelated files. Show a diff summary before committing.
Do not run npm ci or npm install unless I ask.
