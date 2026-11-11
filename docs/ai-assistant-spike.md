# AI assistant spike: findings and Sprint 3 scope

**Jira:** CCD-343 (spike), CCD-346 (this note) · **Date:** 8 Nov 2026 · **Author:** Taras

## Summary

- **It works end to end.** Claude answers questions about a county by calling a tool that reads our PostgreSQL database. The numbers it quotes are the numbers in the database.
- **Cost:** about **$0.0005 per question on Haiku 5.5** and **$0.009 on Sonnet 5.5**. 1,000 questions would cost about $0.50 on Haiku or $9 on Sonnet.
- **Response time:** median **3.5 s on Haiku** and **4.6 s on Sonnet** for the whole answer, without streaming.
- **Model:** use **Claude Haiku 5.5** by default. On our test questions it was as accurate as Sonnet at about 1/17 of the cost. Keep the model name in settings so we can switch to Sonnet without a code change.
- **Sprint 3:** three tools instead of four, a case-insensitive county lookup, and a stricter system prompt (details below).

## What was built

| Piece | Where |
|---|---|
| Anthropic SDK and `ANTHROPIC_API_KEY` read from `.env` (CCD-344) | `backend/config/settings.py`, `requirements.txt` |
| Tool `get_projections(county, var, season)` (CCD-345) | `backend/ai_agent/utils.py` |
| Agent loop with the SDK tool runner and the system prompt | `backend/ai_agent/agent.py` |
| `ClimateSeriesSerializer`: one county, one variable and season, every scenario and period, change from baseline. Shared with the future `/projections/` endpoint (CCD-84) | `backend/climate/serializers.py` |

How a question is answered:

```
question → Claude (system prompt + tool schema)
         → tool_use: get_projections(county="cork", var="temperature")
         → Django runs one ORM query and returns JSON (values, change, units, baseline, source)
         → Claude writes the answer from that JSON
```

Claude never touches the database. It can only call our functions, and only to read data. The API key stays on the server.

## How it was measured

10 questions, each sent once to Haiku 5.5 and once to Sonnet 5.5 (20 runs, about $0.08 in total). The questions were:

- 7 about our data: single county, seasonal, a scenario comparison, two counties, and a misspelt county ("Corkk");
- 1 that our data does not cover (sea level, since that tool does not exist yet);
- 1 asking for a weather forecast;
- 1 off-topic ("write me a poem about football").

The cost was worked out from the token counts the API returns and the list prices below. The time is wall-clock time for the whole loop, measured from our server, without streaming.

| Model | Input $/1M tokens | Output $/1M tokens |
|---|---|---|
| Claude Haiku 5.5 | 0.10 | 0.50 |
| Claude Sonnet 5.5 | 2.00 | 10.00 |

## Results

| | Haiku 5.5 | Sonnet 5.5 |
|---|---|---|
| Cost per data question | $0.0005–0.0008 | $0.008–0.012 |
| Cost per question, mean of all 10 | **$0.00046** | **$0.0078** |
| Time, median / max | **3.5 s / 4.5 s** | **4.6 s / 5.8 s** |
| Tokens per data question (in / out) | ~2,800 / ~500 | ~2,700 / ~400 |
| Numbers match the database | 7 / 7 | 7 / 7 |
| Says when data does not cover the question (sea level) | yes | yes |
| Declines the weather forecast and points to Met Éireann | yes | yes |
| Declines the off-topic question | **no, wrote the poem** | **no, wrote the poem** |
| Names the data source | rarely | usually ("Source: TRANSLATE") |

Example answer from Haiku, checked against the database: *"By 2050, Cork's annual mean temperature is projected to be about 0.9 °C warmer under RCP8.5 … Baseline: 1976–2005, 9.815 °C."*

### What we learned

1. **Accuracy is the same on both models.** Every number in every data answer came from the tool result. Both models said "projections, not forecasts", gave the baseline and the period, and picked the right period for "by 2050" (2021–2050). Sonnet formats answers a little better (tables) and names the source more often.
2. **Every data question used one API round trip too many.** Claude first called the tool with `"Cork"`, got "Unknown county" back (we look up the lowercase slug), then retried with `"cork"`. Making the lookup case-insensitive should cut each data question from 3 API calls to 2. That makes it roughly a third cheaper and about 1 s faster.
3. **The system prompt is not strict enough yet.** Both models wrote the football poem, and Haiku rarely names the source. CCD-347 requires both of these, so the system prompt (CCD-350) has to cover them explicitly.
4. **Returning all scenarios and periods in one call works well.** One tool result is about 1,000 tokens. Claude picked the right scenario and period itself, so the tool does not need `scenario` and `period` arguments.
5. **The misspelt county was fixed by Claude.** It read "Corkk" as Cork before calling the tool. When a slug really is wrong, the tool's error message lists the valid slugs, and Claude retries.
6. **Not measured yet:** time to the first streamed word (streaming comes in CCD-349) and quality on long conversations. Both are part of CCD-353.

## Decision: which model

**Use Claude Haiku 5.5 (`claude-haiku-5-5`) by default.**

- It was as accurate as Sonnet on our questions, about 1 s faster, and about 17 times cheaper.
- At $0.0005 per question, a $5 budget covers about 10,000 questions, which is far more than we need for the demo and testing.
- Put the model name in settings (`ASSISTANT_MODEL`, read from `.env`). If CCD-353 finds Haiku answers too weak, switch to `claude-sonnet-5-5` without a code change.

The same decision answers the "choose the LLM provider" step of the AI commentary story (CCD-198).

## Final tool list for Sprint 3 (CCD-348)

| Tool | Arguments | Returns | Why |
|---|---|---|---|
| `get_county_projection` | `county`, `variable`, `season` (default `annual`) | `ClimateSeriesSerializer`: every scenario and period, change from baseline, units, source | Built and tested in the spike. `scenario` and `period` arguments are not needed (finding 4) |
| `get_sea_level` | `county` | `SeaLevelSeriesSerializer`: every scenario, 2020–2100, cm, provenance | The serializer already exists. Answers the sea level question that failed in the spike |
| `rank_counties` | `variable`, `season`, `scenario`, `period`, `order`, `limit` | Counties ordered by change from baseline, with units and source | "Which county will warm the most?" would otherwise need 26 tool calls |

**Dropped: `list_metadata()`.** The tool schemas already list the valid variables, seasons and scenarios as `enum` values. The valid county slugs come back in the tool's error message, and they could also go in the system prompt (26 short names). A separate tool would only add a round trip.

All tools: case-insensitive county lookup, values returned with units and source, and invalid input returned as a readable error instead of an exception (as in the spike).

## Proposed changes to Sprint 3 subtasks

| Ticket | Change |
|---|---|
| CCD-348 Define assistant tools | Three tools instead of four, as in the table above. Remove `scenario`/`period` from `get_county_projection` and `scenario`/`year` from `get_sea_level`. Add "county lookup is case-insensitive" to the acceptance criteria |
| CCD-349 Chat endpoint | Add "model name read from settings (`ASSISTANT_MODEL`, default `claude-haiku-5-5`)" to the acceptance criteria |
| CCD-350 System prompt and guardrails | No change in scope. Add the spike's failures as test cases: the football poem must be declined, and every answer must name the source |
| CCD-351 Rate limiting | Suggested limit: about 20 questions per hour per IP. At Haiku prices, 100 users × 20 questions costs about $1 |
| CCD-353 Demo test questions | Start from the 10 spike questions above. Add multi-turn questions and measure time to the first streamed word |
| CCD-198 Commentary requirements | Step 4 (choose the provider) is answered by this note: Claude Haiku 5.5 |

No new tickets are needed.
