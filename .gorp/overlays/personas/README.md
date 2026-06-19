# Persona Overlays — guava-os

Project-specific extensions to canonical personas (`personas/<id>.md` in Gorp).
Add an overlay here as `<persona-id>.overlay.md` only when a role needs
guava-os-specific patterns, context, narrower scope, or extra review duties.

Overlays follow `personas/PERSONA-SCHEMA.md` (§6) and are **tighten-and-extend
only**: they may add stack patterns, context, narrower scopes, or extra approval
gates; they may NOT broaden safety rules, add capabilities, raise the reasoning
tier, add secret access, add unapproved provider access, or override specs.

None are defined yet for guava-os. The canonical personas are sufficient until a
role needs project-specific detail.
