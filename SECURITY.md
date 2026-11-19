# Security

`cqs` is a heuristic linter for context packs. It is not a secret manager and it is not a guarantee that a pack is safe to send to a model.

## What the scanner does

It looks for a fixed set of credential-shaped patterns and for environment files such as `.env` (not `.env.example`). A finding names the file, the line, and the pattern. It does not include the matched text in the terminal report, JSON, Markdown, SARIF, GitHub annotations, or suggestion text.

That means:

- A clean score can still hide a secret written in a novel format.
- Example keys and documentation that happen to match a pattern are flagged. That is intentional.
- Placeholder values such as `your_api_key` and `placeholder` are not flagged.

## The fixture token

`examples/fixture-pack/.env` holds a synthetic `ghp_` string so the tests can prove redaction. It is not a live credential. Do not "fix" the fixture by inserting a real token.

## If you find a real secret

Rotate it. Remove it from the pack and from git history if it was committed. Do not open an issue that contains the value.

## The optional LLM hook

`llm.enabled` defaults to false. The CLI does not execute `llm.command` and does not call a network model. A library caller can pass a reviewer; returned notes are truncated and dropped if they themselves match a credential pattern. Reviewer notes never change the numeric score.
