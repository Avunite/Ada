# AI Tool Request Format Guide

Based on the analysis of the tool manager code, the AI should format tool requests in the OpenAI function calling format:

## Correct Format:

```json
{
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "follow",
        "arguments": "{\"username\":\"exampleuser\"}"
      }
    }
  ]
}
```

## Key Points:

1. **Use `tool_calls` array**, not `tool_call` object
2. **Use `function.arguments` as JSON string**, not `parameters` as object
3. **The `arguments` field must be a stringified JSON**, not a plain object
4. **Include proper `id` and `type` fields**

## New Username Support:

All user-related tools now support both `userId` and `username` parameters:

- `follow`: `{"username": "testuser"}` or `{"userId": "9358sgi0s7"}`
- `unfollow`: `{"username": "testuser"}` or `{"userId": "9358sgi0s7"}`
- `block`: `{"username": "testuser"}` or `{"userId": "9358sgi0s7"}`
- `unblock`: `{"username": "testuser"}` or `{"userId": "9358sgi0s7"}`
- `dm`: `{"username": "testuser", "message": "Hello!"}` or `{"userId": "9358sgi0s7", "message": "Hello!"}`
- `lookup_user`: `{"username": "testuser"}` or `{"userId": "9358sgi0s7"}`
- `search_barks`: `{"query": "test", "username": "testuser"}` or `{"query": "test", "userId": "9358sgi0s7"}`

The AI can now use usernames directly without needing to look up user IDs first, making the interaction much more natural.

## Example Tool Calls:

### Follow a user by username:
```json
{
  "tool_calls": [
    {
      "id": "call_follow_1",
      "type": "function", 
      "function": {
        "name": "follow",
        "arguments": "{\"username\":\"exampleuser\"}"
      }
    }
  ]
}
```

### Send a DM by username:
```json
{
  "tool_calls": [
    {
      "id": "call_dm_1",
      "type": "function",
      "function": {
        "name": "dm", 
        "arguments": "{\"username\":\"exampleuser\",\"message\":\"Hello there!\"}"
      }
    }
  ]
}
```

### Look up user info:
```json
{
  "tool_calls": [
    {
      "id": "call_lookup_1",
      "type": "function",
      "function": {
        "name": "lookup_user",
        "arguments": "{\"username\":\"exampleuser\"}"
      }
    }
  ]
}
```

### Search posts from a specific user:
```json
{
  "tool_calls": [
    {
      "id": "call_search_1", 
      "type": "function",
      "function": {
        "name": "search_barks",
        "arguments": "{\"query\":\"interesting topic\",\"username\":\"exampleuser\",\"limit\":5}"
      }
    }
  ]
}
```
