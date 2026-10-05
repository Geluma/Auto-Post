# Discord Multi-Account Auto Poster - User Manual & Guide

Welcome to **Discord Multi-Account Auto Poster**! This application allows you to manage multiple Discord accounts and automate scheduled postings across different Discord channels or via webhooks with anti-ban protections, Spintax variation, and rate-limit handling.

---

## 📑 Table of Contents
1. [Initial Login Credentials](#1-initial-login-credentials)
2. [How to Change Password & Username](#2-how-to-change-password--username)
3. [How to Add & Configure Discord Accounts](#3-how-to-add--configure-discord-accounts)
4. [How to Set Up Auto-Post Channels & Intervals](#4-how-to-set-up-auto-post-channels--intervals)
5. [Spintax & Dynamic Message Variables](#5-spintax--dynamic-message-variables)
6. [Starting, Stopping & Monitoring Activity](#6-starting-stopping--monitoring-activity)
7. [Running Standalone in Termux (Android) or Windows/VPS (Python)](#7-running-standalone-in-termux-android-or-windowsvps-python)
8. [Backup & Restore Configurations](#8-backup--restore-configurations)
9. [Troubleshooting & Error Codes](#9-troubleshooting--error-codes)

---

## 1. Initial Login Credentials

When opening the dashboard for the first time:

- **Username**: `admin`
- **Password**: `admin`

> ⚠️ **Important Security Note:** Change these credentials immediately after your first login to secure your dashboard.

---

## 2. How to Change Password & Username

You can change your credentials directly from the user interface:

1. Click the **Security Settings** (Shield icon 🛡️) button located in the top header.
2. In the modal, you will find:
   - **Current Password**: Enter your existing password (defaults to `admin`).
   - **New Username**: (Optional) Enter your preferred admin username.
   - **New Password**: Enter your desired new password (at least 4 characters).
   - **Confirm Password**: Re-type the new password.
3. Click **"Save New Password"**.
4. The system will securely hash and salt your new password using server-side PBKDF2/SHA-512 encryption (`auth.json`).

---

## 3. How to Add & Configure Discord Accounts

### Adding an Account:
1. Click the **"+ Add Account"** button in the header or in the search bar area.
2. An account card will appear.

### Configuring Account Details:
- **Account Name**: Give your account an identifier (e.g., `Main Seller`, `Alt Promo 2`).
- **Discord Token**: Paste your Discord User Authorization Token into the token field.
- **Check Token Button**: Click the refresh/check icon next to the token field to test connectivity. If valid, the card displays your Discord avatar and username (`@username`).
- **Webhook Integration (Optional)**:
  - Toggle the **Webhook** switch on.
  - Enter a Discord Webhook URL.
  - Whenever a message is posted or an error occurs, an embed notification will be automatically delivered to your monitoring Discord channel.
  - Use the **Test** button to verify the webhook.

---

## 4. How to Set Up Auto-Post Channels & Intervals

Each account can post to multiple channels simultaneously with independent schedules:

1. In the account card, click **"+ Add Channel"**.
2. Fill in:
   - **Channel Name**: Label for your reference (e.g., `#trade-chat`, `#general`).
   - **Channel ID**: The numerical Discord channel ID (e.g., `123456789012345678`).
     - *How to get Channel ID*: In Discord, enable **Developer Mode** (Settings > Advanced > Developer Mode), then right-click on the target channel and select **"Copy Channel ID"**.
   - **Message Box**: Enter the message you want to send. Click the small `✕` icon at the top right of the textarea to clear the text instantly.
   - **Interval (Hours / Minutes / Seconds)**: Set how frequently the message should be sent.
     - *Recommended minimum*: At least 1-2 minutes to prevent Discord spam detection.
   - **Enable / Disable Toggle**: Toggle the green checkbox on or off for individual channels.
   - **Test Button**: Click **"Test"** on a channel row to send a single one-off message immediately and confirm permission.

---

## 5. Spintax & Dynamic Message Variables

To avoid repetitive message detection and bans, the auto poster features a built-in text engine:

### 1. Spintax Format `{word1|word2|word3}`
The system randomly picks one variant every time it posts:
```
{Hello|Hey|Hi} everyone! {Check out|Visit} our new server!
```
*Outputs dynamically as:*
- `Hi everyone! Check out our new server!`
- `Hello everyone! Visit our new server!`
- `Hey everyone! Check out our new server!`

### 2. Built-in Variables
You can insert dynamic placeholders inside your messages:
- `{time}`: Current timestamp (e.g., `14:30:15`).
- `{date}`: Current date (e.g., `9/23/2026`).
- `{counter}`: Incremental post counter (e.g., `1`, `2`, `3`...).
- `{random_num}`: A random 4-digit number (e.g., `4821`).

### Example Combination:
```
{Good morning|Hello|Hey}! Daily update #{counter}. Time: {time} [ID: {random_num}]
```

---

## 6. Starting, Stopping & Monitoring Activity

- **Start Single Account**: Click the green **"▶ Start"** button on the account card.
- **Stop Single Account**: Click the red **"⏹ Stop"** button on the account card.
- **Start All Accounts**: Click **"Start All"** in the top navigation bar.
- **Stop All Accounts**: Click **"Stop All"** in the top navigation bar.
- **Live Logs**:
  - Click **"Logs"** (Terminal icon 📜) in the header.
  - Review real-time entries with color coding:
    - 🟢 **Success**: Message sent successfully.
    - 🔴 **Failed / Error**: Permission denied, token expired, or rate limited.
  - Filter logs by account, clear logs, or copy logs anytime.

---

## 7. Running Standalone in Termux (Android) or Windows/VPS (Python)

You do not need to keep your browser tab open! The app can export a complete, self-contained Python script configured with all your accounts and channels.

1. Click **"Python Script"** (Code icon 💻) in the top header.
2. Click **"Download auto_post_multi.py"**.

### Running on Android (Termux):
```bash
# 1. Update packages and install python + git
pkg update -y && pkg install python git -y

# 2. Install the requests library
pip install requests

# 3. Move the downloaded script to your Termux directory and run:
python auto_post_multi.py
```

### Running on Windows / Linux / VPS:
```bash
# 1. Install dependencies
pip install requests

# 2. Run the script
python auto_post_multi.py
```
The script runs multi-threaded; each account and channel runs in its own background thread with automatic rate-limit cooldown and error handling.

---

## 8. Backup & Restore Configurations

1. Click **"Backup & Restore"** (Database icon 💾) in the top header.
2. **Export Configuration**:
   - Click **"Export config_multi.json"** to download your current setup as a file.
   - Or click **"Copy to Clipboard"** to copy the raw JSON.
3. **Import Configuration**:
   - Paste a previously saved JSON configuration into the box.
   - Click **"Import & Apply"** to restore your accounts instantly.

---

## 9. Troubleshooting & Error Codes

| Error Message | Cause | Solution |
| :--- | :--- | :--- |
| **`401 Unauthorized`** | Invalid or expired Discord token. | Re-copy your user authorization token and validate it using the check button. |
| **`403 Forbidden`** | Account lacks permission to post in that channel. | Ensure the account has joined the server and has "Send Messages" permission in the channel. |
| **`404 Not Found`** | Channel ID doesn't exist or account is not in the server. | Verify the numerical Channel ID and check if the account is in the server. |
| **`429 Rate Limit`** | Discord rate limit reached. | The poster automatically handles this by waiting for the specified cooldown. Increase the interval to avoid repeated triggers. |
| **`Account Removed`** | Accidental deletion. | Restore your setup anytime using the **Backup & Restore** feature. |

---

*Discord Multi-Account Auto Poster - Built for high reliability, security, and flexible scheduling.*
