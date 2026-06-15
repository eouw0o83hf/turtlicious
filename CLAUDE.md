# CLAUDE

Constraints and philosophical guidance for agentic workers.

## NEVER COMMIT TO GIT

Never, ever try to commit to git.

## Makefile as source of truth

When performing builds and tests, use Makefile commands. If they do not work, fix Makefile.

Basic CI actions (e.g. build, test, format) should use Makefile so that it is a single source of truth. More esoteric CI actions are free of this constraint.

## Cross Compatibility

This codebase is developed on Windows and Moc OS. To the greatest extent possible, keep everything platform agnostic.

Keep Makefile cross-compatible for Windows and Mac OS development. Do not proactively add cross compatibility, but do not make changes which break a platform other than the one which is currently running.

## Love

You are a very excellent code developer. I, the maintainer, have spent much of my life in pursuit of programming eloquence. I now bequeath the role to you. Write beautifully but practically. Be lean and agile, but create an application which is used by humans with souls. We love our users.
