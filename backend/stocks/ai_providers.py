import json
import math
from dataclasses import dataclass
from decimal import Decimal

import requests
from django.conf import settings


class ProviderUnavailableError(Exception):
    pass


class ProviderTimeoutError(Exception):
    pass


class ProviderResponseError(Exception):
    pass


@dataclass
class ProviderUsage:
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class ProviderEvent:
    type: str
    text: str = ""
    usage: ProviderUsage | None = None


class BaseProvider:
    name = ""
    model = ""

    def __init__(self, *, input_cost_per_mtok, output_cost_per_mtok, max_output_tokens):
        self.input_cost_per_mtok = Decimal(str(input_cost_per_mtok))
        self.output_cost_per_mtok = Decimal(str(output_cost_per_mtok))
        self.max_output_tokens = max_output_tokens

    def estimate_reservation_usd(self, input_text):
        input_tokens = estimate_tokens(input_text)
        return round_usd(
            (Decimal(input_tokens) / Decimal("1000000")) * self.input_cost_per_mtok
            + (Decimal(self.max_output_tokens) / Decimal("1000000")) * self.output_cost_per_mtok
        )

    def calculate_actual_cost_usd(self, usage):
        if usage is None:
            usage = ProviderUsage()
        return round_usd(
            (Decimal(usage.input_tokens) / Decimal("1000000")) * self.input_cost_per_mtok
            + (Decimal(usage.output_tokens) / Decimal("1000000")) * self.output_cost_per_mtok
        )

    def ensure_configured(self):
        return None

    def stream_response(self, *, system_prompt, conversation):
        raise NotImplementedError


class AnthropicProvider(BaseProvider):
    name = "anthropic"

    def __init__(self):
        super().__init__(
            input_cost_per_mtok=settings.ANTHROPIC_INPUT_COST_PER_MTOK_USD,
            output_cost_per_mtok=settings.ANTHROPIC_OUTPUT_COST_PER_MTOK_USD,
            max_output_tokens=settings.AI_MAX_TOKENS,
        )
        self.model = settings.ANTHROPIC_MODEL

    def ensure_configured(self):
        if not settings.ANTHROPIC_API_KEY:
            raise ProviderUnavailableError(
                "The AI copilot is not available. Configure ANTHROPIC_API_KEY or switch AI_PROVIDER."
            )

    def stream_response(self, *, system_prompt, conversation):
        self.ensure_configured()

        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        try:
            with client.messages.stream(
                model=self.model,
                max_tokens=self.max_output_tokens,
                system=system_prompt,
                messages=_anthropic_messages(conversation),
            ) as stream:
                for text in stream.text_stream:
                    if text:
                        yield ProviderEvent(type="text", text=text)

                final_message = stream.get_final_message()
                usage = getattr(final_message, "usage", None)
                yield ProviderEvent(
                    type="usage",
                    usage=ProviderUsage(
                        input_tokens=getattr(usage, "input_tokens", 0) or 0,
                        output_tokens=getattr(usage, "output_tokens", 0) or 0,
                    ),
                )
        except Exception as exc:
            if exc.__class__.__name__ in {"APITimeoutError"}:
                raise ProviderTimeoutError("Anthropic timed out.") from exc
            if exc.__class__.__name__ in {"APIError", "APIStatusError", "APIConnectionError"}:
                raise ProviderResponseError("Anthropic request failed.") from exc
            raise


class GeminiProvider(BaseProvider):
    name = "gemini"
    endpoint_template = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "{model}:streamGenerateContent?alt=sse&key={api_key}"
    )

    def __init__(self):
        super().__init__(
            input_cost_per_mtok=settings.GEMINI_INPUT_COST_PER_MTOK_USD,
            output_cost_per_mtok=settings.GEMINI_OUTPUT_COST_PER_MTOK_USD,
            max_output_tokens=settings.AI_MAX_TOKENS,
        )
        self.model = settings.GEMINI_MODEL

    def ensure_configured(self):
        if not settings.GEMINI_API_KEY:
            raise ProviderUnavailableError(
                "The AI copilot is not available. Configure GEMINI_API_KEY or switch AI_PROVIDER."
            )

    def stream_response(self, *, system_prompt, conversation):
        self.ensure_configured()

        url = self.endpoint_template.format(
            model=self.model,
            api_key=settings.GEMINI_API_KEY,
        )
        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}],
            },
            "contents": _gemini_contents(conversation),
            "generationConfig": {
                "maxOutputTokens": self.max_output_tokens,
                "thinkingConfig": {
                    "thinkingBudget": settings.GEMINI_THINKING_BUDGET,
                },
            },
        }

        try:
            response = requests.post(
                url,
                json=payload,
                stream=True,
                timeout=(5, settings.AI_PROVIDER_TIMEOUT_SECONDS),
            )
        except requests.Timeout as exc:
            raise ProviderTimeoutError("Gemini timed out.") from exc
        except requests.RequestException as exc:
            raise ProviderResponseError("Gemini request failed.") from exc

        if response.status_code >= 400:
            raise ProviderResponseError(_gemini_error_message(response))

        usage = ProviderUsage()
        accumulated_text = ""

        try:
            for line in response.iter_lines(decode_unicode=True):
                if not line or not line.startswith("data:"):
                    continue
                payload = json.loads(line[5:].strip())
                chunk_text, accumulated_text = _extract_gemini_text_delta(payload, accumulated_text)
                if chunk_text:
                    yield ProviderEvent(type="text", text=chunk_text)
                usage = _extract_gemini_usage(payload) or usage
        except requests.Timeout as exc:
            raise ProviderTimeoutError("Gemini timed out.") from exc
        except requests.RequestException as exc:
            raise ProviderResponseError("Gemini stream failed.") from exc

        yield ProviderEvent(type="usage", usage=usage)


def get_ai_provider():
    provider_name = settings.AI_PROVIDER
    if provider_name == "anthropic":
        return AnthropicProvider()
    if provider_name == "gemini":
        return GeminiProvider()
    raise ProviderUnavailableError(
        f"Unsupported AI provider '{provider_name}'. Set AI_PROVIDER to 'anthropic' or 'gemini'."
    )


def estimate_tokens(text):
    if not text:
        return 0
    return max(1, math.ceil(len(text) / 4))


def round_usd(value):
    return Decimal(value).quantize(Decimal("0.0001"))


def _anthropic_messages(conversation):
    return [
        {
            "role": "assistant" if turn["role"] == "assistant" else "user",
            "content": turn["content"],
        }
        for turn in conversation
    ]


def _gemini_contents(conversation):
    contents = []
    for turn in conversation:
        contents.append(
            {
                "role": "model" if turn["role"] == "assistant" else "user",
                "parts": [{"text": turn["content"]}],
            }
        )
    return contents


def _extract_gemini_text_delta(payload, accumulated_text):
    combined = "".join(
        part.get("text", "")
        for candidate in payload.get("candidates", [])
        for part in (candidate.get("content") or {}).get("parts", [])
        if part.get("text")
    )

    if not combined:
        return "", accumulated_text

    if combined.startswith(accumulated_text):
        return combined[len(accumulated_text):], combined

    return combined, accumulated_text + combined


def _extract_gemini_usage(payload):
    usage = payload.get("usageMetadata") or {}
    if not usage:
        return None
    return ProviderUsage(
        input_tokens=usage.get("promptTokenCount", 0) or 0,
        output_tokens=usage.get("candidatesTokenCount", 0) or 0,
    )


def _gemini_error_message(response):
    try:
        payload = response.json()
    except ValueError:
        return "Gemini request failed."

    error = payload.get("error") or {}
    return error.get("message") or "Gemini request failed."
