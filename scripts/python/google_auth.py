from google_auth_oauthlib.flow import InstalledAppFlow
import json
import os
import stat

SCOPES = ["https://www.googleapis.com/auth/drive"]

flow = InstalledAppFlow.from_client_secrets_file(
    "credentials.json",
    SCOPES
)

creds = flow.run_local_server(port=0)

token_info = {
    "token": creds.token,
    "refresh_token": creds.refresh_token,
    "token_uri": creds.token_uri,
    "client_id": creds.client_id,
    "client_secret": creds.client_secret,
    "scopes": creds.scopes
}

with open("token.json", "w") as f:
    json.dump(token_info, f, indent=2)

os.chmod("token.json", stat.S_IRUSR | stat.S_IWUSR)  # 0o600 — owner read/write only

print("token.json created successfully!")