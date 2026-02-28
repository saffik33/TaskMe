import json
from datetime import date
from typing import Optional

from pydantic import BaseModel

from ..config import settings

SYSTEM_PROMPT = """You are a task extraction assistant. Your job is to parse free-form human
language text and extract structured task information.

Today's date is {current_date}.

RULES:
1. Extract EVERY distinct task mentioned in the text.
2. For each task, extract these fields:
   - task_name: A concise action-oriented title (e.g., "Finish quarterly report")
   - description: Additional context if available, otherwise null.
     Do NOT put custom field values (like "FieldName: value" pairs) here —
     use the custom_fields object instead.
   - owner: The person responsible (first name, full name, or role as given)
   - email: Email address if mentioned, otherwise null
   - start_date: In YYYY-MM-DD format. If "today" use {current_date}. If not mentioned, set to null.
   - due_date: In YYYY-MM-DD format. Interpret relative dates like "next week"
     (= next Monday), "by Friday" (= this coming Friday), "end of month", etc.
     relative to {current_date}. If not mentioned, set to null.
   - priority: Infer from language cues. Words like "urgent", "ASAP", "critical"
     = "High" or "Critical". "when you get a chance", "low priority" = "Low".
     Default to "Medium" if no cues.
3. If the text mentions multiple people with multiple tasks, create separate
   task entries for each.
4. If a single person has multiple tasks, create separate entries for each task.
5. Do NOT invent information not present in the text.
6. For ambiguous dates, make your best reasonable interpretation and note the
   assumption in the description field.
{custom_fields_rules}{tone_instruction}
Respond with ONLY valid JSON matching this exact schema:
{{
  "tasks": [
    {{
      "task_name": "string",
      "description": "string or null",
      "owner": "string or null",
      "email": "string or null",
      "start_date": "YYYY-MM-DD or null",
      "due_date": "YYYY-MM-DD or null",
      "priority": "Low | Medium | High | Critical"{custom_fields_schema}
    }}
  ]
}}"""


class ParsedTask(BaseModel):
    task_name: str
    description: Optional[str] = None
    owner: Optional[str] = None
    email: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    priority: str = "Medium"
    custom_fields: Optional[dict] = None


class ParsedTaskList(BaseModel):
    tasks: list[ParsedTask]


TONE_MAP = {
    "professional": "Rephrase task_name and description in clear, formal business language. Use action-oriented titles. Avoid slang or casual phrasing.",
    "executive": "Rephrase task_name and description in high-level strategic language. Frame tasks as outcomes and decisions. Use concise executive-level phrasing.",
    "friendly": "Rephrase task_name and description in warm, approachable language. Keep it casual but clear. Use an encouraging and collaborative tone.",
    "concise": "Rephrase task_name and description using the fewest words possible. Strip filler words, articles, and unnecessary detail. Keep only the essential action and subject.",
}


def _build_system_prompt(custom_fields_spec: list[dict] | None = None, tone: str | None = None) -> str:
    current_date = date.today().isoformat()

    custom_fields_rules = ""
    custom_fields_schema = ""

    if custom_fields_spec:
        lines = ["7. IMPORTANT — Extract these custom fields when their values appear in the text:"]
        for cf in custom_fields_spec:
            desc = f'   - {cf["display_name"]} ({cf["field_type"]})'
            if cf.get("options"):
                try:
                    opts = json.loads(cf["options"])
                    desc += f' — valid options: {", ".join(opts)}'
                except (json.JSONDecodeError, TypeError):
                    pass
            desc += f': Extract into custom_fields.{cf["field_key"]}'
            lines.append(desc)
        lines.append('   Look for patterns like "FieldName: value", "FieldName = value", or')
        lines.append('   "FieldName is value". These MUST go into custom_fields, NOT description.')
        lines.append("   If none of these custom fields are mentioned, set custom_fields to null.")
        lines.append("   Only include a custom field in the object if its value is explicitly stated.")
        custom_fields_rules = "\n".join(lines) + "\n"

        example_obj = ", ".join(f'"{cf["field_key"]}": "value"' for cf in custom_fields_spec)
        custom_fields_schema = f',\n      "custom_fields": {{{example_obj}}} or null'

    tone_instruction = ""
    if tone and tone != "none" and tone in TONE_MAP:
        rule_num = 8 if custom_fields_spec else 7
        tone_instruction = (
            f"{rule_num}. REPHRASING: {TONE_MAP[tone]}\n"
            f"   Keep all factual information (names, dates, emails) unchanged — "
            f"only rephrase the wording of task_name and description.\n"
        )

    return SYSTEM_PROMPT.format(
        current_date=current_date,
        custom_fields_rules=custom_fields_rules,
        custom_fields_schema=custom_fields_schema,
        tone_instruction=tone_instruction,
    )


def parse_with_openai(text: str, custom_fields_spec: list[dict] | None = None, tone: str | None = None) -> list[dict]:
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    system_prompt = _build_system_prompt(custom_fields_spec, tone=tone)

    completion = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
    )

    raw = completion.choices[0].message.content
    parsed = ParsedTaskList.model_validate(json.loads(raw))
    return [task.model_dump() for task in parsed.tasks]


def parse_with_anthropic(text: str, custom_fields_spec: list[dict] | None = None, tone: str | None = None) -> list[dict]:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    system_prompt = _build_system_prompt(custom_fields_spec, tone=tone)

    message = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": text}],
    )

    raw = message.content[0].text.strip()
    # Strip markdown code fences if present (e.g. ```json ... ```)
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]  # remove opening fence line
        raw = raw.rsplit("```", 1)[0].strip()
    parsed = ParsedTaskList.model_validate_json(raw)
    return [task.model_dump() for task in parsed.tasks]


def parse_natural_language(text: str, provider: Optional[str] = None, custom_fields_spec: list[dict] | None = None, tone: str | None = None) -> list[dict]:
    provider = provider or settings.LLM_PROVIDER
    if provider == "openai":
        return parse_with_openai(text, custom_fields_spec, tone=tone)
    elif provider == "anthropic":
        return parse_with_anthropic(text, custom_fields_spec, tone=tone)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
