"""
Auto Post Discord Multi-Account
Compatible with Termux (Android) and Windows / Linux / VPS
Requirements: pip install requests
"""

import time
import threading
import json
import os
import requests

# Load config from config_multi.json if present, else fallback
CONFIG_FILE = "config_multi.json"
CONFIG = {"accounts": []}

if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            CONFIG = json.load(f)
    except Exception as e:
        print(f"Error loading {CONFIG_FILE}: {e}")

def parse_spintax(text):
    import re, random
    pattern = r'\{([^{}]+)\}'
    while re.search(pattern, text):
        text = re.sub(pattern, lambda m: random.choice(m.group(1).split('|')).strip(), text)
    return text

def process_variables(text, counter=1):
    import random
    text = parse_spintax(text)
    now = time.strftime("%H:%M:%S")
    date_str = time.strftime("%Y-%m-%d")
    random_num = str(random.randint(1000, 9999))
    text = text.replace("{time}", now)
    text = text.replace("{date}", date_str)
    text = text.replace("{counter}", str(counter))
    text = text.replace("{random_num}", random_num)
    return text

def send_webhook(webhook_url, account_name, channel_id, message, success, status_info):
    if not webhook_url:
        return
    now = time.strftime("%d %B %Y %I:%M:%S %p")
    embed = {
        "title": "🎁 Discord Auto Post (Multi-Account) 🎁",
        "description": f"> **Account: {account_name}**",
        "color": 65280 if success else 16711680,
        "fields": [
            {"name": "🟢 Status Log", "value": "> Success" if success else "> Failed", "inline": True},
            {"name": "📺 Channel Target", "value": f"> <#{channel_id}>", "inline": True},
            {"name": "🕓 Date & Time", "value": f"> {now}", "inline": False},
            {"name": "✅ Status Info", "value": f"> {status_info}", "inline": False},
            {"name": "💬 Message Sent", "value": f"```{message[:150]}```", "inline": False}
        ],
        "image": {
            "url": "https://cdn.discordapp.com/attachments/1222659397477097572/1226427380985126922/image.png"
        },
        "footer": {"text": "Discord Multi-Account Auto Poster"}
    }
    try:
        requests.post(webhook_url, json={"embeds": [embed]}, timeout=10)
    except Exception as e:
        print(f"[{account_name}] Webhook Error: {e}")

def post_channel_loop(account, channel):
    token = account.get("token", "").strip()
    channel_id = channel.get("channelId", "").strip()
    interval = max(5, int(channel.get("interval", 120)))
    raw_message = channel.get("message", "")
    account_name = account.get("name", "Unknown Account")

    print(f"[{account_name}] Started posting to channel {channel_id} every {interval}s")
    counter = 1

    while True:
        try:
            content = process_variables(raw_message, counter)
            url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
            headers = {
                "Authorization": token,
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
            res = requests.post(url, headers=headers, json={"content": content}, timeout=15)
            
            if res.status_code in [200, 201, 204]:
                print(f"[{account_name}] [SUCCESS] #{channel_id}: {content[:35]}...")
                if account.get("useWebhook"):
                    send_webhook(account.get("webhookUrl"), account_name, channel_id, content, True, f"HTTP {res.status_code} OK")
                counter += 1
            elif res.status_code == 429:
                retry_after = 5
                try:
                    retry_after = res.json().get("retry_after", 5)
                except:
                    pass
                print(f"[{account_name}] [RATE LIMIT 429] Waiting {retry_after}s...")
                time.sleep(float(retry_after))
                continue
            else:
                print(f"[{account_name}] [FAILED {res.status_code}] #{channel_id}: {res.text[:100]}")
                if account.get("useWebhook"):
                    send_webhook(account.get("webhookUrl"), account_name, channel_id, content, False, f"HTTP {res.status_code}: {res.text[:80]}")
        except Exception as e:
            print(f"[{account_name}] [ERROR] #{channel_id}: {e}")
        
        time.sleep(interval)

def main():
    print("==================================================")
    print("    Discord Multi-Account Auto Poster Bot")
    print("==================================================")

    accounts = CONFIG.get("accounts", [])
    if not accounts:
        print("[!] No accounts found in config. Please configure config_multi.json")
        return

    threads = []
    for account in accounts:
        token = account.get("token", "").strip()
        if not token:
            print(f"[-] Skipping {account.get('name', 'Account')} (No Token)")
            continue
        print(f"[+] Initializing {account.get('name')}...")
        for ch in account.get("channels", []):
            if ch.get("channelId") and ch.get("enabled", True):
                t = threading.Thread(target=post_channel_loop, args=(account, ch), daemon=True)
                t.start()
                threads.append(t)

    if not threads:
        print("[!] No active channels configured with channelId.")
        return

    print(f"\n[OK] Running {len(threads)} posting thread(s). Press CTRL+C to stop.\n")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nBot stopped by user.")

if __name__ == "__main__":
    main()
