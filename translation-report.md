# Translation Completeness Report

**Total missing translations: 14**

## basic (12 missing)

| Path | English Text | Suggestion |
|------|-------------|------------|
| `basic.ping_response` | Pong! | Pong! |
| `basic.ping_status` | Status | Status |
| `basic.hostname` | Hostname | Hostname |
| `basic.kernel` | Kernel | Kernel |
| `basic.paypal` | PayPal | PayPal |
| `basic.kofi` | Ko-fi | Ko-fi |
| `basic.patreon` | Patreon | Patreon |
| `basic.framework` | Framework | Framework |
| `basic.repository` | Repository | Repository |
| `basic.name` | Name | Name |
| `basic.nodejs` | Node.js | Node.js |
| `basic.cache` | Cache | Cache |

## reactions (1 missing)

| Path | English Text | Suggestion |
|------|-------------|------------|
| `reactions.categories.fastfurious` | Fast & Furious | Fast & Furious |

## user (1 missing)

| Path | English Text | Suggestion |
|------|-------------|------------|
| `user.level` | Level | Level |

## How to Add Missing Translations

1. Open `/src/translations/de.json`
2. Locate the appropriate section based on the path
3. Add the missing translation
4. Make sure to maintain proper JSON format

Example for `category.command_name`:
```json
{
  "category": {
    "command_name": "German translation here"
  }
}
```
