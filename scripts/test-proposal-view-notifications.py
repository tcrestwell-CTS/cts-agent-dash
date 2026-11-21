"""Integration checks against explicitly seeded QA proposals, never real client links.

Requires LOVABLE_BROWSER_SUPABASE_SESSION_JSON and STORAGE_KEY for the advisor
owning the fixtures. Seed seven d8112026-1111/2222 fixtures (assigned, repeat,
approved, unsent, missing-send, already-viewed, unassigned) before running.
Remove fixtures and their 'Proposal View QA 20261121' alerts after the run.
No approvals, email sends, or payment calls are made by this test.
"""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

PREFIX = "Proposal View QA 20261121"
OUT = Path("/tmp/browser/proposal-notifications")


def token(number):
    return f"d8112026-2222-4222-8222-{number:012d}"


async def main():
    session_json = os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"]
    session = json.loads(session_json)
    key = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        advisor_context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        advisor = await advisor_context.new_page()
        await advisor.goto("http://localhost:8080")
        await advisor.evaluate("([k,v]) => localStorage.setItem(k,v)", [key, session_json])
        await advisor.goto("http://localhost:8080/notifications?filter=all")
        await advisor.get_by_role("heading", name="Notifications", exact=True).wait_for()

        public_context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        guest = await public_context.new_page()
        config = {}

        async def capture(request):
            if "/rest/v1/rpc/" in request.url:
                config["origin"] = request.url.split("/rest/v1/")[0]
                config["apikey"] = request.headers.get("apikey")

        guest.on("request", capture)
        await guest.goto(f"http://localhost:8080/proposal/{token(1)}")
        await guest.get_by_role("button", name="Approve this proposal").wait_for()
        for _ in range(50):
            if config.get("apikey"):
                break
            await asyncio.sleep(.1)
        assert config.get("apikey"), "Could not locate app public API configuration"

        async def count(scenario):
            response = await advisor_context.request.get(
                config["origin"] + "/rest/v1/agent_notifications",
                params={"select": "id,user_id,message", "type": "eq.proposal_viewed",
                        "message": f"like.{PREFIX} {scenario} viewed*"},
                headers={"apikey": config["apikey"], "Authorization": "Bearer " + session["access_token"]},
            )
            assert response.ok, "Could not read advisor's private notification inbox"
            rows = await response.json()
            assert all(row["user_id"] == session["user"]["id"] for row in rows)
            return len(rows)

        async def mark(number):
            response = await public_context.request.post(
                config["origin"] + "/rest/v1/rpc/mark_proposal_viewed",
                data={"p_token": token(number)},
                headers={"apikey": config["apikey"], "Content-Type": "application/json"},
            )
            assert response.ok, "Public proposal view request failed"

        for _ in range(50):
            if await count("assigned") == 1:
                break
            await asyncio.sleep(.1)
        assert await count("assigned") == 1, "First view must notify assigned advisor once"
        await guest.reload()
        await guest.get_by_role("button", name="Approve this proposal").wait_for()
        await asyncio.gather(*(mark(1) for _ in range(8)))
        assert await count("assigned") == 1, "Reload/concurrent views must not duplicate alerts"
        await asyncio.gather(*(mark(2) for _ in range(8)))
        assert await count("repeat") == 1, "Concurrent first views must create exactly one alert"
        for number, scenario in ((3,"approved"),(4,"unsent"),(5,"missing-send"),(6,"already-viewed")):
            await mark(number)
            assert await count(scenario) == 0, f"{scenario} must not create a new view alert"
        await mark(7)
        assert await count("unassigned") == 1, "Unassigned view must reach this admin inbox"

        await advisor.reload()
        alert = advisor.get_by_text(f"{PREFIX} assigned viewed the proposal for Test destination.", exact=True)
        await alert.wait_for()
        await advisor.screenshot(path=str(OUT / "advisor-inbox.png"))
        await alert.click()
        await advisor.wait_for_url("**/leads")
        await advisor.get_by_text(PREFIX, exact=False).first.wait_for()
        print("PASS: first view, refresh, concurrent views, assigned recipient, unassigned admin fallback,")
        print("approved/unsent/missing-send/already-viewed suppression, private inbox read and lead navigation.")
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())