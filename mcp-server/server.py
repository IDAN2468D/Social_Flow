"""
SocialFlow MCP Server (Model Context Protocol)
Exposes the SocialFlow Social Network to AI Agents (Cursor, Claude, Antigravity, Agno).
"""

import sys
import httpx
from typing import List, Optional
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP Server
mcp = FastMCP("SocialFlow-MCP-Server")

GATEWAY_BASE = "http://localhost:8088"
DEFAULT_USER_HEADERS = {
    "Content-Type": "application/json",
    "X-Auth-UserId": "1",
    "X-Auth-Username": "idan"
}

@mcp.tool()
def get_feed(tab: str = "for-you", limit: int = 10) -> str:
    """
    Retrieves the latest posts and interactive polls from the SocialFlow social feed.
    Args:
        tab: Feed type ('for-you', 'trending', or 'following')
        limit: Maximum number of posts to retrieve (1-20)
    """
    url = f"{GATEWAY_BASE}/api/v1/feed/{tab}?userId=1&page=0&size={limit}"
    try:
        with httpx.Client(timeout=6.0) as client:
            res = client.get(url, headers=DEFAULT_USER_HEADERS)
            if res.status_code == 200:
                data = res.json()
                posts = data.get("content", []) if isinstance(data, dict) else data
                summary = []
                for p in posts[:limit]:
                    p_id = p.get("postId") or p.get("id")
                    author = p.get("authorUsername", "משתמש")
                    content = p.get("content", "")
                    tags = ", ".join(p.get("tags") or [])
                    has_poll = p.get("hasPoll", False)
                    summary.append(f"Post #{p_id} by @{author}: {content} [Tags: {tags}] [Poll: {has_poll}]")
                return "\n".join(summary) if summary else "No posts found in feed."
            return f"Error fetching feed: HTTP {res.status_code}"
    except Exception as e:
        return f"Failed to connect to SocialFlow API Gateway: {str(e)}"

@mcp.tool()
def create_post(content: str, tags: Optional[List[str]] = None, poll_question: Optional[str] = None, poll_options: Optional[List[str]] = None) -> str:
    """
    Publishes a new post or interactive poll to the SocialFlow social network.
    Args:
        content: The text content of the post.
        tags: Optional list of hashtags (without #).
        poll_question: Optional poll question to attach.
        poll_options: Optional list of 2 to 5 options for the poll.
    """
    url = f"{GATEWAY_BASE}/api/v1/posts"
    payload = {
        "content": content,
        "mediaUrls": [],
        "tags": tags or [],
        "visibility": "PUBLIC"
    }

    if poll_question and poll_options and len(poll_options) >= 2:
        payload["poll"] = {
            "question": poll_question,
            "options": poll_options,
            "durationHours": 24
        }
        if not content.strip():
            payload["content"] = poll_question

    try:
        with httpx.Client(timeout=8.0) as client:
            res = client.post(url, json=payload, headers=DEFAULT_USER_HEADERS)
            if res.status_code in (200, 201):
                post = res.json()
                return f"Post #{post.get('id')} published successfully! Author: @{post.get('authorUsername')}"
            return f"Failed to publish post: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"Error connecting to SocialFlow: {str(e)}"

@mcp.tool()
def vote_poll(post_id: int, option_id: int) -> str:
    """
    Casts a vote on an interactive poll in a SocialFlow post.
    Args:
        post_id: ID of the post containing the poll.
        option_id: ID of the chosen poll option.
    """
    url = f"{GATEWAY_BASE}/api/v1/posts/{post_id}/poll/vote?optionId={option_id}"
    try:
        with httpx.Client(timeout=6.0) as client:
            res = client.post(url, headers=DEFAULT_USER_HEADERS)
            if res.status_code == 200:
                poll = res.json()
                options_str = ", ".join([f"{o.get('text')}: {o.get('voteCount')} votes ({o.get('percentage')}%)" for o in poll.get("options", [])])
                return f"Vote recorded successfully on poll #{poll.get('id')} ('{poll.get('question')}'). Results: {options_str}"
            return f"Failed to vote: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def search_posts(query: str) -> str:
    """
    Searches SocialFlow posts, hashtags, and authors.
    Args:
        query: Search term or hashtag.
    """
    url = f"{GATEWAY_BASE}/api/v1/search?query={query}"
    try:
        with httpx.Client(timeout=6.0) as client:
            res = client.get(url, headers=DEFAULT_USER_HEADERS)
            if res.status_code == 200:
                data = res.json()
                posts = data.get("content", []) if isinstance(data, dict) else data
                return "\n".join([f"#{p.get('postId') or p.get('id')} by @{p.get('authorUsername')}: {p.get('content')}" for p in posts]) if posts else f"No matches found for '{query}'"
            return f"Search error: HTTP {res.status_code}"
    except Exception as e:
        return f"Error: {str(e)}"

@mcp.tool()
def ask_feed_ai(question: str) -> str:
    """
    Executes a RAG (Retrieval Augmented Generation) query over the live SocialFlow feed using Gemini 3.5 Flash-Lite.
    Args:
        question: Natural language question about what people are saying, posting, or trending on SocialFlow.
    """
    url = f"{GATEWAY_BASE}/api/v1/ai/ask-feed"
    try:
        with httpx.Client(timeout=15.0) as client:
            res = client.post(url, json={"question": question}, headers=DEFAULT_USER_HEADERS)
            if res.status_code == 200:
                data = res.json()
                return data.get("answer") or "No answer generated."
            return f"AI Service error: HTTP {res.status_code} - {res.text}"
    except Exception as e:
        return f"Error calling AI RAG service: {str(e)}"

@mcp.tool()
def system_health() -> str:
    """
    Checks the status and connectivity of all SocialFlow ecosystem microservices.
    """
    services = {
        "API Gateway": "http://localhost:8088/actuator/health",
        "AI Service (Gemini 3.5 Flash-Lite)": "http://localhost:8086/health",
        "Frontend Nginx": "http://localhost:3000"
    }
    report = []
    with httpx.Client(timeout=3.0) as client:
        for name, url in services.items():
            try:
                res = client.get(url)
                status = "UP (HTTP " + str(res.status_code) + ")" if res.status_code < 400 else "DEGRADED"
            except Exception:
                status = "DOWN"
            report.append(f"- {name}: {status}")
    return "\n".join(report)

if __name__ == "__main__":
    mcp.run()
