"""
Miro MCP client using the Streamable HTTP transport (MCP spec 2025-03-26).

Miro hosts the MCP server at https://mcp.miro.com/.
Authentication is via an OAuth Bearer token obtained through Miro's OAuth flow.

Transport protocol:
  1. POST `initialize`  → server replies with capabilities + optional Mcp-Session-Id header
  2. POST `notifications/initialized`  (no response body expected)
  3. POST `tools/call` with the desired tool name & arguments
"""
import httpx
from app.core.config import settings

_MCP_ENDPOINT = settings.MIRO_MCP_ENDPOINT
_PROTOCOL_VERSION = "2025-03-26"


class MiroMCPError(Exception):
    """Raised when the MCP server returns a JSON-RPC error."""
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"MCP error {code}: {message}")


async def call_tool(name: str, arguments: dict, access_token: str) -> dict:
    """
    Execute a single Miro MCP tool and return the result dict.

    Args:
        name:         MCP tool name, e.g. "diagram_create", "board_content_list"
        arguments:    Tool-specific arguments dict
        access_token: Miro OAuth access token for the user

    Returns:
        The `result` field from the JSON-RPC response.

    Raises:
        MiroMCPError:    If the server returns a JSON-RPC error object.
        httpx.HTTPError: For transport-level failures.
    """
    base_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        # Tell the server we can accept plain JSON (not SSE) for simple tool calls
        "Accept": "application/json, text/event-stream",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # ── Step 1: initialize ───────────────────────────────────────────────
        init_response = await client.post(
            _MCP_ENDPOINT,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": _PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {"name": "comply-backend", "version": "0.1.0"},
                },
            },
            headers=base_headers,
        )
        init_response.raise_for_status()

        # Capture the session ID if the server issued one
        session_id = init_response.headers.get("Mcp-Session-Id")
        if session_id:
            base_headers["Mcp-Session-Id"] = session_id

        init_data = init_response.json()
        if "error" in init_data:
            e = init_data["error"]
            raise MiroMCPError(e.get("code", -1), e.get("message", "initialize failed"))

        # ── Step 2: initialized notification (fire-and-forget) ───────────────
        await client.post(
            _MCP_ENDPOINT,
            json={
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
            },
            headers=base_headers,
        )

        # ── Step 3: tools/call ───────────────────────────────────────────────
        tool_response = await client.post(
            _MCP_ENDPOINT,
            json={
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": name,
                    "arguments": arguments,
                },
            },
            headers=base_headers,
        )
        tool_response.raise_for_status()

        data = tool_response.json()
        if "error" in data:
            e = data["error"]
            raise MiroMCPError(e.get("code", -1), e.get("message", "tool call failed"))

        return data.get("result", {})


async def list_tools(access_token: str) -> list[dict]:
    """
    Discover available tools on the Miro MCP server.

    Returns:
        List of tool definition dicts (name, description, inputSchema).
    """
    base_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        # initialize
        init_resp = await client.post(
            _MCP_ENDPOINT,
            json={
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": _PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {"name": "comply-backend", "version": "0.1.0"},
                },
            },
            headers=base_headers,
        )
        init_resp.raise_for_status()
        session_id = init_resp.headers.get("Mcp-Session-Id")
        if session_id:
            base_headers["Mcp-Session-Id"] = session_id

        # initialized notification
        await client.post(
            _MCP_ENDPOINT,
            json={"jsonrpc": "2.0", "method": "notifications/initialized"},
            headers=base_headers,
        )

        # tools/list
        list_resp = await client.post(
            _MCP_ENDPOINT,
            json={"jsonrpc": "2.0", "id": 3, "method": "tools/list"},
            headers=base_headers,
        )
        list_resp.raise_for_status()
        data = list_resp.json()
        if "error" in data:
            e = data["error"]
            raise MiroMCPError(e.get("code", -1), e.get("message", "tools/list failed"))

        return data.get("result", {}).get("tools", [])
