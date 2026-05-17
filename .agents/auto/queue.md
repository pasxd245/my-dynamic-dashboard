# Autoagent topic queue

Round topics autoagent will drain in order. Format:

```markdown
### Topic: <one-line topic>

- req: <requirement 1>
- req: <requirement 2>
```

Mark consumed entries with `[x]` after the round closes:

```markdown
### [x] Topic: (consumed)
```

Autoagent picks the first un-checked `### Topic:` heading.

---

<!-- enqueue rounds below this line -->
