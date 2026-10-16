# WhatsApp Bot Baileys

WhatsApp Bot Base using Baileys with interactive buttons, mini web native flow, and plugin system.


## 🚀 How to Run

### 1. Prerequisites
- **Node.js**: Version 18 or later (`node -v`)
- **NPM**: Version 9 or later

### 2. Dependency Installation
```bash
npm install
```

### 3. `config.js` Configuration
Open the `config.js` file and adjust:
- `owner`: Your phone number (example: `['6282217590187']`)
- `authMode`: Select `'pairing'` (8-digit code) or `'qr'` (camera scan)
- `botNumber`: Bot number to receive pairing code (if pairing mode)

### 4. Run Bot
```bash
npm start
```
Or:
```bash
node index.js
```

---

## Collection of 12 Types of Native Flow Buttons

This bot implements all 12 official WhatsApp Native Flow v7 interactive button types:

1. Quick Reply (name: 'quick_reply'): Automatic quick reply button.
2. Open Webview (name: 'open_webview'): Automatic quick reply button.
3. **CTA Copy** (`name: 'cta_copy'`): 1-click button to copy the voucher code.
4. **CTA URL** (`name: 'cta_url'`): Opens the website link in an external browser.
5. **CTA Call** (`name: 'cta_call'`): Initiate a direct phone call.
6. **Send Location** (`name: 'send_location'`): Share GPS location coordinates.
7. **CTA Reminder** (`name: 'cta_reminder'`): Sets the event reminder schedule.
8. **Cancel Reminder** (`name: 'cta_cancel_reminder'`): Cancels the event reminder.
9. **Address Message** (`name: 'address_message'`): Interactive shipping address form.
10. **CTA Catalog** (`name: 'cta_catalog'`): Opens the WhatsApp store product showcase.
11. **Flows** (`name: 'flow'`): WhatsApp Flows v3 multi-step form.
12. **Single Select List** (`name: 'single_select'`): Category & row selection menu.

---


## 🧩   How to Add a New Plugin

Create a new file with the extension `.js` in the `plugins/` folder, for example `plugins/halo.js`:

```javascript
module.exports = {
  command: ['halo', 'hai'],
  tags: ['main'],
  help: ['halo'],
  description: 'Sapaan ramah',
  run: async (m, { sock, prefix }) => {
    await m.reply(`Halo *${m.pushName}*! 👋`);
  }
};
```
The plugin will automatically load without the need to restart the bot!
