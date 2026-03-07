import json
from datetime import date
from typing import Optional

from pydantic import BaseModel, field_validator

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


SEARCH_SYSTEM_PROMPT = """You are a search query parser for a task management application.
Given a natural language search query, extract structured filters.

Today's date is {current_date}.

Available filters:
- status: array of exact values from ["To Do", "In Progress", "Done", "Blocked"]
- priority: array of exact values from ["Low", "Medium", "High", "Critical"]
- owner: string (person name to filter by)
- search: string (free text to search in task names and descriptions)
- date_from: string in YYYY-MM-DD format (tasks with due_date on or after this)
- date_to: string in YYYY-MM-DD format (tasks with due_date on or before this)
- sort_by: one of ["task_name", "created_at", "updated_at", "due_date", "start_date", "priority", "status", "owner"]
- order: "asc" or "desc"

Interpretation rules:
- Map natural language to exact enum values: "in progress" -> "In Progress", "to do"/"todo" -> "To Do", "done"/"completed" -> "Done", "blocked" -> "Blocked"
- "urgent"/"important"/"asap" -> priority: ["High", "Critical"]
- "overdue" -> date_to: yesterday's date
- "due this week" -> date_from: this Monday, date_to: this Sunday
- "due today" -> date_from: today, date_to: today
- "assigned to John" or "John's tasks" -> owner: "John"
- Support multiple values: "in progress and to do" -> status: ["In Progress", "To Do"]
- Support multiple values: "high and critical" -> priority: ["High", "Critical"]
- "newest first"/"recent" -> sort_by: "created_at", order: "desc"
- "oldest first" -> sort_by: "created_at", order: "asc"
- "by due date" -> sort_by: "due_date", order: "asc"
- "alphabetical" -> sort_by: "task_name", order: "asc"
- If the query contains text to match task names/descriptions, put it in "search"
- If no specific filter is mentioned for a field, set it to null

Return ONLY valid JSON with no markdown formatting:
{{
  "status": ["In Progress"] or null,
  "priority": ["Critical"] or null,
  "owner": "string" or null,
  "search": "string" or null,
  "date_from": "YYYY-MM-DD" or null,
  "date_to": "YYYY-MM-DD" or null,
  "sort_by": "field_name" or null,
  "order": "asc" or null
}}"""


VALID_STATUSES = {"To Do", "In Progress", "Done", "Blocked"}
VALID_PRIORITIES = {"Low", "Medium", "High", "Critical"}
VALID_SORT_FIELDS = {"task_name", "created_at", "updated_at", "due_date", "start_date", "priority", "status", "owner"}


class ParsedFilters(BaseModel):
    status: Optional[list[str]] = None
    priority: Optional[list[str]] = None
    owner: Optional[str] = None
    search: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    sort_by: Optional[str] = None
    order: Optional[str] = None

    @classmethod
    def _filter_valid(cls, values, valid_set):
        if values is None:
            return None
        filtered = [v for v in values if v in valid_set]
        return filtered or None

    @field_validator('status', mode='before')
    @classmethod
    def validate_status(cls, v):
        return cls._filter_valid(v, VALID_STATUSES)

    @field_validator('priority', mode='before')
    @classmethod
    def validate_priority(cls, v):
        return cls._filter_valid(v, VALID_PRIORITIES)

    @field_validator('sort_by', mode='before')
    @classmethod
    def validate_sort_by(cls, v):
        return v if v in VALID_SORT_FIELDS else None

    @field_validator('order', mode='before')
    @classmethod
    def validate_order(cls, v):
        return v if v in ('asc', 'desc') else None

    @field_validator('date_from', 'date_to', mode='before')
    @classmethod
    def validate_date_format(cls, v):
        if v is None:
            return v
        try:
            date.fromisoformat(v)
            return v
        except (ValueError, TypeError):
            return None


def _build_search_prompt() -> str:
    return SEARCH_SYSTEM_PROMPT.format(current_date=date.today().isoformat())


def _parse_search_openai(text: str) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    system_prompt = _build_search_prompt()

    completion = client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text},
        ],
        response_format={"type": "json_object"},
    )

    raw = completion.choices[0].message.content if completion.choices else None
    if not raw:
        raise ValueError("LLM returned empty response for search query parsing")
    parsed = ParsedFilters.model_validate(json.loads(raw))
    return parsed.model_dump(exclude_none=True)


def _parse_search_anthropic(text: str) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    system_prompt = _build_search_prompt()

    message = client.messages.create(
        model=settings.ANTHROPIC_MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": text}],
    )

    raw = message.content[0].text.strip() if message.content else None
    if not raw:
        raise ValueError("LLM returned empty response for search query parsing")
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        raw = raw.rsplit("```", 1)[0].strip()
    parsed = ParsedFilters.model_validate_json(raw)
    return parsed.model_dump(exclude_none=True)


def parse_search_query(text: str, provider: Optional[str] = None) -> dict:
    provider = provider or settings.LLM_PROVIDER
    if provider == "openai":
        return _parse_search_openai(text)
    elif provider == "anthropic":
        return _parse_search_anthropic(text)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")


def parse_natural_language(text: str, provider: Optional[str] = None, custom_fields_spec: list[dict] | None = None, tone: str | None = None) -> list[dict]:
    provider = provider or settings.LLM_PROVIDER
    if provider == "openai":
        return parse_with_openai(text, custom_fields_spec, tone=tone)
    elif provider == "anthropic":
        return parse_with_anthropic(text, custom_fields_spec, tone=tone)
    else:
        raise ValueError(f"Unknown LLM provider: {provider}")
