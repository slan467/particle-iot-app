# Copilot, Codex and Claude Code

Install the Svelte extension for VS Code and the coding-agent extension you intend to use: GitHub Copilot, OpenAI Codex, or Claude Code. Each needs its own account/access; this template does not provide AI subscriptions or require calling an AI API from the application.

## One set of project instructions

`AGENTS.md` is the canonical project guidance. `.github/copilot-instructions.md` points Copilot to it. `CLAUDE.md` imports it with `@AGENTS.md`, including for Claude sessions that do not load `AGENTS.md` directly. Keeping a short adapter avoids maintaining three copies of the architectural rules.

## One shared skill

The canonical skill lives at `.agents/skills/add-iot-feature/SKILL.md`. The repository also contains these relative directory symlinks:

```text
.github/skills/add-iot-feature → ../../.agents/skills/add-iot-feature
.claude/skills/add-iot-feature → ../../.agents/skills/add-iot-feature
```

Codex discovers `.agents/skills`, Copilot uses `.github/skills`, and Claude Code uses `.claude/skills`. The skill uses standard `name` and `description` frontmatter and no tool-specific APIs. Codex and Claude document following skill-directory symlinks; Copilot discovery should be checked in the actual installed VS Code extension.

After cloning, run:

```sh
npm run skills:setup
```

On Windows, a Git checkout may materialize a symlink as a text file, or symlink creation may require Developer Mode. If that happens, run `npm run skills:setup -- --copy`. The script recognizes Git’s symlink-placeholder text and replaces it with an ordinary skill directory. It refuses to replace unrelated files. Rerun the copy command after editing the canonical skill, and avoid committing divergent copies.

Reopen the agent session after setup. Confirm the skill appears in its skill picker or slash-command menu. In Codex, explicitly invoke `$add-iot-feature`; in Claude Code use `/add-iot-feature`; in Copilot use its skill picker/slash command when available, or ask it to use the `add-iot-feature` skill by name. If automatic discovery fails, explicitly reference the canonical `SKILL.md` in the request and inspect the extension’s skill settings.

The skill guides a complete firmware → validation → storage → UI change. It does not contain credentials or grant permission to flash devices, publish deployments, delete records or operate real actuators beyond the task the user authorized.

Use [project-guide.md](project-guide.md) for a realistic request. Verify the extension actually loads the skill rather than assuming a model choice alone enables skill discovery. All three extension paths need an interactive check on the machines used for development; repository validation can check links and frontmatter but cannot establish account/extension availability.

References: [Codex skills](https://learn.chatgpt.com/docs/build-skills), [VS Code agent skills](https://code.visualstudio.com/docs/agent-customization/agent-skills), [Claude Code skills](https://code.claude.com/docs/en/skills).
